'use client';

import { useRef, useState } from 'react';
import Link from 'next/link';
import ProtectedRoute from '@/components/ProtectedRoute';
import { api, messageFor } from '@/lib/api';
import { speakLearnText } from '@/lib/speak';
import { Button, Card, LoadingSpinner } from '@/lib/components/ui';
import toast from 'react-hot-toast';
import type {
  BatchTranslateResult,
  BatchTranslateRow,
  DocumentExtractResult,
  LearnLanguage,
  OcrResult,
  TranslateLanguage,
  TranslateResult,
} from '@/types';

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
  const [ocrLoading, setOcrLoading] = useState(false);
  const [docLoading, setDocLoading] = useState(false);
  const [batchLoading, setBatchLoading] = useState(false);
  const [batchRows, setBatchRows] = useState<BatchTranslateRow[] | null>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const imageInputRef = useRef<HTMLInputElement>(null);
  const documentInputRef = useRef<HTMLInputElement>(null);
  const csvInputRef = useRef<HTMLInputElement>(null);

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

  async function handleImageUpload(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    // Cleared up front, not just on every exit path below — same reasoning
    // as handleUpload's own clear, so re-picking the SAME file still fires
    // onChange.
    e.target.value = '';
    // Guards against overlapping with a translate() already in flight, not
    // just its own button's disabled state — the button is the normal way
    // in, but disabled state alone doesn't stop a request already queued
    // (e.g. a fast second click before React re-renders). Without this, a
    // slower translate() resolving AFTER this OCR call finishes could
    // still call setResult() with a translation of text that's no longer
    // in the box.
    if (!file || loading || docLoading) return;

    setOcrLoading(true);
    try {
      const body = new FormData();
      body.append('image', file);
      const data = await api.post<OcrResult>('/translate/ocr', body);
      setText(data.text);
      setResult(null);
      // Only ever moves `from` TO a confidently-detected language, never
      // clears it back to a guess — if the model couldn't tell,
      // whatever the learner already had selected stays selected.
      if (data.detectedLanguage) setFrom(data.detectedLanguage);
    } catch (caught) {
      toast.error(messageFor(caught, 'Could not extract text from that image'));
    } finally {
      setOcrLoading(false);
    }
  }

  async function handleDocumentUpload(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    e.target.value = '';
    // Same three-way mutual exclusion as handleImageUpload — this box is
    // about to be overwritten with the extracted text, so it must not be
    // in flight from (or feeding) any of the other operations.
    if (!file || loading || ocrLoading) return;

    setDocLoading(true);
    try {
      const body = new FormData();
      body.append('document', file);
      const data = await api.post<DocumentExtractResult>('/translate/document', body);
      setText(data.text);
      setResult(null);
      // Same reasoning as handleImageUpload's own guard: only move `from`
      // TO a confident detection, never overwrite the user's own selection
      // with a `null` non-signal.
      if (data.detectedLanguage) setFrom(data.detectedLanguage);
    } catch (caught) {
      toast.error(messageFor(caught, 'Could not extract text from that document'));
    } finally {
      setDocLoading(false);
    }
  }

  async function translate() {
    // Same reasoning as handleImageUpload's own `loading` guard, the other
    // direction: refuses to start while an OCR or document upload is still
    // populating the very text box this is about to read from.
    if (!text.trim() || ocrLoading || docLoading) return;

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

  async function handleCsvUpload(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    e.target.value = '';
    // A batch is a separate results table, not a rewrite of the single-item
    // text box above, so it only needs to guard against overlapping ITSELF —
    // unlike the OCR/document uploads, there's nothing here for translate()
    // or another upload to race with.
    if (!file || batchLoading) return;

    setBatchLoading(true);
    try {
      const body = new FormData();
      body.append('csv', file);
      body.append('from', from);
      body.append('to', to);
      const data = await api.post<BatchTranslateResult>('/translate/batch', body);
      setBatchRows(data.rows);
    } catch (caught) {
      toast.error(messageFor(caught, 'Could not process that CSV'));
    } finally {
      setBatchLoading(false);
    }
  }

  function downloadBatchResults() {
    if (!batchRows || batchRows.length === 0) return;
    const columns: Array<keyof BatchTranslateRow> = [
      'source',
      'translation',
      'meaning',
      'translationTransliteration',
      'sourceTransliteration',
      'error',
    ];
    // Standard CSV quoting: only quote a field that needs it, doubling any
    // embedded quote — anything simpler would break the moment a
    // translation or meaning contains its own comma or newline.
    const toCsvField = (value: string) => (/[",\n]/.test(value) ? `"${value.replace(/"/g, '""')}"` : value);
    const lines = [
      columns.join(','),
      ...batchRows.map((row) => columns.map((column) => toCsvField(row[column] ?? '')).join(',')),
    ];
    const blob = new Blob([lines.join('\n')], { type: 'text/csv' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = 'translation-results.csv';
    a.click();
    URL.revokeObjectURL(url);
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
                <input
                  ref={imageInputRef}
                  type="file"
                  accept="image/jpeg,image/png,image/webp,image/heic,image/heif"
                  className="hidden"
                  onChange={handleImageUpload}
                />
                <Button
                  variant="ghost"
                  size="sm"
                  onClick={() => imageInputRef.current?.click()}
                  disabled={ocrLoading || loading || docLoading}
                >
                  {ocrLoading ? 'Reading image...' : 'Upload image'}
                </Button>
                <input
                  ref={documentInputRef}
                  type="file"
                  accept="application/pdf,.pdf"
                  className="hidden"
                  onChange={handleDocumentUpload}
                />
                <Button
                  variant="ghost"
                  size="sm"
                  onClick={() => documentInputRef.current?.click()}
                  disabled={docLoading || loading || ocrLoading}
                >
                  {docLoading ? 'Reading PDF...' : 'Upload PDF'}
                </Button>
              </div>
            </div>
            <textarea
              value={text}
              onChange={(e) => setText(e.target.value)}
              placeholder={`Paste or type ${LANGUAGE_LABEL[from]} text here...`}
              rows={8}
              // Disabled while OCR/document extraction is filling this box
              // in — without this, typing during that window is a real edit
              // that setText(data.text) then silently overwrites the moment
              // the upload call resolves.
              disabled={ocrLoading || docLoading}
              className="w-full rounded-md border border-border bg-background p-3 text-base text-foreground placeholder:text-foreground-tertiary focus:outline-none focus:ring-2 focus:ring-primary disabled:opacity-60"
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
              <Button
                variant="primary"
                onClick={translate}
                disabled={!text.trim() || loading || ocrLoading || docLoading}
              >
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

        <Card className="mt-6 flex flex-col gap-3">
          <div className="flex flex-wrap items-center justify-between gap-3">
            <div>
              <p className="text-sm font-semibold text-foreground">Batch translate a CSV</p>
              <p className="text-xs text-foreground-tertiary">
                One phrase or verse per row, first column only — uses the {LANGUAGE_LABEL[from]} →{' '}
                {LANGUAGE_LABEL[to]} languages selected above.
              </p>
            </div>
            <div className="flex items-center gap-2">
              <input ref={csvInputRef} type="file" accept=".csv,text/csv" className="hidden" onChange={handleCsvUpload} />
              <Button variant="ghost" size="sm" onClick={() => csvInputRef.current?.click()} disabled={batchLoading}>
                {batchLoading ? 'Translating batch...' : 'Upload CSV'}
              </Button>
              {batchRows && batchRows.length > 0 && (
                <Button variant="ghost" size="sm" onClick={downloadBatchResults}>
                  Download results
                </Button>
              )}
            </div>
          </div>
          {batchLoading && (
            <div className="flex items-center justify-center py-8">
              <LoadingSpinner size="lg" />
            </div>
          )}
          {batchRows && !batchLoading && (
            <div className="overflow-x-auto">
              <table className="w-full text-left text-sm">
                <thead>
                  <tr className="border-b border-border text-xs font-semibold uppercase tracking-wide text-foreground-tertiary">
                    <th className="py-2 pr-4">{LANGUAGE_LABEL[from]}</th>
                    <th className="py-2 pr-4">{LANGUAGE_LABEL[to]}</th>
                    <th className="py-2">Meaning</th>
                  </tr>
                </thead>
                <tbody>
                  {batchRows.map((row, i) => (
                    <tr key={i} className="border-b border-border align-top last:border-0">
                      <td className="py-2 pr-4 whitespace-pre-wrap text-foreground">{row.source}</td>
                      <td className="py-2 pr-4 whitespace-pre-wrap">
                        {row.error ? (
                          <span className="text-error">{row.error}</span>
                        ) : (
                          <span className="text-foreground">{row.translation}</span>
                        )}
                      </td>
                      <td className="py-2 whitespace-pre-wrap text-foreground-secondary">{row.meaning ?? ''}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </Card>
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
