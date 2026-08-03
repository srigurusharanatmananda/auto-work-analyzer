/**
 * The seam between "how commits are grouped" and "what consumes the groups".
 *
 * Two implementations exist: HeuristicCommitGrouper (keyword rules, never
 * fails) and AiCommitGrouper (semantic, falls back to the heuristic). `mode`
 * exists so a caller can tell the two apart after the fact — degraded output
 * that looks like the good path is the failure this seam guards against.
 */

import type { WorkItem } from "../domain/WorkItem.js";
import type { GitCommit } from "../types/index.js";

export interface GroupingContext {
  /** Fallback date for items whose commits carry none. */
  analysisDate: string;
  repository?: string;
}

export interface GroupingResult {
  items: WorkItem[];
  mode: "ai" | "heuristic";
  /** Present only when mode is "heuristic" after an AI attempt failed. */
  fallbackReason?: string;
}

export interface CommitGrouper {
  /**
   * Groups commits into work items.
   *
   * Contract every implementation must honour: each input commit appears in
   * exactly one returned item's `provenance.commits`. No commit may be dropped
   * or duplicated, whatever the grouping strategy or its failure mode.
   */
  group(commits: GitCommit[], context: GroupingContext): Promise<GroupingResult>;
}
