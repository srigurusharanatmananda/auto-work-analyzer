'use client';

/**
 * Call transcript -> reviewed action items -> ClickUp tasks.
 *
 * Two decisions here differ deliberately from NotesTab, which is otherwise the
 * closest precedent (paste text, get tasks):
 *
 * 1. **There is no "create automatically" option.** NotesTab has one, checked by
 *    default, because a note is something the user wrote themselves — they have
 *    already reviewed it by authoring it. A transcript is not: the items come
 *    from a model reading someone else's speech. Every extracted item cites the
 *    sentence it came from and the backend has already checked that the sentence
 *    is really in the transcript, but "was said" is not "is worth filing" — an
 *    accurately-quoted "we should probably look at that some day" passes
 *    validation. The citation is only worth carrying if a human reads it, so
 *    extraction and creation are always two steps.
 *
 * 2. **Creation posts back the previewed work items, never the transcript.**
 *    Extraction is a model call and is not deterministic. Re-sending the
 *    transcript to /api/create-tasks would re-extract and create a different set
 *    of tasks from the one just approved, and nothing in the response would look
 *    wrong. `PreviewWorkItem` values are therefore round-tripped untouched.
 *    (Pinned server-side by "creating does not re-run extraction" in
 *    tasks.routes.transcript.nodetest.ts.)
 *
 * Items arrive selected. The guard against invented tasks is the backend
 * validator, which cannot be clicked past; this screen's job is to put the
 * evidence in front of someone, and defaulting to nothing-selected mostly
 * teaches people to hit "select all".
 */

import { useMemo, useRef, useState, ChangeEvent } from 'react';
import toast from 'react-hot-toast';
import { Card, Button } from '@/lib/components/ui';
import { api, messageFor } from '@/lib/api';
import {
  AUDIO_EXTENSIONS,
  TEXT_EXTENSIONS,
  TranscriptionJob,
  isAudioFile,
  uploadAudio,
  waitForTranscript,
} from '@/lib/api/transcription';
import { CreatedTask, PreviewWorkItem, RenderedTaskPreview } from '@/types';

interface PreviewState {
  items: RenderedTaskPreview[];
  warnings: string[];
  destination: { id: string; name: string; listName?: string } | null;
  template: { id: string; name: string };
}

const SAMPLE_TRANSCRIPT = `Priya: Before we wrap up — the CSV export is dropping the last row for anyone with more than a thousand records.
Sam: I can take that. I'll have a fix out by Thursday.
Priya: Thanks. Also, a few customers have asked for dark mode on the dashboard.
Sam: Noted, but that's a bigger piece of work. Let's size it next sprint.
Priya: Fine. We should probably rewrite the whole reporting module at some point.
Sam: Maybe next quarter. Not committing to that today.`;

/** What `POST /api/preview-tasks` returns for a transcript. */
interface PreviewPayload {
  items: RenderedTaskPreview[];
  warnings?: string[];
  destination?: PreviewState['destination'];
  template: PreviewState['template'];
}

interface CreatePayload {
  tasksCreated: number;
  tasks: CreatedTask[];
  failedTasks?: unknown[];
}

export default function TranscriptTab() {
  const [transcript, setTranscript] = useState('');
  const [fileName, setFileName] = useState('');
  const [callTitle, setCallTitle] = useState('');
  const [callDate, setCallDate] = useState('');

  /**
   * The in-flight transcription, or null. Held as the job itself rather than a
   * boolean so the progress line can show which stage it is at and how many
   * segments have come back — a 40-minute recording is several minutes of
   * nothing otherwise, which reads as a hang.
   */
  const [transcribing, setTranscribing] = useState<TranscriptionJob | null>(null);
  const transcribeAbort = useRef<AbortController | null>(null);

  const [extracting, setExtracting] = useState(false);
  const [creating, setCreating] = useState(false);
  const [preview, setPreview] = useState<PreviewState | null>(null);
  /** Index-keyed so unchecking an item cannot reorder or mutate the others. */
  const [approved, setApproved] = useState<Set<number>>(new Set());
  const [created, setCreated] = useState<CreatedTask[] | null>(null);
  const [error, setError] = useState<string | null>(null);

  const approvedItems = useMemo<PreviewWorkItem[]>(
    () =>
      preview
        ? preview.items.filter((_, index) => approved.has(index)).map((entry) => entry.workItem)
        : [],
    [preview, approved]
  );

  const handleFileSelect = (event: ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    if (!file) return;

    setFileName(file.name);
    if (isAudioFile(file)) {
      void handleAudio(file);
      return;
    }

    const reader = new FileReader();
    reader.onload = (loaded) => setTranscript((loaded.target?.result as string) ?? '');
    reader.readAsText(file);
    toast.success(`Loaded ${file.name}`, { duration: 2000 });
  };

  /**
   * Audio takes the long way round: upload, then poll a queued job.
   *
   * The transcript lands in the same textarea a pasted one would, rather than
   * going straight to extraction. Whisper mishears names and numbers, and the
   * quote guard can only check that a sentence appears in the transcript it was
   * given — it cannot know the transcript itself is wrong. Putting the text in
   * front of someone, editable, before any model reads it is the only place
   * that error can still be caught.
   */
  const handleAudio = async (file: File) => {
    reset();
    setTranscript('');

    const controller = new AbortController();
    transcribeAbort.current = controller;
    const toastId = toast.loading(`Uploading ${file.name}…`);

    try {
      const queued = await uploadAudio({
        file,
        ...(callTitle.trim() ? { callTitle: callTitle.trim() } : {}),
        ...(callDate ? { callDate } : {}),
      });
      setTranscribing(queued);
      toast.loading('Transcribing — this runs in the background', { id: toastId });

      const done = await waitForTranscript(queued.id, {
        onProgress: setTranscribing,
        signal: controller.signal,
      });

      setTranscript(done.transcript ?? '');
      if (done.callTitle && !callTitle.trim()) setCallTitle(done.callTitle);

      toast.success(
        done.transcript?.trim()
          ? 'Transcribed — check it reads correctly, then extract'
          : 'Transcribed, but no speech was found in the audio',
        { id: toastId, duration: 5000 }
      );
    } catch (caught) {
      if (caught instanceof Error && caught.name === 'AbortError') {
        toast.dismiss(toastId);
        return;
      }
      const message = messageFor(caught, 'Transcription failed');
      setError(message);
      toast.error(message, { id: toastId, duration: 6000 });
    } finally {
      setTranscribing(null);
      transcribeAbort.current = null;
    }
  };

  const reset = () => {
    setPreview(null);
    setApproved(new Set());
    setCreated(null);
    setError(null);
  };

  const handleExtract = async () => {
    if (!transcript.trim()) {
      toast.error('Paste a transcript first');
      return;
    }

    reset();
    setExtracting(true);
    const toastId = toast.loading('Reading the transcript…');

    try {
      const payload = await api.post<PreviewPayload>('/preview-tasks', {
        transcript,
        ...(callTitle.trim() ? { callTitle: callTitle.trim() } : {}),
        ...(callDate ? { callDate } : {}),
      });

      const items = payload.items ?? [];
      setPreview({
        items,
        warnings: payload.warnings ?? [],
        destination: payload.destination ?? null,
        template: payload.template,
      });
      setApproved(new Set(items.map((_, index) => index)));

      toast.success(
        items.length === 0
          ? 'No action items found in this call'
          : `Found ${items.length} action item${items.length === 1 ? '' : 's'} to review`,
        { id: toastId, duration: 4000 }
      );
    } catch (caught) {
      const message = messageFor(caught, 'Extraction failed');
      setError(message);
      toast.error(message, { id: toastId, duration: 5000 });
    } finally {
      setExtracting(false);
    }
  };

  const handleCreate = async () => {
    if (approvedItems.length === 0) return;

    setCreating(true);
    const toastId = toast.loading(`Creating ${approvedItems.length} task(s) in ClickUp…`);

    try {
      // The approved items, exactly as the preview returned them. See the
      // header: sending `transcript` here would re-run extraction.
      const response = await api.send<CreatePayload>('/create-tasks', {
        method: 'POST',
        body: { workItems: approvedItems },
      });

      setCreated(response.data.tasks ?? []);
      // The backend's own sentence — it already counts failures, and phrasing it
      // twice is how the two drift apart.
      toast.success(response.message ?? `Created ${response.data.tasksCreated} tasks`, {
        id: toastId,
        duration: 5000,
      });
    } catch (caught) {
      const message = messageFor(caught, 'Creation failed');
      setError(message);
      toast.error(message, { id: toastId, duration: 5000 });
    } finally {
      setCreating(false);
    }
  };

  const toggle = (index: number) => {
    setApproved((current) => {
      const next = new Set(current);
      if (next.has(index)) next.delete(index);
      else next.add(index);
      return next;
    });
  };

  const allSelected = preview !== null && approved.size === preview.items.length;

  return (
    <div className="space-y-6">
      <Card className="p-8">
        <div className="space-y-6">
          {/* Upload */}
          <div>
            <div className="mb-2 flex items-center justify-between">
              <label className="block text-sm font-semibold text-foreground">
                Upload audio or a transcript
              </label>
              {fileName && !transcribing && (
                <button
                  type="button"
                  onClick={() => {
                    setFileName('');
                    setTranscript('');
                    const input = document.getElementById('transcriptFile') as HTMLInputElement;
                    if (input) input.value = '';
                    reset();
                  }}
                  className="rounded-md bg-error/10 px-3 py-1 text-sm text-error transition-colors hover:bg-error/20"
                >
                  ✕ Clear
                </button>
              )}
            </div>
            <input
              type="file"
              id="transcriptFile"
              accept={[...AUDIO_EXTENSIONS, ...TEXT_EXTENSIONS].join(',')}
              onChange={handleFileSelect}
              disabled={transcribing !== null}
              className="hidden"
            />
            <label
              htmlFor="transcriptFile"
              className={
                'flex flex-col items-center justify-center rounded-lg border-2 border-dashed p-8 transition-all duration-300 ' +
                (transcribing
                  ? 'cursor-not-allowed border-border opacity-60'
                  : 'cursor-pointer border-border hover:border-primary hover:bg-background-tertiary')
              }
            >
              <span className="mb-3 text-5xl">🎙️</span>
              <span className="text-lg font-semibold text-primary">
                {fileName || 'Click to upload a recording or transcript'}
              </span>
              <span className="mt-2 text-sm text-foreground-tertiary">
                Audio (.m4a, .mp3, .wav, .aac, .ogg, .opus, .flac, .webm, .mp4) or text (.txt, .md)
              </span>
              <span className="mt-1 text-xs text-foreground-tertiary">
                Audio is transcribed on this machine — nothing is sent to a transcription service.
              </span>
            </label>
          </div>

          {/* Transcription progress. Whisper runs at roughly 6x realtime, so a
              40-minute call is ~7 minutes of apparently nothing; the segment
              count is the only evidence that it is alive. */}
          {transcribing && (
            <div className="rounded-lg border border-primary/40 bg-primary/5 p-4">
              <div className="flex items-center justify-between gap-4">
                <div className="min-w-0">
                  <p className="text-sm font-semibold text-foreground">
                    {transcribing.status === 'queued'
                      ? 'Waiting for a transcription slot…'
                      : 'Transcribing…'}
                  </p>
                  <p className="mt-1 truncate text-xs text-foreground-tertiary">
                    {transcribing.originalFilename}
                    {typeof transcribing.segmentsSeen === 'number' && transcribing.segmentsSeen > 0
                      ? ` · ${transcribing.segmentsSeen} segments so far`
                      : ''}
                  </p>
                </div>
                <button
                  type="button"
                  onClick={() => transcribeAbort.current?.abort()}
                  className="shrink-0 text-sm text-foreground-tertiary hover:text-error hover:underline"
                >
                  Stop watching
                </button>
              </div>
              <p className="mt-2 text-xs text-foreground-tertiary">
                This runs in the background — the job keeps going even if you leave the page.
              </p>
            </div>
          )}

          {/* Paste */}
          <div>
            <div className="mb-2 flex items-center justify-between">
              <label htmlFor="transcriptText" className="block text-sm font-semibold text-foreground">
                Or paste it here
              </label>
              <button
                type="button"
                onClick={() => {
                  setTranscript(SAMPLE_TRANSCRIPT);
                  reset();
                }}
                className="text-xs text-primary hover:underline"
              >
                Use a sample call
              </button>
            </div>
            <textarea
              id="transcriptText"
              value={transcript}
              onChange={(event) => setTranscript(event.target.value)}
              placeholder={'Priya: Before we wrap up — the export is dropping the last row.\nSam: I can take that.'}
              className="min-h-[220px] w-full resize-y rounded-lg border border-border bg-background-tertiary px-4 py-3 font-mono text-sm text-foreground transition-colors placeholder:text-foreground-tertiary focus:outline-none focus:ring-2 focus:ring-primary"
            />
            <p className="mt-2 text-xs text-foreground-tertiary">
              Speaker labels help — items are attributed to whoever the transcript names.
            </p>
          </div>

          {/* Context */}
          <div className="grid gap-4 sm:grid-cols-2">
            <div>
              <label htmlFor="callTitle" className="mb-2 block text-sm font-semibold text-foreground">
                Call title <span className="font-normal text-foreground-tertiary">(optional)</span>
              </label>
              <input
                id="callTitle"
                type="text"
                value={callTitle}
                onChange={(event) => setCallTitle(event.target.value)}
                placeholder="Weekly sync"
                className="w-full rounded-lg border border-border bg-background-tertiary px-4 py-2 text-sm text-foreground focus:outline-none focus:ring-2 focus:ring-primary"
              />
            </div>
            <div>
              <label htmlFor="callDate" className="mb-2 block text-sm font-semibold text-foreground">
                Call date <span className="font-normal text-foreground-tertiary">(optional)</span>
              </label>
              <input
                id="callDate"
                type="date"
                value={callDate}
                onChange={(event) => setCallDate(event.target.value)}
                className="w-full rounded-lg border border-border bg-background-tertiary px-4 py-2 text-sm text-foreground focus:outline-none focus:ring-2 focus:ring-primary"
              />
            </div>
          </div>
          <p className="text-xs text-foreground-tertiary">
            Both become tags on the created tasks, so you can find everything a call produced.
          </p>

          <Button
            type="button"
            onClick={handleExtract}
            disabled={extracting || transcribing !== null || !transcript.trim()}
            isLoading={extracting}
            variant="primary"
            className="w-full py-6 text-lg"
          >
            {!extracting && <span>Extract action items</span>}
          </Button>

          <p className="text-center text-xs text-foreground-tertiary">
            Nothing is created yet — you review what was found first.
          </p>
        </div>

        {error && (
          <div className="mt-6 rounded-r-lg border-l-4 border-error bg-error/10 p-4">
            <p className="font-medium text-error">{error}</p>
          </div>
        )}
      </Card>

      {/* Review */}
      {preview && (
        <Card className="p-8">
          <div className="mb-6 flex flex-wrap items-start justify-between gap-4">
            <div>
              <h2 className="text-xl font-bold text-foreground">Review before creating</h2>
              <p className="mt-1 text-sm text-foreground-secondary">
                Each item quotes the sentence it came from. Uncheck anything that should not
                become a task.
              </p>
            </div>
            {preview.items.length > 0 && (
              <button
                type="button"
                onClick={() =>
                  setApproved(
                    allSelected ? new Set() : new Set(preview.items.map((_, index) => index))
                  )
                }
                className="text-sm text-primary hover:underline"
              >
                {allSelected ? 'Deselect all' : 'Select all'}
              </button>
            )}
          </div>

          {/* Warnings. Prominent on purpose: "this call had no action items" and
              "extraction broke" both render an empty list and mean opposite
              things, and this is the only thing that tells them apart. */}
          {preview.warnings.length > 0 && (
            <div className="mb-6 rounded-r-lg border-l-4 border-warning bg-warning/10 p-4">
              <h3 className="mb-2 text-sm font-semibold text-warning">Worth knowing</h3>
              <ul className="list-inside list-disc space-y-1 text-sm text-foreground-secondary">
                {preview.warnings.map((warning, index) => (
                  <li key={index}>{warning}</li>
                ))}
              </ul>
            </div>
          )}

          {preview.items.length === 0 ? (
            <div className="py-8 text-center">
              <span className="text-4xl">🤷</span>
              <p className="mt-3 font-medium text-foreground">No action items found</p>
              <p className="mt-1 text-sm text-foreground-tertiary">
                {preview.warnings.length > 0
                  ? 'Something went wrong above — this may not mean the call was quiet.'
                  : 'Nothing in this transcript read as a commitment to act.'}
              </p>
            </div>
          ) : (
            <ul className="space-y-4">
              {preview.items.map((entry, index) => {
                const item = entry.workItem;
                const isApproved = approved.has(index);

                return (
                  <li
                    key={index}
                    className={
                      'rounded-lg border p-5 transition-colors ' +
                      (isApproved
                        ? 'border-primary/50 bg-background-tertiary'
                        : 'border-border bg-background-secondary opacity-60')
                    }
                  >
                    <div className="flex items-start gap-4">
                      <input
                        type="checkbox"
                        checked={isApproved}
                        onChange={() => toggle(index)}
                        aria-label={`Create task: ${entry.task.name}`}
                        className="mt-1 h-5 w-5 accent-primary"
                      />
                      <div className="min-w-0 flex-1">
                        <h3 className="font-semibold text-foreground">{entry.task.name}</h3>

                        <div className="mt-2 flex flex-wrap gap-2 text-xs">
                          <span className="rounded bg-primary/20 px-2 py-0.5 text-primary">
                            {item.type}
                          </span>
                          <span className="rounded bg-foreground/10 px-2 py-0.5 text-foreground-secondary">
                            {item.priority} priority
                          </span>
                          <span className="rounded bg-foreground/10 px-2 py-0.5 text-foreground-secondary">
                            ~{item.estimateHours}h
                          </span>
                          {item.status && (
                            <span className="rounded bg-foreground/10 px-2 py-0.5 text-foreground-secondary">
                              {item.status}
                            </span>
                          )}
                        </div>

                        {item.description && (
                          <p className="mt-3 text-sm text-foreground-secondary">
                            {item.description}
                          </p>
                        )}

                        {/* The evidence. Always visible, never behind a toggle —
                            a citation nobody reads is decoration. */}
                        {item.provenance.quote && (
                          <blockquote className="mt-3 border-l-4 border-border-hover pl-4">
                            <p className="text-sm italic text-foreground-secondary">
                              “{item.provenance.quote}”
                            </p>
                            {item.provenance.speaker && (
                              <footer className="mt-1 text-xs text-foreground-tertiary">
                                — {item.provenance.speaker}
                              </footer>
                            )}
                          </blockquote>
                        )}
                      </div>
                    </div>
                  </li>
                );
              })}
            </ul>
          )}

          {preview.items.length > 0 && (
            <div className="mt-6 border-t border-border pt-6">
              <p className="mb-4 text-sm text-foreground-secondary">
                Destination:{' '}
                <span className="font-medium text-foreground">
                  {preview.destination
                    ? preview.destination.name +
                      (preview.destination.listName ? ` → ${preview.destination.listName}` : '')
                    : 'the list configured in .env'}
                </span>
                {' · Template: '}
                <span className="font-medium text-foreground">{preview.template.name}</span>
              </p>

              <Button
                type="button"
                onClick={handleCreate}
                disabled={creating || approved.size === 0 || created !== null}
                isLoading={creating}
                variant="primary"
                className="w-full py-6 text-lg"
              >
                {!creating && (
                  <span>
                    {created !== null
                      ? 'Tasks created'
                      : approved.size === 0
                        ? 'Nothing selected'
                        : `Create ${approved.size} task${approved.size === 1 ? '' : 's'} in ClickUp`}
                  </span>
                )}
              </Button>
            </div>
          )}
        </Card>
      )}

      {/* Result */}
      {created && created.length > 0 && (
        <Card className="p-8">
          <h2 className="mb-4 text-xl font-bold text-foreground">
            Created {created.length} task{created.length === 1 ? '' : 's'}
          </h2>
          <ul className="space-y-2">
            {created.map((task) => (
              <li key={task.id} className="flex items-center justify-between gap-4">
                <span className="min-w-0 truncate text-sm text-foreground">{task.name}</span>
                <a
                  href={task.url}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="shrink-0 text-sm text-primary hover:underline"
                >
                  Open in ClickUp ↗
                </a>
              </li>
            ))}
          </ul>
        </Card>
      )}
    </div>
  );
}
