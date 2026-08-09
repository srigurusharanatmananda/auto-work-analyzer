'use client';

import { Suspense, use } from 'react';
import ProtectedRoute from '@/components/ProtectedRoute';
import TranscriptDetail from '@/components/TranscriptDetail';

/**
 * `useSearchParams` (for the `?t=` deep link) suspends, and Next requires a
 * boundary around it or the whole route opts into client rendering with a build
 * warning.
 */
export default function TranscriptDetailPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = use(params);

  return (
    <ProtectedRoute>
      <div className="p-8">
        <Suspense fallback={<p className="text-sm text-foreground-tertiary">Loading…</p>}>
          <TranscriptDetail jobId={id} />
        </Suspense>
      </div>
    </ProtectedRoute>
  );
}
