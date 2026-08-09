/**
 * Reconciles our normalized statuses against a ClickUp list's real statuses.
 *
 * ClickUp statuses are per-list, so "complete" is not a status that exists —
 * it is a status that some lists happen to have. Commit af716cd removed a
 * hardcoded one for exactly this reason: sending a status the target list does
 * not define makes ClickUp reject the whole create.
 *
 * When nothing matches we omit the status so ClickUp applies the list default,
 * and report the omission so it is visible in the preview instead of being
 * discovered after the fact.
 */

import { distance } from "fastest-levenshtein";

export interface StatusMapping {
  from: string;
  to: string | null;
  method: "exact" | "synonym" | "fuzzy" | "unmatched";
}

/** Mirrors NotesProcessor.normalizeStatus, extended with target-side variants. */
const SYNONYMS: Record<string, string[]> = {
  complete: ["complete", "completed", "done", "finished", "closed", "x"],
  "in progress": ["in progress", "in-progress", "wip", "working", "doing", "started", "active"],
  "to do": ["to do", "todo", "to-do", "pending", "backlog", "open", "new"],
  blocked: ["blocked", "on hold", "paused", "waiting"],
  "in review": ["in review", "review", "reviewing", "qa"],
};

/**
 * Above this normalized edit distance we refuse to guess. Tuned so
 * "in-progress" -> "in progress" (1/11 ≈ 0.09) passes while "to do" ->
 * "Complete" (8/8 = 1.0) does not: a wrong guess silently files work under the
 * wrong column, which is worse than leaving it at the list default.
 */
const FUZZY_MAX_RATIO = 0.34;

function canonicalGroup(value: string): string | null {
  const lower = value.toLowerCase().trim();
  for (const [group, variants] of Object.entries(SYNONYMS)) {
    if (variants.includes(lower)) return group;
  }
  return null;
}

export function mapStatus(
  desired: string | undefined,
  available: string[]
): StatusMapping | null {
  if (!desired || desired.trim().length === 0) return null;

  const from = desired.trim();
  const lower = from.toLowerCase();

  const exact = available.find((status) => status.toLowerCase() === lower);
  if (exact) return { from, to: exact, method: "exact" };

  const desiredGroup = canonicalGroup(from);
  if (desiredGroup) {
    const synonym = available.find((status) => canonicalGroup(status) === desiredGroup);
    if (synonym) return { from, to: synonym, method: "synonym" };
  }

  let best: { status: string; ratio: number } | null = null;
  for (const status of available) {
    const target = status.toLowerCase();
    const ratio = distance(lower, target) / Math.max(lower.length, target.length);
    if (best === null || ratio < best.ratio) best = { status, ratio };
  }

  if (best && best.ratio <= FUZZY_MAX_RATIO) {
    return { from, to: best.status, method: "fuzzy" };
  }

  return { from, to: null, method: "unmatched" };
}

/** Deduplicated by the desired status, so a preview reports each drop once. */
export function mapStatuses(
  desired: Array<string | undefined>,
  available: string[]
): StatusMapping[] {
  const seen = new Set<string>();
  const mappings: StatusMapping[] = [];

  for (const value of desired) {
    const mapping = mapStatus(value, available);
    if (!mapping) continue;
    const key = mapping.from.toLowerCase();
    if (seen.has(key)) continue;
    seen.add(key);
    mappings.push(mapping);
  }

  return mappings;
}
