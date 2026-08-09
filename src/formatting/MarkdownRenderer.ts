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
  let body = blocks.join("\n\n---\n\n");

  // NotesProcessor only takes the structured-parse path when the text
  // contains a "---" separator at all. With a single item there is no join
  // between blocks to supply one, so add a trailing separator to guarantee
  // it — the empty trailing section it produces is filtered out by
  // parseStructuredTasks (`.filter(s => s.trim())`).
  if (blocks.length < 2) body += "\n\n---\n";

  if (!header.title && !header.period) return body;

  const preamble: string[] = [];
  if (header.title) preamble.push(`# ${header.title}`);
  if (header.period) preamble.push(`# Period: ${header.period}`);

  return `${preamble.join("\n")}\n\n${body}`;
}
