'use client';

/**
 * Searching what was said in past calls.
 *
 * The archive only becomes useful once you can get back into it. Uploading and
 * sweeping both work forwards — audio in, tasks out — and neither answers the
 * question people actually come back with: *when did we talk about this, and
 * what exactly was said?*
 *
 * Two decisions shape the UI:
 *
 *  - **The excerpt is the result.** A list of filenames would technically be a
 *    search; it would also make you open every hit to find out which one you
 *    meant. The matched sentence, in context, with the phrase marked, is the
 *    answer — the recording it came from is just provenance.
 *  - **Requests are cancelled as you type.** Without that, a slow response to
 *    "con" can land after the response to "contract" and overwrite it, so the
 *    results contradict the box they came from. An `AbortController` per
 *    keystroke makes the last query the one that wins, always.
 */

import { useCallback, useEffect, useRef, useState } from 'react';
import Link from 'next/link';
import { Card } from '@/lib/components/ui';
import { messageFor } from '@/lib/api';
import {
  TranscriptHighlight,
  TranscriptSearchResult,
  formatDuration,
  formatTimestamp,
  searchTranscripts,
} from '@/lib/api/transcription';

/**
 * Pause after the last keystroke before searching.
 *
 * Long enough that a typed word is one request rather than eight, short enough
 * to still feel like it is keeping up.
 */
const DEBOUNCE_MS = 300;

/** Below this, a query matches so much that the results are noise. */
const MIN_QUERY_LENGTH = 2;

interface Filters {
  query: string;
  from: string;
  to: string;
}

const EMPTY: Filters = { query: '', from: '', to: '' };

/**
 * Renders an excerpt with the matched phrase marked.
 *
 * Uses the offsets the server computed rather than searching the excerpt again
 * here. Re-searching looks equivalent and is not: when the phrase occurs twice
 * in one excerpt, a local search marks the first occurrence, which may not be
 * the one this highlight is about — and the timestamp beside it would then
 * belong to a different moment than the marked text.
 */
function Excerpt({ highlight }: { highlight: TranscriptHighlight }) {
  const { text, matchStart, matchEnd } = highlight;
  const safeStart = Math.max(0, Math.min(matchStart, text.length));
  const safeEnd = Math.max(safeStart, Math.min(matchEnd, text.length));

  return (
    <p className="text-sm leading-relaxed text-foreground-secondary">
      {text.slice(0, safeStart)}
      <mark className="rounded bg-primary/25 px-0.5 font-medium text-foreground">
        {text.slice(safeStart, safeEnd)}
      </mark>
      {text.slice(safeEnd)}
    </p>
  );
}

function ResultCard({ result }: { result: TranscriptSearchResult }) {
  const title = result.callTitle?.trim() || result.originalFilename;
  const duration = formatDuration(result.durationSeconds);
  const recorded = result.callDate ?? result.createdAt.slice(0, 10);

  return (
    <li className="rounded-lg border border-border bg-background-secondary p-4">
      <div className="flex flex-wrap items-baseline justify-between gap-3">
        <Link
          href={`/transcripts/${result.id}`}
          className="font-medium text-foreground hover:text-primary hover:underline"
        >
          {title}
        </Link>

        <div className="flex flex-wrap items-center gap-2 text-xs text-foreground-tertiary">
          <span>{recorded}</span>
          {duration && <span>· {duration}</span>}
          {result.language && <span>· {result.language}</span>}
          {result.matchCount > 0 && (
            <span className="rounded bg-primary/15 px-1.5 py-0.5 font-medium text-primary">
              {result.matchCount} {result.matchCount === 1 ? 'mention' : 'mentions'}
            </span>
          )}
          {result.sweptAt && (
            <span
              className="rounded bg-success/15 px-1.5 py-0.5 font-medium text-success"
              title="Action items from this call have already been filed to ClickUp"
            >
              Filed
            </span>
          )}
        </div>
      </div>

      {result.callTitle && result.callTitle.trim() !== result.originalFilename && (
        <p className="mt-0.5 text-xs text-foreground-tertiary">{result.originalFilename}</p>
      )}

      {result.titleOnlyMatch ? (
        <p className="mt-3 text-sm italic text-foreground-tertiary">
          Matched on the title or filename — the phrase is not in what was said.
        </p>
      ) : (
        <ul className="mt-3 space-y-3">
          {result.highlights.map((highlight) => {
            const at = formatTimestamp(highlight.startSeconds);

            return (
              <li key={highlight.transcriptOffset} className="flex gap-3">
                {/*
                  A timestamp that cannot be reached is just a number. When we
                  have one, it links into the player at that exact second; when
                  the transcript no longer lines up with its audio there is
                  nothing honest to link to, so it renders inert.
                */}
                {at ? (
                  <Link
                    href={`/transcripts/${result.id}?t=${Math.floor(highlight.startSeconds!)}`}
                    className="mt-0.5 shrink-0 font-mono text-xs text-primary hover:underline"
                    title="Play the recording from here"
                  >
                    {at}
                  </Link>
                ) : (
                  <span
                    className="mt-0.5 shrink-0 font-mono text-xs text-foreground-tertiary"
                    title="This transcript was edited, so it no longer lines up with the audio"
                  >
                    --:--
                  </span>
                )}
                <Excerpt highlight={highlight} />
              </li>
            );
          })}
        </ul>
      )}

      {result.matchCount > result.highlights.length && (
        <p className="mt-2 text-xs text-foreground-tertiary">
          Showing {result.highlights.length} of {result.matchCount} mentions.
        </p>
      )}
    </li>
  );
}

export default function TranscriptSearch() {
  const [filters, setFilters] = useState<Filters>(EMPTY);
  const [results, setResults] = useState<TranscriptSearchResult[] | null>(null);
  const [searching, setSearching] = useState(false);
  const [error, setError] = useState<string | null>(null);
  /** The query the displayed results are for — not necessarily what is typed. */
  const [searchedFor, setSearchedFor] = useState('');

  const inFlight = useRef<AbortController | null>(null);

  const run = useCallback(async (next: Filters) => {
    // Whatever is still open is now answering a question nobody is asking.
    inFlight.current?.abort();
    const controller = new AbortController();
    inFlight.current = controller;

    setSearching(true);
    setError(null);

    try {
      const response = await searchTranscripts({
        query: next.query,
        from: next.from || undefined,
        to: next.to || undefined,
        signal: controller.signal,
      });

      setResults(response.results);
      setSearchedFor(response.query);
    } catch (caught) {
      // An abort is this component replacing its own request, not a failure.
      if (controller.signal.aborted) return;
      setError(messageFor(caught));
      setResults(null);
    } finally {
      // Guarded: a superseded request must not clear the spinner belonging to
      // the request that replaced it.
      if (!controller.signal.aborted) setSearching(false);
    }
  }, []);

  const trimmed = filters.query.trim();
  const tooShort = trimmed.length > 0 && trimmed.length < MIN_QUERY_LENGTH;

  useEffect(() => {
    if (tooShort) return;

    const timer = setTimeout(() => void run(filters), DEBOUNCE_MS);
    return () => clearTimeout(timer);
  }, [filters, run, tooShort]);

  // Abort on unmount, so navigating away mid-search does not leave a request
  // that resolves into a component that is gone.
  useEffect(() => () => inFlight.current?.abort(), []);

  const update = (patch: Partial<Filters>) => setFilters((current) => ({ ...current, ...patch }));
  const filtered = Boolean(trimmed || filters.from || filters.to);

  return (
    <div className="space-y-6">
      <Card>
        <div className="space-y-4">
          <div>
            <label htmlFor="transcript-query" className="mb-1.5 block text-sm font-medium text-foreground">
              Search what was said
            </label>
            <input
              id="transcript-query"
              type="search"
              value={filters.query}
              onChange={(event) => update({ query: event.target.value })}
              placeholder="A name, a phrase, anything you remember — “signed contract”, “Priya”"
              className="w-full rounded-md border border-border bg-background px-3 py-2 text-sm text-foreground placeholder:text-foreground-tertiary focus:border-primary focus:outline-none"
            />
            <p className="mt-1.5 text-xs text-foreground-tertiary">
              Matches anywhere in the text, including part of a word, and ignores case. Only
              finished transcriptions are searched.
            </p>
          </div>

          <div className="flex flex-wrap items-end gap-4">
            <div>
              <label htmlFor="transcript-from" className="mb-1.5 block text-xs font-medium text-foreground-secondary">
                From
              </label>
              <input
                id="transcript-from"
                type="date"
                value={filters.from}
                max={filters.to || undefined}
                onChange={(event) => update({ from: event.target.value })}
                className="rounded-md border border-border bg-background px-3 py-2 text-sm text-foreground focus:border-primary focus:outline-none"
              />
            </div>
            <div>
              <label htmlFor="transcript-to" className="mb-1.5 block text-xs font-medium text-foreground-secondary">
                To
              </label>
              <input
                id="transcript-to"
                type="date"
                value={filters.to}
                min={filters.from || undefined}
                onChange={(event) => update({ to: event.target.value })}
                className="rounded-md border border-border bg-background px-3 py-2 text-sm text-foreground focus:border-primary focus:outline-none"
              />
            </div>

            {filtered && (
              <button
                type="button"
                onClick={() => setFilters(EMPTY)}
                className="rounded-md px-3 py-2 text-sm text-foreground-secondary transition-colors hover:bg-background-tertiary hover:text-foreground"
              >
                Clear
              </button>
            )}
          </div>

          {tooShort && (
            <p className="text-xs text-foreground-tertiary">
              Keep typing — at least {MIN_QUERY_LENGTH} characters.
            </p>
          )}
        </div>
      </Card>

      {error && (
        <div className="rounded-lg border border-error bg-error/10 p-4 text-sm text-error">
          {error}
        </div>
      )}

      {searching && !results && <p className="text-sm text-foreground-tertiary">Searching…</p>}

      {results && results.length === 0 && (
        <Card>
          <p className="text-sm text-foreground-secondary">
            {searchedFor
              ? `Nothing matched “${searchedFor}”.`
              : 'No finished transcriptions yet.'}{' '}
            <Link href="/transcripts" className="text-primary hover:underline">
              Upload a recording
            </Link>
            .
          </p>
        </Card>
      )}

      {results && results.length > 0 && (
        <>
          <p className="text-sm text-foreground-tertiary">
            {results.length} recording{results.length === 1 ? '' : 's'}
            {searchedFor && <> mentioning “{searchedFor}”</>}
            {searching && <> · updating…</>}
          </p>
          <ul className="space-y-3">
            {results.map((result) => (
              <ResultCard key={result.id} result={result} />
            ))}
          </ul>
        </>
      )}
    </div>
  );
}
