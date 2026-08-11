'use client';

import { useEffect, useRef, useState } from 'react';
import Link from 'next/link';
import ProtectedRoute from '@/components/ProtectedRoute';
import { api, messageFor } from '@/lib/api';
import { Button, Card, LoadingSpinner } from '@/lib/components/ui';
import toast from 'react-hot-toast';
import type { LearnLanguage, LearnLesson, LearnProgress } from '@/types';
import { LEARN_LEVELS } from '@/types';

const LANGUAGE_LABEL: Record<LearnLanguage, string> = {
  sanskrit: 'Sanskrit',
  tamil: 'Tamil',
};

export default function LearnPage() {
  const [language, setLanguage] = useState<LearnLanguage>('sanskrit');
  const [lessons, setLessons] = useState<LearnLesson[]>([]);
  const [progress, setProgress] = useState<LearnProgress | null>(null);
  const [loading, setLoading] = useState(true);
  const [actionLoading, setActionLoading] = useState(false);
  const [audioLoading, setAudioLoading] = useState(false);
  // null = showing the live "next" lesson from the server. Set to browse
  // an already-unlocked lesson without touching progress — see `displayIndex`.
  const [reviewIndex, setReviewIndex] = useState<number | null>(null);
  // Lets recordSeen (fired for one language) discard its response if the user
  // has since switched languages — `language` itself can't do this, since a
  // closure over it is fixed at call time, not live.
  const languageRef = useRef(language);
  useEffect(() => {
    languageRef.current = language;
  }, [language]);

  useEffect(() => {
    let ignore = false;

    async function load() {
      setLoading(true);
      // Cleared up front, not just left stale on failure: without this, a
      // failed fetch after switching languages would keep showing the
      // PREVIOUS language's lesson under the newly-selected tab.
      setProgress(null);
      setLessons([]);
      setReviewIndex(null);
      try {
        const [lessonsData, progressData] = await Promise.all([
          api.get<{ lessons: LearnLesson[] }>('/learn/lessons', { query: { language } }),
          api.get<LearnProgress>('/learn/next', { query: { language } }),
        ]);
        if (!ignore) {
          setLessons(lessonsData.lessons);
          setProgress(progressData);
        }
      } catch (caught) {
        if (!ignore) toast.error(messageFor(caught, 'Failed to load the lesson'));
      } finally {
        if (!ignore) setLoading(false);
      }
    }

    void load();

    return () => {
      ignore = true;
    };
  }, [language]);

  // Where the "live" frontier sits in `lessons`. Progress only ever advances
  // through lessons in order, so `seenCount` lessons seen means index
  // `seenCount` is the next (or, once every lesson is seen, one past the
  // end — "Previous" from the completed card should still work).
  const frontierIndex = progress?.seenCount ?? 0;

  const displayIndex = reviewIndex ?? frontierIndex;
  const displayLesson: LearnLesson | null =
    displayIndex >= 0 && displayIndex < lessons.length ? lessons[displayIndex]! : null;
  const isReviewing = reviewIndex !== null && reviewIndex < frontierIndex;

  async function recordSeen(correct: boolean) {
    if (!progress?.lesson || isReviewing) return;

    const requestLanguage = language;
    setActionLoading(true);
    try {
      const data = await api.post<LearnProgress>('/learn/seen', {
        language,
        lessonId: progress.lesson.id,
        correct,
      });
      // Discard a response for a language the user has since switched away
      // from — otherwise it would clobber the newly-loaded language's progress.
      if (languageRef.current === requestLanguage) setProgress(data);
    } catch (caught) {
      toast.error(messageFor(caught, 'Failed to record your answer'));
    } finally {
      setActionLoading(false);
    }
  }

  async function playAudio() {
    if (!displayLesson) return;

    setAudioLoading(true);
    try {
      // Not `api.post` — that unwraps the `{success, data}` JSON envelope,
      // and this route returns raw audio bytes. `rawRequest` gets the same
      // Authorization header and 401-refresh-and-retry as every other call
      // without reimplementing either.
      const response = await api.rawRequest('/learn/speak', {
        method: 'POST',
        body: { language, text: displayLesson.text },
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

  function goPrevious() {
    if (displayIndex > 0) setReviewIndex(displayIndex - 1);
  }

  function goNext() {
    if (reviewIndex === null) return;
    // One step short of the frontier stays in review; landing exactly on it
    // hands back to "live" mode, so Got it/Need practice reappear.
    setReviewIndex(reviewIndex + 1 >= frontierIndex ? null : reviewIndex + 1);
  }

  const seenCount = progress?.seenCount ?? 0;
  const total = progress?.total ?? 0;
  const pct = total > 0 ? Math.min(100, Math.round((seenCount / total) * 100)) : 0;

  // Per-level counts, derived the same way `frontierIndex` is: lessons are
  // learned strictly in manifest order, so "seen" is exactly `lessons[0..
  // seenCount-1]" — no separate per-lesson seen/unseen field exists or needs
  // to, client-side, to answer "how much of level 3 is done".
  const levelStats = LEARN_LEVELS.map((level) => {
    let totalCount = 0;
    let doneCount = 0;
    lessons.forEach((lesson, index) => {
      if (lesson.level !== level.id) return;
      totalCount += 1;
      if (index < seenCount) doneCount += 1;
    });
    return { ...level, doneCount, totalCount };
  });
  // Falls back to the HIGHEST level with any content, not the last lesson in
  // array order: once every lesson is seen, displayLesson is null (the
  // "completed" card shows instead), and Curriculum.ts's own LEVELS comment
  // is explicit that level is a display grouping, not guaranteed sorted
  // across the whole manifest — a later-added lesson could land after
  // higher-level content while itself being a lower level (backfilling more
  // level-1 vocabulary, say). Taking the max avoids depending on an
  // ordering the engine never promised.
  const currentLevelId =
    displayLesson?.level ?? (lessons.length > 0 ? Math.max(...lessons.map((l) => l.level)) : 1);

  return (
    <ProtectedRoute>
      <div className="p-8">
        <div className="mb-6 flex items-center justify-between">
          <div>
            <h1 className="text-3xl font-bold text-foreground">Learn</h1>
            <p className="mt-2 text-foreground-secondary">
              Five levels, beginner to expert — one lesson at a time.
            </p>
          </div>
          <div className="flex gap-2">
            <Link href="/learn/translate">
              <Button variant="ghost">Translate →</Button>
            </Link>
            <Link href="/learn/resources">
              <Button variant="ghost">Reading resources →</Button>
            </Link>
          </div>
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
          <div className="mb-6 flex flex-wrap gap-2">
            {levelStats.map((level) => {
              const isCurrent = level.id === currentLevelId;
              const isEmpty = level.totalCount === 0;
              return (
                <div
                  key={level.id}
                  title={level.description}
                  className={`rounded-lg border px-3 py-2 text-xs ${
                    isCurrent
                      ? 'border-primary bg-primary/10'
                      : isEmpty
                        ? 'border-border opacity-50'
                        : 'border-border'
                  }`}
                >
                  <p className={`font-semibold ${isCurrent ? 'text-primary' : 'text-foreground'}`}>
                    Level {level.id}: {level.name}
                  </p>
                  <p className="mt-0.5 text-foreground-tertiary">
                    {isEmpty ? 'Coming soon' : `${level.doneCount} / ${level.totalCount} done`}
                  </p>
                </div>
              );
            })}
          </div>
        )}

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
              {isReviewing && " — won't change until you're back to your current lesson"}
            </p>
          </div>
        )}

        {loading ? (
          <div className="flex justify-center py-12">
            <LoadingSpinner size="lg" />
          </div>
        ) : displayLesson ? (
          <Card className="flex flex-col items-center gap-4 py-12 text-center">
            <div className="flex items-center gap-2">
              <span className="rounded-full bg-primary/10 px-2 py-0.5 text-xs font-medium text-primary">
                Level {displayLesson.level}: {LEARN_LEVELS.find((l) => l.id === displayLesson.level)?.name}
              </span>
              <span className="rounded-full bg-foreground/10 px-2 py-0.5 text-xs font-medium text-foreground-secondary">
                {displayLesson.stage}
              </span>
              {isReviewing && (
                <span className="rounded-full bg-primary/10 px-2 py-0.5 text-xs font-medium text-primary">
                  Reviewing
                </span>
              )}
            </div>
            <p className="text-5xl font-semibold text-foreground">{displayLesson.text}</p>
            <p className="text-sm text-foreground-secondary">{displayLesson.gloss}</p>
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

        <div className="mt-6 flex flex-wrap items-center justify-center gap-3">
          <Button
            variant="ghost"
            onClick={goPrevious}
            disabled={loading || actionLoading || displayIndex <= 0}
          >
            ← Previous
          </Button>

          {isReviewing ? (
            <Button variant="secondary" onClick={goNext}>
              Next →
            </Button>
          ) : (
            <>
              <Button
                variant="secondary"
                onClick={() => recordSeen(false)}
                disabled={!displayLesson || actionLoading}
              >
                Need practice
              </Button>
              <Button
                variant="primary"
                onClick={() => recordSeen(true)}
                disabled={!displayLesson || actionLoading}
              >
                Got it
              </Button>
            </>
          )}

          <Button variant="ghost" onClick={playAudio} disabled={!displayLesson || audioLoading}>
            {audioLoading ? 'Playing...' : 'Play audio'}
          </Button>
        </div>
      </div>
    </ProtectedRoute>
  );
}
