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
  | { ok: true; items: ActionItem[]; reason?: undefined; warnings?: string[] }
  | { ok: false; items?: undefined; reason: string; warnings?: undefined };

/**
 * How many distinct requests one sentence may evidence.
 *
 * A sentence really can carry two or three commitments — "I'll fix the export
 * and Priya will send the NDA" is one sentence and two people's work. Beyond
 * that it is no longer a sentence being read carefully, it is a model
 * shredding a passage, and the items are not worth filing.
 */
export const MAX_ITEMS_PER_QUOTE = 3;

/**
 * Identity of the *request*, as opposed to the evidence for it.
 *
 * Two items citing one sentence are only a duplicate if they ask for the same
 * thing. This is what separates "one sentence, two commitments" from "the model
 * emitted the same task twice".
 */
function requestIdentity(item: { title: string; description: string }): string {
  return normalizeForQuoteMatch(`${item.title} ${item.description}`);
}

/**
 * What makes two action items the same item.
 *
 * Exported because dedup happens in two places — here, within a chunk, and in
 * `ActionItemExtractor` across chunks — and the two have to agree. They did
 * not: the cross-chunk pass keyed on the quote ALONE, so it silently undid the
 * distinction this module draws and dropped the second commitment out of a
 * sentence carrying two. Fixing the validator alone would have left the bug
 * intact one layer up. One function now, so they cannot drift apart again.
 */
export function actionItemIdentity(item: {
  title: string;
  description: string;
  quote: string;
}): string {
  return `${normalizeForQuoteMatch(item.quote)} :: ${requestIdentity(item)}`;
}

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
  /** Normalized quote -> the distinct requests already credited to it. */
  const quoteGroups = new Map<string, Set<string>>();
  const warnings: string[] = [];

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

    // Two items citing one sentence is NOT automatically a duplicate.
    //
    // This rule used to reject the whole response, on the theory that a shared
    // quote meant the model had mis-split a passage. That is one cause; it is
    // not the common one. "I'll fix the export bug and Priya will send the NDA
    // after this" is a single sentence carrying two people's commitments, and
    // both items correctly cite it. Rejecting the chunk lost BOTH of them, and
    // every other item in that chunk with them, silently. Seen live.
    //
    // So the two cases are separated. Same sentence, same request is a
    // duplicate. Same sentence, different requests is a sentence doing two
    // jobs, which is ordinary speech.
    const identity = requestIdentity(item as { title: string; description: string });
    const sharing = quoteGroups.get(normalizedQuote) ?? new Set<string>();

    if (sharing.has(identity)) {
      // Dropped, not fatal — and reported, because a silent drop is how a
      // list quietly becomes incomplete.
      //
      // Being lenient here is the right asymmetry, and it is the opposite of
      // the one the quote check makes. An invented task is invisible and
      // corrosive, so it is rejected outright. A duplicate is *visible* — you
      // see two identical tasks and delete one — so the cheap failure is
      // filing it, and the expensive failure is discarding the whole chunk to
      // avoid it.
      warnings.push(
        `Item ${index} ("${item.title}") repeats an earlier item word for word; ` +
          `it was dropped rather than filed twice`
      );
      continue;
    }

    if (sharing.size >= MAX_ITEMS_PER_QUOTE) {
      // Still fatal. One sentence yielding four or more distinct requests is
      // the mis-split the original rule was built for, and at that point
      // nothing in the response has been read carefully enough to trust.
      return {
        ok: false,
        reason:
          `More than ${MAX_ITEMS_PER_QUOTE} separate items cite the same sentence, ` +
          `which means the passage was mis-split rather than read: ` +
          `"${item.quote.slice(0, 80)}"`,
      };
    }

    sharing.add(identity);
    quoteGroups.set(normalizedQuote, sharing);

    if (item.speaker !== undefined && typeof item.speaker !== "string") {
      return { ok: false, reason: `Item ${index} has a non-string speaker` };
    }

    validated.push(item as unknown as ActionItem);
  }

  return {
    ok: true,
    items: validated,
    ...(warnings.length > 0 ? { warnings } : {}),
  };
}
