/**
 * Validation for the action-item extractor's response.
 *
 * The model is an untrusted source. Nothing it returns becomes a WorkItem —
 * and therefore a real ClickUp task someone is expected to act on — without
 * passing through here.
 *
 * The load-bearing rule is the quote check. Every extracted item must cite the
 * transcript sentence it came from, and an item whose quote is not actually in
 * the transcript is rejected outright rather than repaired. This is a cheap
 * mechanical guard against the failure mode that matters: a model that produces
 * a confident, well-formed, entirely invented commitment. A task nobody agreed
 * to is worse than a task that was missed — the missed one costs a follow-up,
 * the invented one costs trust in every other task the system files.
 *
 * Two normalizations are applied before comparing, and neither can manufacture
 * content that was not there:
 *
 *  - **Whitespace is collapsed.** Transcripts arrive with line wrapping and
 *    segment boundaries the model does not reproduce, so requiring byte
 *    equality would reject nearly every genuine quote.
 *  - **Case is ignored.** Changing case cannot invent a request; ASR output
 *    also capitalises inconsistently across segment boundaries.
 *
 * Everything else is strict. In particular, punctuation and word choice are
 * not normalized: a model paraphrasing "we should probably look at the export
 * bug" into "fix the export bug" is exactly the case this rejects, because at
 * that point the citation no longer evidences anything.
 */

import { ALL_WORK_ITEM_PRIORITIES, ALL_WORK_ITEM_TYPES } from "../domain/WorkItem.js";
import type { WorkItemPriority, WorkItemType } from "../domain/WorkItem.js";

export interface ActionItem {
  title: string;
  description: string;
  type: WorkItemType;
  priority: WorkItemPriority;
  estimateHours: number;
  /** Verbatim from the transcript. Checked, not trusted. */
  quote: string;
  /** Optional; the transcript often does not attribute clearly. */
  speaker?: string;
}

export interface ActionItemResponse {
  items: ActionItem[];
}

/**
 * Both members declare both fields, for the same reason as groupingSchema:
 * `strictNullChecks` is off repo-wide, which defeats narrowing a discriminated
 * union by its `ok` flag.
 */
export type ActionItemOutcome =
  | { ok: true; items: ActionItem[]; reason?: undefined }
  | { ok: false; items?: undefined; reason: string };

/**
 * Short quotes are not evidence.
 *
 * "Yes.", "ok", "we should" all appear in almost any transcript, so a model
 * could attach one to an invented task and pass the substring check. Thirty
 * characters is long enough that a matching span is specific to the passage it
 * came from, and short enough not to reject a genuinely terse instruction.
 */
export const MIN_QUOTE_LENGTH = 30;

/**
 * Collapses whitespace and lowercases. Applied to both sides of the comparison.
 * Deliberately does NOT strip punctuation — see the header.
 */
export function normalizeForQuoteMatch(text: string): string {
  return text.replace(/\s+/g, " ").trim().toLowerCase();
}

/**
 * Validates shape AND that every citation is real.
 *
 * `transcript` is the exact text the model was shown. Passing the full
 * transcript when the model only saw a chunk would let an item cite a passage
 * from a different chunk, which is a real way for a chunked run to launder an
 * invented quote into a valid-looking one.
 */
export function validateActionItems(raw: unknown, transcript: string): ActionItemOutcome {
  if (raw === null || typeof raw !== "object") {
    return { ok: false, reason: "Response was not a JSON object" };
  }

  const items = (raw as { items?: unknown }).items;
  if (!Array.isArray(items)) {
    return { ok: false, reason: "Response had no 'items' array" };
  }

  // An empty array is a valid, correct answer. Most conversations contain no
  // action items at all, and a validator that treated "nothing to do" as a
  // failure would push the extractor towards inventing something — the exact
  // behaviour the quote check exists to prevent. Note this differs from
  // groupingSchema, where zero groups IS an error: there, every commit must be
  // accounted for, so an empty response means work was dropped.
  if (items.length === 0) return { ok: true, items: [] };

  const haystack = normalizeForQuoteMatch(transcript);
  const validated: ActionItem[] = [];
  const seenQuotes = new Set<string>();

  for (const [index, entry] of items.entries()) {
    if (entry === null || typeof entry !== "object") {
      return { ok: false, reason: `Item ${index} was not an object` };
    }
    const item = entry as Record<string, unknown>;

    if (typeof item.title !== "string" || item.title.trim().length === 0) {
      return { ok: false, reason: `Item ${index} has no title` };
    }
    if (typeof item.description !== "string") {
      return { ok: false, reason: `Item ${index} ("${item.title}") has no description` };
    }
    if (!ALL_WORK_ITEM_TYPES.includes(item.type as WorkItemType)) {
      return { ok: false, reason: `Item ${index} has unknown type "${String(item.type)}"` };
    }
    if (!ALL_WORK_ITEM_PRIORITIES.includes(item.priority as WorkItemPriority)) {
      return {
        ok: false,
        reason: `Item ${index} has unknown priority "${String(item.priority)}"`,
      };
    }
    if (
      typeof item.estimateHours !== "number" ||
      !Number.isFinite(item.estimateHours) ||
      item.estimateHours <= 0
    ) {
      return { ok: false, reason: `Item ${index} has an invalid estimateHours` };
    }

    if (typeof item.quote !== "string" || item.quote.trim().length === 0) {
      return { ok: false, reason: `Item ${index} ("${item.title}") cites no quote` };
    }

    const normalizedQuote = normalizeForQuoteMatch(item.quote);

    if (normalizedQuote.length < MIN_QUOTE_LENGTH) {
      return {
        ok: false,
        reason:
          `Item ${index} ("${item.title}") cites a ${normalizedQuote.length}-character ` +
          `quote, which is too short to evidence anything (minimum ${MIN_QUOTE_LENGTH})`,
      };
    }

    if (!haystack.includes(normalizedQuote)) {
      return {
        ok: false,
        reason:
          `Item ${index} ("${item.title}") cites a quote that is not in the ` +
          `transcript: "${item.quote.slice(0, 80)}"`,
      };
    }

    // Two items citing the same sentence means one request was filed twice.
    // Rejecting the whole response rather than silently dropping the duplicate:
    // it is a sign the model mis-split a passage, and the other items in that
    // response are not more trustworthy for it.
    if (seenQuotes.has(normalizedQuote)) {
      return {
        ok: false,
        reason:
          `Item ${index} ("${item.title}") cites the same sentence as an earlier ` +
          `item — it would be filed twice`,
      };
    }
    seenQuotes.add(normalizedQuote);

    if (item.speaker !== undefined && typeof item.speaker !== "string") {
      return { ok: false, reason: `Item ${index} has a non-string speaker` };
    }

    validated.push(item as unknown as ActionItem);
  }

  return { ok: true, items: validated };
}
