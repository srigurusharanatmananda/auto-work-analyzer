'use client';

import ProtectedRoute from '@/components/ProtectedRoute';
import TranscriptTab from '@/components/TranscriptTab';

export default function TranscriptsPage() {
  return (
    <ProtectedRoute>
      <div className="p-8">
        <div className="mb-6">
          <h1 className="text-3xl font-bold text-foreground">Call Transcripts</h1>
          <p className="mt-2 text-foreground-secondary">
            Upload a recording or paste a transcript, and turn what was agreed into ClickUp tasks
            — after you have checked it
          </p>
        </div>

        <div className="mb-6 rounded-lg border border-primary bg-primary/10 p-4">
          <div className="flex items-start gap-3">
            <svg
              className="mt-0.5 h-5 w-5 text-primary"
              fill="none"
              strokeLinecap="round"
              strokeLinejoin="round"
              strokeWidth="2"
              viewBox="0 0 24 24"
              stroke="currentColor"
            >
              <path d="M13 16h-1v-4h-1m1-4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
            </svg>
            <div>
              <h3 className="mb-1 text-sm font-semibold text-primary">How it works</h3>
              <p className="text-xs text-foreground-secondary">
                Audio is transcribed locally by Whisper — the recording never leaves this
                machine — and the text lands in the box below for you to correct before any
                model reads it. Every action item found must then quote the sentence it came
                from, and an item whose quote is not actually in the transcript is thrown away
                rather than filed. You see the quotes and choose what becomes a task — nothing
                reaches ClickUp until you say so.
              </p>
            </div>
          </div>
        </div>

        <TranscriptTab />
      </div>
    </ProtectedRoute>
  );
}
