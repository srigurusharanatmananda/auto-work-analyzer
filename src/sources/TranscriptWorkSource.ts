/**
 * Adapts extracted action items onto the canonical WorkItem.
 *
 * The point of this file is how little it does. Once a transcript has become
 * `WorkItem[]`, the whole existing pipeline applies unchanged — `buildPreview`,
 * `annotateStatusMapping`, `createRenderedTasks`, `DestinationResolver`,
 * templates, status mapping, the lot. Nothing downstream needs to know the work
 * came from a call rather than a repository. If this file ever starts building
 * a task name or a description prefix, the canonical pipeline has been bypassed
 * and preview/created parity is broken.
 */

import { WorkItem } from "../domain/WorkItem.js";
import { ActionItemExtractor } from "../calls/ActionItemExtractor.js";
import type { ActionItem } from "../calls/actionItemSchema.js";
import type { AiClient } from "../ai/AiClient.js";

export interface TranscriptContext {
  /** ISO yyyy-mm-dd of the call. Used for the due-date source and a tag. */
  callDate?: string;
  /** Shown in tags so tasks from one call can be found together. */
  callTitle?: string;
}

export interface TranscriptWorkResult {
  items: WorkItem[];
  /** Present when extraction produced nothing, or an incomplete list. */
  reason?: string;
}

/** Trims and drops empties, so a tag list never contains "". */
function tagsFor(item: ActionItem, context: TranscriptContext): string[] {
  return Array.from(
    new Set(
      [
        item.type,
        // The provenance marker, mirroring "git-analyzed" on the git path.
        // ClickUp saved filters read these, and they are consumers a grep
        // cannot see.
        "call-transcript",
        context.callDate,
        context.callTitle,
      ]
        .filter((tag): tag is string => typeof tag === "string")
        .map((tag) => tag.trim())
        .filter((tag) => tag.length > 0)
    )
  );
}

export function workItemFromActionItem(
  item: ActionItem,
  context: TranscriptContext = {}
): WorkItem {
  return {
    title: item.title.trim(),
    description: item.description.trim(),
    type: item.type,
    priority: item.priority,
    // NOT "complete", which is what the git path uses because a commit is
    // finished work by definition. An action item is the opposite: it is a
    // request that has not been done yet. Filing these as complete would create
    // a list of closed tasks nobody ever does.
    status: "to do",
    estimateHours: item.estimateHours,
    // No completedDate: nothing has been completed. The git path sets it from a
    // real commit date; there is no equivalent here and inventing one from the
    // call date would assert that the work happened during the call.
    tags: tagsFor(item, context),
    provenance: {
      commits: [],
      files: [],
      source: "transcript",
      // Carried through to the reviewer. This is the evidence the item is real,
      // and it is the reason the whole extractor exists.
      quote: item.quote,
      ...(item.speaker ? { speaker: item.speaker } : {}),
    },
  };
}

/**
 * Transcript text in, WorkItem[] out.
 *
 * Returns an empty list rather than throwing when extraction fails or finds
 * nothing — with `reason` set, so the caller can tell "this call had no action
 * items" apart from "extraction did not work", which look identical otherwise
 * and mean very different things.
 */
export async function workItemsFromTranscript(
  transcript: string,
  client: AiClient,
  context: TranscriptContext = {}
): Promise<TranscriptWorkResult> {
  const extraction = await new ActionItemExtractor(client).extract(transcript);

  return {
    items: extraction.items.map((item) => workItemFromActionItem(item, context)),
    ...(extraction.reason ? { reason: extraction.reason } : {}),
  };
}
