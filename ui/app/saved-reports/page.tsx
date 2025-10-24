'use client';

import SavedReportsTab from '@/components/SavedReportsTab';
import ProtectedRoute from '@/components/ProtectedRoute';

export default function SavedReportsPage() {
  return (
    <ProtectedRoute>
      <div className="p-8">
      <div className="mb-6">
        <h1 className="text-3xl font-bold text-foreground">Saved Reports</h1>
        <p className="mt-2 text-foreground-secondary">
          Browse and manage your saved analysis reports
        </p>
      </div>
      <SavedReportsTab />
    </div>
    </ProtectedRoute>
  );
}
