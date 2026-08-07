/**
 * Collapses a call's action items into fewer, larger tasks.
 *
 * Eight separate ClickUp tasks from one thirty-minute call is technically
 * accurate and practically unusable — the board fills with fragments and the
 * fact that they came from one conversation is lost. So the reviewer picks a
 * shape:
 *
 *   per-item     one task each. The original behaviour, and still the default.
 *   single-task  one task for the call, every item a subtask of it.
 *   by-theme     the model clusters related items; each cluster is a task.
 *
 * **Grouping never invents, drops or merges the items themselves.** Parents are
 * containers; the leaves that reach ClickUp are the same objects the extractor
 * produced, still carrying the quotes the validator checked. `by-theme`
 * validates that every input item is claimed by exactly one group before it
 * accepts the model's answer — the same coverage discipline as
 * `validateGroupResponse`, and for the same reason: a well-formed response that
 * silently omits two items looks perfectly fine and loses work.
 *
 * A parent carries NO quote. It is a synthesis, not something anybody said, and
 * giving it one would put an unattributable sentence in front of a reviewer who
 * has been trained to trust that field.
 */

import type { AiClient } from "../ai/AiClient.js";
import {
  ALL_WORK_ITEM_TYPES,
  WorkItem,
  WorkItemPriority,
  WorkItemType,
} from "../domain/WorkItem.js";

export type TranscriptGrouping = "per-item" | "single-task" | "by-theme";

export const ALL_TRANSCRIPT_GROUPINGS: TranscriptGrouping[] = [
  "per-item",
  "single-task",
  "by-theme",
];

export function isTranscriptGrouping(value: unknown): value is TranscriptGrouping {
  return (
    typeof value === "string" &&
    (ALL_TRANSCRIPT_GROUPINGS as string[]).includes(value)
  );
}

export interface GroupActionItemsContext {
  callTitle?: string;
  callDate?: string;
}

export interface ActionItemGroupResult {
  items: WorkItem[];
  /** What actually happened, which is not always what was asked for. */
  mode: TranscriptGrouping;
  /** Why `by-theme` fell back. Surfaced to the reviewer as a warning. */
  fallbackReason?: string;
}

/** Most urgent first. A parent is as urgent as the most urgent thing inside it. */
const PRIORITY_RANK: Record<WorkItemPriority, number> = {
  urgent: 0,
  high: 1,
  normal: 2,
  low: 3,
};

function highestPriority(items: WorkItem[]): WorkItemPriority {
  return items.reduce<WorkItemPriority>(
    (best, item) => (PRIORITY_RANK[item.priority] < PRIORITY_RANK[best] ? item.priority : best),
    "low"
  );
}

/**
 * The most common child type, ties going to whichever appeared first.
 *
 * Deliberately derived rather than fixed to "chore": a group of three bug fixes
 * that files itself as a chore is a small lie that shows up in every filter and
 * report built on task type.
 */
function dominantType(items: WorkItem[]): WorkItemType {
  const counts = new Map<WorkItemType, number>();
  for (const item of items) counts.set(item.type, (counts.get(item.type) ?? 0) + 1);

  let best: WorkItemType = items[0]?.type ?? "chore";
  let bestCount = 0;
  for (const item of items) {
    const count = counts.get(item.type)!;
    if (count > bestCount) {
      best = item.type;
      bestCount = count;
    }
  }
  return best;
}

/** Union of the children's tags, order-preserving. */
function mergedTags(items: WorkItem[]): string[] {
  return Array.from(new Set(items.flatMap((item) => item.tags)));
}

function makeParent(
  title: string,
  description: string,
  children: WorkItem[],
  type?: WorkItemType
): WorkItem {
  return {
    title,
    description,
    type: type ?? dominantType(children),
    priority: highestPriority(children),
    status: "to do",
    // Summed, not averaged: the parent represents all the work below it, and
    // ClickUp rolls a parent's own estimate up alongside its subtasks' only if
    // it has one.
    estimateHours: children.reduce((total, child) => total + child.estimateHours, 0),
    tags: mergedTags(children),
    provenance: {
      commits: [],
      files: [],
      source: "transcript",
      // No `quote` — see the header.
    },
    subitems: children,
  };
}

/** "Weekly sync — 2026-08-07", falling back through what context there is. */
function callLabel(context: GroupActionItemsContext): string {
  const parts = [context.callTitle?.trim(), context.callDate?.trim()].filter(
    (part): part is string => Boolean(part)
  );
  return parts.length > 0 ? parts.join(" — ") : "Call action items";
}

function singleTask(items: WorkItem[], context: GroupActionItemsContext): WorkItem[] {
  if (items.length === 0) return [];
  return [
    makeParent(
      callLabel(context),
      `${items.length} action item${items.length === 1 ? "" : "s"} agreed on this call.`,
      items
    ),
  ];
}

/** One group the model proposed, before validation. */
interface ThemeGroup {
  title: string;
  description: string;
  type: WorkItemType;
  itemIndexes: number[];
}

type ThemeOutcome =
  | { ok: true; groups: ThemeGroup[]; reason?: undefined }
  | { ok: false; groups?: undefined; reason: string };

/**
 * Shape AND coverage. Every input index must be claimed exactly once: an index
 * that does not exist, one nobody claims, and one claimed twice are all
 * rejected. The last is the quiet one — a set-based check passes it while the
 * item is filed under two different parents.
 */
export function validateThemeResponse(raw: unknown, itemCount: number): ThemeOutcome {
  if (raw === null || typeof raw !== "object") {
    return { ok: false, reason: "Grouping response was not a JSON object" };
  }

  const groups = (raw as { groups?: unknown }).groups;
  if (!Array.isArray(groups) || groups.length === 0) {
    return { ok: false, reason: "Grouping response contained no groups" };
  }

  const claimed = new Map<number, number>();
  const validated: ThemeGroup[] = [];

  for (const entry of groups) {
    if (entry === null || typeof entry !== "object") {
      return { ok: false, reason: "A group was not an object" };
    }
    const { title, description, type, itemIndexes } = entry as Record<string, unknown>;

    if (typeof title !== "string" || title.trim().length === 0) {
      return { ok: false, reason: "A group had no title" };
    }
    if (!Array.isArray(itemIndexes) || itemIndexes.length === 0) {
      return { ok: false, reason: `Group "${title}" claimed no items` };
    }

    const indexes: number[] = [];
    for (const value of itemIndexes) {
      if (!Number.isInteger(value) || (value as number) < 0 || (value as number) >= itemCount) {
        return { ok: false, reason: `Group "${title}" referenced item ${String(value)}, which does not exist` };
      }
      const index = value as number;
      claimed.set(index, (claimed.get(index) ?? 0) + 1);
      indexes.push(index);
    }

    validated.push({
      title: title.trim(),
      description: typeof description === "string" ? description.trim() : "",
      // An unrecognised type is not worth failing the whole grouping over; the
      // parent's type is derived from its children in that case.
      type: ALL_WORK_ITEM_TYPES.includes(type as WorkItemType)
        ? (type as WorkItemType)
        : undefined,
      itemIndexes: indexes,
    } as ThemeGroup);
  }

  const duplicated = [...claimed.entries()].filter(([, count]) => count > 1).map(([index]) => index);
  if (duplicated.length > 0) {
    return {
      ok: false,
      reason: `Items ${duplicated.join(", ")} were placed in more than one group`,
    };
  }

  const missing: number[] = [];
  for (let index = 0; index < itemCount; index += 1) {
    if (!claimed.has(index)) missing.push(index);
  }
  if (missing.length > 0) {
    return { ok: false, reason: `Items ${missing.join(", ")} were not placed in any group` };
  }

  return { ok: true, groups: validated };
}

function buildThemePrompt(items: WorkItem[], context: GroupActionItemsContext): string {
  const listed = items
    .map(
      (item, index) =>
        `${index}. [${item.type}/${item.priority}] ${item.title}` +
        (item.description ? `\n   ${item.description}` : "")
    )
    .join("\n");

  return `You are organising the action items from one call${
    context.callTitle ? ` ("${context.callTitle}")` : ""
  } into a small number of coherent parent tasks.

Action items:
${listed}

Group them by what a person would actually work on together — same deliverable,
same recipient, same system. Rules:
- Every item index must appear in exactly one group. Do not omit or repeat any.
- Prefer 2 to 5 groups. If the items genuinely have nothing in common, it is
  correct to return one group per item.
- Do not invent work, rename the items, or merge two items into one.
- A group title names the shared outcome, not the call.

Return ONLY JSON:
{"groups":[{"title":"...","description":"...","type":"feature|bug-fix|improvement|refactor|documentation|test|chore|release","itemIndexes":[0,2]}]}`;
}

/** Tolerates a fenced or prose-wrapped JSON object. */
function parseJson(text: string): unknown {
  const fenced = text.match(/```(?:json)?\s*([\s\S]*?)```/);
  const candidate = fenced ? fenced[1]! : text;
  const start = candidate.indexOf("{");
  const end = candidate.lastIndexOf("}");
  if (start === -1 || end <= start) throw new Error("No JSON object in the response");
  return JSON.parse(candidate.slice(start, end + 1));
}

async function byTheme(
  items: WorkItem[],
  context: GroupActionItemsContext,
  client: AiClient
): Promise<ActionItemGroupResult> {
  try {
    const { text } = await client.complete(buildThemePrompt(items, context));
    const validation = validateThemeResponse(parseJson(text), items.length);
    if (!validation.ok) throw new Error(validation.reason);

    return {
      mode: "by-theme",
      items: validation.groups.map((group) => {
        const children = group.itemIndexes.map((index) => items[index]!);
        // A group of one is a task, not a task with a single subtask. Wrapping
        // it would bury the quote one level down for no gain.
        if (children.length === 1) return children[0]!;
        return makeParent(group.title, group.description, children, group.type);
      }),
    };
  } catch (error) {
    const reason = error instanceof Error ? error.message : String(error);
    console.warn(`Theme grouping unavailable, leaving items ungrouped: ${reason}`);
    // Falls back to per-item, not to single-task: the user gets every task they
    // would have got anyway, just unnested. Collapsing everything into one
    // parent because the model failed would be a bigger surprise than doing
    // nothing.
    return { mode: "per-item", items, fallbackReason: reason };
  }
}

/**
 * Applies the chosen shape. Never throws: a grouping failure degrades to
 * `per-item` with a reason, because losing the grouping is recoverable and
 * losing the extraction is not.
 */
export async function groupActionItems(
  items: WorkItem[],
  mode: TranscriptGrouping,
  context: GroupActionItemsContext = {},
  client?: AiClient
): Promise<ActionItemGroupResult> {
  if (items.length === 0) return { mode, items: [] };

  switch (mode) {
    case "single-task":
      return { mode, items: singleTask(items, context) };
    case "by-theme": {
      if (!client) {
        return {
          mode: "per-item",
          items,
          fallbackReason: "Grouping by theme needs an AI provider, and none is configured.",
        };
      }
      // One item cannot be clustered, and a model call to discover that is
      // spend for nothing.
      if (items.length === 1) return { mode, items };
      return byTheme(items, context, client);
    }
    case "per-item":
    default:
      return { mode: "per-item", items };
  }
}
