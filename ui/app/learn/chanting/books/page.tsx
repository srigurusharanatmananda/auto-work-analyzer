'use client';

import { useEffect, useRef, useState } from 'react';
import Link from 'next/link';
import ProtectedRoute from '@/components/ProtectedRoute';
import { api, messageFor } from '@/lib/api';
import { speakLearnText } from '@/lib/speak';
import { Button, Card, LoadingSpinner } from '@/lib/components/ui';
import VersePicker, { VerseStepper, type VersePickerItem } from '@/lib/components/VersePicker';
import toast from 'react-hot-toast';
import type {
  ChantBook,
  ChantBookCreated,
  ChantBookVerseDetail,
  ChantBookVerseSummary,
  ChantSyllable,
  LearnLanguage,
} from '@/types';

const LANGUAGE_LABEL: Record<LearnLanguage, string> = {
  sanskrit: 'Sanskrit',
  tamil: 'Tamil',
};

const LANGUAGES: LearnLanguage[] = ['sanskrit', 'tamil'];

/**
 * Mirrors `DEFAULT_MAX_UPLOAD_BYTES` in `src/routes/chantBooks.routes.ts`.
 * Checked here as well as there so an oversized file is refused instantly
 * instead of after uploading half a gigabyte only to be rejected — the
 * server check is still the real one, this is just courtesy.
 */
const MAX_UPLOAD_MB = 500;

// Same styling as the built-in chanting page (ui/app/learn/chanting/page.tsx)
// — kept as its own copy rather than a shared import, since the two pages'
// surrounding state/data-fetching shapes differ enough (a book verse is
// lazily computed and may still be loading) that sharing just this styling
// constant isn't worth a cross-page dependency for four lines.
const WEIGHT_STYLE: Record<ChantSyllable['weight'], string> = {
  guru: 'bg-primary/15 text-primary font-semibold',
  laghu: 'bg-background-tertiary text-foreground-secondary',
  anceps: 'bg-foreground/10 text-foreground-secondary italic',
};

const WEIGHT_LABEL: Record<ChantSyllable['weight'], string> = {
  guru: 'guru — long',
  laghu: 'laghu — short',
  anceps: 'anceps — pāda-final, either length',
};

export default function ChantBooksPage() {
  const [language, setLanguage] = useState<LearnLanguage>('sanskrit');
  const [books, setBooks] = useState<ChantBook[]>([]);
  const [booksLoading, setBooksLoading] = useState(true);
  const [uploading, setUploading] = useState(false);
  const [title, setTitle] = useState('');
  const fileInputRef = useRef<HTMLInputElement>(null);

  const [selectedBook, setSelectedBook] = useState<ChantBook | null>(null);
  const [verseSummaries, setVerseSummaries] = useState<ChantBookVerseSummary[]>([]);
  const [versesLoading, setVersesLoading] = useState(false);

  const [selectedVerse, setSelectedVerse] = useState<ChantBookVerseDetail | null>(null);
  const [verseDetailLoading, setVerseDetailLoading] = useState(false);
  // Distinguishes "haven't picked a verse yet" from "picked one and it
  // failed" — same reasoning as the built-in chanting page's own
  // `verseLoadFailed`, and for the same bug this fixes: without it, a
  // failed fetch left the PREVIOUS verse's breakdown on screen looking
  // current, since `selectedVerse` was never cleared on error.
  const [verseLoadFailed, setVerseLoadFailed] = useState(false);
  const [padaIndex, setPadaIndex] = useState(0);
  const [audioLoading, setAudioLoading] = useState(false);
  // Guards a selectVerse response from landing after the learner has since
  // picked a different verse — same reasoning as the built-in chanting
  // page's own `selectedIdRef`.
  const selectedVerseKeyRef = useRef<string | null>(null);

  async function loadBooks(forLanguage: LearnLanguage) {
    setBooksLoading(true);
    setSelectedBook(null);
    setSelectedVerse(null);
    setVerseSummaries([]);
    try {
      const data = await api.get<ChantBook[]>('/chant-books', { query: { language: forLanguage } });
      setBooks(data);
    } catch (caught) {
      toast.error(messageFor(caught, 'Failed to load your books'));
    } finally {
      setBooksLoading(false);
    }
  }

  useEffect(() => {
    void (async () => {
      await loadBooks(language);
    })();
  }, [language]);

  async function handleUpload(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    e.target.value = '';
    if (!file || uploading) return;
    if (!title.trim()) {
      toast.error('Give the book a title first.');
      return;
    }
    if (file.size > MAX_UPLOAD_MB * 1024 * 1024) {
      toast.error(
        `That file is ${Math.round(file.size / 1024 / 1024)} MB — the limit is ${MAX_UPLOAD_MB} MB.`
      );
      return;
    }

    setUploading(true);
    try {
      const body = new FormData();
      body.append('file', file);
      body.append('language', language);
      body.append('title', title.trim());
      const created = await api.post<ChantBookCreated>('/chant-books', body);
      toast.success(`Uploaded — found ${created.verseCount} numbered verses.`);
      setTitle('');
      await loadBooks(language);
    } catch (caught) {
      toast.error(messageFor(caught, 'Could not process that book'));
    } finally {
      setUploading(false);
    }
  }

  async function openBook(book: ChantBook) {
    setSelectedBook(book);
    setSelectedVerse(null);
    setVersesLoading(true);
    try {
      const data = await api.get<ChantBookVerseSummary[]>(`/chant-books/${book.id}/verses`);
      setVerseSummaries(data);
    } catch (caught) {
      toast.error(messageFor(caught, 'Failed to load this book\'s verses'));
    } finally {
      setVersesLoading(false);
    }
  }

  async function deleteBook(book: ChantBook) {
    try {
      await api.delete(`/chant-books/${book.id}`);
      toast.success('Deleted.');
      await loadBooks(language);
    } catch (caught) {
      toast.error(messageFor(caught, 'Failed to delete that book'));
    }
  }

  async function selectVerse(bookId: string, verseNumber: number) {
    const key = `${bookId}:${verseNumber}`;
    selectedVerseKeyRef.current = key;
    setVerseDetailLoading(true);
    setVerseLoadFailed(false);
    setSelectedVerse(null);
    setPadaIndex(0);
    try {
      const detail = await api.get<ChantBookVerseDetail>(`/chant-books/${bookId}/verses/${verseNumber}`);
      if (selectedVerseKeyRef.current === key) setSelectedVerse(detail);
    } catch (caught) {
      if (selectedVerseKeyRef.current === key) {
        toast.error(messageFor(caught, 'Failed to break down that verse'));
        setVerseLoadFailed(true);
      }
    } finally {
      if (selectedVerseKeyRef.current === key) setVerseDetailLoading(false);
    }
  }

  async function playAudio(text: string) {
    if (!selectedBook) return;
    setAudioLoading(true);
    try {
      await speakLearnText(selectedBook.language, text);
    } catch (caught) {
      toast.error(messageFor(caught, 'Failed to play audio'));
    } finally {
      setAudioLoading(false);
    }
  }

  const pada = selectedVerse?.padas[padaIndex] ?? null;

  // Verse NUMBER is the key here, not an id: a book verse is addressed by
  // its number in the route (`/chant-books/:id/verses/:verseNumber`) and
  // has no id of its own.
  const pickerItems: VersePickerItem[] = verseSummaries.map((v) => ({
    key: String(v.verseNumber),
    number: v.verseNumber,
    preview: v.rawText,
  }));

  return (
    <ProtectedRoute>
      <div className="p-8">
        <div className="mb-6 flex items-center justify-between">
          <div>
            <h1 className="text-3xl font-bold text-foreground">My Chant Books</h1>
            <p className="mt-2 text-foreground-secondary">
              Upload any numbered-verse text — pick whichever verse you want to chant, whenever you want.
            </p>
          </div>
          <Link href="/learn/chanting">
            <Button variant="ghost">← Back to Chanting</Button>
          </Link>
        </div>

        <div className="mb-6 flex rounded-lg border border-border overflow-hidden w-fit">
          {LANGUAGES.map((lang) => (
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

        <Card className="mb-6 flex flex-col gap-3 p-6">
          <h2 className="text-lg font-semibold text-foreground">Upload a {LANGUAGE_LABEL[language]} book</h2>
          <p className="text-xs text-foreground-tertiary">
            Needs explicit verse-number markers — either &quot;॥ 1॥&quot;-style dandas, or a bare number on its own line.
            A book without one of those conventions can&apos;t be split into verses reliably and will be rejected.
          </p>
          <p className="text-xs text-foreground-tertiary">
            PDF or .txt, up to {MAX_UPLOAD_MB} MB. A PDF needs a real text layer — a purely scanned
            book has no text to extract and will come back empty.
          </p>
          <div className="flex flex-wrap items-center gap-2">
            <input
              type="text"
              value={title}
              onChange={(e) => setTitle(e.target.value)}
              placeholder="Book title"
              className="rounded-md border border-border bg-background px-3 py-2 text-sm text-foreground placeholder:text-foreground-tertiary focus:outline-none focus:ring-2 focus:ring-primary"
            />
            <input
              ref={fileInputRef}
              type="file"
              accept="application/pdf,.pdf,.txt,text/plain"
              className="hidden"
              onChange={handleUpload}
            />
            <Button variant="primary" onClick={() => fileInputRef.current?.click()} disabled={uploading}>
              {uploading ? 'Processing...' : 'Upload PDF or .txt'}
            </Button>
          </div>
        </Card>

        <div className="grid gap-6 lg:grid-cols-3">
          <Card className="flex flex-col gap-2 p-4 lg:col-span-1">
            <h2 className="text-sm font-semibold uppercase tracking-wide text-foreground-tertiary">Your books</h2>
            {booksLoading ? (
              <div className="flex justify-center py-8">
                <LoadingSpinner />
              </div>
            ) : books.length === 0 ? (
              <p className="py-4 text-center text-sm text-foreground-tertiary">
                No {LANGUAGE_LABEL[language]} books uploaded yet.
              </p>
            ) : (
              <div className="flex flex-col gap-1">
                {books.map((book) => (
                  <div
                    key={book.id}
                    className={`flex items-center justify-between rounded-md border px-3 py-2 ${
                      selectedBook?.id === book.id ? 'border-primary bg-primary/10' : 'border-border'
                    }`}
                  >
                    <button onClick={() => openBook(book)} className="flex-1 text-left text-sm text-foreground">
                      {book.title}
                    </button>
                    <button
                      onClick={() => deleteBook(book)}
                      className="ml-2 text-xs text-foreground-tertiary hover:text-error"
                      aria-label={`Delete ${book.title}`}
                    >
                      Delete
                    </button>
                  </div>
                ))}
              </div>
            )}
          </Card>

          <Card className="self-start p-4 lg:col-span-1 lg:sticky lg:top-6">
            {!selectedBook ? (
              <>
                <h2 className="text-sm font-semibold uppercase tracking-wide text-foreground-tertiary">
                  Verses
                </h2>
                <p className="py-4 text-center text-sm text-foreground-tertiary">
                  Pick a book to see its verses.
                </p>
              </>
            ) : versesLoading ? (
              <div className="flex justify-center py-8">
                <LoadingSpinner />
              </div>
            ) : (
              <VersePicker
                items={pickerItems}
                selectedKey={selectedVerse ? String(selectedVerse.verseNumber) : null}
                onSelect={(key) => selectVerse(selectedBook.id, Number(key))}
                title={selectedBook.title}
                emptyMessage="This book has no verses."
              />
            )}
          </Card>

          <div className="lg:col-span-1">
            {verseDetailLoading ? (
              <Card className="flex flex-col items-center gap-3 py-12 text-center">
                <LoadingSpinner size="lg" />
                <p className="text-xs text-foreground-tertiary">Breaking this verse down — first time takes a bit.</p>
              </Card>
            ) : !selectedVerse ? (
              <Card className="py-12 text-center">
                <p className="text-foreground-secondary">
                  {verseLoadFailed ? "Couldn't break down this verse — try again." : 'Pick a verse to chant it.'}
                </p>
              </Card>
            ) : (
              pada && (
                <div className="flex flex-col gap-4">
                  <VerseStepper
                    items={pickerItems}
                    selectedKey={String(selectedVerse.verseNumber)}
                    onSelect={(key) => selectVerse(selectedBook!.id, Number(key))}
                  />
                  <Card className="flex flex-col items-center gap-4 py-8 text-center">
                    <span className="rounded-full bg-primary/10 px-2 py-0.5 text-xs font-medium text-primary">
                      Phrase {padaIndex + 1} of {selectedVerse.padas.length}
                    </span>
                    <p className="text-3xl font-semibold text-foreground">{pada.text}</p>
                    <p className="text-sm text-foreground-secondary">{pada.iast}</p>
                    {/* Syllable/guru-laghu weight analysis is Sanskrit-only for now (the
                        backend sends an empty array for Tamil — see chantBooks.routes.ts's
                        own comment) — hidden rather than shown blank when there's nothing to display. */}
                    {pada.syllables.length > 0 && (
                      <div className="flex flex-wrap justify-center gap-1.5">
                        {pada.syllables.map((syllable, i) => (
                          <span
                            key={i}
                            title={WEIGHT_LABEL[syllable.weight]}
                            className={`rounded px-2 py-1 text-base ${WEIGHT_STYLE[syllable.weight]}`}
                          >
                            {syllable.text}
                          </span>
                        ))}
                      </div>
                    )}
                    <div className="mt-1 flex flex-col gap-1 text-xs text-foreground-secondary">
                      {pada.words.map((word, i) => (
                        <p key={i}>
                          <span className="font-medium text-foreground">{word.devanagari}</span>
                          <span className="text-foreground-tertiary"> ({word.iast})</span> — {word.gloss}
                        </p>
                      ))}
                    </div>
                    <Button variant="ghost" size="sm" onClick={() => playAudio(pada.text)} disabled={audioLoading}>
                      {audioLoading ? 'Synthesizing...' : 'Play audio'}
                    </Button>
                  </Card>

                  <div className="flex justify-center gap-2">
                    <Button
                      variant="ghost"
                      size="sm"
                      onClick={() => setPadaIndex((i) => Math.max(0, i - 1))}
                      disabled={padaIndex === 0}
                    >
                      ← Previous
                    </Button>
                    <Button
                      variant="secondary"
                      size="sm"
                      onClick={() => setPadaIndex((i) => Math.min(selectedVerse.padas.length - 1, i + 1))}
                      disabled={padaIndex === selectedVerse.padas.length - 1}
                    >
                      Next →
                    </Button>
                  </div>

                  <Card className="flex flex-col gap-2 p-4">
                    <h3 className="text-sm font-semibold text-foreground">Meaning</h3>
                    <p className="text-sm text-foreground-secondary">{selectedVerse.meaning}</p>
                  </Card>

                  <details className="rounded-lg border border-border p-3 text-xs text-foreground-tertiary">
                    <summary className="cursor-pointer text-xs font-medium text-foreground-secondary">
                      Sourcing notes
                    </summary>
                    <p className="mt-2">{selectedVerse.citation}</p>
                  </details>
                </div>
              )
            )}
          </div>
        </div>
      </div>
    </ProtectedRoute>
  );
}
