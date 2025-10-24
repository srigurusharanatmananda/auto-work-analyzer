'use client';

import NotesTab from '@/components/NotesTab';
import ProtectedRoute from '@/components/ProtectedRoute';

export default function NotesPage() {
  return (
    <ProtectedRoute>
      <div className="p-8">
      <div className="mb-6">
        <h1 className="text-3xl font-bold text-foreground">Upload Notes</h1>
        <p className="mt-2 text-foreground-secondary">
          Convert your text notes into structured work items and tasks
        </p>
      </div>

      {/* Info Card */}
      <div className="mb-6 rounded-lg border border-primary bg-primary/10 p-4">
        <div className="flex items-start gap-3">
          <svg className="h-5 w-5 text-primary mt-0.5" fill="none" strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" viewBox="0 0 24 24" stroke="currentColor">
            <path d="M13 16h-1v-4h-1m1-4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
          </svg>
          <div>
            <h3 className="text-sm font-semibold text-primary mb-1">How it works</h3>
            <p className="text-xs text-foreground-secondary">
              Upload a text or markdown file with your notes, or paste them directly.
              The system will automatically parse and structure them into work items.
            </p>
          </div>
        </div>
      </div>

      <NotesTab />
    </div>
    </ProtectedRoute>
  );
}
