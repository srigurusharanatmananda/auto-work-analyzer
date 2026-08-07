'use client';

/**
 * The recordings this user has uploaded, and what became of them.
 *
 * Transcription is a background job, so without this list the feature has a
 * hole you fall into by doing the obvious thing: upload a forty-minute call,
 * close the tab, come back — the job finished, the transcript is in the
 * database, and there is no way to reach it. The upload screen alone only works
 * if you sit and wait.
 *
 * It also polls while anything is active, which is what makes leaving the page
 * safe rather than merely survivable: a job that was running when you left is
 * still shown running when you return, and finishes in front of you.
 */

import { useCallback, useEffect, useState } from 'react';
import toast from 'react-hot-toast';
import { Card } from '@/lib/components/ui';
import { messageFor } from '@/lib/api';
import { useApiQuery } from '@/lib/api/useApiQuery';
import {
  TranscriptionJob,
  cancelTranscription,
  isJobActive,
} from '@/lib/api/transcription';

/** How often to re-read while a job is queued or running. */
const POLL_MS = 5000;

const STATUS_STYLES: Record<TranscriptionJob['status'], string> = {
  queued: 'bg-foreground/10 text-foreground-secondary',
  running: 'bg-primary/20 text-primary',
  succeeded: 'bg-success/20 text-success',
  failed: 'bg-error/20 text-error',
  cancelled: 'bg-foreground/10 text-foreground-tertiary',
};

const STATUS_LABELS: Record<TranscriptionJob['status'], string> = {
  queued: 'Waiting',
  running: 'Transcribing',
  succeeded: 'Ready',
  failed: 'Failed',
  cancelled: 'Cancelled',
};

function formatDuration(seconds: number | null | undefined): string | null {
  if (!seconds || seconds <= 0) return null;
  const minutes = Math.floor(seconds / 60);
  const rest = Math.round(seconds % 60);
  return minutes > 0 ? `${minutes}m ${rest}s` : `${rest}s`;
}

/** First line of the transcript, as a hint at what the call was about. */
function preview(transcript: string | null | undefined): string | null {
  const trimmed = transcript?.trim();
  if (!trimmed) return null;
  return trimmed.length > 140 ? `${trimmed.slice(0, 140)}…` : trimmed;
}

export interface RecentTranscriptionsProps {
  /** Load a finished transcript into the editor above. */
  onUse: (job: TranscriptionJob) => void;
  /**
   * Changing this re-reads the list. The upload flow bumps it so a just-finished
   * job appears without waiting for the next poll.
   */
  refreshToken?: number;
}

export default function RecentTranscriptions({ onUse, refreshToken }: RecentTranscriptionsProps) {
  const { data, error, isLoading, reload } = useApiQuery<TranscriptionJob[]>(
    '/transcription/jobs',
    { errorMessage: 'Could not load your recordings' }
  );
  const [cancelling, setCancelling] = useState<string | null>(null);

  const jobs = data ?? [];
  const hasActive = jobs.some(isJobActive);

  useEffect(() => {
    if (refreshToken === undefined) return;
    void reload();
    // `reload` is stable per path; re-running on it would poll every render.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [refreshToken]);

  useEffect(() => {
    if (!hasActive) return;
    const timer = setInterval(() => void reload(), POLL_MS);
    return () => clearInterval(timer);
  }, [hasActive, reload]);

  const handleCancel = useCallback(
    async (job: TranscriptionJob) => {
      setCancelling(job.id);
      try {
        await cancelTranscription(job.id);
        toast.success(`Cancelled ${job.originalFilename}`);
        await reload();
      } catch (caught) {
        // The common case is a 409: the worker picked it up between the list
        // being drawn and the button being pressed. Saying so beats "failed".
        toast.error(messageFor(caught, 'Could not cancel that job'));
        await reload();
      } finally {
        setCancelling(null);
      }
    },
    [reload]
  );

  // Nothing uploaded yet is the normal first-run state, not a section worth
  // showing an empty box for.
  if (!isLoading && !error && jobs.length === 0) return null;

  return (
    <Card className="p-8">
      <div className="mb-4 flex items-center justify-between gap-4">
        <div>
          <h2 className="text-xl font-bold text-foreground">Your recordings</h2>
          <p className="mt-1 text-sm text-foreground-secondary">
            Transcription runs in the background — anything finished here can be reused without
            uploading it again.
          </p>
        </div>
        <button
          type="button"
          onClick={() => void reload()}
          className="shrink-0 text-sm text-primary hover:underline"
        >
          Refresh
        </button>
      </div>

      {error && (
        <div className="rounded-r-lg border-l-4 border-error bg-error/10 p-4">
          <p className="text-sm text-error">{error}</p>
        </div>
      )}

      {isLoading && jobs.length === 0 && (
        <p className="text-sm text-foreground-tertiary">Loading…</p>
      )}

      <ul className="divide-y divide-border">
        {jobs.map((job) => {
          const duration = formatDuration(job.durationSeconds);
          const snippet = preview(job.transcript);

          return (
            <li key={job.id} className="flex flex-wrap items-start justify-between gap-4 py-4">
              <div className="min-w-0 flex-1">
                <div className="flex flex-wrap items-center gap-2">
                  <span
                    className={`rounded px-2 py-0.5 text-xs font-medium ${STATUS_STYLES[job.status]}`}
                  >
                    {STATUS_LABELS[job.status]}
                    {job.status === 'running' && job.segmentsSeen
                      ? ` · ${job.segmentsSeen} segments`
                      : ''}
                  </span>
                  <span className="min-w-0 truncate font-medium text-foreground">
                    {job.callTitle || job.originalFilename}
                  </span>
                </div>

                <p className="mt-1 text-xs text-foreground-tertiary">
                  {[job.callDate, duration, job.language?.toUpperCase()]
                    .filter(Boolean)
                    .join(' · ') || job.originalFilename}
                </p>

                {job.status === 'failed' && job.error && (
                  <p className="mt-2 text-sm text-error">{job.error}</p>
                )}

                {snippet && (
                  <p className="mt-2 text-sm italic text-foreground-secondary">“{snippet}”</p>
                )}
              </div>

              <div className="flex shrink-0 items-center gap-3">
                {/* A succeeded job with no speech has nothing to load, and
                    offering the button would produce an empty editor and no
                    explanation. */}
                {job.status === 'succeeded' && job.transcript?.trim() && (
                  <button
                    type="button"
                    onClick={() => onUse(job)}
                    className="rounded-md bg-primary/10 px-3 py-1.5 text-sm font-medium text-primary transition-colors hover:bg-primary/20"
                  >
                    Use this transcript
                  </button>
                )}
                {job.status === 'succeeded' && !job.transcript?.trim() && (
                  <span className="text-sm text-foreground-tertiary">No speech found</span>
                )}
                {job.status === 'queued' && (
                  <button
                    type="button"
                    onClick={() => void handleCancel(job)}
                    disabled={cancelling === job.id}
                    className="text-sm text-foreground-tertiary transition-colors hover:text-error hover:underline disabled:opacity-50"
                  >
                    {cancelling === job.id ? 'Cancelling…' : 'Cancel'}
                  </button>
                )}
              </div>
            </li>
          );
        })}
      </ul>
    </Card>
  );
}
