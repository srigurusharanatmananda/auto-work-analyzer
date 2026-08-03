/**
 * Groups commits into semantic units of work using the shared provider chain.
 *
 * Every failure mode lands in the same place: the heuristic grouper, with a
 * reason attached. Nothing here throws, and no commit is ever dropped —
 * validation refuses a response that does not account for its whole chunk, and
 * a refusal falls the entire run back rather than shipping a partial answer.
 */

import { AiClient } from "../ai/AiClient.js";
import type { WorkItem } from "../domain/WorkItem.js";
import type { GitCommit } from "../types/index.js";
import type { CommitGrouper, GroupingContext, GroupingResult } from "./CommitGrouper.js";
import { HeuristicCommitGrouper } from "./HeuristicCommitGrouper.js";
import { validateGroupResponse } from "./groupingSchema.js";
import type { AiGroup } from "./groupingSchema.js";

/** Commits per request. Keeps prompts inside provider context limits. */
const CHUNK_SIZE = 60;

export class AiCommitGrouper implements CommitGrouper {
  private fallback = new HeuristicCommitGrouper();

  constructor(private client: AiClient, private chunkSize: number = CHUNK_SIZE) {}

  async group(commits: GitCommit[], context: GroupingContext): Promise<GroupingResult> {
    if (commits.length === 0) return { items: [], mode: "heuristic" };

    try {
      const chunks = this.chunk(commits);
      const items: WorkItem[] = [];

      // Cost is proportional to commits, not to runs, and a fortnight of a busy
      // repo is several calls. Log it so spend is observable before it surprises
      // someone.
      console.log(
        `AI grouping ${commits.length} commit(s) in ${chunks.length} request(s) ` +
          `(chunk size ${this.chunkSize})`
      );

      for (const chunk of chunks) {
        const { text } = await this.client.complete(this.buildPrompt(chunk));
        const parsed = this.parseJson(text);
        const validation = validateGroupResponse(parsed, chunk);
        // Throwing here abandons the items already accumulated, on purpose: half
        // AI-grouped and half heuristic output would be neither, and its
        // coverage would be nobody's invariant.
        if (!validation.ok) throw new Error(validation.reason);
        items.push(...validation.groups.map((group) => this.toWorkItem(group, chunk, context)));
      }

      return { items, mode: "ai" };
    } catch (error) {
      const reason = error instanceof Error ? error.message : String(error);
      console.warn(`AI grouping unavailable, falling back to heuristics: ${reason}`);
      const heuristic = await this.fallback.group(commits, context);
      return { ...heuristic, fallbackReason: reason };
    }
  }

  /**
   * Chunks by position after sorting by date, so related work stays together.
   *
   * The chunks partition the input — disjoint and exhaustive — which is what
   * makes per-chunk coverage validation add up to coverage of the whole set.
   */
  private chunk(commits: GitCommit[]): GitCommit[][] {
    const sorted = [...commits].sort((a, b) => a.date.localeCompare(b.date));
    const chunks: GitCommit[][] = [];
    for (let index = 0; index < sorted.length; index += this.chunkSize) {
      chunks.push(sorted.slice(index, index + this.chunkSize));
    }
    return chunks;
  }

  /** Models often wrap JSON in prose or a code fence. */
  private parseJson(text: string): unknown {
    const fenced = text.match(/```(?:json)?\s*([\s\S]*?)```/);
    const candidate = fenced ? fenced[1]! : text;
    const start = candidate.indexOf("{");
    const end = candidate.lastIndexOf("}");
    if (start === -1 || end === -1 || end < start) {
      throw new Error("Response contained no JSON object");
    }
    return JSON.parse(candidate.slice(start, end + 1));
  }

  private toWorkItem(group: AiGroup, chunk: GitCommit[], context: GroupingContext): WorkItem {
    // Filtering the chunk rather than mapping the cited hashes is deliberate:
    // it yields each commit at most once even if the model repeated a hash, and
    // it cannot invent a commit that is not in the chunk.
    const cited = chunk.filter((commit) => group.commitHashes.includes(commit.hash));
    const dates = cited.map((commit) => commit.date).sort();
    const files = Array.from(new Set(cited.flatMap((commit) => commit.files)));

    return {
      title: group.title.trim(),
      description: group.description.trim(),
      type: group.type,
      priority: group.priority,
      status: "complete",
      estimateHours: group.estimateHours,
      // Always from a real commit. The model is never trusted with a date, and
      // the response shape has no date field for it to fill in.
      completedDate: dates[dates.length - 1] ?? context.analysisDate,
      // The same provenance trio workItemsFromAnalysis attaches on the heuristic
      // path. ClickUp saved filters read "git-analyzed", and they are consumers a
      // grep cannot see — turning AI grouping on must not silently empty them.
      tags: Array.from(new Set([group.type, "git-analyzed", context.analysisDate])),
      provenance: {
        commits: cited,
        files,
        repository: context.repository,
        source: "git",
      },
    };
  }

  private buildPrompt(commits: GitCommit[]): string {
    const lines = commits.map(
      (commit) =>
        `${commit.hash} | ${commit.date} | ${commit.message} | ${commit.files.length} files | +${commit.insertions}/-${commit.deletions}`
    );

    return [
      "You are grouping git commits into units of work for a project management tool.",
      "",
      "Commits (hash | date | message | file count | churn):",
      ...lines,
      "",
      "Group these into units of work. Rules:",
      "1. Every commit hash above must appear in exactly one group's commitHashes.",
      "2. Never invent a commit hash. Use only the hashes listed above.",
      "3. `title` is a task title, not a commit subject: imperative mood, no",
      "   `feat(scope):` prefix, readable by someone who has not seen the diff.",
      "4. `description` states what the problem or goal was, not what the diff did.",
      "   Two sentences at most.",
      "5. `type` is one of: feature, bug-fix, improvement, refactor, documentation,",
      "   test, chore, release.",
      "6. `priority` is one of: urgent, high, normal, low. Use urgent for crashes,",
      "   data loss, and security issues.",
      "7. `estimateHours` is a positive number reflecting the work's scope.",
      "8. Group by unit of work, not by commit. Several commits that finish one",
      "   thing are one group. One commit touching unrelated things may be its own group.",
      "",
      "Respond with JSON only, in exactly this shape, and nothing else:",
      '{"groups":[{"title":"","description":"","type":"feature","priority":"normal","estimateHours":3,"commitHashes":[""]}]}',
    ].join("\n");
  }
}
