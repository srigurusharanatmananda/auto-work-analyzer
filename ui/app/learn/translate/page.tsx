'use client';

import { useRef, useState } from 'react';
import Link from 'next/link';
import ProtectedRoute from '@/components/ProtectedRoute';
import { api, messageFor } from '@/lib/api';
import { speakLearnText } from '@/lib/speak';
import { Button, Card, LoadingSpinner } from '@/lib/components/ui';
import toast from 'react-hot-toast';
import type { LearnLanguage, TranslateLanguage, TranslateResult } from '@/types';

const LANGUAGE_LABEL: Record<TranslateLanguage, string> = {
  english: 'English',
  sanskrit: 'Sanskrit',
  tamil: 'Tamil',
};

const LANGUAGES: TranslateLanguage[] = ['english', 'sanskrit', 'tamil'];

function isSpeakable(language: TranslateLanguage): language is LearnLanguage {
  return language === 'sanskrit' || language === 'tamil';
}

export default function TranslatePage() {
  const [from, setFrom] = useState<TranslateLanguage>('english');
  const [to, setTo] = useState<TranslateLanguage>('sanskrit');
  const [text, setText] = useState('');
  const [result, setResult] = useState<TranslateResult | null>(null);
  const [loading, setLoading] = useState(false);
  // Which side is currently synthesizing — 'source' | 'result' | null,
  // rather than a single shared boolean, so playing one side doesn't
  // disable the other's button for no reason.
  const [speaking, setSpeaking] = useState<'source' | 'result' | null>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);

  async function playSide(side: 'source' | 'result', language: LearnLanguage, spokenText: string) {
    if (!spokenText.trim()) return;
    setSpeaking(side);
    try {
      await speakLearnText(language, spokenText);
    } catch (caught) {
      toast.error(messageFor(caught, 'Failed to play audio'));
    } finally {
      setSpeaking(null);
    }
  }

  function swap() {
    setFrom(to);
    setTo(from);
    setResult(null);
  }

  async function handleUpload(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    if (!file) return;
    try {
      setText(await file.text());
      setResult(null);
    } catch (caught) {
      toast.error(messageFor(caught, 'Could not read that file'));
    } finally {
      // Cleared so choosing the SAME file again still fires onChange.
      e.target.value = '';
    }
  }

  async function translate() {
    if (!text.trim()) return;

    setLoading(true);
    try {
      const data = await api.post<TranslateResult>('/translate', { text: text.trim(), from, to });
      setResult(data);
    } catch (caught) {
      toast.error(messageFor(caught, 'Translation failed'));
    } finally {
      setLoading(false);
    }
  }

  return (
    <ProtectedRoute>
      <div className="p-8">
        <div className="mb-6 flex items-center justify-between">
          <div>
            <h1 className="text-3xl font-bold text-foreground">Translate</h1>
            <p className="mt-2 text-foreground-secondary">
              Sanskrit, Tamil, and English — translation and transliteration, either direction.
            </p>
          </div>
          <Link href="/learn">
            <Button variant="ghost">← Back to lessons</Button>
          </Link>
        </div>

        <div className="mb-4 flex flex-wrap items-center gap-3">
          <LanguagePicker
            value={from}
            onChange={(value) => {
              setFrom(value);
              setResult(null);
            }}
            label="From"
          />
          <Button variant="ghost" size="sm" onClick={swap} aria-label="Swap languages">
            ⇄
          </Button>
          <LanguagePicker
            value={to}
            onChange={(value) => {
              setTo(value);
              setResult(null);
            }}
            label="To"
          />
        </div>

        <div className="grid gap-6 lg:grid-cols-2">
          <Card className="flex flex-col gap-3">
            <div className="flex items-center justify-between">
              <p className="text-xs font-semibold uppercase tracking-wide text-foreground-tertiary">
                {LANGUAGE_LABEL[from]}
              </p>
              <div className="flex items-center gap-2">
                <input
                  ref={fileInputRef}
                  type="file"
                  accept=".txt,text/plain"
                  className="hidden"
                  onChange={handleUpload}
                />
                <Button variant="ghost" size="sm" onClick={() => fileInputRef.current?.click()}>
                  Upload .txt
                </Button>
              </div>
            </div>
            <textarea
              value={text}
              onChange={(e) => setText(e.target.value)}
              placeholder={`Paste or type ${LANGUAGE_LABEL[from]} text here...`}
              rows={8}
              className="w-full rounded-md border border-border bg-background p-3 text-base text-foreground placeholder:text-foreground-tertiary focus:outline-none focus:ring-2 focus:ring-primary"
            />
            <div className="flex justify-end gap-2">
              {isSpeakable(from) && (
                <Button
                  variant="ghost"
                  onClick={() => playSide('source', from, text)}
                  disabled={!text.trim() || speaking !== null}
                >
                  {speaking === 'source' ? 'Synthesizing (can take minutes)...' : 'Play audio'}
                </Button>
              )}
              <Button variant="primary" onClick={translate} disabled={!text.trim() || loading}>
                {loading ? 'Translating...' : 'Translate'}
              </Button>
            </div>
          </Card>

          <Card className="flex flex-col gap-3">
            <p className="text-xs font-semibold uppercase tracking-wide text-foreground-tertiary">
              {LANGUAGE_LABEL[to]}
            </p>
            {loading ? (
              <div className="flex flex-1 items-center justify-center py-12">
                <LoadingSpinner size="lg" />
              </div>
            ) : result ? (
              <div className="flex flex-1 flex-col gap-4">
                <p className="text-xl text-foreground whitespace-pre-wrap">{result.translation}</p>
                {result.translationTransliteration && (
                  <p className="text-sm italic text-foreground-secondary">
                    {result.translationTransliteration}
                  </p>
                )}
                {result.meaning && (
                  <div className="rounded-md bg-background-tertiary p-3">
                    <p className="text-xs font-semibold uppercase tracking-wide text-foreground-tertiary">
                      Meaning
                    </p>
                    <p className="mt-1 text-sm text-foreground-secondary whitespace-pre-wrap">
                      {result.meaning}
                    </p>
                  </div>
                )}
                <div className="mt-auto flex flex-col gap-3">
                  {result.sourceTransliteration && (
                    <div className="border-t border-border pt-3">
                      <p className="text-xs font-semibold uppercase tracking-wide text-foreground-tertiary">
                        {LANGUAGE_LABEL[from]} romanized
                      </p>
                      <p className="mt-1 text-sm italic text-foreground-secondary">
                        {result.sourceTransliteration}
                      </p>
                    </div>
                  )}
                  {isSpeakable(to) && (
                    <div className="flex justify-end">
                      <Button
                        variant="ghost"
                        onClick={() => playSide('result', to, result.translation)}
                        disabled={!result.translation.trim() || speaking !== null}
                      >
                        {speaking === 'result' ? 'Synthesizing (can take minutes)...' : 'Play audio'}
                      </Button>
                    </div>
                  )}
                </div>
              </div>
            ) : (
              <div className="flex flex-1 items-center justify-center py-12 text-center text-sm text-foreground-tertiary">
                {from === to
                  ? 'Same language on both sides shows the romanization only.'
                  : 'Translation and romanization will appear here.'}
              </div>
            )}
          </Card>
        </div>
      </div>
    </ProtectedRoute>
  );
}

function LanguagePicker({
  value,
  onChange,
  label,
}: {
  value: TranslateLanguage;
  onChange: (value: TranslateLanguage) => void;
  label: string;
}) {
  return (
    <label className="flex items-center gap-2 text-sm text-foreground-secondary">
      {label}
      <select
        value={value}
        onChange={(e) => onChange(e.target.value as TranslateLanguage)}
        className="rounded-md border border-border bg-background-tertiary px-3 py-2 text-foreground focus:outline-none focus:ring-2 focus:ring-primary"
      >
        {LANGUAGES.map((lang) => (
          <option key={lang} value={lang}>
            {LANGUAGE_LABEL[lang]}
          </option>
        ))}
      </select>
    </label>
  );
}
