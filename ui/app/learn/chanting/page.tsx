'use client';

import { useEffect, useRef, useState } from 'react';
import Link from 'next/link';
import ProtectedRoute from '@/components/ProtectedRoute';
import { api, messageFor } from '@/lib/api';
import { speakLearnText } from '@/lib/speak';
import { Button, Card, LoadingSpinner } from '@/lib/components/ui';
import toast from 'react-hot-toast';
import type { ChantSyllable, ChantVerse, ChantVerseSummary } from '@/types';

// Longer = held longer while chanting, the same "clap vs. clap-with-a-hold"
// intuition the source material for this feature uses — guru literally
// takes about twice as long to say as laghu. anceps (the last syllable of
// every pāda) is genuinely ambiguous, not a third length, so it gets its
// own neutral treatment rather than being forced into "long" or "short".
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

export default function ChantingPage() {
  const [verses, setVerses] = useState<ChantVerseSummary[]>([]);
  const [verse, setVerse] = useState<ChantVerse | null>(null);
  // Distinguishes "haven't loaded a verse's detail yet" from "tried and it
  // failed" — without this, a detail-fetch failure after a successful list
  // fetch would fall into the same `!verse` branch as "no verses exist at
  // all" and show the wrong empty-state message.
  const [verseLoadFailed, setVerseLoadFailed] = useState(false);
  const [padaIndex, setPadaIndex] = useState(0);
  const [loading, setLoading] = useState(true);
  const [audioLoading, setAudioLoading] = useState(false);
  // Lets a stale selectVerse response discard itself if the user has since
  // picked a different verse — same reasoning as `learn/page.tsx`'s own
  // `languageRef`, needed once more than one verse exists for the picker to
  // select between (a plain closure over `id` can't see a LATER selection).
  const selectedIdRef = useRef<string | null>(null);

  async function selectVerse(id: string) {
    selectedIdRef.current = id;
    setLoading(true);
    setVerseLoadFailed(false);
    setPadaIndex(0);
    try {
      const detail = await api.get<ChantVerse>(`/chanting/verses/${id}`);
      if (selectedIdRef.current === id) setVerse(detail);
    } catch (caught) {
      if (selectedIdRef.current === id) {
        toast.error(messageFor(caught, 'Failed to load the verse'));
        setVerseLoadFailed(true);
      }
    } finally {
      if (selectedIdRef.current === id) setLoading(false);
    }
  }

  useEffect(() => {
    let ignore = false;

    async function load() {
      setLoading(true);
      try {
        const list = await api.get<ChantVerseSummary[]>('/chanting/verses');
        if (ignore) return;
        setVerses(list);
        if (list.length > 0) {
          selectedIdRef.current = list[0].id;
          const detail = await api.get<ChantVerse>(`/chanting/verses/${list[0].id}`);
          if (!ignore) setVerse(detail);
        }
      } catch (caught) {
        if (!ignore) {
          toast.error(messageFor(caught, 'Failed to load the verse'));
          setVerseLoadFailed(true);
        }
      } finally {
        if (!ignore) setLoading(false);
      }
    }

    void load();
    return () => {
      ignore = true;
    };
  }, []);

  async function playAudio(text: string) {
    setAudioLoading(true);
    try {
      await speakLearnText('sanskrit', text);
    } catch (caught) {
      toast.error(messageFor(caught, 'Failed to play audio'));
    } finally {
      setAudioLoading(false);
    }
  }

  const pada = verse?.padas[padaIndex] ?? null;

  return (
    <ProtectedRoute>
      <div className="p-8">
        <div className="mb-6 flex items-center justify-between">
          <div>
            <h1 className="text-3xl font-bold text-foreground">Chanting Practice</h1>
            <p className="mt-2 text-foreground-secondary">
              One verse at a time — pronunciation first, then meaning, then fluency.
            </p>
          </div>
          <Link href="/learn">
            <Button variant="ghost">← Back to Learn</Button>
          </Link>
        </div>

        {verses.length > 1 && (
          <div className="mb-6 flex flex-wrap gap-2">
            {verses.map((v) => (
              <button
                key={v.id}
                onClick={() => selectVerse(v.id)}
                className={`rounded-lg border px-3 py-2 text-left text-xs ${
                  verse?.id === v.id ? 'border-primary bg-primary/10' : 'border-border'
                }`}
              >
                <p className="font-semibold text-foreground">
                  {v.source} — verse {v.verseNumber}
                </p>
              </button>
            ))}
          </div>
        )}

        {loading ? (
          <div className="flex justify-center py-12">
            <LoadingSpinner size="lg" />
          </div>
        ) : !verse ? (
          <Card className="py-12 text-center">
            <p className="text-foreground-secondary">
              {verseLoadFailed ? "Couldn't load this verse — try again." : 'No verses yet.'}
            </p>
          </Card>
        ) : (
          <div className="flex flex-col gap-6">
            <div>
              <p className="text-sm font-medium text-foreground-secondary">
                {verse.source} — verse {verse.verseNumber}
              </p>
              {verse.speakerTag && (
                <p className="mt-1 text-sm italic text-foreground-tertiary">{verse.speakerTag}</p>
              )}
            </div>

            {pada && (
              <Card className="flex flex-col items-center gap-4 py-10 text-center">
                <span className="rounded-full bg-primary/10 px-2 py-0.5 text-xs font-medium text-primary">
                  Phrase {padaIndex + 1} of {verse.padas.length}
                </span>

                <p className="text-4xl font-semibold text-foreground">{pada.text}</p>
                <p className="text-sm text-foreground-secondary">{pada.iast}</p>

                <div className="flex flex-wrap justify-center gap-1.5">
                  {pada.syllables.map((syllable, i) => (
                    <span
                      key={i}
                      title={WEIGHT_LABEL[syllable.weight]}
                      className={`rounded px-2 py-1 text-lg ${WEIGHT_STYLE[syllable.weight]}`}
                    >
                      {syllable.text}
                    </span>
                  ))}
                </div>
                <p className="text-xs text-foreground-tertiary">
                  Darker = guru (say it longer) · lighter = laghu (say it shorter) · italic = pāda-final,
                  either length is fine
                </p>

                <div className="mt-2 flex flex-col gap-1 text-sm text-foreground-secondary">
                  {pada.words.map((word, i) => (
                    <p key={i}>
                      <span className="font-medium text-foreground">{word.devanagari}</span>
                      <span className="text-foreground-tertiary"> ({word.iast})</span> — {word.gloss}
                    </p>
                  ))}
                </div>

                <Button
                  variant="ghost"
                  onClick={() => playAudio(pada.text)}
                  disabled={audioLoading}
                >
                  {audioLoading ? 'Synthesizing (can take minutes)...' : 'Play audio'}
                </Button>
              </Card>
            )}

            <div className="flex justify-center gap-3">
              <Button
                variant="ghost"
                onClick={() => setPadaIndex((i) => Math.max(0, i - 1))}
                disabled={padaIndex === 0}
              >
                ← Previous phrase
              </Button>
              <Button
                variant="secondary"
                onClick={() => setPadaIndex((i) => Math.min(verse.padas.length - 1, i + 1))}
                disabled={padaIndex === verse.padas.length - 1}
              >
                Next phrase →
              </Button>
            </div>

            <Card className="flex flex-col gap-3 p-6">
              <h2 className="text-lg font-semibold text-foreground">Full verse</h2>
              <p className="text-xl text-foreground">{verse.padas.map((p) => p.text).join(' ')}</p>
              <p className="text-sm text-foreground-secondary">
                {verse.padas.map((p) => p.iast).join(' ')}
              </p>
              <Button
                variant="ghost"
                className="self-start"
                onClick={() => playAudio(verse.padas.map((p) => p.text).join(' '))}
                disabled={audioLoading}
              >
                {audioLoading ? 'Synthesizing (can take minutes)...' : 'Play full verse'}
              </Button>
            </Card>

            <Card className="flex flex-col gap-2 p-6">
              <h2 className="text-lg font-semibold text-foreground">Meaning</h2>
              <p className="text-foreground-secondary">{verse.meaning}</p>
            </Card>

            <details className="rounded-lg border border-border p-4 text-xs text-foreground-tertiary">
              <summary className="cursor-pointer text-sm font-medium text-foreground-secondary">
                Sourcing notes
              </summary>
              <p className="mt-2">{verse.citation}</p>
            </details>
          </div>
        )}
      </div>
    </ProtectedRoute>
  );
}
