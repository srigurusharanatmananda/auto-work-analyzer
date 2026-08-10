'use client';

import { useEffect, useState } from 'react';
import Link from 'next/link';
import ProtectedRoute from '@/components/ProtectedRoute';
import { api, messageFor } from '@/lib/api';
import { Button, Card, LoadingSpinner } from '@/lib/components/ui';
import toast from 'react-hot-toast';
import type { LearnLanguage, LearnResource, LearnResourceNote } from '@/types';

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

export default function LearnResourcesPage() {
  const [language, setLanguage] = useState<LearnLanguage>('sanskrit');
  const [resources, setResources] = useState<LearnResource[]>([]);
  const [loading, setLoading] = useState(true);
  const [selectedId, setSelectedId] = useState<string | null>(null);

  useEffect(() => {
    let ignore = false;

    async function loadResources() {
      setLoading(true);
      setSelectedId(null);
      try {
        const data = await api.get<LearnResource[]>('/resources', { query: { language } });
        if (!ignore) setResources(data);
      } catch (caught) {
        if (!ignore) toast.error(messageFor(caught, 'Failed to load resources'));
      } finally {
        if (!ignore) setLoading(false);
      }
    }

    void loadResources();

    return () => {
      ignore = true;
    };
  }, [language]);

  const selected = resources.find((r) => r.id === selectedId) ?? null;

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
          <div className="grid gap-6 lg:grid-cols-[minmax(0,1fr)_minmax(0,1.4fr)]">
            <div className="flex flex-col gap-3">
              {resources.map((resource) => (
                <Card
                  key={resource.id}
                  hover
                  onClick={() => setSelectedId(resource.id)}
                  className={`cursor-pointer ${
                    selectedId === resource.id ? 'border-primary' : ''
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
            </div>

            <div>
              {selected ? (
                <ResourceReader resource={selected} />
              ) : (
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

function ResourceReader({ resource }: { resource: LearnResource }) {
  return (
    <Card className="flex flex-col gap-5">
      <div>
        <p className="text-xl font-semibold text-foreground">{resource.title}</p>
        <p className="mt-1 text-sm text-foreground-secondary">{resource.author}</p>
      </div>

      <div>
        <p className="text-xs font-semibold uppercase tracking-wide text-foreground-tertiary">
          Best way to read this
        </p>
        <p className="mt-1 text-sm text-foreground">{resource.howToRead}</p>
      </div>

      {resource.embeddableExcerpt && (
        <blockquote className="border-l-2 border-border pl-4 text-sm text-foreground-secondary italic">
          {resource.embeddableExcerpt}
        </blockquote>
      )}

      <div>
        <p className="text-xs font-semibold uppercase tracking-wide text-foreground-tertiary">License</p>
        <p className="mt-1 text-sm text-foreground-secondary">{resource.license}</p>
      </div>

      <a href={resource.sourceUrl} target="_blank" rel="noopener noreferrer" className="w-fit">
        <Button variant="secondary">Open resource ↗</Button>
      </a>

      <div className="border-t border-border pt-5">
        <NotesPanel resourceId={resource.id} />
      </div>
    </Card>
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
