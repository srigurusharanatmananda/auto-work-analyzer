'use client';

import { useEffect, useState } from 'react';
import Link from 'next/link';
import ProtectedRoute from '@/components/ProtectedRoute';
import { api, messageFor } from '@/lib/api';
import { Button, Card, LoadingSpinner } from '@/lib/components/ui';
import toast from 'react-hot-toast';
import type { LearnLanguage, LearnProgress } from '@/types';

const LANGUAGE_LABEL: Record<LearnLanguage, string> = {
  sanskrit: 'Sanskrit',
  tamil: 'Tamil',
};

export default function LearnPage() {
  const [language, setLanguage] = useState<LearnLanguage>('sanskrit');
  const [progress, setProgress] = useState<LearnProgress | null>(null);
  const [loading, setLoading] = useState(true);
  const [actionLoading, setActionLoading] = useState(false);
  const [audioLoading, setAudioLoading] = useState(false);

  useEffect(() => {
    let ignore = false;

    async function loadNext() {
      setLoading(true);
      // Cleared up front, not just left stale on failure: without this, a
      // failed fetch after switching languages would keep showing the
      // PREVIOUS language's lesson under the newly-selected tab.
      setProgress(null);
      try {
        const data = await api.get<LearnProgress>('/learn/next', { query: { language } });
        if (!ignore) setProgress(data);
      } catch (caught) {
        if (!ignore) toast.error(messageFor(caught, 'Failed to load the next lesson'));
      } finally {
        if (!ignore) setLoading(false);
      }
    }

    void loadNext();

    return () => {
      ignore = true;
    };
  }, [language]);

  async function recordSeen(correct: boolean) {
    if (!progress?.lesson) return;

    setActionLoading(true);
    try {
      const data = await api.post<LearnProgress>('/learn/seen', {
        language,
        lessonId: progress.lesson.id,
        correct,
      });
      setProgress(data);
    } catch (caught) {
      toast.error(messageFor(caught, 'Failed to record your answer'));
    } finally {
      setActionLoading(false);
    }
  }

  async function playAudio() {
    if (!progress?.lesson) return;

    setAudioLoading(true);
    try {
      // Not `api.post` — that unwraps the `{success, data}` JSON envelope,
      // and this route returns raw audio bytes. `rawRequest` gets the same
      // Authorization header and 401-refresh-and-retry as every other call
      // without reimplementing either.
      const response = await api.rawRequest('/learn/speak', {
        method: 'POST',
        body: { language, text: progress.lesson.text },
      });

      if (!response.ok) {
        if (response.status === 503) {
          toast.error("Text-to-speech isn't set up yet");
          return;
        }

        let message = 'Failed to play audio';
        try {
          const body = await response.json();
          if (typeof body?.error === 'string') message = body.error;
        } catch {
          // Not JSON — fall back to the generic message.
        }
        toast.error(message);
        return;
      }

      const blob = await response.blob();
      const url = URL.createObjectURL(blob);
      const audio = new Audio(url);
      audio.onended = () => URL.revokeObjectURL(url);
      await audio.play();
    } catch (caught) {
      toast.error(messageFor(caught, 'Failed to play audio'));
    } finally {
      setAudioLoading(false);
    }
  }

  const lesson = progress?.lesson ?? null;
  const seenCount = progress?.seenCount ?? 0;
  const total = progress?.total ?? 0;
  const pct = total > 0 ? Math.min(100, Math.round((seenCount / total) * 100)) : 0;

  return (
    <ProtectedRoute>
      <div className="p-8">
        <div className="mb-6 flex items-center justify-between">
          <div>
            <h1 className="text-3xl font-bold text-foreground">Learn</h1>
            <p className="mt-2 text-foreground-secondary">
              Work through letters, words, and sentences one lesson at a time.
            </p>
          </div>
          <Link href="/learn/resources">
            <Button variant="ghost">Reading resources →</Button>
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

        {!loading && (
          <div className="mb-6 max-w-md">
            <div className="h-2 w-full overflow-hidden rounded-lg bg-background-tertiary">
              <div
                className="h-full rounded-lg bg-primary transition-all"
                style={{ width: `${pct}%` }}
              />
            </div>
            <p className="mt-1 text-xs text-foreground-tertiary">
              {seenCount} / {total} lessons
            </p>
          </div>
        )}

        {loading ? (
          <div className="flex justify-center py-12">
            <LoadingSpinner size="lg" />
          </div>
        ) : lesson ? (
          <Card className="flex flex-col items-center gap-4 py-12 text-center">
            <span className="rounded-full bg-foreground/10 px-2 py-0.5 text-xs font-medium text-foreground-secondary">
              {lesson.stage}
            </span>
            <p className="text-5xl font-semibold text-foreground">{lesson.text}</p>
            <p className="text-sm text-foreground-secondary">{lesson.gloss}</p>
          </Card>
        ) : (
          <Card className="py-12 text-center">
            <p className="text-lg font-semibold text-foreground">
              You&apos;ve completed every {LANGUAGE_LABEL[language]} lesson!
            </p>
            <p className="mt-2 text-sm text-foreground-secondary">
              {seenCount} / {total}
            </p>
          </Card>
        )}

        <div className="mt-6 flex flex-wrap justify-center gap-3">
          <Button
            variant="secondary"
            onClick={() => recordSeen(false)}
            disabled={!lesson || actionLoading}
          >
            Need practice
          </Button>
          <Button
            variant="primary"
            onClick={() => recordSeen(true)}
            disabled={!lesson || actionLoading}
          >
            Got it
          </Button>
          <Button
            variant="ghost"
            onClick={playAudio}
            disabled={!lesson || audioLoading}
          >
            {audioLoading ? 'Playing...' : 'Play audio'}
          </Button>
        </div>
      </div>
    </ProtectedRoute>
  );
}
