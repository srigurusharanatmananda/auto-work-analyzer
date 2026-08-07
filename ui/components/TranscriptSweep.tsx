'use client';

/**
 * Filing action items from every finished recording at once.
 *
 * The paste-and-review flow on the Transcripts page handles one call carefully.
 * This handles a backlog: you recorded four calls this week and want the
 * commitments out of them without opening each one.
 *
 * ## Why the dry run is not optional
 *
 * Every other path into ClickUp in this app shows you the tasks first and waits
 * for you to press a button. This one creates tasks from several calls with no
 * per-item review, so the preview is the review — it is the only place you see
 * what is about to be filed while it can still be stopped.
 *
 * The component therefore cannot file anything you have not previewed: "File
 * these" only appears once a dry run has returned, and any change to the
 * grouping throws the preview away. The server agrees independently — `dryRun`
 * defaults to true there, so a request that forgets the flag is the safe one.
 */

import { useCallback, useState } from 'react';
import toast from 'react-hot-toast';
import { Card } from '@/lib/components/ui';
import { messageFor } from '@/lib/api';
import {
  SweepSummary,
  TranscriptGrouping,
  runTranscriptSweep,
} from '@/lib/api/transcription';

const GROUPING_LABELS: Record<TranscriptGrouping, string> = {
  'per-item': 'One task per action item',
  'single-task': 'One task per call',
  'by-theme': 'Group related items by theme',
};

function JobRow({ job, dryRun }: { job: SweepSummary['jobs'][number]; dryRun: boolean }) {
  const title = job.callTitle?.trim() || job.filename;

  return (
    <li className="py-3">
      <div className="flex flex-wrap items-baseline justify-between gap-2">
        <span className="font-medium text-foreground">{title}</span>

        <span className="text-xs text-foreground-tertiary">
          {job.error ? (
            <span className="text-error">{job.error}</span>
          ) : dryRun ? (
            `${job.wouldCreate?.length ?? 0} task(s) would be created`
          ) : (
            `${job.tasksCreated} created`
          )}
          {job.alreadyFiled > 0 && <> · {job.alreadyFiled} already filed</>}
          {/*
            Worth surfacing: it means this job was swept before and the items
            you are looking at are the ones frozen then, not a fresh reading of
            the transcript.
          */}
          {job.reusedExtraction && <> · reusing earlier extraction</>}
          {job.destination && <> · {job.destination}</>}
        </span>
      </div>

      {job.wouldCreate && job.wouldCreate.length > 0 && (
        <ul className="mt-2 space-y-1">
          {job.wouldCreate.map((task, index) => (
            <li key={`${task.name}-${index}`} className="text-sm text-foreground-secondary">
              · {task.name}
            </li>
          ))}
        </ul>
      )}
    </li>
  );
}

export default function TranscriptSweep() {
  const [grouping, setGrouping] = useState<TranscriptGrouping>('per-item');
  const [preview, setPreview] = useState<SweepSummary | null>(null);
  const [result, setResult] = useState<SweepSummary | null>(null);
  const [busy, setBusy] = useState<null | 'preview' | 'file'>(null);
  const [error, setError] = useState<string | null>(null);

  const run = useCallback(
    async (dryRun: boolean) => {
      setBusy(dryRun ? 'preview' : 'file');
      setError(null);

      try {
        const summary = await runTranscriptSweep({ dryRun, grouping });

        if (dryRun) {
          setPreview(summary);
          setResult(null);
        } else {
          setResult(summary);
          // The preview described work that no longer exists — those jobs are
          // filed now. Leaving it on screen invites filing them twice.
          setPreview(null);
          toast.success(`Created ${summary.totalTasksCreated} task(s).`);
        }
      } catch (caught) {
        setError(messageFor(caught));
      } finally {
        setBusy(null);
      }
    },
    [grouping]
  );

  const summary = result ?? preview;
  const dryRun = result === null;
  const nothingToDo = preview !== null && preview.jobs.length === 0;

  return (
    <Card className="p-8">
      <div className="mb-4">
        <h2 className="text-xl font-bold text-foreground">File a backlog</h2>
        <p className="mt-1 text-sm text-foreground-secondary">
          Pulls the action items out of every finished recording you have not filed yet. Preview
          first — this creates real tasks with no per-item review.
        </p>
      </div>

      <fieldset className="mb-4">
        <legend className="mb-2 text-sm font-medium text-foreground">Shape the tasks</legend>
        <div className="space-y-1.5">
          {(Object.keys(GROUPING_LABELS) as TranscriptGrouping[]).map((option) => (
            <label key={option} className="flex items-center gap-2 text-sm text-foreground-secondary">
              <input
                type="radio"
                name="sweep-grouping"
                value={option}
                checked={grouping === option}
                onChange={() => {
                  setGrouping(option);
                  // The preview was for a different shape. Keeping it would let
                  // you approve one set of tasks and file another.
                  setPreview(null);
                  setResult(null);
                }}
                className="accent-primary"
              />
              {GROUPING_LABELS[option]}
            </label>
          ))}
        </div>
      </fieldset>

      <div className="flex flex-wrap items-center gap-3">
        <button
          type="button"
          onClick={() => void run(true)}
          disabled={busy !== null}
          className="rounded-md border border-border px-4 py-2 text-sm font-medium text-foreground-secondary transition-colors hover:bg-background-tertiary hover:text-foreground disabled:opacity-50"
        >
          {busy === 'preview' ? 'Checking…' : 'Preview'}
        </button>

        {/* Only reachable after a preview, and only when it found something. */}
        {preview && preview.jobs.length > 0 && (
          <button
            type="button"
            onClick={() => void run(false)}
            disabled={busy !== null}
            className="rounded-md bg-primary px-4 py-2 text-sm font-medium text-white transition-colors hover:bg-primary/90 disabled:opacity-50"
          >
            {busy === 'file'
              ? 'Filing…'
              : `File these to ClickUp (${preview.jobs.reduce(
                  (total, job) => total + (job.wouldCreate?.length ?? 0),
                  0
                )})`}
          </button>
        )}
      </div>

      {error && (
        <div className="mt-4 rounded-lg border border-error bg-error/10 p-4 text-sm text-error">
          {error}
        </div>
      )}

      {nothingToDo && (
        <p className="mt-4 text-sm text-foreground-secondary">
          Nothing to file — every finished recording has already been swept.
        </p>
      )}

      {summary && summary.jobs.length > 0 && (
        <div className="mt-4">
          <p className="text-sm text-foreground-tertiary">
            {dryRun
              ? `${summary.jobs.length} recording(s) would produce tasks. Nothing has been created yet.`
              : `Swept ${summary.jobs.length} recording(s), created ${summary.totalTasksCreated} task(s).`}
          </p>
          <ul className="mt-2 divide-y divide-border">
            {summary.jobs.map((job) => (
              <JobRow key={job.jobId} job={job} dryRun={dryRun} />
            ))}
          </ul>
        </div>
      )}
    </Card>
  );
}
