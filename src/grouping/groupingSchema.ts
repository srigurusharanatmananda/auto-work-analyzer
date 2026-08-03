/**
 * Validation for the AI grouper's response.
 *
 * The model is treated as an untrusted source throughout: nothing it returns
 * reaches a WorkItem without passing through here.
 */

import { ALL_WORK_ITEM_PRIORITIES, ALL_WORK_ITEM_TYPES } from "../domain/WorkItem.js";
import type { WorkItemPriority, WorkItemType } from "../domain/WorkItem.js";
import type { GitCommit } from "../types/index.js";

export interface AiGroup {
  title: string;
  description: string;
  type: WorkItemType;
  priority: WorkItemPriority;
  estimateHours: number;
  commitHashes: string[];
}

export interface AiGroupResponse {
  groups: AiGroup[];
}

/**
 * Both members declare both fields. `strictNullChecks` is off repo-wide, which
 * defeats narrowing a discriminated union by its `ok` flag, so a caller reading
 * `.reason` after `if (!outcome.ok)` would not compile against a union that
 * mentioned `reason` in only one member.
 */
export type ValidationOutcome =
  | { ok: true; groups: AiGroup[]; reason?: undefined }
  | { ok: false; groups?: undefined; reason: string };

/**
 * Validates shape AND commit coverage.
 *
 * Coverage is the important half: a model that quietly drops commits produces
 * output that looks perfectly well-formed while losing work. The three ways
 * coverage can break are all rejected — a hash that was never in the input, an
 * input commit no group claims, and a commit claimed twice. The last one is the
 * subtle one: a set-based coverage check passes it happily while the commit ends
 * up in two work items, so the work gets filed twice.
 */
export function validateGroupResponse(raw: unknown, commits: GitCommit[]): ValidationOutcome {
  if (raw === null || typeof raw !== "object") {
    return { ok: false, reason: "Response was not a JSON object" };
  }

  const groups = (raw as { groups?: unknown }).groups;
  if (!Array.isArray(groups)) {
    return { ok: false, reason: "Response had no 'groups' array" };
  }
  if (groups.length === 0) {
    return { ok: false, reason: "Response contained zero groups" };
  }

  const knownHashes = new Set(commits.map((commit) => commit.hash));
  const covered = new Set<string>();
  const validated: AiGroup[] = [];

  for (const [index, entry] of groups.entries()) {
    if (entry === null || typeof entry !== "object") {
      return { ok: false, reason: `Group ${index} was not an object` };
    }
    const group = entry as Record<string, unknown>;

    if (typeof group.title !== "string" || group.title.trim().length === 0) {
      return { ok: false, reason: `Group ${index} has no title` };
    }
    if (typeof group.description !== "string") {
      return { ok: false, reason: `Group ${index} ("${group.title}") has no description` };
    }
    if (!ALL_WORK_ITEM_TYPES.includes(group.type as WorkItemType)) {
      return { ok: false, reason: `Group ${index} has unknown type "${String(group.type)}"` };
    }
    if (!ALL_WORK_ITEM_PRIORITIES.includes(group.priority as WorkItemPriority)) {
      return { ok: false, reason: `Group ${index} has unknown priority "${String(group.priority)}"` };
    }
    if (
      typeof group.estimateHours !== "number" ||
      !Number.isFinite(group.estimateHours) ||
      group.estimateHours <= 0
    ) {
      return { ok: false, reason: `Group ${index} has an invalid estimateHours` };
    }
    if (!Array.isArray(group.commitHashes) || group.commitHashes.length === 0) {
      return { ok: false, reason: `Group ${index} cites no commits` };
    }

    for (const hash of group.commitHashes) {
      if (typeof hash !== "string" || !knownHashes.has(hash)) {
        return {
          ok: false,
          reason: `Group ${index} cites unknown commit hash "${String(hash)}"`,
        };
      }
      if (covered.has(hash)) {
        return {
          ok: false,
          reason: `Commit ${hash} is claimed more than once (group ${index}) — it would be filed twice`,
        };
      }
      covered.add(hash);
    }

    validated.push(group as unknown as AiGroup);
  }

  const uncovered = commits.filter((commit) => !covered.has(commit.hash));
  if (uncovered.length > 0) {
    return {
      ok: false,
      reason: `${uncovered.length} commit(s) uncovered: ${uncovered
        .map((commit) => commit.hash)
        .slice(0, 5)
        .join(", ")}`,
    };
  }

  return { ok: true, groups: validated };
}
