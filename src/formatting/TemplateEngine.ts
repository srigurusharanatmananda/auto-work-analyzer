/**
 * A deliberately small Mustache-shaped template engine.
 *
 * Three constructs only: {{scalar}}, {{#section}}…{{/section}}, and
 * {{^section}}…{{/section}}. No arithmetic, no filters, no expressions, no
 * eval. If a template ever needs a computed value, add a named scalar to the
 * render context instead of growing the language.
 */

export interface AllowedSchema {
  scalars: string[];
  sections: Record<string, AllowedSchema>;
}

export class TemplateError extends Error {
  constructor(
    message: string,
    public readonly placeholder: string,
    public readonly valid: string[]
  ) {
    super(message);
    this.name = "TemplateError";
  }
}

type Node =
  | { kind: "text"; value: string }
  | { kind: "scalar"; name: string }
  | { kind: "section"; name: string; inverted: boolean; children: Node[] };

const TAG = /\{\{([#^/]?)\s*([\w.]+)\s*\}\}/g;

function parse(template: string): Node[] {
  const root: Node[] = [];
  const stack: Array<{ name: string; nodes: Node[]; inverted: boolean }> = [];
  let cursor = 0;

  const currentNodes = (): Node[] =>
    stack.length === 0 ? root : stack[stack.length - 1]!.nodes;

  TAG.lastIndex = 0;
  let match = TAG.exec(template);

  while (match !== null) {
    if (match.index > cursor) {
      currentNodes().push({ kind: "text", value: template.slice(cursor, match.index) });
    }

    const sigil = match[1];
    const name = match[2]!;

    if (sigil === "#" || sigil === "^") {
      stack.push({ name, nodes: [], inverted: sigil === "^" });
    } else if (sigil === "/") {
      const open = stack.pop();
      if (!open) {
        throw new TemplateError(`Closing tag {{/${name}}} has no matching opening tag`, name, []);
      }
      if (open.name !== name) {
        throw new TemplateError(
          `Closing tag {{/${name}}} does not match opening tag {{#${open.name}}}`,
          name,
          [open.name]
        );
      }
      currentNodes().push({ kind: "section", name, inverted: open.inverted, children: open.nodes });
    } else {
      currentNodes().push({ kind: "scalar", name });
    }

    cursor = match.index + match[0].length;
    match = TAG.exec(template);
  }

  if (stack.length > 0) {
    const unclosed = stack[stack.length - 1]!;
    throw new TemplateError(`Section {{#${unclosed.name}}} is never closed`, unclosed.name, []);
  }

  if (cursor < template.length) {
    root.push({ kind: "text", value: template.slice(cursor) });
  }

  return root;
}

function isEmpty(value: unknown): boolean {
  if (value === null || value === undefined || value === false || value === "") return true;
  if (Array.isArray(value)) return value.length === 0;
  return false;
}

function scalarToString(value: unknown): string {
  if (value === null || value === undefined || value === false) return "";
  return String(value);
}

function renderNodes(nodes: Node[], context: Record<string, unknown>, allowed: AllowedSchema): string {
  let out = "";

  for (const node of nodes) {
    if (node.kind === "text") {
      out += node.value;
      continue;
    }

    if (node.kind === "scalar") {
      // "." refers to the current element of a scalar array section.
      if (node.name === ".") {
        if (!allowed.scalars.includes(".")) {
          throw new TemplateError(`{{.}} is not valid here`, ".", allowed.scalars);
        }
        out += scalarToString(context["."]);
        continue;
      }
      if (!allowed.scalars.includes(node.name)) {
        throw new TemplateError(
          `Unknown placeholder {{${node.name}}}`,
          node.name,
          allowed.scalars
        );
      }
      out += scalarToString(context[node.name]);
      continue;
    }

    // Section. A section name may be either a declared section or, when used
    // as a truthy guard, a declared scalar.
    const childSchema = allowed.sections[node.name];
    const isScalarGuard = childSchema === undefined && allowed.scalars.includes(node.name);

    if (childSchema === undefined && !isScalarGuard) {
      throw new TemplateError(
        `Unknown section {{#${node.name}}}`,
        node.name,
        Object.keys(allowed.sections)
      );
    }

    const value = context[node.name];
    const empty = isEmpty(value);

    if (node.inverted) {
      if (empty) out += renderNodes(node.children, context, allowed);
      continue;
    }

    if (empty) continue;

    if (Array.isArray(value)) {
      const itemSchema = childSchema ?? allowed;
      for (const element of value) {
        const elementContext =
          element !== null && typeof element === "object"
            ? { ...context, ...(element as Record<string, unknown>) }
            : { ...context, ".": element };
        out += renderNodes(node.children, elementContext, itemSchema);
      }
      continue;
    }

    out += renderNodes(node.children, context, childSchema ?? allowed);
  }

  return out;
}

export function renderTemplate(
  template: string,
  context: Record<string, unknown>,
  allowed: AllowedSchema
): string {
  return renderNodes(parse(template), context, allowed);
}

/** Returns human-readable errors; empty array when the template is valid. */
export function validateTemplate(template: string, allowed: AllowedSchema): string[] {
  let nodes: Node[];
  try {
    nodes = parse(template);
  } catch (error) {
    return [error instanceof Error ? error.message : String(error)];
  }

  const errors: string[] = [];

  const walk = (list: Node[], schema: AllowedSchema): void => {
    for (const node of list) {
      if (node.kind === "scalar") {
        if (node.name === ".") {
          if (!schema.scalars.includes(".")) {
            errors.push(`{{.}} is not valid here`);
          }
        } else if (!schema.scalars.includes(node.name)) {
          errors.push(
            `Unknown placeholder {{${node.name}}}. Valid here: ${schema.scalars.join(", ")}`
          );
        }
      } else if (node.kind === "section") {
        const childSchema = schema.sections[node.name];
        if (childSchema === undefined) {
          if (schema.scalars.includes(node.name)) {
            walk(node.children, schema);
          } else {
            errors.push(
              `Unknown section {{#${node.name}}}. Valid sections here: ${Object.keys(schema.sections).join(", ")}`
            );
          }
        } else {
          walk(node.children, childSchema);
        }
      }
    }
  };

  walk(nodes, allowed);
  return errors;
}
