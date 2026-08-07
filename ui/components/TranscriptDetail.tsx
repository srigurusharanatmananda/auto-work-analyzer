'use client';

/**
 * One recording: the audio, and the transcript lined up against it.
 *
 * This is what makes the timestamps on the search page worth having. Until now
 * a search could tell you a phrase was said at 12:34 and then leave you to find
 * 12:34 yourself, in a file on a server you have no way to open.
 *
 * The two directions both matter, and only one of them is obvious:
 *
 *  - **Click a line, hear it.** The obvious one.
 *  - **Play, and the transcript follows.** The line being spoken is
 *    highlighted and scrolled to. Without it, listening to a long stretch means
 *    losing your place in the text within about a minute, and the pairing stops
 *    being useful exactly when the recording is long enough to need it.
 */

import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import Link from 'next/link';
import { useSearchParams } from 'next/navigation';
import { Card } from '@/lib/components/ui';
import { messageFor } from '@/lib/api';
import {
  TranscriptSegment,
  TranscriptionJob,
  formatDuration,
  formatTimestamp,
  getTranscriptionJob,
  playbackSrc,
  requestAudioUrl,
} from '@/lib/api/transcription';

/**
 * Finds the segment covering a time, by binary search.
 *
 * Called on every `timeupdate` — four times a second, against a transcript that
 * can run to thousands of segments. A linear scan is fine until it is not, and
 * "not" here is a page that stutters while playing.
 */
function segmentIndexAt(segments: TranscriptSegment[], time: number): number {
  let low = 0;
  let high = segments.length - 1;
  let found = -1;

  while (low <= high) {
    const mid = (low + high) >> 1;
    const segment = segments[mid]!;

    if (time < segment.start) high = mid - 1;
    else if (time >= segment.end) low = mid + 1;
    else return mid;
  }

  // Between segments — a pause. Keep the line just finished highlighted rather
  // than clearing it, so the highlight does not flicker off at every breath.
  found = high;
  return found >= 0 ? found : -1;
}

export default function TranscriptDetail({ jobId }: { jobId: string }) {
  const searchParams = useSearchParams();
  /** `?t=` deep link, from a search result. Read once — see below. */
  const initialSeek = useMemo(() => {
    const raw = searchParams.get('t');
    const seconds = raw === null ? NaN : Number(raw);
    return Number.isFinite(seconds) && seconds >= 0 ? seconds : null;
  }, [searchParams]);

  const [job, setJob] = useState<TranscriptionJob | null>(null);
  const [audioUrl, setAudioUrl] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [activeIndex, setActiveIndex] = useState(-1);
  const [audioBroken, setAudioBroken] = useState(false);

  const audioRef = useRef<HTMLAudioElement | null>(null);
  const activeRef = useRef<HTMLLIElement | null>(null);
  /** So a `?t=` deep link seeks once, and not again on every metadata event. */
  const seekedOnce = useRef(false);

  useEffect(() => {
    let cancelled = false;

    (async () => {
      try {
        const loaded = await getTranscriptionJob(jobId);
        if (cancelled) return;
        setJob(loaded);

        // Only finished jobs have audio worth offering. Asking for a playback
        // URL for a queued one would mint a capability for a file that is not
        // there yet and fail confusingly.
        if (loaded.status === 'succeeded') {
          const playback = await requestAudioUrl(jobId);
          if (!cancelled) setAudioUrl(playbackSrc(playback.url));
        }
      } catch (caught) {
        if (!cancelled) setError(messageFor(caught));
      } finally {
        if (!cancelled) setLoading(false);
      }
    })();

    return () => {
      cancelled = true;
    };
  }, [jobId]);

  const segments = job?.segments ?? [];

  const seekTo = useCallback((seconds: number) => {
    const audio = audioRef.current;
    if (!audio) return;

    audio.currentTime = seconds;
    // Deliberately fire-and-forget. Autoplay policies reject `play()` when
    // there has been no user gesture, and an unhandled rejection in the console
    // for a deep link that legitimately cannot autoplay is just noise.
    void audio.play().catch(() => {});
  }, []);

  /** Keeps the highlighted line in view without fighting a manual scroll. */
  useEffect(() => {
    activeRef.current?.scrollIntoView({ block: 'nearest', behavior: 'smooth' });
  }, [activeIndex]);

  if (loading) return <p className="text-sm text-foreground-tertiary">Loading…</p>;

  if (error) {
    return (
      <div className="rounded-lg border border-error bg-error/10 p-4 text-sm text-error">
        {error}
      </div>
    );
  }

  if (!job) return null;

  const title = job.callTitle?.trim() || job.originalFilename;
  const duration = formatDuration(job.durationSeconds);

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-start justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold text-foreground">{title}</h1>
          <p className="mt-1 text-sm text-foreground-tertiary">
            {job.originalFilename}
            {job.callDate && <> · {job.callDate}</>}
            {duration && <> · {duration}</>}
            {job.language && <> · {job.language}</>}
          </p>
        </div>

        <Link
          href="/transcripts/search"
          className="rounded-md border border-border px-4 py-2 text-sm font-medium text-foreground-secondary transition-colors hover:bg-background-tertiary hover:text-foreground"
        >
          Back to search
        </Link>
      </div>

      {job.status !== 'succeeded' ? (
        <Card>
          <p className="text-sm text-foreground-secondary">
            This recording is {job.status}. {job.error}
          </p>
        </Card>
      ) : (
        <>
          <Card>
            {audioBroken ? (
              <p className="text-sm text-foreground-secondary">
                The audio for this recording could not be played — the file may have been
                cleaned up. The transcript below is unaffected.
              </p>
            ) : (
              audioUrl && (
                // eslint-disable-next-line jsx-a11y/media-has-caption -- the transcript below IS the caption
                <audio
                  ref={audioRef}
                  src={audioUrl}
                  controls
                  /*
                   * The API is on a different origin from the UI. Without this
                   * the media request is made in no-cors mode, the response is
                   * opaque, and the element cannot read Content-Range — so it
                   * never learns the duration and the player sits at
                   * readyState 0 with a dead scrubber and no error.
                   * `anonymous` because the URL carries its own capability
                   * token; no cookies are wanted here.
                   */
                  crossOrigin="anonymous"
                  preload="metadata"
                  className="w-full"
                  onLoadedMetadata={() => {
                    if (seekedOnce.current || initialSeek === null) return;
                    seekedOnce.current = true;
                    seekTo(initialSeek);
                  }}
                  onTimeUpdate={(event) =>
                    setActiveIndex(segmentIndexAt(segments, event.currentTarget.currentTime))
                  }
                  onError={() => setAudioBroken(true)}
                />
              )
            )}
          </Card>

          <Card>
            {segments.length > 0 ? (
              <ul className="max-h-[60vh] space-y-1 overflow-y-auto">
                {segments.map((segment, index) => {
                  const active = index === activeIndex;

                  return (
                    <li key={`${segment.start}-${index}`} ref={active ? activeRef : null}>
                      <button
                        type="button"
                        onClick={() => seekTo(segment.start)}
                        className={`flex w-full gap-3 rounded px-2 py-1.5 text-left transition-colors ${
                          active
                            ? 'bg-primary/15 text-foreground'
                            : 'text-foreground-secondary hover:bg-background-tertiary'
                        }`}
                      >
                        <span className="mt-0.5 shrink-0 font-mono text-xs text-foreground-tertiary">
                          {formatTimestamp(segment.start)}
                        </span>
                        <span className="text-sm leading-relaxed">{segment.text.trim()}</span>
                      </button>
                    </li>
                  );
                })}
              </ul>
            ) : (
              /**
               * A pasted transcript, or one whose segments were lost. Still
               * worth showing — the text is the point; only the seeking is
               * unavailable.
               */
              <p className="whitespace-pre-wrap text-sm leading-relaxed text-foreground-secondary">
                {job.transcript?.trim() || 'This recording produced no speech.'}
              </p>
            )}
          </Card>
        </>
      )}
    </div>
  );
}
