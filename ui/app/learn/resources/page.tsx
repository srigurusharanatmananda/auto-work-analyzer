'use client';

import { useCallback, useEffect, useRef, useState } from 'react';
import Link from 'next/link';
import ProtectedRoute from '@/components/ProtectedRoute';
import { api, API_BASE_URL, messageFor } from '@/lib/api';
import { Button, Card, LoadingSpinner } from '@/lib/components/ui';
import toast from 'react-hot-toast';
import type { LearnLanguage, LearnResource, LearnResourceNote, LearnResourceUpload } from '@/types';

const LANGUAGE_LABEL: Record<LearnLanguage, string> = {
  sanskrit: 'Sanskrit',
  tamil: 'Tamil',
};

const TYPE_LABEL: Record<LearnResource['type'], string> = {
  article: 'Article',
  book: 'Book',
  video: 'Video',
  course: 'Course',
  dictionary: 'Dictionary',
  audio: 'Audio',
  primer: 'Primer',
};

const MIN_LIST_WIDTH = 260;
const MAX_LIST_WIDTH = 640;
const DEFAULT_LIST_WIDTH = 380;
const LIST_WIDTH_STORAGE_KEY = 'learn-resources-list-width';

type Selected =
  | { kind: 'resource'; data: LearnResource }
  | { kind: 'upload'; data: LearnResourceUpload };

function formatBytes(bytes: number): string {
  if (bytes < 1024 * 1024) return `${Math.round(bytes / 1024)} KB`;
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
}

export default function LearnResourcesPage() {
  const [language, setLanguage] = useState<LearnLanguage>('sanskrit');
  const [resources, setResources] = useState<LearnResource[]>([]);
  const [uploads, setUploads] = useState<LearnResourceUpload[]>([]);
  const [loading, setLoading] = useState(true);
  const [selected, setSelected] = useState<Selected | null>(null);
  const [isMaximized, setIsMaximized] = useState(false);
  const [uploading, setUploading] = useState(false);
  // `fetch` (what the shared `api` client is built on) has no reliable
  // cross-browser upload-progress event, so this is a ticking clock rather
  // than a byte count — enough to show a genuinely-large upload is still
  // working, not stuck, without a bespoke non-fetch transport just for this
  // one call.
  const [uploadElapsedSec, setUploadElapsedSec] = useState(0);
  const fileInputRef = useRef<HTMLInputElement>(null);
  // Lets an in-flight upload/delete/uploads-list request discard its result
  // if the user has since switched languages — `language` itself can't do
  // this from inside an async callback, since a closure over it is fixed at
  // call time, not live. Same idiom as `languageRef` in `/learn/page.tsx`.
  const languageRef = useRef(language);
  useEffect(() => {
    languageRef.current = language;
  }, [language]);

  // Lazy initializer, not an effect: this page only ever renders client-side
  // (behind ProtectedRoute), so there is no SSR mismatch to avoid, and a
  // lazy initializer sets the real width on the first render instead of
  // flashing the default and then jumping.
  const [listWidth, setListWidth] = useState(() => {
    // Next prerenders this page's initial state server-side at build time,
    // where there is no `window` — the lazy initializer still runs there.
    if (typeof window === 'undefined') return DEFAULT_LIST_WIDTH;
    const saved = Number(localStorage.getItem(LIST_WIDTH_STORAGE_KEY));
    return Number.isFinite(saved) && saved >= MIN_LIST_WIDTH && saved <= MAX_LIST_WIDTH
      ? saved
      : DEFAULT_LIST_WIDTH;
  });
  const draggingRef = useRef(false);
  // The currently-attached window listeners, if a drag is in progress — lets
  // the unmount effect below remove them even if the mouse is never released
  // (e.g. the user navigates away mid-drag), which `onUp` alone cannot do.
  const dragListenersRef = useRef<{ onMove: (e: MouseEvent) => void; onUp: () => void } | null>(null);

  const startResize = useCallback((e: React.MouseEvent) => {
    e.preventDefault();
    draggingRef.current = true;

    const onMove = (moveEvent: MouseEvent) => {
      if (!draggingRef.current) return;
      const next = Math.min(MAX_LIST_WIDTH, Math.max(MIN_LIST_WIDTH, moveEvent.clientX - 32));
      setListWidth(next);
    };
    const onUp = () => {
      draggingRef.current = false;
      window.removeEventListener('mousemove', onMove);
      window.removeEventListener('mouseup', onUp);
      dragListenersRef.current = null;
      // Persisted on release, not on every move — a resize in progress does
      // not need hundreds of localStorage writes.
      setListWidth((current) => {
        localStorage.setItem(LIST_WIDTH_STORAGE_KEY, String(current));
        return current;
      });
    };
    dragListenersRef.current = { onMove, onUp };
    window.addEventListener('mousemove', onMove);
    window.addEventListener('mouseup', onUp);
  }, []);

  useEffect(() => {
    return () => {
      if (!dragListenersRef.current) return;
      window.removeEventListener('mousemove', dragListenersRef.current.onMove);
      window.removeEventListener('mouseup', dragListenersRef.current.onUp);
    };
  }, []);

  const loadUploads = useCallback(async (lang: LearnLanguage) => {
    try {
      const data = await api.get<LearnResourceUpload[]>('/resources/uploads', { query: { language: lang } });
      // Discards a response for a language the user has since switched away
      // from — otherwise a slower request for the PREVIOUS language could
      // resolve after a faster one for the new language and clobber it.
      if (languageRef.current === lang) setUploads(data);
    } catch (caught) {
      toast.error(messageFor(caught, 'Failed to load your uploads'));
    }
  }, []);

  useEffect(() => {
    let ignore = false;

    async function loadAll() {
      setLoading(true);
      setSelected(null);
      setIsMaximized(false);
      // Cleared up front, not left stale: `loading` goes false as soon as the
      // curated list resolves, but `loadUploads` below is a separate request
      // racing it — without this, the "Your uploads" panel would keep
      // showing the PREVIOUS language's uploads for that gap.
      setUploads([]);

      // Two independent GETs with no data dependency on each other — fired
      // together, not one awaited before the other starts, so a tab switch
      // costs max(resources, uploads) instead of their sum.
      const resourcesLoad = api
        .get<LearnResource[]>('/resources', { query: { language } })
        .then((data) => {
          if (!ignore) setResources(data);
        })
        .catch((caught) => {
          if (!ignore) toast.error(messageFor(caught, 'Failed to load resources'));
        })
        .finally(() => {
          if (!ignore) setLoading(false);
        });
      const uploadsLoad = loadUploads(language);

      await Promise.all([resourcesLoad, uploadsLoad]);
    }

    void loadAll();

    return () => {
      ignore = true;
    };
  }, [language, loadUploads]);

  async function handleFileChosen(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    e.target.value = '';
    if (!file) return;

    const requestLanguage = language;
    setUploading(true);
    setUploadElapsedSec(0);
    const startedAt = Date.now();
    const ticker = setInterval(() => setUploadElapsedSec(Math.round((Date.now() - startedAt) / 1000)), 1000);
    try {
      const title = file.name.replace(/\.pdf$/i, '');
      const body = new FormData();
      body.append('file', file);
      body.append('language', requestLanguage);
      body.append('title', title);
      const created = await api.post<LearnResourceUpload>('/resources/uploads', body);
      // If the user switched languages while a large upload was still in
      // flight, the upload itself already succeeded server-side — just don't
      // insert it into (and force-select it into) whatever OTHER language's
      // view is showing now. Switching back re-fetches it via loadUploads.
      if (languageRef.current === requestLanguage) {
        setUploads((prev) => [created, ...prev]);
        setSelected({ kind: 'upload', data: created });
        setIsMaximized(false);
      }
    } catch (caught) {
      toast.error(messageFor(caught, 'Failed to upload that file'));
    } finally {
      clearInterval(ticker);
      setUploading(false);
    }
  }

  async function deleteUpload(id: string) {
    try {
      await api.delete(`/resources/uploads/${id}`);
      setUploads((prev) => prev.filter((u) => u.id !== id));
      // Deleting the upload currently open in full screen would otherwise leave
      // `isMaximized` true with nothing selected — invisible in the moment
      // (full screen requires a selection, so this falls back to the split
      // view), but the NEXT card clicked would then snap straight into full
      // screen unasked, since `isMaximized && reader` goes true again.
      if (selected?.kind === 'upload' && selected.data.id === id) {
        setSelected(null);
        setIsMaximized(false);
      }
    } catch (caught) {
      toast.error(messageFor(caught, 'Failed to delete that upload'));
    }
  }

  const reader = selected && (
    <ReaderShell isMaximized={isMaximized} onToggleMaximize={() => setIsMaximized((v) => !v)}>
      {selected.kind === 'resource' ? (
        <ResourceReader resource={selected.data} isMaximized={isMaximized} />
      ) : (
        <UploadReader
          upload={selected.data}
          isMaximized={isMaximized}
          onDelete={() => deleteUpload(selected.data.id)}
        />
      )}
    </ReaderShell>
  );

  // Full screen replaces the whole two-pane layout — the list has nothing to
  // do while the reader owns the viewport, so it is not rendered underneath.
  if (isMaximized && reader) {
    return <ProtectedRoute><div className="p-8">{reader}</div></ProtectedRoute>;
  }

  return (
    <ProtectedRoute>
      <div className="p-8">
        <div className="mb-6 flex items-center justify-between">
          <div>
            <h1 className="text-3xl font-bold text-foreground">Reading resources</h1>
            <p className="mt-2 text-foreground-secondary">
              Curated, verified reading material — with the best way to work through each one, and space
              for your own notes.
            </p>
          </div>
          <Link href="/learn">
            <Button variant="ghost">← Back to lessons</Button>
          </Link>
        </div>

        <div className="mb-6 flex rounded-lg border border-border overflow-hidden w-fit">
          {(['sanskrit', 'tamil'] as const).map((lang) => (
            <button
              key={lang}
              onClick={() => setLanguage(lang)}
              className={`px-4 py-2 text-sm font-medium transition-colors ${
                language === lang
                  ? 'bg-primary text-white'
                  : 'bg-background text-foreground-secondary hover:bg-background-secondary'
              }`}
            >
              {LANGUAGE_LABEL[lang]}
            </button>
          ))}
        </div>

        {loading ? (
          <div className="flex justify-center py-12">
            <LoadingSpinner size="lg" />
          </div>
        ) : (
          <div className="flex gap-0 items-start">
            <div className="flex flex-col gap-3 shrink-0" style={{ width: listWidth }}>
              {resources.map((resource) => (
                <Card
                  key={resource.id}
                  hover
                  onClick={() => setSelected({ kind: 'resource', data: resource })}
                  className={`cursor-pointer ${
                    selected?.kind === 'resource' && selected.data.id === resource.id ? 'border-primary' : ''
                  }`}
                >
                  <div className="flex items-start justify-between gap-3">
                    <div>
                      <p className="font-semibold text-foreground">{resource.title}</p>
                      <p className="mt-1 text-sm text-foreground-secondary">{resource.author}</p>
                    </div>
                    <span className="shrink-0 rounded-full bg-foreground/10 px-2 py-0.5 text-xs font-medium text-foreground-secondary">
                      {TYPE_LABEL[resource.type]}
                    </span>
                  </div>
                </Card>
              ))}

              <div className="mt-3 flex items-center justify-between">
                <p className="text-xs font-semibold uppercase tracking-wide text-foreground-tertiary">
                  Your uploads
                </p>
                <Button
                  variant="ghost"
                  size="sm"
                  onClick={() => fileInputRef.current?.click()}
                  disabled={uploading}
                >
                  {uploading ? `Uploading… ${uploadElapsedSec}s` : '+ Upload a book'}
                </Button>
                <input
                  ref={fileInputRef}
                  type="file"
                  accept="application/pdf"
                  hidden
                  onChange={handleFileChosen}
                />
              </div>
              {uploading && (
                <p className="text-xs text-foreground-tertiary">
                  Large scanned books can take a few minutes — this keeps working in the background.
                </p>
              )}

              {uploads.length === 0 ? (
                <Card className="py-6 text-center">
                  <p className="text-xs text-foreground-tertiary">
                    No uploads yet — add a PDF to read it here, alongside its own notes.
                  </p>
                </Card>
              ) : (
                uploads.map((upload) => (
                  <Card
                    key={upload.id}
                    hover
                    onClick={() => setSelected({ kind: 'upload', data: upload })}
                    className={`cursor-pointer ${
                      selected?.kind === 'upload' && selected.data.id === upload.id ? 'border-primary' : ''
                    }`}
                  >
                    <div className="flex items-start justify-between gap-3">
                      <div>
                        <p className="font-semibold text-foreground">{upload.title}</p>
                        <p className="mt-1 text-sm text-foreground-secondary">
                          {formatBytes(upload.sizeBytes)}
                        </p>
                      </div>
                      <div className="flex shrink-0 items-center gap-2">
                        <span className="rounded-full bg-foreground/10 px-2 py-0.5 text-xs font-medium text-foreground-secondary">
                          Your upload
                        </span>
                        <button
                          onClick={(e) => {
                            e.stopPropagation();
                            deleteUpload(upload.id);
                          }}
                          className="text-xs text-foreground-tertiary hover:text-error"
                          aria-label={`Delete ${upload.title}`}
                        >
                          Delete
                        </button>
                      </div>
                    </div>
                  </Card>
                ))
              )}
            </div>

            {/* Drag handle: mousedown starts the window-level listeners in startResize. */}
            <div
              onMouseDown={startResize}
              className="w-2 shrink-0 cursor-col-resize self-stretch mx-1 rounded hover:bg-border active:bg-primary"
              role="separator"
              aria-orientation="vertical"
              aria-label="Resize resource list"
            />

            <div className="min-w-0 flex-1">
              {reader ?? (
                <Card className="py-12 text-center">
                  <p className="text-foreground-secondary">
                    Pick a resource on the left to see how to read it and add your own notes.
                  </p>
                </Card>
              )}
            </div>
          </div>
        )}
      </div>
    </ProtectedRoute>
  );
}

function ReaderShell({
  isMaximized,
  onToggleMaximize,
  children,
}: {
  isMaximized: boolean;
  onToggleMaximize: () => void;
  children: React.ReactNode;
}) {
  const card = (
    <Card className="flex flex-col gap-5">
      <div className="flex justify-end">
        <Button variant="ghost" size="sm" onClick={onToggleMaximize}>
          {isMaximized ? '✕ Exit full screen' : '⛶ Full screen'}
        </Button>
      </div>
      {children}
    </Card>
  );

  if (!isMaximized) return card;

  return <div className="mx-auto max-w-4xl">{card}</div>;
}

function ResourceReader({
  resource,
  isMaximized,
}: {
  resource: LearnResource;
  isMaximized: boolean;
}) {
  const hasInAppContent = Boolean(
    resource.embedUrl || resource.embeddableBookUrl || resource.embeddableExcerpt || resource.inAppNotes,
  );

  return (
    <>
      <div>
        <p className="text-xl font-semibold text-foreground">{resource.title}</p>
        <p className="mt-1 text-sm text-foreground-secondary">{resource.author}</p>
      </div>

      {resource.embedUrl && (
        <div
          className={
            isMaximized
              ? 'h-[75vh] w-full overflow-hidden rounded-md bg-background-tertiary'
              : 'aspect-video w-full overflow-hidden rounded-md bg-background-tertiary'
          }
        >
          {/*
            No `sandbox` attribute: YouTube's player needs both allow-scripts
            and allow-same-origin to work at all, and that combination lets the
            framed page remove the sandbox on itself — so it adds no real
            isolation while still breaking in-player navigation (clicking the
            video title/channel). `embedUrl` is a hardcoded youtube.com URL,
            never user input, so there is nothing untrusted being framed here.
          */}
          <iframe
            src={resource.embedUrl}
            title={resource.title}
            className="h-full w-full"
            allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture"
            allowFullScreen
          />
        </div>
      )}

      {resource.embeddableBookUrl && (
        <div>
          <p className="text-xs font-semibold uppercase tracking-wide text-foreground-tertiary">
            Read the full, public-domain scan here
          </p>
          {/*
            Same reasoning as the YouTube embed above: no `sandbox` attribute.
            archive.org's BookReader needs allow-scripts + allow-same-origin to
            function, and that pair lets a framed page strip its own sandbox
            anyway — so sandboxing here would only break the reader, not add
            isolation. `embeddableBookUrl` is a hardcoded archive.org URL, never
            user input.
          */}
          <iframe
            src={resource.embeddableBookUrl}
            title={`${resource.title} — full scan`}
            className={isMaximized ? 'mt-2 h-[80vh] w-full rounded-md border border-border bg-background-tertiary' : 'mt-2 h-[600px] w-full rounded-md border border-border bg-background-tertiary'}
            allowFullScreen
          />
        </div>
      )}

      {resource.embeddableExcerpt && (
        <div>
          <p className="text-xs font-semibold uppercase tracking-wide text-foreground-tertiary">
            {resource.embeddableBookUrl ? 'Highlighted excerpt (typed, searchable)' : 'Read it here'}
          </p>
          <div className="mt-2 max-h-96 overflow-y-auto rounded-md border border-border bg-background-tertiary p-4">
            <pre className="whitespace-pre-wrap font-sans text-sm text-foreground">
              {resource.embeddableExcerpt}
            </pre>
          </div>
        </div>
      )}

      {resource.inAppNotes && (
        <div>
          <p className="text-xs font-semibold uppercase tracking-wide text-foreground-tertiary">
            In-app notes
          </p>
          <p className="mt-1 whitespace-pre-wrap text-sm text-foreground">{resource.inAppNotes}</p>
        </div>
      )}

      <div>
        <p className="text-xs font-semibold uppercase tracking-wide text-foreground-tertiary">
          Best way to read this
        </p>
        <p className="mt-1 text-sm text-foreground">{resource.howToRead}</p>
      </div>

      <div>
        <p className="text-xs font-semibold uppercase tracking-wide text-foreground-tertiary">License</p>
        <p className="mt-1 text-sm text-foreground-secondary">{resource.license}</p>
      </div>

      <div>
        {hasInAppContent && (
          <p className="mb-2 text-xs text-foreground-tertiary">
            Prefer the source itself, or the content above isn&apos;t enough? It&apos;s also available
            externally:
          </p>
        )}
        <a href={resource.sourceUrl} target="_blank" rel="noopener noreferrer" className="w-fit">
          <Button variant={hasInAppContent ? 'ghost' : 'secondary'}>Open resource ↗</Button>
        </a>
      </div>

      <div className="border-t border-border pt-5">
        <NotesPanel resourceId={resource.id} />
      </div>
    </>
  );
}

/**
 * Reads a user's own uploaded PDF, mirroring `playAudio`'s pattern in
 * `/learn/page.tsx`: a POST mints a short-lived signed URL (the `<iframe>`
 * cannot carry an Authorization header any more than an `<audio>` element
 * can), and the GET behind it is authorised by that token alone.
 */
function UploadReader({
  upload,
  isMaximized,
  onDelete,
}: {
  upload: LearnResourceUpload;
  isMaximized: boolean;
  onDelete: () => void;
}) {
  const [fileUrl, setFileUrl] = useState<string | null>(null);
  // Bumped by the Reload button to force a fresh mint below without
  // duplicating the effect's body — a long reading session can outlast even
  // the 2-hour upload token, or hit a one-off connection hiccup, and there is
  // otherwise no way back short of deselecting and reselecting the upload.
  const [reloadKey, setReloadKey] = useState(0);

  useEffect(() => {
    let ignore = false;

    async function mint() {
      setFileUrl(null);
      try {
        const { url } = await api.post<{ url: string; expiresAt: string }>(
          `/resources/uploads/${upload.id}/token`,
        );
        if (!ignore) setFileUrl(`${API_BASE_URL}${url}`);
      } catch (caught) {
        if (!ignore) toast.error(messageFor(caught, 'Failed to open this upload'));
      }
    }

    void mint();
    return () => {
      ignore = true;
    };
  }, [upload.id, reloadKey]);

  return (
    <>
      <div className="flex items-start justify-between gap-3">
        <div>
          <p className="text-xl font-semibold text-foreground">{upload.title}</p>
          <p className="mt-1 text-sm text-foreground-secondary">
            Your upload — {formatBytes(upload.sizeBytes)}, added{' '}
            {new Date(upload.createdAt).toLocaleDateString()}
          </p>
        </div>
        <div className="flex shrink-0 gap-2">
          <Button variant="ghost" size="sm" onClick={() => setReloadKey((k) => k + 1)}>
            Reload
          </Button>
          <Button variant="ghost" size="sm" onClick={onDelete}>
            Delete
          </Button>
        </div>
      </div>

      {fileUrl ? (
        <iframe
          // Keyed by the URL itself, not just given a new `src`: a fresh
          // mount discards whatever broken/stuck state the PDF viewer was in
          // from a previous failed load, instead of asking it to recover in
          // place.
          key={fileUrl}
          src={fileUrl}
          title={upload.title}
          className={
            isMaximized
              ? 'h-[80vh] w-full rounded-md border border-border bg-background-tertiary'
              : 'h-[600px] w-full rounded-md border border-border bg-background-tertiary'
          }
          allowFullScreen
        />
      ) : (
        <div className="flex h-[300px] items-center justify-center">
          <LoadingSpinner size="lg" />
        </div>
      )}

      <div className="border-t border-border pt-5">
        <NotesPanel resourceId={upload.id} />
      </div>
    </>
  );
}

function NotesPanel({ resourceId }: { resourceId: string }) {
  const [notes, setNotes] = useState<LearnResourceNote[]>([]);
  const [loading, setLoading] = useState(true);
  const [draft, setDraft] = useState('');
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    let ignore = false;

    async function loadNotes() {
      setLoading(true);
      try {
        const data = await api.get<LearnResourceNote[]>(`/resources/${resourceId}/notes`);
        if (!ignore) setNotes(data);
      } catch (caught) {
        if (!ignore) toast.error(messageFor(caught, 'Failed to load notes'));
      } finally {
        if (!ignore) setLoading(false);
      }
    }

    void loadNotes();

    return () => {
      ignore = true;
    };
  }, [resourceId]);

  async function saveNote() {
    if (!draft.trim()) return;

    setSaving(true);
    try {
      const created = await api.post<LearnResourceNote>(`/resources/${resourceId}/notes`, {
        note: draft.trim(),
      });
      setNotes((prev) => [created, ...prev]);
      setDraft('');
    } catch (caught) {
      toast.error(messageFor(caught, 'Failed to save note'));
    } finally {
      setSaving(false);
    }
  }

  async function deleteNote(noteId: string) {
    try {
      await api.delete(`/resources/${resourceId}/notes/${noteId}`);
      setNotes((prev) => prev.filter((n) => n.id !== noteId));
    } catch (caught) {
      toast.error(messageFor(caught, 'Failed to delete note'));
    }
  }

  return (
    <div>
      <p className="text-xs font-semibold uppercase tracking-wide text-foreground-tertiary">Your notes</p>

      <textarea
        value={draft}
        onChange={(e) => setDraft(e.target.value)}
        placeholder="What did you notice, or want to remember, about this resource?"
        rows={3}
        className="mt-2 w-full rounded-md border border-border bg-background p-3 text-sm text-foreground placeholder:text-foreground-tertiary focus:outline-none focus:ring-2 focus:ring-primary"
      />
      <div className="mt-2 flex justify-end">
        <Button variant="primary" size="sm" onClick={saveNote} disabled={!draft.trim() || saving}>
          {saving ? 'Saving...' : 'Save note'}
        </Button>
      </div>

      {loading ? (
        <div className="flex justify-center py-6">
          <LoadingSpinner size="md" />
        </div>
      ) : notes.length > 0 ? (
        <ul className="mt-4 flex flex-col gap-3">
          {notes.map((note) => (
            <li key={note.id} className="rounded-md bg-background-tertiary p-3">
              <div className="flex items-start justify-between gap-3">
                <p className="text-sm text-foreground whitespace-pre-wrap">{note.note}</p>
                <button
                  onClick={() => deleteNote(note.id)}
                  className="shrink-0 text-xs text-foreground-tertiary hover:text-error"
                  aria-label="Delete note"
                >
                  Delete
                </button>
              </div>
              <p className="mt-2 text-xs text-foreground-tertiary">
                {new Date(note.createdAt).toLocaleString()}
              </p>
            </li>
          ))}
        </ul>
      ) : (
        <p className="mt-4 text-sm text-foreground-tertiary">No notes yet.</p>
      )}
    </div>
  );
}
