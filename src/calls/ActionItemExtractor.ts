/**
 * Turns a call transcript into reviewable action items.
 *
 * Modelled on AiCommitGrouper, which already solves this shape — LLM, parse
 * JSON, validate, fail safe — but with one deliberate difference in the failure
 * behaviour, and it is the whole design:
 *
 * **There is no fallback.** AiCommitGrouper falls back to a keyword heuristic
 * because the input (commits) definitely represents real work, so producing a
 * rougher grouping is better than producing nothing. A transcript is not like
 * that. Most conversation is not a commitment, and a keyword heuristic over
 * speech would file tasks for "we should probably", "can you look at", "I'll
 * think about" — inventing obligations from hedges. When extraction fails here,
 * the answer is no items and a stated reason. A missed action item costs a
 * follow-up; an invented one costs trust in everything else the system files.
 *
 * Nothing here throws.
 */

import { AiClient } from "../ai/AiClient.js";
import { actionItemIdentity, validateActionItems } from "./actionItemSchema.js";
import type { ActionItem } from "./actionItemSchema.js";

/**
 * Characters per request. Transcripts are far larger than commit lists — an
 * hour of speech is roughly 50k characters — so chunking is the normal path
 * rather than an edge case.
 */
const CHUNK_SIZE = 12_000;

export interface ExtractionResult {
  items: ActionItem[];
  /** Number of requests made. Surfaced so cost is observable. */
  chunks: number;
  /**
   * Why extraction produced nothing, or produced less than it might have.
   * Absent on a clean run. Present with items when SOME chunks failed —
   * a partial result the caller must be able to notice.
   *
   * Load-bearing: callers treat this as "do not trust this as the complete
   * list". Only set it for a genuine shortfall.
   */
  reason?: string;
  /**
   * Things worth saying that are NOT a shortfall — currently, duplicate items
   * dropped by the validator. The list is complete; this explains why it is
   * shorter than what the model returned.
   */
  notes?: string;
}

export class ActionItemExtractor {
  constructor(
    private client: AiClient,
    private chunkSize: number = CHUNK_SIZE
  ) {}

  async extract(transcript: string): Promise<ExtractionResult> {
    if (!transcript || transcript.trim().length === 0) {
      return { items: [], chunks: 0 };
    }

    if (!this.client.isConfigured) {
      return {
        items: [],
        chunks: 0,
        reason:
          "No AI provider is configured, so no action items were extracted. " +
          "Add a provider key to .env — see env.example.",
      };
    }

    const chunks = this.chunk(transcript);
    const items: ActionItem[] = [];
    const failures: string[] = [];
    /** Non-fatal losses — items the validator dropped rather than filed. */
    const dropped: string[] = [];

    console.log(`Extracting action items from ${transcript.length} characters in ${chunks.length} request(s)`);

    for (const [index, chunk] of chunks.entries()) {
      try {
        const { text } = await this.client.complete(this.buildPrompt(chunk));
        const parsed = this.parseJson(text);

        // Validated against THIS chunk, never the whole transcript. Passing the
        // full text would let an item cite a passage from a different chunk —
        // a chunked run laundering an invented quote into a valid-looking one,
        // since the model never saw the passage it would be credited with.
        const validation = validateActionItems(parsed, chunk);
        if (!validation.ok) throw new Error(validation.reason);

        // A dropped duplicate is not a failure, but it IS a difference between
        // what the model said and what was kept — and anything the caller
        // cannot see, the caller cannot check.
        for (const warning of validation.warnings ?? []) {
          dropped.push(`chunk ${index + 1}/${chunks.length}: ${warning}`);
        }
        items.push(...validation.items);
      } catch (error) {
        // Per-chunk isolation, unlike the grouper's all-or-nothing.
        //
        // The grouper must abandon the whole run because its invariant is
        // coverage: every commit in exactly one group, which a partial result
        // cannot satisfy. Action items have no such invariant — the items from
        // chunk 1 are just as valid whether or not chunk 4 parsed. Discarding
        // them would lose real requests to an unrelated failure. The reason is
        // reported so a partial result is never mistaken for a complete one.
        const reason = error instanceof Error ? error.message : String(error);
        failures.push(`chunk ${index + 1}/${chunks.length}: ${reason}`);
        console.warn(`Action item extraction failed for chunk ${index + 1}: ${reason}`);
      }
    }

    // `reason` and `notes` are kept apart deliberately, and it is not a
    // stylistic split. `reason` means THIS LIST MAY BE MISSING SOMETHING, and
    // callers act on it — TranscriptSweeper refuses to freeze an extraction
    // that carries one, because a partial list frozen onto a job becomes the
    // permanent record of what a call agreed. A dropped duplicate is the
    // opposite: the list is complete, it just has one fewer copy. Folding the
    // two together would abort sweeps over a benign tidy-up.
    return {
      items: this.dedupe(items),
      chunks: chunks.length,
      ...(failures.length > 0
        ? {
            reason:
              `${failures.length} of ${chunks.length} transcript chunk(s) could not be ` +
              `processed, so this list may be incomplete: ${failures.join("; ")}`,
          }
        : {}),
      ...(dropped.length > 0
        ? { notes: `Repeated items were dropped rather than filed twice: ${dropped.join("; ")}` }
        : {}),
    };
  }

  /**
   * Splits on paragraph then sentence boundaries, never mid-sentence.
   *
   * A chunk that ends mid-sentence truncates the only evidence an item can
   * cite, so the quote check would reject a genuine request on a technicality.
   * Chunks do not overlap: an overlapping window would show the same sentence
   * to two requests and produce the same action item twice, and the per-chunk
   * duplicate check cannot see across chunks.
   */
  private chunk(transcript: string): string[] {
    const text = transcript.trim();
    if (text.length <= this.chunkSize) return [text];

    // Paragraphs first (transcripts are usually one line per speaker turn),
    // then sentences for any single paragraph that is itself oversized.
    const units = text
      .split(/\n\s*\n|\n/)
      .flatMap((paragraph) =>
        paragraph.length <= this.chunkSize
          ? [paragraph]
          : (paragraph.match(/[^.!?]+[.!?]+\s*|[^.!?]+$/g) ?? [paragraph])
      )
      .map((unit) => unit.trim())
      .filter((unit) => unit.length > 0);

    const chunks: string[] = [];
    let current = "";

    for (const unit of units) {
      const candidate = current ? `${current}\n${unit}` : unit;

      if (candidate.length > this.chunkSize && current) {
        chunks.push(current);
        current = unit;
      } else {
        current = candidate;
      }
    }

    if (current) chunks.push(current);
    return chunks;
  }

  /**
   * Drops items another item has already claimed, across chunks.
   *
   * Two chunks can contain the same sentence if the transcript repeats itself,
   * and a speaker restating a request should not file it twice.
   *
   * Keyed on `actionItemIdentity` — the quote AND the request — not on the
   * quote alone. Keying on the quote was a second copy of the bug the
   * validator was just fixed for: a sentence carrying two commitments ("I'll
   * fix the export and Priya will send the NDA") got past the validator
   * correctly and then lost its second item here instead, which is why the
   * fix had to be made in both places at once. Sharing one function is what
   * stops them diverging again.
   */
  private dedupe(items: ActionItem[]): ActionItem[] {
    const seen = new Set<string>();
    return items.filter((item) => {
      const key = actionItemIdentity(item);
      if (seen.has(key)) return false;
      seen.add(key);
      return true;
    });
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

  private buildPrompt(transcript: string): string {
    return [
      "You are extracting action items from a call transcript for a project management tool.",
      "",
      "Transcript:",
      "---",
      transcript,
      "---",
      "",
      "Extract only things someone committed to doing, or was explicitly asked to do.",
      "",
      "Rules:",
      "1. Every item MUST include `quote`: the sentence from the transcript that",
      "   shows the request, copied EXACTLY, word for word. Do not paraphrase,",
      "   summarise, correct grammar, or fix transcription errors in the quote.",
      "   An item whose quote is not found in the transcript above is discarded.",
      "2. The quote must be at least 30 characters. Extend to the full sentence",
      "   rather than citing a fragment.",
      "3. If the transcript contains no action items, return an empty array. Do",
      "   not invent work to fill the response. An empty answer is a correct answer.",
      "4. Ideas, opinions, hedges and hypotheticals are NOT action items.",
      '   "We should probably think about X" is not a commitment. "I\'ll send you',
      '   the numbers by Friday" is.',
      "5. Do not create an item for something the transcript says is already done.",
      "6. `title` is a task title: imperative mood, readable by someone who was",
      "   not on the call.",
      "7. `description` states what was asked and any stated constraint or",
      "   deadline. Two sentences at most.",
      "8. `type` is one of: feature, bug-fix, improvement, refactor, documentation,",
      "   test, chore, release.",
      "9. `priority` is one of: urgent, high, normal, low.",
      "10. `estimateHours` is a positive number reflecting the work's scope.",
      "11. `speaker` is who committed or asked, if the transcript identifies them.",
      "    Omit it rather than guessing.",
      "",
      "Respond with JSON only, in exactly this shape, and nothing else:",
      '{"items":[{"title":"","description":"","type":"feature","priority":"normal","estimateHours":2,"quote":"","speaker":""}]}',
    ].join("\n");
  }
}
