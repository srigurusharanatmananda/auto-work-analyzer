'use client';

import HistoryTab from '@/components/HistoryTab';
import ProtectedRoute from '@/components/ProtectedRoute';

export default function HistoryPage() {
  return (
    <ProtectedRoute>
      <div className="p-8">
      <div className="mb-6">
        <h1 className="text-3xl font-bold text-foreground">Analysis History</h1>
        <p className="mt-2 text-foreground-secondary">
          View your past analyses and their statistics
        </p>
      </div>
      <HistoryTab />
    </div>
    </ProtectedRoute>
  );
}
