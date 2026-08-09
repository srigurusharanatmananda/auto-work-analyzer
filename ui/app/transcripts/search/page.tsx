'use client';

import Link from 'next/link';
import ProtectedRoute from '@/components/ProtectedRoute';
import TranscriptSearch from '@/components/TranscriptSearch';

export default function TranscriptSearchPage() {
  return (
    <ProtectedRoute>
      <div className="p-8">
        <div className="mb-6 flex flex-wrap items-start justify-between gap-4">
          <div>
            <h1 className="text-3xl font-bold text-foreground">Search Transcripts</h1>
            <p className="mt-2 text-foreground-secondary">
              Find the call a phrase was said in, and the moment it was said
            </p>
          </div>

          <Link
            href="/transcripts"
            className="rounded-md border border-border px-4 py-2 text-sm font-medium text-foreground-secondary transition-colors hover:bg-background-tertiary hover:text-foreground"
          >
            Upload a recording
          </Link>
        </div>

        <TranscriptSearch />
      </div>
    </ProtectedRoute>
  );
}
