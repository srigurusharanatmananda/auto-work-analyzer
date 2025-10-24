'use client';

import { useState } from 'react';
import ReportsTab from '@/components/ReportsTab';
import ProtectedRoute from '@/components/ProtectedRoute';

export default function ReportsPage() {
  const [selectedProjectPath, setSelectedProjectPath] = useState<string>('');

  return (
    <ProtectedRoute>
      <div className="p-8">
      <div className="mb-6">
        <h1 className="text-3xl font-bold text-foreground">Daily Reports</h1>
        <p className="mt-2 text-foreground-secondary">
          Generate and manage your daily work reports
        </p>
      </div>

      {/* Project Path Info */}
      {selectedProjectPath && (
        <div className="mb-6 rounded-lg border border-success bg-success/10 p-4">
          <div className="flex items-center gap-3">
            <svg className="h-5 w-5 text-success" fill="none" strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" viewBox="0 0 24 24" stroke="currentColor">
              <path d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z" />
            </svg>
            <div className="flex-1 min-w-0">
              <div className="text-xs font-semibold text-success uppercase tracking-wide mb-1">
                Selected Project
              </div>
              <code className="text-sm text-foreground font-mono block truncate">
                {selectedProjectPath}
              </code>
            </div>
          </div>
        </div>
      )}

      <ReportsTab
        selectedProjectPath={selectedProjectPath}
        setSelectedProjectPath={setSelectedProjectPath}
      />
    </div>
    </ProtectedRoute>
  );
}
