# Slice 1 — Canonical Pipeline and Templates Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Route every ClickUp task creation through one canonical `WorkItem` → template → renderer pipeline, so all three creation paths emit an identical, user-configurable format, and commit analysis can be exported as structured markdown.

**Architecture:** A canonical `WorkItem` domain type replaces three divergent ad-hoc task shapes. Sources (git, notes) produce `WorkItem[]`; a validated placeholder template engine drives two renderers (ClickUp payloads, structured markdown). Creation is only reachable through a renderer, so format consistency is structural rather than conventional.

**Tech Stack:** TypeScript (ESM, `NodeNext`-style `.js` import specifiers), Express 4, better-sqlite3, `bun test`, Next.js 14 App Router for the UI.

## Global Constraints

- **Spec:** `docs/superpowers/specs/2026-08-02-clickup-formatting-destinations-design.md`. Read it before starting.
- **Module system:** ESM. Every relative import MUST end in `.js` even when importing a `.ts` file (e.g. `import { WorkItem } from "../domain/WorkItem.js"`). This matches every existing file in `src/`.
- **Test files:** co-locate as `src/**/*.test.ts`. `tsconfig.json` already excludes `**/*.test.ts` from the build — do not change that.
- **Test runner:** `bun test`. Do not add jest, vitest, or ts-node.
- **No new runtime dependencies.** The template engine is hand-written; `fastest-levenshtein`, `better-sqlite3`, `express`, and `uuid` are already present.
- **No network in tests.** ClickUp is mocked at `fetch`.
- **`strictNullChecks` is `false`** in `tsconfig.json`. Do not enable it; do not write code that depends on it.
- **Backward compatibility:** `POST /api/notes` and `POST /api/create-tasks` MUST keep working with their current request shapes when the new optional fields are omitted.
- **Commit trailer:** every commit message in this plan ends with:
  ```
  Co-Authored-By: Claude Opus 5 (1M context) <noreply@anthropic.com>
  ```
  It is shown in full in Task 1 and abbreviated as `<trailer>` afterwards. Always include it.

---

## File Structure

| File | Responsibility |
| --- | --- |
| `src/domain/WorkItem.ts` | Canonical work-item type, label maps, fixture builder |
| `src/formatting/TemplateEngine.ts` | Parse, validate, and render `{{placeholder}}` templates |
| `src/formatting/renderContext.ts` | `WorkItem` → render context; the allowed-placeholder schema |
| `src/formatting/Template.ts` | `Template` / `TemplateOptions` types |
| `src/formatting/builtinTemplates.ts` | The three seeded read-only templates |
| `src/formatting/ClickUpRenderer.ts` | `WorkItem[]` + `Template` → `TaskData[]` |
| `src/formatting/MarkdownRenderer.ts` | `WorkItem[]` + `Template` → structured markdown |
| `src/sources/NotesWorkSource.ts` | Notes text → `WorkItem[]` |
| `src/sources/GitWorkSource.ts` | `WorkAnalysisResult` → `WorkItem[]` |
| `src/services/TemplateStore.ts` | `task_templates` table access + seeding |
| `src/routes/templates.routes.ts` | Template CRUD with save-time validation |
| `src/routes/tasks.routes.ts` | Preview, export-markdown, create-tasks, notes |
| `ui/app/settings/templates/page.tsx` | Template list + editor |
| `ui/components/TaskPreviewModal.tsx` | Gains a template picker (modify) |

---

### Task 1: Test infrastructure and the `WorkItem` domain type

**Files:**
- Create: `src/domain/WorkItem.ts`
- Create: `src/domain/WorkItem.test.ts`
- Modify: `package.json` (scripts block)

**Interfaces:**
- Consumes: `GitCommit` from `src/types/index.js` (already exists).
- Produces: `WorkItem`, `WorkItemType`, `WorkItemPriority`, `WorkItemProvenance`, `TYPE_LABELS`, `TYPE_EMOJI`, `PRIORITY_LABELS`, `ALL_WORK_ITEM_TYPES`, `ALL_WORK_ITEM_PRIORITIES`, `toWorkItemType(value)`, `toWorkItemPriority(value)`, and the test helper `makeWorkItem(overrides?: Partial<WorkItem>): WorkItem`. Every later task uses these — the narrowing helpers exist here so Task 6's two sources share one copy instead of each declaring their own type list.

- [ ] **Step 1: Add the test script**

In `package.json`, rename the existing smoke script and add the runner. The current `"test": "tsx src/test.ts"` is a manual config smoke check, not a unit test suite — it must keep working under a new name.

```json
"scripts": {
  "build": "tsc",
  "dev": "tsx src/index.ts",
  "start": "node dist/index.js",
  "analyze": "tsx src/cli.ts",
  "test": "bun test",
  "test:smoke": "tsx src/test.ts",
  "setup": "tsx src/setup.ts",
  "setup-admin": "tsx src/scripts/setup-admin.ts",
  "webhook": "tsx src/webhook-server.ts"
}
```

- [ ] **Step 2: Write the failing test**

Create `src/domain/WorkItem.test.ts`:

```ts
import { describe, expect, test } from "bun:test";
import {
  makeWorkItem,
  TYPE_LABELS,
  TYPE_EMOJI,
  PRIORITY_LABELS,
} from "./WorkItem.js";

describe("WorkItem", () => {
  test("makeWorkItem produces a valid default item", () => {
    const item = makeWorkItem();
    expect(item.title).toBe("Example work item");
    expect(item.type).toBe("feature");
    expect(item.priority).toBe("normal");
    expect(item.estimateHours).toBe(3);
    expect(item.provenance.source).toBe("git");
    expect(item.provenance.commits).toEqual([]);
    expect(item.tags).toEqual([]);
  });

  test("makeWorkItem applies overrides", () => {
    const item = makeWorkItem({ title: "Fix login", priority: "urgent" });
    expect(item.title).toBe("Fix login");
    expect(item.priority).toBe("urgent");
    expect(item.type).toBe("feature");
  });

  test("every type has a label and an emoji", () => {
    const types = Object.keys(TYPE_LABELS);
    expect(types).toContain("chore");
    expect(types).toContain("release");
    for (const type of types) {
      expect(TYPE_EMOJI[type as keyof typeof TYPE_EMOJI]).toBeTruthy();
    }
  });

  test("priority labels round-trip through NotesProcessor vocabulary", () => {
    expect(PRIORITY_LABELS.urgent).toBe("CRITICAL");
    expect(PRIORITY_LABELS.high).toBe("HIGH");
    expect(PRIORITY_LABELS.normal).toBe("MEDIUM");
    expect(PRIORITY_LABELS.low).toBe("LOW");
  });
});
```

The last test is load-bearing: `NotesProcessor.parseStructuredTasks` maps `CRITICAL`/`URGENT` → `urgent`, `HIGH` → `high`, `MEDIUM`/`NORMAL` → `normal`, `LOW` → `low`. If these labels drift, the markdown round-trip in Task 5 breaks.

- [ ] **Step 3: Run test to verify it fails**

Run: `bun test src/domain/WorkItem.test.ts`
Expected: FAIL — `Cannot find module './WorkItem.js'`

- [ ] **Step 4: Write the implementation**

Create `src/domain/WorkItem.ts`:

```ts
/**
 * The canonical unit of work.
 *
 * Every source produces WorkItem[]; every renderer consumes it. `description`
 * holds prose only — all structural formatting (type labels, emoji, commit
 * lists) belongs to templates, never to this type.
 */

import { GitCommit } from "../types/index.js";

export type WorkItemType =
  | "feature"
  | "bug-fix"
  | "improvement"
  | "refactor"
  | "documentation"
  | "test"
  | "chore"
  | "release";

export type WorkItemPriority = "urgent" | "high" | "normal" | "low";

export interface WorkItemProvenance {
  /** Empty for notes-sourced items. */
  commits: GitCommit[];
  files: string[];
  repository?: string;
  source: "git" | "notes" | "manual";
}

export interface WorkItem {
  title: string;
  /** Prose only. No markdown scaffolding. */
  description: string;
  type: WorkItemType;
  priority: WorkItemPriority;
  /** Normalized; mapped to a destination's real status at write time. */
  status?: string;
  estimateHours: number;
  /** ISO yyyy-mm-dd. */
  completedDate?: string;
  tags: string[];
  provenance: WorkItemProvenance;
  subitems?: WorkItem[];
}

export const TYPE_LABELS: Record<WorkItemType, string> = {
  feature: "New Feature",
  "bug-fix": "Bug Fix",
  improvement: "Improvement",
  refactor: "Refactoring",
  documentation: "Documentation",
  test: "Testing",
  chore: "Chore",
  release: "Release",
};

export const TYPE_EMOJI: Record<WorkItemType, string> = {
  feature: "✅",
  "bug-fix": "🐛",
  improvement: "🔧",
  refactor: "♻️",
  documentation: "📝",
  test: "🧪",
  chore: "🧹",
  release: "🚀",
};

/**
 * Uppercase labels used in the structured markdown format. These MUST stay
 * in the vocabulary NotesProcessor.parseStructuredTasks accepts, or the
 * markdown round-trip breaks.
 */
export const PRIORITY_LABELS: Record<WorkItemPriority, string> = {
  urgent: "CRITICAL",
  high: "HIGH",
  normal: "MEDIUM",
  low: "LOW",
};

export const ALL_WORK_ITEM_TYPES: WorkItemType[] = Object.keys(TYPE_LABELS) as WorkItemType[];

export const ALL_WORK_ITEM_PRIORITIES: WorkItemPriority[] = [
  "urgent",
  "high",
  "normal",
  "low",
];

/** Narrows an untrusted string to a WorkItemType, falling back to `improvement`. */
export function toWorkItemType(value: string | undefined): WorkItemType {
  return ALL_WORK_ITEM_TYPES.includes(value as WorkItemType)
    ? (value as WorkItemType)
    : "improvement";
}

/** Narrows an untrusted string to a WorkItemPriority, falling back to `normal`. */
export function toWorkItemPriority(value: string | undefined): WorkItemPriority {
  return ALL_WORK_ITEM_PRIORITIES.includes(value as WorkItemPriority)
    ? (value as WorkItemPriority)
    : "normal";
}

/** Test fixture builder. Not used by production code. */
export function makeWorkItem(overrides: Partial<WorkItem> = {}): WorkItem {
  return {
    title: "Example work item",
    description: "An example description.",
    type: "feature",
    priority: "normal",
    estimateHours: 3,
    tags: [],
    provenance: { commits: [], files: [], source: "git" },
    ...overrides,
  };
}
```

- [ ] **Step 5: Run test to verify it passes**

Run: `bun test src/domain/WorkItem.test.ts`
Expected: PASS, 4 tests.

- [ ] **Step 6: Verify the build still compiles**

Run: `bun run build`
Expected: exit 0, no errors. (Confirms the `*.test.ts` exclusion works.)

- [ ] **Step 7: Commit**

```bash
git add package.json src/domain/WorkItem.ts src/domain/WorkItem.test.ts
git commit -m "feat(domain): add canonical WorkItem type and bun test runner

Co-Authored-By: Claude Opus 5 (1M context) <noreply@anthropic.com>"
```

---

### Task 2: Template engine

**Files:**
- Create: `src/formatting/TemplateEngine.ts`
- Create: `src/formatting/TemplateEngine.test.ts`

**Interfaces:**
- Consumes: nothing from earlier tasks.
- Produces:
  - `interface AllowedSchema { scalars: string[]; sections: Record<string, AllowedSchema> }`
  - `class TemplateError extends Error { placeholder: string; valid: string[] }`
  - `function renderTemplate(template: string, context: Record<string, unknown>, allowed: AllowedSchema): string`
  - `function validateTemplate(template: string, allowed: AllowedSchema): string[]` — returns human-readable error strings, empty array when valid.

- [ ] **Step 1: Write the failing test**

Create `src/formatting/TemplateEngine.test.ts`:

```ts
import { describe, expect, test } from "bun:test";
import {
  renderTemplate,
  validateTemplate,
  TemplateError,
  AllowedSchema,
} from "./TemplateEngine.js";

const SCHEMA: AllowedSchema = {
  scalars: ["title", "priority"],
  sections: {
    commits: { scalars: ["shortHash", "message"], sections: {} },
    tags: { scalars: ["."], sections: {} },
  },
};

describe("renderTemplate", () => {
  test("substitutes scalars", () => {
    const out = renderTemplate("{{title}} [{{priority}}]", { title: "Fix login", priority: "HIGH" }, SCHEMA);
    expect(out).toBe("Fix login [HIGH]");
  });

  test("renders a section once per array element", () => {
    const out = renderTemplate(
      "{{#commits}}{{shortHash}} {{message}}\n{{/commits}}",
      { commits: [ { shortHash: "abc1234", message: "one" }, { shortHash: "def5678", message: "two" } ] },
      SCHEMA
    );
    expect(out).toBe("abc1234 one\ndef5678 two\n");
  });

  test("renders nothing for an empty array section", () => {
    expect(renderTemplate("A{{#commits}}X{{/commits}}B", { commits: [] }, SCHEMA)).toBe("AB");
  });

  test("a section over a truthy scalar acts as a guard", () => {
    expect(renderTemplate("{{#title}}has title{{/title}}", { title: "x" }, SCHEMA)).toBe("has title");
    expect(renderTemplate("{{#title}}has title{{/title}}", { title: "" }, SCHEMA)).toBe("");
  });

  test("inverted section renders only when falsy or empty", () => {
    expect(renderTemplate("{{^commits}}no commits{{/commits}}", { commits: [] }, SCHEMA)).toBe("no commits");
    expect(renderTemplate("{{^commits}}no commits{{/commits}}", { commits: [{}] }, SCHEMA)).toBe("");
  });

  test("{{.}} renders the current element of a scalar array", () => {
    expect(renderTemplate("{{#tags}}#{{.}} {{/tags}}", { tags: ["api", "auth"] }, SCHEMA)).toBe("#api #auth ");
  });

  test("a missing but allowed scalar renders as empty string", () => {
    expect(renderTemplate("[{{priority}}]", {}, SCHEMA)).toBe("[]");
  });

  test("an unknown placeholder throws TemplateError naming it", () => {
    expect(() => renderTemplate("{{nope}}", {}, SCHEMA)).toThrow(TemplateError);
    try {
      renderTemplate("{{nope}}", {}, SCHEMA);
    } catch (error) {
      const templateError = error as TemplateError;
      expect(templateError.placeholder).toBe("nope");
      expect(templateError.valid).toContain("title");
    }
  });

  test("an unclosed section throws", () => {
    expect(() => renderTemplate("{{#commits}}x", {}, SCHEMA)).toThrow(TemplateError);
  });

  test("a mismatched closing tag throws", () => {
    expect(() => renderTemplate("{{#commits}}x{{/tags}}", {}, SCHEMA)).toThrow(TemplateError);
  });

  test("braces inside substituted data are not re-interpreted", () => {
    const out = renderTemplate("{{title}}", { title: "fix {{priority}} parsing" }, SCHEMA);
    expect(out).toBe("fix {{priority}} parsing");
  });
});

describe("validateTemplate", () => {
  test("returns no errors for a valid template", () => {
    expect(validateTemplate("{{title}}{{#commits}}{{message}}{{/commits}}", SCHEMA)).toEqual([]);
  });

  test("reports an unknown scalar", () => {
    const errors = validateTemplate("{{bogus}}", SCHEMA);
    expect(errors.length).toBe(1);
    expect(errors[0]).toContain("bogus");
  });

  test("reports an unknown scalar inside a section", () => {
    const errors = validateTemplate("{{#commits}}{{author}}{{/commits}}", SCHEMA);
    expect(errors.length).toBe(1);
    expect(errors[0]).toContain("author");
  });

  test("reports an unknown section", () => {
    expect(validateTemplate("{{#nope}}x{{/nope}}", SCHEMA).length).toBe(1);
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `bun test src/formatting/TemplateEngine.test.ts`
Expected: FAIL — `Cannot find module './TemplateEngine.js'`

- [ ] **Step 3: Write the implementation**

Create `src/formatting/TemplateEngine.ts`:

```ts
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
```

- [ ] **Step 4: Run test to verify it passes**

Run: `bun test src/formatting/TemplateEngine.test.ts`
Expected: PASS, 15 tests.

- [ ] **Step 5: Commit**

```bash
git add src/formatting/TemplateEngine.ts src/formatting/TemplateEngine.test.ts
git commit -m "feat(formatting): add validated placeholder template engine

<trailer>"
```

---

### Task 3: Render context, `Template` type, and built-in templates

**Files:**
- Create: `src/formatting/Template.ts`
- Create: `src/formatting/renderContext.ts`
- Create: `src/formatting/renderContext.test.ts`
- Create: `src/formatting/builtinTemplates.ts`

**Interfaces:**
- Consumes: `WorkItem`, `TYPE_LABELS`, `TYPE_EMOJI`, `PRIORITY_LABELS` (Task 1); `AllowedSchema` (Task 2).
- Produces:
  - `interface TemplateOptions` and `interface Template` (`src/formatting/Template.ts`)
  - `const WORK_ITEM_SCHEMA: AllowedSchema` and `function buildRenderContext(item: WorkItem, meta?: RenderMeta): Record<string, unknown>` (`src/formatting/renderContext.ts`)
  - `const BUILTIN_TEMPLATES: Template[]` with stable ids `builtin-standard`, `builtin-terse`, `builtin-commit-log` (`src/formatting/builtinTemplates.ts`)

- [ ] **Step 1: Write the failing test**

Create `src/formatting/renderContext.test.ts`:

```ts
import { describe, expect, test } from "bun:test";
import { makeWorkItem } from "../domain/WorkItem.js";
import { buildRenderContext, WORK_ITEM_SCHEMA } from "./renderContext.js";
import { validateTemplate } from "./TemplateEngine.js";
import { BUILTIN_TEMPLATES } from "./builtinTemplates.js";

describe("buildRenderContext", () => {
  test("exposes labels derived from the work item", () => {
    const context = buildRenderContext(
      makeWorkItem({ type: "bug-fix", priority: "urgent", estimateHours: 4 })
    );
    expect(context.typeLabel).toBe("Bug Fix");
    expect(context.typeEmoji).toBe("🐛");
    expect(context.priorityLabel).toBe("CRITICAL");
    expect(context.estimateHours).toBe(4);
  });

  test("exposes commit fields including a short hash", () => {
    const item = makeWorkItem({
      provenance: {
        source: "git",
        files: ["a.ts", "b.ts"],
        commits: [
          {
            hash: "3b912cd0aa11bb22cc33",
            author: "dev@example.com",
            date: "2026-07-29",
            message: "fix(meditation): stabilize player layout",
            files: ["a.ts"],
            insertions: 10,
            deletions: 2,
          },
        ],
      },
    });
    const context = buildRenderContext(item);
    const commits = context.commits as Array<Record<string, unknown>>;
    expect(commits.length).toBe(1);
    expect(commits[0]!.shortHash).toBe("3b912cd");
    expect(commits[0]!.message).toBe("fix(meditation): stabilize player layout");
    expect(context.commitCount).toBe(1);
    expect(context.fileCount).toBe(2);
  });

  test("dateRange is empty when there are no commits", () => {
    expect(buildRenderContext(makeWorkItem()).dateRange).toBe("");
  });

  test("dateRange spans the earliest and latest commit dates", () => {
    const commit = (date: string, hash: string) => ({
      hash, author: "d", date, message: "m", files: [], insertions: 0, deletions: 0,
    });
    const context = buildRenderContext(
      makeWorkItem({
        provenance: {
          source: "git",
          files: [],
          commits: [commit("2026-07-29", "a"), commit("2026-07-12", "b")],
        },
      })
    );
    expect(context.dateRange).toBe("2026-07-12 → 2026-07-29");
  });

  test("a single commit date yields that date alone", () => {
    const context = buildRenderContext(
      makeWorkItem({
        provenance: {
          source: "git",
          files: [],
          commits: [{ hash: "a", author: "d", date: "2026-07-29", message: "m", files: [], insertions: 0, deletions: 0 }],
        },
      })
    );
    expect(context.dateRange).toBe("2026-07-29");
  });
});

describe("BUILTIN_TEMPLATES", () => {
  test("all built-ins validate against the work item schema", () => {
    expect(BUILTIN_TEMPLATES.length).toBe(3);
    for (const template of BUILTIN_TEMPLATES) {
      expect(validateTemplate(template.nameTemplate, WORK_ITEM_SCHEMA)).toEqual([]);
      expect(validateTemplate(template.descriptionTemplate, WORK_ITEM_SCHEMA)).toEqual([]);
      expect(template.isBuiltin).toBe(true);
    }
  });

  test("the standard template is the documented default", () => {
    const standard = BUILTIN_TEMPLATES.find((t) => t.id === "builtin-standard");
    expect(standard).toBeDefined();
    expect(standard!.nameTemplate).toBe("{{title}}");
    expect(standard!.options.dueDateSource).toBe("completedDate");
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `bun test src/formatting/renderContext.test.ts`
Expected: FAIL — `Cannot find module './renderContext.js'`

- [ ] **Step 3: Write `src/formatting/Template.ts`**

```ts
/** Decisions a template string cannot express. */
export interface TemplateOptions {
  emitSubtasks: boolean;
  applyPriority: boolean;
  applyTimeEstimate: boolean;
  dueDateSource: "completedDate" | "lastCommitDate" | "none";
  statusMode: "fromWorkItem" | "destinationDefault" | "fixed";
  /** Required when statusMode === "fixed". */
  fixedStatus?: string;
  tagStrategy: {
    mode: "fromWorkItem" | "none" | "fixed" | "merge";
    fixed?: string[];
  };
}

export interface Template {
  id: string;
  userId?: string;
  name: string;
  description?: string;
  nameTemplate: string;
  descriptionTemplate: string;
  options: TemplateOptions;
  isBuiltin: boolean;
}

export const DEFAULT_TEMPLATE_OPTIONS: TemplateOptions = {
  emitSubtasks: false,
  applyPriority: true,
  applyTimeEstimate: true,
  dueDateSource: "completedDate",
  statusMode: "fromWorkItem",
  tagStrategy: { mode: "fromWorkItem" },
};
```

- [ ] **Step 4: Write `src/formatting/renderContext.ts`**

```ts
/**
 * Turns a WorkItem into the flat context the template engine renders against,
 * and declares which placeholders are legal.
 */

import {
  PRIORITY_LABELS,
  TYPE_EMOJI,
  TYPE_LABELS,
  WorkItem,
} from "../domain/WorkItem.js";
import { AllowedSchema } from "./TemplateEngine.js";

export interface RenderMeta {
  repository?: string;
}

const COMMIT_SCALARS = [
  "hash",
  "shortHash",
  "date",
  "message",
  "author",
  "insertions",
  "deletions",
];

const SUBITEM_SCALARS = [
  "title",
  "description",
  "type",
  "typeLabel",
  "typeEmoji",
  "priority",
  "priorityLabel",
  "estimateHours",
  "status",
  "completedDate",
];

export const WORK_ITEM_SCHEMA: AllowedSchema = {
  scalars: [
    "title",
    "description",
    "type",
    "typeLabel",
    "typeEmoji",
    "priority",
    "priorityLabel",
    "estimateHours",
    "status",
    "completedDate",
    "repository",
    "source",
    "dateRange",
    "commitCount",
    "fileCount",
  ],
  sections: {
    commits: { scalars: COMMIT_SCALARS, sections: {} },
    files: { scalars: ["."], sections: {} },
    tags: { scalars: ["."], sections: {} },
    subitems: { scalars: SUBITEM_SCALARS, sections: {} },
  },
};

function formatDateRange(dates: string[]): string {
  if (dates.length === 0) return "";
  const sorted = [...dates].sort();
  const first = sorted[0]!;
  const last = sorted[sorted.length - 1]!;
  return first === last ? first : `${first} → ${last}`;
}

export function buildRenderContext(
  item: WorkItem,
  meta: RenderMeta = {}
): Record<string, unknown> {
  const commits = item.provenance.commits.map((commit) => ({
    hash: commit.hash,
    shortHash: commit.hash.slice(0, 7),
    date: commit.date,
    message: commit.message,
    author: commit.author,
    insertions: commit.insertions,
    deletions: commit.deletions,
  }));

  return {
    title: item.title,
    description: item.description,
    type: item.type,
    typeLabel: TYPE_LABELS[item.type],
    typeEmoji: TYPE_EMOJI[item.type],
    priority: item.priority,
    priorityLabel: PRIORITY_LABELS[item.priority],
    estimateHours: item.estimateHours,
    status: item.status ?? "",
    completedDate: item.completedDate ?? "",
    repository: item.provenance.repository ?? meta.repository ?? "",
    source: item.provenance.source,
    dateRange: formatDateRange(item.provenance.commits.map((c) => c.date)),
    commitCount: commits.length,
    fileCount: item.provenance.files.length,
    commits,
    files: item.provenance.files,
    tags: item.tags,
    subitems: (item.subitems ?? []).map((sub) => ({
      title: sub.title,
      description: sub.description,
      type: sub.type,
      typeLabel: TYPE_LABELS[sub.type],
      typeEmoji: TYPE_EMOJI[sub.type],
      priority: sub.priority,
      priorityLabel: PRIORITY_LABELS[sub.priority],
      estimateHours: sub.estimateHours,
      status: sub.status ?? "",
      completedDate: sub.completedDate ?? "",
    })),
  };
}
```

- [ ] **Step 5: Write `src/formatting/builtinTemplates.ts`**

```ts
import { DEFAULT_TEMPLATE_OPTIONS, Template } from "./Template.js";

/**
 * Seeded, read-only templates. The UI offers "Duplicate to edit" rather than
 * allowing these to be modified, so a user can always get back to a known-good
 * format.
 */
export const BUILTIN_TEMPLATES: Template[] = [
  {
    id: "builtin-standard",
    name: "Standard Work Report",
    description:
      "The default. Prose description followed by provenance. Matches the structured markdown report format.",
    nameTemplate: "{{title}}",
    descriptionTemplate: [
      "{{description}}",
      "",
      "**Type:** {{typeLabel}}  ",
      "**Estimate:** {{estimateHours}} hours  ",
      "{{#completedDate}}**Completed:** {{completedDate}}  {{/completedDate}}",
      "{{#dateRange}}**Commit range:** {{dateRange}}  {{/dateRange}}",
      "{{#commitCount}}**Commits:** {{commitCount}} across {{fileCount}} files{{/commitCount}}",
    ].join("\n"),
    options: { ...DEFAULT_TEMPLATE_OPTIONS },
    isBuiltin: true,
  },
  {
    id: "builtin-terse",
    name: "Terse",
    description: "Title and one-line description. No provenance.",
    nameTemplate: "{{title}}",
    descriptionTemplate: "{{description}}",
    options: {
      ...DEFAULT_TEMPLATE_OPTIONS,
      applyTimeEstimate: false,
      dueDateSource: "none",
      tagStrategy: { mode: "none" },
    },
    isBuiltin: true,
  },
  {
    id: "builtin-commit-log",
    name: "Commit Log",
    description:
      "Audit-heavy: appends every commit hash, date, and changed file to the description.",
    nameTemplate: "{{typeEmoji}} {{title}}",
    descriptionTemplate: [
      "{{description}}",
      "",
      "### Commits",
      "{{#commits}}- `{{shortHash}}` {{date}} — {{message}}",
      "{{/commits}}{{^commits}}_No commits recorded._",
      "{{/commits}}",
      "### Files changed",
      "{{#files}}- `{{.}}`",
      "{{/files}}{{^files}}_None recorded._",
      "{{/files}}",
    ].join("\n"),
    options: { ...DEFAULT_TEMPLATE_OPTIONS },
    isBuiltin: true,
  },
];
```

- [ ] **Step 6: Run test to verify it passes**

Run: `bun test src/formatting/renderContext.test.ts`
Expected: PASS, 7 tests.

- [ ] **Step 7: Commit**

```bash
git add src/formatting/Template.ts src/formatting/renderContext.ts src/formatting/renderContext.test.ts src/formatting/builtinTemplates.ts
git commit -m "feat(formatting): add render context, Template type, and built-in templates

<trailer>"
```

---

### Task 4: ClickUp renderer

**Files:**
- Create: `src/formatting/ClickUpRenderer.ts`
- Create: `src/formatting/ClickUpRenderer.test.ts`

**Interfaces:**
- Consumes: `WorkItem` (Task 1); `renderTemplate`, `WORK_ITEM_SCHEMA`, `buildRenderContext` (Tasks 2–3); `Template`, `TemplateOptions` (Task 3); `TaskData` from `src/types/index.js`.
- Produces:
  - `interface RenderedTask { task: TaskData; workItem: WorkItem }`
  - `function renderTasks(items: WorkItem[], template: Template, meta?: RenderMeta): RenderedTask[]`

- [ ] **Step 1: Write the failing test**

Create `src/formatting/ClickUpRenderer.test.ts`:

```ts
import { describe, expect, test } from "bun:test";
import { makeWorkItem } from "../domain/WorkItem.js";
import { renderTasks } from "./ClickUpRenderer.js";
import { BUILTIN_TEMPLATES } from "./builtinTemplates.js";
import { DEFAULT_TEMPLATE_OPTIONS, Template } from "./Template.js";

const template = (overrides: Partial<Template> = {}): Template => ({
  id: "t1",
  name: "Test",
  nameTemplate: "{{title}}",
  descriptionTemplate: "{{description}}",
  options: { ...DEFAULT_TEMPLATE_OPTIONS },
  isBuiltin: false,
  ...overrides,
});

describe("renderTasks", () => {
  test("renders name and description through the template", () => {
    const [rendered] = renderTasks(
      [makeWorkItem({ title: "Fix login", description: "Users were locked out." })],
      template({ nameTemplate: "{{typeEmoji}} {{title}}" })
    );
    expect(rendered!.task.name).toBe("✅ Fix login");
    expect(rendered!.task.description).toBe("Users were locked out.");
  });

  test("applyPriority false omits priority", () => {
    const [withPriority] = renderTasks([makeWorkItem({ priority: "urgent" })], template());
    expect(withPriority!.task.priority).toBe("urgent");

    const [without] = renderTasks(
      [makeWorkItem({ priority: "urgent" })],
      template({ options: { ...DEFAULT_TEMPLATE_OPTIONS, applyPriority: false } })
    );
    expect(without!.task.priority).toBeUndefined();
  });

  test("applyTimeEstimate converts hours to milliseconds", () => {
    const [rendered] = renderTasks([makeWorkItem({ estimateHours: 4 })], template());
    expect(rendered!.task.timeEstimate).toBe(4 * 60 * 60 * 1000);

    const [without] = renderTasks(
      [makeWorkItem({ estimateHours: 4 })],
      template({ options: { ...DEFAULT_TEMPLATE_OPTIONS, applyTimeEstimate: false } })
    );
    expect(without!.task.timeEstimate).toBeUndefined();
  });

  test("statusMode fromWorkItem passes the item status through", () => {
    const [rendered] = renderTasks([makeWorkItem({ status: "complete" })], template());
    expect(rendered!.task.status).toBe("complete");
  });

  test("statusMode destinationDefault omits status entirely", () => {
    const [rendered] = renderTasks(
      [makeWorkItem({ status: "complete" })],
      template({ options: { ...DEFAULT_TEMPLATE_OPTIONS, statusMode: "destinationDefault" } })
    );
    expect(rendered!.task.status).toBeUndefined();
  });

  test("statusMode fixed overrides the item status", () => {
    const [rendered] = renderTasks(
      [makeWorkItem({ status: "complete" })],
      template({
        options: { ...DEFAULT_TEMPLATE_OPTIONS, statusMode: "fixed", fixedStatus: "in review" },
      })
    );
    expect(rendered!.task.status).toBe("in review");
  });

  test("dueDateSource completedDate uses the completion date", () => {
    const [rendered] = renderTasks(
      [makeWorkItem({ completedDate: "2026-07-29" })],
      template()
    );
    expect(rendered!.task.dueDate).toBe("2026-07-29");
  });

  test("dueDateSource lastCommitDate uses the latest commit", () => {
    const commit = (date: string) => ({
      hash: date, author: "d", date, message: "m", files: [], insertions: 0, deletions: 0,
    });
    const [rendered] = renderTasks(
      [
        makeWorkItem({
          completedDate: "2026-01-01",
          provenance: { source: "git", files: [], commits: [commit("2026-07-12"), commit("2026-07-29")] },
        }),
      ],
      template({ options: { ...DEFAULT_TEMPLATE_OPTIONS, dueDateSource: "lastCommitDate" } })
    );
    expect(rendered!.task.dueDate).toBe("2026-07-29");
  });

  test("dueDateSource none omits the due date", () => {
    const [rendered] = renderTasks(
      [makeWorkItem({ completedDate: "2026-07-29" })],
      template({ options: { ...DEFAULT_TEMPLATE_OPTIONS, dueDateSource: "none" } })
    );
    expect(rendered!.task.dueDate).toBeUndefined();
  });

  test("tagStrategy none drops tags, fixed replaces them, merge unions them", () => {
    const item = makeWorkItem({ tags: ["api"] });

    const [none] = renderTasks(
      [item],
      template({ options: { ...DEFAULT_TEMPLATE_OPTIONS, tagStrategy: { mode: "none" } } })
    );
    expect(none!.task.tags).toEqual([]);

    const [fixed] = renderTasks(
      [item],
      template({
        options: { ...DEFAULT_TEMPLATE_OPTIONS, tagStrategy: { mode: "fixed", fixed: ["auto"] } },
      })
    );
    expect(fixed!.task.tags).toEqual(["auto"]);

    const [merged] = renderTasks(
      [item],
      template({
        options: { ...DEFAULT_TEMPLATE_OPTIONS, tagStrategy: { mode: "merge", fixed: ["auto", "api"] } },
      })
    );
    expect(merged!.task.tags!.sort()).toEqual(["api", "auto"]);
  });

  test("emitSubtasks controls whether subitems become subtasks", () => {
    const item = makeWorkItem({ subitems: [makeWorkItem({ title: "Sub" })] });

    const [without] = renderTasks([item], template());
    expect(without!.task.subtasks).toBeUndefined();

    const [withSubs] = renderTasks(
      [item],
      template({ options: { ...DEFAULT_TEMPLATE_OPTIONS, emitSubtasks: true } })
    );
    expect(withSubs!.task.subtasks!.length).toBe(1);
    expect(withSubs!.task.subtasks![0]!.name).toBe("Sub");
  });

  test("a task name longer than 500 characters is truncated", () => {
    const [rendered] = renderTasks([makeWorkItem({ title: "x".repeat(600) })], template());
    expect(rendered!.task.name.length).toBe(500);
  });

  test("every built-in template renders without throwing", () => {
    for (const builtin of BUILTIN_TEMPLATES) {
      const [rendered] = renderTasks([makeWorkItem()], builtin);
      expect(rendered!.task.name.length).toBeGreaterThan(0);
    }
  });
});
```

The truncation test matters: `ClickUpService.createTask` throws on names over 500 characters, and a template that interpolates a long field would otherwise fail the whole batch at the API boundary rather than at render time.

- [ ] **Step 2: Run test to verify it fails**

Run: `bun test src/formatting/ClickUpRenderer.test.ts`
Expected: FAIL — `Cannot find module './ClickUpRenderer.js'`

- [ ] **Step 3: Write the implementation**

Create `src/formatting/ClickUpRenderer.ts`:

```ts
import { WorkItem } from "../domain/WorkItem.js";
import { TaskData } from "../types/index.js";
import { buildRenderContext, RenderMeta, WORK_ITEM_SCHEMA } from "./renderContext.js";
import { Template } from "./Template.js";
import { renderTemplate } from "./TemplateEngine.js";

/** ClickUp rejects task names longer than this. */
const MAX_NAME_LENGTH = 500;

export interface RenderedTask {
  task: TaskData;
  workItem: WorkItem;
}

function resolveDueDate(item: WorkItem, template: Template): string | undefined {
  switch (template.options.dueDateSource) {
    case "completedDate":
      return item.completedDate;
    case "lastCommitDate": {
      const dates = item.provenance.commits.map((c) => c.date).sort();
      return dates.length > 0 ? dates[dates.length - 1] : undefined;
    }
    case "none":
    default:
      return undefined;
  }
}

function resolveStatus(item: WorkItem, template: Template): string | undefined {
  switch (template.options.statusMode) {
    case "fromWorkItem":
      return item.status;
    case "fixed":
      return template.options.fixedStatus;
    case "destinationDefault":
    default:
      return undefined;
  }
}

function resolveTags(item: WorkItem, template: Template): string[] {
  const strategy = template.options.tagStrategy;
  switch (strategy.mode) {
    case "none":
      return [];
    case "fixed":
      return [...(strategy.fixed ?? [])];
    case "merge":
      return Array.from(new Set([...item.tags, ...(strategy.fixed ?? [])]));
    case "fromWorkItem":
    default:
      return [...item.tags];
  }
}

function renderOne(item: WorkItem, template: Template, meta: RenderMeta): TaskData {
  const context = buildRenderContext(item, meta);
  const name = renderTemplate(template.nameTemplate, context, WORK_ITEM_SCHEMA).trim();
  const description = renderTemplate(template.descriptionTemplate, context, WORK_ITEM_SCHEMA).trim();

  const task: TaskData = {
    name: name.slice(0, MAX_NAME_LENGTH),
    description,
    tags: resolveTags(item, template),
  };

  if (template.options.applyPriority) task.priority = item.priority;
  if (template.options.applyTimeEstimate) {
    task.timeEstimate = Math.round(item.estimateHours * 60 * 60 * 1000);
  }

  const status = resolveStatus(item, template);
  if (status) task.status = status;

  const dueDate = resolveDueDate(item, template);
  if (dueDate) task.dueDate = dueDate;

  if (template.options.emitSubtasks && item.subitems && item.subitems.length > 0) {
    task.subtasks = item.subitems.map((sub) => {
      const { subtasks, ...rest } = renderOne(sub, template, meta);
      return rest;
    });
  }

  return task;
}

export function renderTasks(
  items: WorkItem[],
  template: Template,
  meta: RenderMeta = {}
): RenderedTask[] {
  return items.map((workItem) => ({
    workItem,
    task: renderOne(workItem, template, meta),
  }));
}
```

- [ ] **Step 4: Run test to verify it passes**

Run: `bun test src/formatting/ClickUpRenderer.test.ts`
Expected: PASS, 13 tests.

- [ ] **Step 5: Commit**

```bash
git add src/formatting/ClickUpRenderer.ts src/formatting/ClickUpRenderer.test.ts
git commit -m "feat(formatting): render WorkItems into ClickUp task payloads

<trailer>"
```

---

### Task 5: Markdown renderer and the round-trip guarantee

**Files:**
- Create: `src/formatting/MarkdownRenderer.ts`
- Create: `src/formatting/MarkdownRenderer.test.ts`

**Interfaces:**
- Consumes: `WorkItem`, `PRIORITY_LABELS` (Task 1); `Template` (Task 3); `renderTemplate`, `WORK_ITEM_SCHEMA`, `buildRenderContext` (Tasks 2–3); `NotesProcessor` from `src/services/NotesProcessor.js`.
- Produces: `function renderMarkdown(items: WorkItem[], template: Template, header?: MarkdownHeader, meta?: RenderMeta): string` and `interface MarkdownHeader { title?: string; period?: string }`.

This task carries the load-bearing test of the whole slice. The markdown emitted here must be re-parseable by the `NotesProcessor.parseStructuredTasks` path, which requires the text to contain `---` separators **and** match `/Task \d+(?:\.\d+)?:/i`.

Known and accepted lossiness: `NotesProcessor` re-derives `type` and `tags` from keywords rather than reading them back, so the round-trip test asserts equality on **title, priority, estimateHours, status, and completedDate only**. Do not attempt to make type/tags round-trip in this slice.

- [ ] **Step 1: Write the failing test**

Create `src/formatting/MarkdownRenderer.test.ts`:

```ts
import { describe, expect, test } from "bun:test";
import { makeWorkItem, WorkItem } from "../domain/WorkItem.js";
import { NotesProcessor } from "../services/NotesProcessor.js";
import { BUILTIN_TEMPLATES } from "./builtinTemplates.js";
import { renderMarkdown } from "./MarkdownRenderer.js";

const standard = BUILTIN_TEMPLATES.find((t) => t.id === "builtin-standard")!;

describe("renderMarkdown", () => {
  test("emits numbered task blocks separated by ---", () => {
    const md = renderMarkdown(
      [makeWorkItem({ title: "First" }), makeWorkItem({ title: "Second" })],
      standard
    );
    expect(md).toContain("Task 1: First");
    expect(md).toContain("Task 2: Second");
    expect(md.split("\n---\n").length).toBe(2);
  });

  test("emits the metadata fields NotesProcessor parses", () => {
    const md = renderMarkdown(
      [
        makeWorkItem({
          title: "Fix login",
          priority: "urgent",
          estimateHours: 4,
          status: "complete",
          completedDate: "2026-07-29",
        }),
      ],
      standard
    );
    expect(md).toContain("Priority: CRITICAL");
    expect(md).toContain("Estimate: 4 hours");
    expect(md).toContain("Status: complete");
    expect(md).toContain("Completed: 2026-07-29");
    expect(md).toContain("Description:");
  });

  test("omits Status and Completed lines when absent", () => {
    const md = renderMarkdown([makeWorkItem()], standard);
    expect(md).not.toContain("Status:");
    expect(md).not.toContain("Completed:");
  });

  test("includes an optional header without breaking the first task block", () => {
    const md = renderMarkdown([makeWorkItem({ title: "Only" })], standard, {
      title: "3-Week Report",
      period: "2026-07-10 → 2026-08-02",
    });
    expect(md.startsWith("# 3-Week Report")).toBe(true);
    expect(md).toContain("2026-07-10 → 2026-08-02");
    expect(md).toContain("Task 1: Only");
  });
});

describe("round trip through NotesProcessor", () => {
  const items: WorkItem[] = [
    makeWorkItem({
      title: "Fix login",
      description: "Users were locked out after an update.\nKeychain entry was invalidated.",
      priority: "urgent",
      estimateHours: 6,
      status: "complete",
      completedDate: "2026-07-30",
    }),
    makeWorkItem({
      title: "Add voice input to chat",
      description: "Voice and image input in the mobile composer.",
      priority: "high",
      estimateHours: 10,
      status: "complete",
      completedDate: "2026-07-19",
    }),
    makeWorkItem({
      title: "Document the release process",
      description: "Write the publish runbook.",
      priority: "low",
      estimateHours: 2,
    }),
  ];

  test("re-parsing rendered markdown recovers the parseable fields", async () => {
    const md = renderMarkdown(items, standard);
    const parsed = await new NotesProcessor().processNotes(md);

    expect(parsed.tasks.length).toBe(items.length);

    for (let index = 0; index < items.length; index += 1) {
      const original = items[index]!;
      const actual = parsed.tasks[index]! as unknown as {
        name: string;
        priority: string;
        estimatedHours: number;
        status?: string;
        completedDate?: string;
      };

      expect(actual.name).toBe(original.title);
      expect(actual.priority).toBe(original.priority);
      expect(actual.estimatedHours).toBe(original.estimateHours);
      expect(actual.status).toBe(original.status);
      expect(actual.completedDate).toBe(original.completedDate);
    }
  });

  test("the parsed description has no leftover label prefix", async () => {
    const md = renderMarkdown([items[0]!], standard);
    const parsed = await new NotesProcessor().processNotes(md);
    // Exact equality, not toContain: a "Description: " prefix leaking into the
    // parsed body is precisely the bug this guards.
    expect(parsed.tasks[0]!.description.startsWith("Description:")).toBe(false);
    expect(parsed.tasks[0]!.description).toContain("Users were locked out after an update.");
    expect(parsed.tasks[0]!.description).toContain("Keychain entry was invalidated.");
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `bun test src/formatting/MarkdownRenderer.test.ts`
Expected: FAIL — `Cannot find module './MarkdownRenderer.js'`

- [ ] **Step 3: Write the implementation**

Create `src/formatting/MarkdownRenderer.ts`:

```ts
/**
 * Renders WorkItems as the structured markdown format that
 * NotesProcessor.parseStructuredTasks consumes.
 *
 * The field order and labels here are a contract with that parser, not a
 * style choice. Description MUST come last, because the parser treats every
 * line after the recognised metadata keys as description text.
 */

import { PRIORITY_LABELS, WorkItem } from "../domain/WorkItem.js";
import { buildRenderContext, RenderMeta, WORK_ITEM_SCHEMA } from "./renderContext.js";
import { Template } from "./Template.js";
import { renderTemplate } from "./TemplateEngine.js";

export interface MarkdownHeader {
  title?: string;
  period?: string;
}

function renderBlock(
  item: WorkItem,
  index: number,
  template: Template,
  meta: RenderMeta
): string {
  const context = buildRenderContext(item, meta);
  const title = renderTemplate(template.nameTemplate, context, WORK_ITEM_SCHEMA).trim();
  const description = renderTemplate(
    template.descriptionTemplate,
    context,
    WORK_ITEM_SCHEMA
  ).trim();

  const lines: string[] = [];
  lines.push(`Task ${index + 1}: ${title}`);
  lines.push(`Priority: ${PRIORITY_LABELS[item.priority]}`);
  lines.push(`Estimate: ${item.estimateHours} hours`);
  if (item.status) lines.push(`Status: ${item.status}`);
  if (item.completedDate) lines.push(`Completed: ${item.completedDate}`);

  // The label goes on its own line and the body follows. NotesProcessor only
  // recognises a bare "Description:" as a label; "Description: text" falls
  // through to its catch-all branch and the literal prefix ends up inside the
  // parsed description.
  lines.push("Description:");
  lines.push(description);

  return lines.join("\n");
}

export function renderMarkdown(
  items: WorkItem[],
  template: Template,
  header: MarkdownHeader = {},
  meta: RenderMeta = {}
): string {
  const blocks = items.map((item, index) => renderBlock(item, index, template, meta));
  const body = blocks.join("\n\n---\n\n");

  if (!header.title && !header.period) return body;

  const preamble: string[] = [];
  if (header.title) preamble.push(`# ${header.title}`);
  if (header.period) preamble.push(`# Period: ${header.period}`);

  return `${preamble.join("\n")}\n\n${body}`;
}
```

Note the header uses `#` comment-style lines: `NotesProcessor` splits on `\n---\n`, and the preamble travels with the first block where it is skipped because it does not match a metadata key and precedes the `Task N:` title line, which the parser locates by search rather than by position.

- [ ] **Step 4: Run test to verify it passes**

Run: `bun test src/formatting/MarkdownRenderer.test.ts`
Expected: PASS, 6 tests.

If the round-trip test fails on `description`, check that `Description:` is the final key emitted and that no metadata line follows it.

- [ ] **Step 5: Run the whole suite**

Run: `bun test`
Expected: PASS, all tests from Tasks 1–5.

- [ ] **Step 6: Commit**

```bash
git add src/formatting/MarkdownRenderer.ts src/formatting/MarkdownRenderer.test.ts
git commit -m "feat(formatting): render structured markdown with NotesProcessor round-trip test

<trailer>"
```

---

### Task 6: Sources — notes and git produce `WorkItem[]`

**Files:**
- Create: `src/sources/NotesWorkSource.ts`
- Create: `src/sources/GitWorkSource.ts`
- Create: `src/sources/sources.test.ts`

**Interfaces:**
- Consumes: `WorkItem`, `WorkItemType`, `WorkItemPriority` (Task 1); `NotesProcessor` and `DetectedWork`/`WorkAnalysisResult` from existing code.
- Produces:
  - `async function workItemsFromNotes(notesText: string): Promise<WorkItem[]>`
  - `function workItemsFromAnalysis(analysis: WorkAnalysisResult, repository?: string): WorkItem[]`

- [ ] **Step 1: Write the failing test**

Create `src/sources/sources.test.ts`:

```ts
import { describe, expect, test } from "bun:test";
import { workItemsFromNotes } from "./NotesWorkSource.js";
import { workItemsFromAnalysis } from "./GitWorkSource.js";
import { WorkAnalysisResult } from "../types/index.js";

describe("workItemsFromNotes", () => {
  const notes = [
    "Task 1: Fix payment processing",
    "Priority: CRITICAL",
    "Estimate: 4 hours",
    "Status: complete",
    "Completed: 2026-07-30",
    "Description: Payments failed for certain card types.",
    "",
    "---",
    "",
    "Task 2: Write API documentation",
    "Priority: LOW",
    "Estimate: 2 hours",
    "Description: Document all REST endpoints.",
  ].join("\n");

  test("maps structured notes onto WorkItems", async () => {
    const items = await workItemsFromNotes(notes);
    expect(items.length).toBe(2);

    expect(items[0]!.title).toBe("Fix payment processing");
    expect(items[0]!.priority).toBe("urgent");
    expect(items[0]!.estimateHours).toBe(4);
    expect(items[0]!.status).toBe("complete");
    expect(items[0]!.completedDate).toBe("2026-07-30");
    expect(items[0]!.description).toBe("Payments failed for certain card types.");
    expect(items[0]!.provenance.source).toBe("notes");
    expect(items[0]!.provenance.commits).toEqual([]);
  });

  test("defaults priority to normal when the field is absent", async () => {
    const items = await workItemsFromNotes(
      "Task 1: Something\nEstimate: 1 hours\nDescription: Do it.\n\n---\n\nTask 2: Other\nDescription: Also.",
    );
    expect(items[0]!.priority).toBe("normal");
  });
});

describe("workItemsFromAnalysis", () => {
  const analysis: WorkAnalysisResult = {
    date: "2026-07-29",
    totalCommits: 2,
    totalFilesChanged: 3,
    totalLinesAdded: 100,
    totalLinesDeleted: 20,
    summary: "Two things happened.",
    detectedWork: [
      {
        type: "bug-fix",
        name: "Stabilize the meditation player layout",
        description: "The player jumped on rotation.",
        files: ["player.dart", "layout.dart"],
        complexity: "high",
        estimatedHours: 5,
        tags: ["mobile"],
        commits: [
          {
            hash: "3b912cd0aa",
            author: "dev@example.com",
            date: "2026-07-29",
            message: "fix(meditation): stabilize player layout",
            files: ["player.dart"],
            insertions: 40,
            deletions: 10,
          },
        ],
      },
    ],
  };

  test("maps detected work onto WorkItems with git provenance", () => {
    const items = workItemsFromAnalysis(analysis, "ask_nithyananda_app");
    expect(items.length).toBe(1);

    const item = items[0]!;
    expect(item.title).toBe("Stabilize the meditation player layout");
    expect(item.type).toBe("bug-fix");
    expect(item.estimateHours).toBe(5);
    expect(item.provenance.source).toBe("git");
    expect(item.provenance.repository).toBe("ask_nithyananda_app");
    expect(item.provenance.commits.length).toBe(1);
    expect(item.provenance.files).toEqual(["player.dart", "layout.dart"]);
  });

  test("derives priority from complexity when none is supplied", () => {
    expect(workItemsFromAnalysis(analysis)[0]!.priority).toBe("high");
  });

  test("derives completedDate from the latest commit", () => {
    expect(workItemsFromAnalysis(analysis)[0]!.completedDate).toBe("2026-07-29");
  });

  test("falls back to the analysis date when a work item has no commits", () => {
    const withoutCommits: WorkAnalysisResult = {
      ...analysis,
      detectedWork: [{ ...analysis.detectedWork[0]!, commits: [] }],
    };
    expect(workItemsFromAnalysis(withoutCommits)[0]!.completedDate).toBe("2026-07-29");
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `bun test src/sources/sources.test.ts`
Expected: FAIL — `Cannot find module './NotesWorkSource.js'`

- [ ] **Step 3: Write `src/sources/NotesWorkSource.ts`**

```ts
/**
 * Adapts NotesProcessor output onto the canonical WorkItem.
 *
 * NotesProcessor attaches priority/status/completedDate to its DetectedWork
 * results via an `as any` cast (they are not on the DetectedWork interface),
 * so this adapter reads them defensively.
 */

import { toWorkItemPriority, toWorkItemType, WorkItem } from "../domain/WorkItem.js";
import { NotesProcessor } from "../services/NotesProcessor.js";

interface LooseDetectedWork {
  type: string;
  name: string;
  description: string;
  files?: string[];
  estimatedHours?: number;
  complexity?: string;
  tags?: string[];
  priority?: string;
  status?: string;
  completedDate?: string;
}

export async function workItemsFromNotes(notesText: string): Promise<WorkItem[]> {
  const processed = await new NotesProcessor().processNotes(notesText);

  return processed.tasks.map((task) => {
    const loose = task as unknown as LooseDetectedWork;
    return {
      title: loose.name,
      description: loose.description ?? "",
      type: toWorkItemType(loose.type),
      priority: toWorkItemPriority(loose.priority),
      status: loose.status,
      estimateHours: loose.estimatedHours ?? 3,
      completedDate: loose.completedDate,
      tags: loose.tags ?? [],
      provenance: {
        commits: [],
        files: loose.files ?? [],
        source: "notes",
      },
    };
  });
}
```

- [ ] **Step 4: Write `src/sources/GitWorkSource.ts`**

```ts
/** Adapts a WorkAnalysisResult onto canonical WorkItems. */

import { toWorkItemType, WorkItem, WorkItemPriority } from "../domain/WorkItem.js";
import { WorkAnalysisResult } from "../types/index.js";

function priorityFromComplexity(complexity: string): WorkItemPriority {
  if (complexity === "high") return "high";
  if (complexity === "medium") return "normal";
  return "low";
}

export function workItemsFromAnalysis(
  analysis: WorkAnalysisResult,
  repository?: string
): WorkItem[] {
  return analysis.detectedWork.map((work) => {
    const loose = work as unknown as { priority?: WorkItemPriority; status?: string };
    const dates = work.commits.map((commit) => commit.date).sort();
    const completedDate = dates.length > 0 ? dates[dates.length - 1] : analysis.date;

    return {
      title: work.name,
      description: work.description,
      type: toWorkItemType(work.type),
      priority: loose.priority ?? priorityFromComplexity(work.complexity),
      status: loose.status,
      estimateHours: work.estimatedHours,
      completedDate,
      tags: work.tags ?? [],
      provenance: {
        commits: work.commits,
        files: work.files ?? [],
        repository,
        source: "git",
      },
    };
  });
}
```

- [ ] **Step 5: Run test to verify it passes**

Run: `bun test src/sources/sources.test.ts`
Expected: PASS, 6 tests.

- [ ] **Step 6: Commit**

```bash
git add src/sources/
git commit -m "feat(sources): adapt notes and git analysis onto canonical WorkItems

<trailer>"
```

---

### Task 7: Template persistence and CRUD API

**Files:**
- Create: `src/services/TemplateStore.ts`
- Create: `src/services/TemplateStore.test.ts`
- Create: `src/routes/templates.routes.ts`
- Modify: `src/webhook-server.ts` (mount the router)

**Interfaces:**
- Consumes: `Template`, `TemplateOptions`, `DEFAULT_TEMPLATE_OPTIONS` (Task 3); `BUILTIN_TEMPLATES` (Task 3); `validateTemplate`, `WORK_ITEM_SCHEMA` (Tasks 2–3); `authenticate` from `src/middleware/auth.middleware.js`.
- Produces: `class TemplateStore` with `constructor(dbPath: string)`, `list(userId: string): Template[]`, `get(id: string): Template | null`, `create(userId, input): Template`, `update(id, userId, input): Template`, `remove(id, userId): void`, `close(): void`. Slice 2 consumes `get` for `default_template_id` resolution.
- Also produces the routes `GET/POST/PUT/DELETE /api/templates[/:id]` and `POST /api/templates/preview` (renders an unsaved template against a fixture so the editor can show live output).

- [ ] **Step 1: Write the failing test**

Create `src/services/TemplateStore.test.ts`:

```ts
import { afterEach, beforeEach, describe, expect, test } from "bun:test";
import { existsSync, mkdtempSync, rmSync } from "fs";
import { tmpdir } from "os";
import { join } from "path";
import { TemplateStore } from "./TemplateStore.js";
import { DEFAULT_TEMPLATE_OPTIONS } from "../formatting/Template.js";

let dir: string;
let store: TemplateStore;

beforeEach(() => {
  dir = mkdtempSync(join(tmpdir(), "awa-templates-"));
  store = new TemplateStore(join(dir, "test.db"));
});

afterEach(() => {
  store.close();
  if (existsSync(dir)) rmSync(dir, { recursive: true, force: true });
});

describe("TemplateStore", () => {
  test("seeds the built-in templates on first open", () => {
    const templates = store.list("user-1");
    const builtins = templates.filter((t) => t.isBuiltin);
    expect(builtins.length).toBe(3);
    expect(builtins.map((t) => t.id).sort()).toEqual([
      "builtin-commit-log",
      "builtin-standard",
      "builtin-terse",
    ]);
  });

  test("seeding is idempotent across reopens", () => {
    store.close();
    const reopened = new TemplateStore(join(dir, "test.db"));
    expect(reopened.list("user-1").filter((t) => t.isBuiltin).length).toBe(3);
    reopened.close();
  });

  test("creates and reads back a user template", () => {
    const created = store.create("user-1", {
      name: "Mine",
      nameTemplate: "{{title}}",
      descriptionTemplate: "{{description}}",
      options: { ...DEFAULT_TEMPLATE_OPTIONS },
    });
    expect(created.id).toBeTruthy();
    expect(created.isBuiltin).toBe(false);

    const fetched = store.get(created.id);
    expect(fetched!.name).toBe("Mine");
    expect(fetched!.options.dueDateSource).toBe("completedDate");
  });

  test("list returns built-ins plus only the caller's templates", () => {
    store.create("user-1", {
      name: "Mine", nameTemplate: "{{title}}", descriptionTemplate: "x",
      options: { ...DEFAULT_TEMPLATE_OPTIONS },
    });
    store.create("user-2", {
      name: "Theirs", nameTemplate: "{{title}}", descriptionTemplate: "x",
      options: { ...DEFAULT_TEMPLATE_OPTIONS },
    });

    const names = store.list("user-1").map((t) => t.name);
    expect(names).toContain("Mine");
    expect(names).not.toContain("Theirs");
  });

  test("update changes a user template", () => {
    const created = store.create("user-1", {
      name: "Mine", nameTemplate: "{{title}}", descriptionTemplate: "x",
      options: { ...DEFAULT_TEMPLATE_OPTIONS },
    });
    const updated = store.update(created.id, "user-1", { name: "Renamed" });
    expect(updated.name).toBe("Renamed");
    expect(updated.nameTemplate).toBe("{{title}}");
  });

  test("update refuses to modify a built-in", () => {
    expect(() => store.update("builtin-standard", "user-1", { name: "Hacked" })).toThrow(
      /built-in/i
    );
  });

  test("update refuses to modify another user's template", () => {
    const created = store.create("user-2", {
      name: "Theirs", nameTemplate: "{{title}}", descriptionTemplate: "x",
      options: { ...DEFAULT_TEMPLATE_OPTIONS },
    });
    expect(() => store.update(created.id, "user-1", { name: "Stolen" })).toThrow(/not found/i);
  });

  test("remove deletes a user template but refuses built-ins", () => {
    const created = store.create("user-1", {
      name: "Mine", nameTemplate: "{{title}}", descriptionTemplate: "x",
      options: { ...DEFAULT_TEMPLATE_OPTIONS },
    });
    store.remove(created.id, "user-1");
    expect(store.get(created.id)).toBeNull();
    expect(() => store.remove("builtin-standard", "user-1")).toThrow(/built-in/i);
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `bun test src/services/TemplateStore.test.ts`
Expected: FAIL — `Cannot find module './TemplateStore.js'`

- [ ] **Step 3: Write `src/services/TemplateStore.ts`**

```ts
import Database from "better-sqlite3";
import { randomUUID } from "crypto";
import { BUILTIN_TEMPLATES } from "../formatting/builtinTemplates.js";
import { DEFAULT_TEMPLATE_OPTIONS, Template, TemplateOptions } from "../formatting/Template.js";

export interface TemplateInput {
  name: string;
  description?: string;
  nameTemplate: string;
  descriptionTemplate: string;
  options: TemplateOptions;
}

interface Row {
  id: string;
  user_id: string | null;
  name: string;
  description: string | null;
  name_template: string;
  description_template: string;
  options: string;
  is_builtin: number;
}

function toTemplate(row: Row): Template {
  return {
    id: row.id,
    userId: row.user_id ?? undefined,
    name: row.name,
    description: row.description ?? undefined,
    nameTemplate: row.name_template,
    descriptionTemplate: row.description_template,
    options: { ...DEFAULT_TEMPLATE_OPTIONS, ...JSON.parse(row.options) },
    isBuiltin: row.is_builtin === 1,
  };
}

export class TemplateStore {
  private db: Database.Database;

  constructor(dbPath: string) {
    this.db = new Database(dbPath);
    this.db.pragma("journal_mode = WAL");
    this.initializeSchema();
    this.seedBuiltins();
  }

  private initializeSchema(): void {
    this.db.exec(`
      CREATE TABLE IF NOT EXISTS task_templates (
        id TEXT PRIMARY KEY,
        user_id TEXT,
        name TEXT NOT NULL,
        description TEXT,
        name_template TEXT NOT NULL,
        description_template TEXT NOT NULL,
        options TEXT NOT NULL,
        is_builtin INTEGER NOT NULL DEFAULT 0,
        created_at TEXT NOT NULL,
        updated_at TEXT NOT NULL
      );
      CREATE INDEX IF NOT EXISTS idx_templates_user ON task_templates(user_id);
    `);
  }

  private seedBuiltins(): void {
    const now = new Date().toISOString();
    const insert = this.db.prepare(`
      INSERT INTO task_templates
        (id, user_id, name, description, name_template, description_template, options, is_builtin, created_at, updated_at)
      VALUES (?, NULL, ?, ?, ?, ?, ?, 1, ?, ?)
      ON CONFLICT(id) DO UPDATE SET
        name = excluded.name,
        description = excluded.description,
        name_template = excluded.name_template,
        description_template = excluded.description_template,
        options = excluded.options,
        updated_at = excluded.updated_at
    `);

    const seed = this.db.transaction(() => {
      for (const template of BUILTIN_TEMPLATES) {
        insert.run(
          template.id,
          template.name,
          template.description ?? null,
          template.nameTemplate,
          template.descriptionTemplate,
          JSON.stringify(template.options),
          now,
          now
        );
      }
    });

    seed();
  }

  list(userId: string): Template[] {
    const rows = this.db
      .prepare(
        `SELECT * FROM task_templates
         WHERE is_builtin = 1 OR user_id = ?
         ORDER BY is_builtin DESC, name ASC`
      )
      .all(userId) as Row[];
    return rows.map(toTemplate);
  }

  get(id: string): Template | null {
    const row = this.db.prepare(`SELECT * FROM task_templates WHERE id = ?`).get(id) as
      | Row
      | undefined;
    return row ? toTemplate(row) : null;
  }

  create(userId: string, input: TemplateInput): Template {
    const id = randomUUID();
    const now = new Date().toISOString();
    this.db
      .prepare(
        `INSERT INTO task_templates
           (id, user_id, name, description, name_template, description_template, options, is_builtin, created_at, updated_at)
         VALUES (?, ?, ?, ?, ?, ?, ?, 0, ?, ?)`
      )
      .run(
        id,
        userId,
        input.name,
        input.description ?? null,
        input.nameTemplate,
        input.descriptionTemplate,
        JSON.stringify(input.options),
        now,
        now
      );
    return this.get(id)!;
  }

  update(id: string, userId: string, input: Partial<TemplateInput>): Template {
    const existing = this.get(id);
    if (existing && existing.isBuiltin) {
      throw new Error("Cannot modify a built-in template. Duplicate it first.");
    }
    if (!existing || existing.userId !== userId) {
      throw new Error("Template not found");
    }

    const merged = {
      name: input.name ?? existing.name,
      description: input.description ?? existing.description ?? null,
      nameTemplate: input.nameTemplate ?? existing.nameTemplate,
      descriptionTemplate: input.descriptionTemplate ?? existing.descriptionTemplate,
      options: input.options ?? existing.options,
    };

    this.db
      .prepare(
        `UPDATE task_templates
           SET name = ?, description = ?, name_template = ?, description_template = ?, options = ?, updated_at = ?
         WHERE id = ? AND user_id = ?`
      )
      .run(
        merged.name,
        merged.description,
        merged.nameTemplate,
        merged.descriptionTemplate,
        JSON.stringify(merged.options),
        new Date().toISOString(),
        id,
        userId
      );

    return this.get(id)!;
  }

  remove(id: string, userId: string): void {
    const existing = this.get(id);
    if (existing && existing.isBuiltin) {
      throw new Error("Cannot delete a built-in template");
    }
    if (!existing || existing.userId !== userId) {
      throw new Error("Template not found");
    }
    this.db.prepare(`DELETE FROM task_templates WHERE id = ? AND user_id = ?`).run(id, userId);
  }

  close(): void {
    this.db.close();
  }
}
```

- [ ] **Step 4: Run test to verify it passes**

Run: `bun test src/services/TemplateStore.test.ts`
Expected: PASS, 8 tests.

- [ ] **Step 5: Write the routes**

Create `src/routes/templates.routes.ts`. Note the `authenticate` middleware attaches the user; read the id the same way the existing `src/routes/auth.routes.ts` does — inspect that file and match its accessor exactly rather than guessing.

```ts
import { Router } from "express";
import { authenticate } from "../middleware/auth.middleware.js";
import { TemplateStore } from "../services/TemplateStore.js";
import { DEFAULT_TEMPLATE_OPTIONS, TemplateOptions } from "../formatting/Template.js";
import { validateTemplate } from "../formatting/TemplateEngine.js";
import { WORK_ITEM_SCHEMA } from "../formatting/renderContext.js";

export function createTemplatesRouter(store: TemplateStore): Router {
  const router = Router();

  const userIdOf = (req: any): string => req.user?.id ?? req.user?.userId;

  const validateBody = (body: any): string[] => {
    const errors: string[] = [];
    if (!body.name || String(body.name).trim().length === 0) {
      errors.push("name is required");
    }
    if (typeof body.nameTemplate !== "string" || body.nameTemplate.trim().length === 0) {
      errors.push("nameTemplate is required");
    } else {
      errors.push(...validateTemplate(body.nameTemplate, WORK_ITEM_SCHEMA));
    }
    if (typeof body.descriptionTemplate !== "string") {
      errors.push("descriptionTemplate is required");
    } else {
      errors.push(...validateTemplate(body.descriptionTemplate, WORK_ITEM_SCHEMA));
    }
    return errors;
  };

  const optionsOf = (body: any): TemplateOptions => ({
    ...DEFAULT_TEMPLATE_OPTIONS,
    ...(body.options ?? {}),
  });

  router.get("/", authenticate, (req, res) => {
    res.json({ success: true, data: store.list(userIdOf(req)) });
  });

  router.post("/", authenticate, (req, res) => {
    const errors = validateBody(req.body);
    if (errors.length > 0) {
      res.status(400).json({ success: false, error: "Invalid template", details: errors });
      return;
    }
    const created = store.create(userIdOf(req), {
      name: req.body.name,
      description: req.body.description,
      nameTemplate: req.body.nameTemplate,
      descriptionTemplate: req.body.descriptionTemplate,
      options: optionsOf(req.body),
    });
    res.status(201).json({ success: true, data: created });
  });

  router.put("/:id", authenticate, (req, res) => {
    const errors = validateBody(req.body);
    if (errors.length > 0) {
      res.status(400).json({ success: false, error: "Invalid template", details: errors });
      return;
    }
    try {
      const updated = store.update(req.params.id!, userIdOf(req), {
        name: req.body.name,
        description: req.body.description,
        nameTemplate: req.body.nameTemplate,
        descriptionTemplate: req.body.descriptionTemplate,
        options: optionsOf(req.body),
      });
      res.json({ success: true, data: updated });
    } catch (error) {
      res.status(400).json({
        success: false,
        error: error instanceof Error ? error.message : "Update failed",
      });
    }
  });

  router.delete("/:id", authenticate, (req, res) => {
    try {
      store.remove(req.params.id!, userIdOf(req));
      res.json({ success: true });
    } catch (error) {
      res.status(400).json({
        success: false,
        error: error instanceof Error ? error.message : "Delete failed",
      });
    }
  });

  // Renders an unsaved template against a fixture (or supplied items) so the
  // editor can show live output before the user commits to saving.
  router.post("/preview", authenticate, (req, res) => {
    const errors = validateBody(req.body);
    if (errors.length > 0) {
      res.status(400).json({ success: false, error: "Invalid template", details: errors });
      return;
    }

    const items: WorkItem[] = Array.isArray(req.body.workItems) && req.body.workItems.length > 0
      ? req.body.workItems
      : [FIXTURE_WORK_ITEM];

    const template: Template = {
      id: "preview",
      name: req.body.name,
      nameTemplate: req.body.nameTemplate,
      descriptionTemplate: req.body.descriptionTemplate,
      options: optionsOf(req.body),
      isBuiltin: false,
    };

    try {
      res.json({
        success: true,
        data: {
          items: renderTasks(items, template),
          markdown: renderMarkdown(items, template),
        },
      });
    } catch (error) {
      res.status(400).json({
        success: false,
        error: "Template render failed",
        details: error instanceof Error ? error.message : String(error),
      });
    }
  });

  return router;
}
```

Add these imports and the fixture at the top of the same file:

```ts
import { WorkItem } from "../domain/WorkItem.js";
import { Template } from "../formatting/Template.js";
import { renderTasks } from "../formatting/ClickUpRenderer.js";
import { renderMarkdown } from "../formatting/MarkdownRenderer.js";

/** Representative item so the editor can render a template with no real data. */
const FIXTURE_WORK_ITEM: WorkItem = {
  title: "Stop app updates from logging users out",
  description: "Installing an update invalidated the Keychain entry and signed every user out.",
  type: "bug-fix",
  priority: "urgent",
  status: "complete",
  estimateHours: 6,
  completedDate: "2026-07-30",
  tags: ["auth", "ios"],
  provenance: {
    source: "git",
    repository: "example-app",
    files: ["src/auth/Keychain.swift", "src/auth/SessionStore.ts"],
    commits: [
      {
        hash: "6338d99aa11bb22cc33",
        author: "dev@example.com",
        date: "2026-07-30",
        message: "fix(auth): stop app updates from logging users out",
        files: ["src/auth/Keychain.swift"],
        insertions: 42,
        deletions: 11,
      },
    ],
  },
};
```

- [ ] **Step 6: Mount the router**

In `src/webhook-server.ts`, alongside the existing route setup, add the import and mount:

```ts
import { TemplateStore } from "./services/TemplateStore.js";
import { createTemplatesRouter } from "./routes/templates.routes.js";

// near the other service construction:
const templateStore = new TemplateStore(process.env.DATABASE_PATH || ".database/auto-work-analyzer.db");

// alongside the other app.use / app.post registrations:
app.use("/api/templates", createTemplatesRouter(templateStore));
```

- [ ] **Step 7: Verify the server boots and the endpoint responds**

Run: `bun run webhook` in one terminal, then in another:

```bash
curl -s -o /dev/null -w "%{http_code}\n" http://localhost:3009/api/templates
```

Expected: `401` (the route is authenticated — a 401 proves it is mounted; a 404 means it is not).

- [ ] **Step 8: Commit**

```bash
git add src/services/TemplateStore.ts src/services/TemplateStore.test.ts src/routes/templates.routes.ts src/webhook-server.ts
git commit -m "feat(templates): persist templates and expose validated CRUD API

<trailer>"
```

---

### Task 8: Route every creation path through the renderer

**Files:**
- Create: `src/routes/tasks.routes.ts`
- Modify: `src/webhook-server.ts` — remove the inline `/api/notes` and `/api/create-tasks` handlers (currently lines ~625–802) and mount the new router
- Create: `src/routes/tasks.routes.test.ts`

**Interfaces:**
- Consumes: `workItemsFromNotes`, `workItemsFromAnalysis` (Task 6); `renderTasks` (Task 4); `renderMarkdown` (Task 5); `TemplateStore` (Task 7); `ClickUpService`, `getClickUpConfig`.
- Produces: `function createTasksRouter(deps: TasksRouterDeps): Router` and `interface PreviewResponse`. Slice 2 modifies this router to resolve a destination instead of the `.env` config.

- [ ] **Step 1: Write the failing test**

Create `src/routes/tasks.routes.test.ts`. This tests the pure preview-building function rather than the HTTP layer, so no server or auth is needed:

```ts
import { describe, expect, test } from "bun:test";
import { buildPreview } from "./tasks.routes.js";
import { makeWorkItem } from "../domain/WorkItem.js";
import { BUILTIN_TEMPLATES } from "../formatting/builtinTemplates.js";

const standard = BUILTIN_TEMPLATES.find((t) => t.id === "builtin-standard")!;

describe("buildPreview", () => {
  test("returns rendered tasks and markdown for the same items", () => {
    const preview = buildPreview(
      [makeWorkItem({ title: "Fix login", completedDate: "2026-07-30" })],
      standard
    );
    expect(preview.items.length).toBe(1);
    expect(preview.items[0]!.task.name).toBe("Fix login");
    expect(preview.markdown).toContain("Task 1: Fix login");
    expect(preview.template.id).toBe("builtin-standard");
    expect(preview.warnings).toEqual([]);
  });

  test("warns when there is nothing to create", () => {
    const preview = buildPreview([], standard);
    expect(preview.items).toEqual([]);
    expect(preview.warnings.some((w) => w.includes("No work items"))).toBe(true);
  });

  test("surfaces a template error as a warning-free throw", () => {
    const broken = { ...standard, nameTemplate: "{{nonexistent}}" };
    expect(() => buildPreview([makeWorkItem()], broken)).toThrow(/nonexistent/);
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `bun test src/routes/tasks.routes.test.ts`
Expected: FAIL — `Cannot find module './tasks.routes.js'`

- [ ] **Step 3: Write `src/routes/tasks.routes.ts`**

```ts
import { Router } from "express";
import multer from "multer";
import { authenticate } from "../middleware/auth.middleware.js";
import { WorkItem } from "../domain/WorkItem.js";
import { RenderedTask, renderTasks } from "../formatting/ClickUpRenderer.js";
import { renderMarkdown } from "../formatting/MarkdownRenderer.js";
import { Template } from "../formatting/Template.js";
import { TemplateStore } from "../services/TemplateStore.js";
import { workItemsFromNotes } from "../sources/NotesWorkSource.js";
import { workItemsFromAnalysis } from "../sources/GitWorkSource.js";
import { ClickUpService } from "../services/ClickUpService.js";
import { ClickUpConfig } from "../types/index.js";

const DEFAULT_TEMPLATE_ID = "builtin-standard";
const BATCH_SIZE = 5;

export interface PreviewResponse {
  items: RenderedTask[];
  markdown: string;
  template: { id: string; name: string };
  warnings: string[];
}

/** Pure: renders items for preview. Performs no I/O. */
export function buildPreview(items: WorkItem[], template: Template): PreviewResponse {
  const rendered = renderTasks(items, template);
  const warnings: string[] = [];
  if (items.length === 0) {
    warnings.push("No work items were produced — nothing would be created.");
  }
  return {
    items: rendered,
    markdown: renderMarkdown(items, template),
    template: { id: template.id, name: template.name },
    warnings,
  };
}

export interface CreateOutcome {
  created: Array<{ id: string; name: string; url: string }>;
  failed: Array<{ name: string; reason: string }>;
}

/** Creates rendered tasks in batches, isolating per-task failures. */
export async function createRenderedTasks(
  rendered: RenderedTask[],
  clickUp: ClickUpService,
  listId?: string
): Promise<CreateOutcome> {
  const created: CreateOutcome["created"] = [];
  const failed: CreateOutcome["failed"] = [];

  for (let index = 0; index < rendered.length; index += BATCH_SIZE) {
    const batch = rendered.slice(index, index + BATCH_SIZE);
    const results = await Promise.all(
      batch.map(async (entry) => {
        try {
          const task = await clickUp.createTask(entry.task, listId);
          return { ok: true as const, task };
        } catch (error) {
          return {
            ok: false as const,
            name: entry.task.name,
            reason: error instanceof Error ? error.message : "Unknown error",
          };
        }
      })
    );

    for (const result of results) {
      if (result.ok) {
        created.push({ id: result.task.id, name: result.task.name, url: result.task.url });
      } else {
        failed.push({ name: result.name, reason: result.reason });
      }
    }

    if (index + BATCH_SIZE < rendered.length) {
      await new Promise((resolve) => setTimeout(resolve, 100));
    }
  }

  return { created, failed };
}

export interface TasksRouterDeps {
  templateStore: TemplateStore;
  clickUpConfig: ClickUpConfig;
}

export function createTasksRouter(deps: TasksRouterDeps): Router {
  const router = Router();
  const upload = multer({ storage: multer.memoryStorage() });

  const resolveTemplate = (templateId?: string): Template => {
    const template = deps.templateStore.get(templateId || DEFAULT_TEMPLATE_ID);
    if (!template) throw new Error(`Template not found: ${templateId}`);
    return template;
  };

  const templateErrorResponse = (res: any, error: unknown): void => {
    res.status(400).json({
      success: false,
      error: "Template render failed",
      details: error instanceof Error ? error.message : String(error),
    });
  };

  // Render only. Writes nothing.
  router.post("/preview-tasks", authenticate, async (req, res) => {
    try {
      const { notes, workAnalysis, workItems, templateId } = req.body;
      let items: WorkItem[];

      if (Array.isArray(workItems)) {
        items = workItems;
      } else if (typeof notes === "string") {
        items = await workItemsFromNotes(notes);
      } else if (workAnalysis) {
        items = workItemsFromAnalysis(workAnalysis, req.body.repository);
      } else {
        res.status(400).json({
          success: false,
          error: "Provide one of: workItems, notes, or workAnalysis",
        });
        return;
      }

      res.json({ success: true, data: buildPreview(items, resolveTemplate(templateId)) });
    } catch (error) {
      templateErrorResponse(res, error);
    }
  });

  router.post("/export-markdown", authenticate, async (req, res) => {
    try {
      const { workItems, notes, workAnalysis, templateId, title, period } = req.body;
      let items: WorkItem[];

      if (Array.isArray(workItems)) items = workItems;
      else if (typeof notes === "string") items = await workItemsFromNotes(notes);
      else if (workAnalysis) items = workItemsFromAnalysis(workAnalysis, req.body.repository);
      else {
        res.status(400).json({ success: false, error: "Provide workItems, notes, or workAnalysis" });
        return;
      }

      const markdown = renderMarkdown(items, resolveTemplate(templateId), { title, period });
      res.json({ success: true, data: { markdown } });
    } catch (error) {
      templateErrorResponse(res, error);
    }
  });

  // Backward compatible: same request shape as before, plus optional templateId.
  router.post("/notes", upload.single("notes"), authenticate, async (req, res) => {
    try {
      const notesText = req.file ? req.file.buffer.toString("utf-8") : req.body.notes;
      if (!notesText) {
        res.status(400).json({
          success: false,
          error: "No notes provided. Send 'notes' in body or upload a text file.",
        });
        return;
      }

      const items = await workItemsFromNotes(notesText);
      const template = resolveTemplate(req.body.templateId);
      const preview = buildPreview(items, template);

      const createTasks = req.body.createTasks === true || req.body.createTasks === "true";
      let outcome: CreateOutcome = { created: [], failed: [] };

      if (createTasks && preview.items.length > 0) {
        outcome = await createRenderedTasks(
          preview.items,
          new ClickUpService(deps.clickUpConfig)
        );
      }

      res.json({
        success: true,
        data: {
          processedNotes: {
            totalTasks: items.length,
            tasks: items.map((item) => ({
              name: item.title,
              type: item.type,
              estimatedHours: item.estimateHours,
              tags: item.tags,
            })),
          },
          createdTasks: outcome.created,
          failedTasks: outcome.failed,
          markdown: preview.markdown,
          summary: {
            tasksExtracted: items.length,
            tasksCreated: outcome.created.length,
            tasksFailed: outcome.failed.length,
          },
        },
        message: `Processed ${items.length} tasks from notes${
          createTasks ? `, created ${outcome.created.length} ClickUp tasks` : ""
        }${outcome.failed.length > 0 ? ` (${outcome.failed.length} failed)` : ""}`,
      });
    } catch (error) {
      templateErrorResponse(res, error);
    }
  });

  // Backward compatible: accepts the legacy { workAnalysis } shape and the new
  // { workItems } shape, plus optional templateId.
  router.post("/create-tasks", authenticate, async (req, res) => {
    try {
      const { workAnalysis, workItems, templateId, repository } = req.body;

      let items: WorkItem[];
      if (Array.isArray(workItems)) items = workItems;
      else if (workAnalysis) items = workItemsFromAnalysis(workAnalysis, repository);
      else {
        res.status(400).json({ success: false, error: "workItems or workAnalysis is required" });
        return;
      }

      const preview = buildPreview(items, resolveTemplate(templateId));
      const outcome = await createRenderedTasks(
        preview.items,
        new ClickUpService(deps.clickUpConfig)
      );

      res.json({
        success: true,
        data: {
          tasksCreated: outcome.created.length,
          tasks: outcome.created,
          failedTasks: outcome.failed,
        },
        message: `Created ${outcome.created.length} tasks in ClickUp${
          outcome.failed.length > 0 ? ` (${outcome.failed.length} failed)` : ""
        }`,
      });
    } catch (error) {
      templateErrorResponse(res, error);
    }
  });

  return router;
}
```

- [ ] **Step 4: Run test to verify it passes**

Run: `bun test src/routes/tasks.routes.test.ts`
Expected: PASS, 3 tests.

- [ ] **Step 5: Remove the superseded inline handlers and mount the router**

In `src/webhook-server.ts`:

1. Delete the entire inline `app.post("/api/notes", ...)` handler and the inline `app.post("/api/create-tasks", ...)` handler (currently lines ~625–802).
2. Add the mount next to the templates router registration from Task 7:

```ts
import { createTasksRouter } from "./routes/tasks.routes.js";

app.use(
  "/api",
  createTasksRouter({
    templateStore,
    clickUpConfig: config.clickup,
  })
);
```

Mounting at `/api` preserves the existing paths `/api/notes` and `/api/create-tasks` exactly.

3. Remove the now-unused `NotesProcessor` import from `webhook-server.ts` if nothing else there uses it. Leave `GitWorkAnalyzer` — `/api/analyze` still needs it.

- [ ] **Step 6: Verify the build and full suite**

Run: `bun run build && bun test`
Expected: build exit 0; all tests pass.

- [ ] **Step 7: Verify backward compatibility by hand**

Start the server (`bun run webhook`) and confirm the legacy notes shape still works. Obtain a token the way `test-auth.sh` does, then:

```bash
curl -s -X POST http://localhost:3009/api/notes \
  -H "Authorization: Bearer $TOKEN" \
  -H "Content-Type: application/json" \
  -d '{"notes":"Task 1: Try it\nPriority: HIGH\nEstimate: 2 hours\nDescription: Smoke test.\n\n---\n\nTask 2: Second\nDescription: Also.","createTasks":false}'
```

Expected: `success: true`, `summary.tasksExtracted` is `2`, and `data.markdown` contains `Task 1: Try it`. No ClickUp call is made because `createTasks` is `false`.

- [ ] **Step 8: Commit**

```bash
git add src/routes/tasks.routes.ts src/routes/tasks.routes.test.ts src/webhook-server.ts
git commit -m "refactor(tasks): route all ClickUp creation through the canonical renderer

Replaces the three divergent formatting paths with one WorkItem pipeline.
/api/notes and /api/create-tasks keep their existing request shapes.

<trailer>"
```

---

### Task 9: Template management UI and preview picker

**Files:**
- Create: `ui/app/settings/templates/page.tsx`
- Modify: `ui/components/TaskPreviewModal.tsx`

**Interfaces:**
- Consumes: `GET/POST/PUT/DELETE /api/templates` (Task 7); `POST /api/preview-tasks` (Task 8).
- Produces: no code consumed by later tasks. Slice 2 adds a destination picker to the same modal.

Read `ui/app/settings/page.tsx` first and match its conventions exactly: `'use client'`, `useAuth()` for `accessToken`, `Card`/`Button`/`Input`/`LoadingSpinner` from `@/lib/components/ui`, `react-hot-toast` for feedback, `ProtectedRoute` wrapper, and the `BACKEND_URL` constant.

- [ ] **Step 1: Build the template list and editor page**

Create `ui/app/settings/templates/page.tsx` with:

- A list of templates from `GET /api/templates`, built-ins visually marked and read-only.
- **Duplicate** on every template — copies `nameTemplate`, `descriptionTemplate`, and `options` into a new user template named `"<name> (copy)"` via `POST /api/templates`.
- **Edit** on user templates only: two textareas (name template, description template) plus controls for each `TemplateOptions` field — `emitSubtasks`, `applyPriority`, `applyTimeEstimate` as checkboxes; `dueDateSource`, `statusMode`, `tagStrategy.mode` as selects; `fixedStatus` and `tagStrategy.fixed` as text inputs shown only when their mode is selected.
- A **placeholder reference** panel listing the valid scalars and sections, copied from `WORK_ITEM_SCHEMA`. Users cannot guess these.
- A **live preview** pane: on a debounced change to either textarea, `POST /api/templates/preview` with the current draft and render the returned `items[0].task.name` and `.description`. This is why the endpoint takes an unsaved template — the user sees the output before saving.
- **Save** posting to `POST`/`PUT /api/templates`. On a `400`, render `result.details` — the array of validation errors — as individual toast lines or an inline error list. This is the whole point of save-time validation; swallowing `details` wastes it.
- **Delete** on user templates, with a confirmation.

- [ ] **Step 2: Add the templates link to the settings navigation**

Add a link to `/settings/templates` from `ui/app/settings/page.tsx`, following how `ui/lib/components/Sidebar.tsx` renders its existing entries.

- [ ] **Step 3: Add the template picker to the preview modal**

In `ui/components/TaskPreviewModal.tsx`:

- Load templates on mount from `GET /api/templates`.
- Add a `<select>` for the template, defaulting to `builtin-standard`.
- On template change, re-request `POST /api/preview-tasks` with the current items and the chosen `templateId`, and re-render the preview from the response so the user sees the actual rendered names and descriptions.
- Render `data.warnings` if non-empty.
- Keep the existing confirm action, now sending `templateId` alongside the approved items.

- [ ] **Step 4: Verify in the browser**

Run the UI (`cd ui && bun run dev`) with the backend running. Confirm:
- `/settings/templates` lists three built-ins.
- Duplicating a built-in produces an editable copy.
- Saving a template containing `{{bogus}}` shows the validation error and does **not** persist.
- Changing the template in the preview modal visibly changes the rendered task names.

- [ ] **Step 5: Commit**

```bash
git add ui/app/settings/templates/page.tsx ui/app/settings/page.tsx ui/components/TaskPreviewModal.tsx
git commit -m "feat(ui): template management page and preview template picker

<trailer>"
```

---

## Slice 1 Definition of Done

- [ ] `bun test` passes, including the markdown round-trip test.
- [ ] `bun run build` exits 0.
- [ ] `/api/notes` and `/api/create-tasks` accept their original request shapes unchanged.
- [ ] All three creation paths produce identically-formatted tasks for the same input.
- [ ] `/api/export-markdown` returns markdown that `/api/notes` can re-ingest.
- [ ] A template saved with an invalid placeholder is rejected with a named error.
- [ ] `src/webhook-server.ts` no longer contains inline task-creation logic.
