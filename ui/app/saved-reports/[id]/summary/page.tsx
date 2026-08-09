'use client';

import { useParams } from 'next/navigation';
import { useReport } from '@/lib/hooks/useReport';
import ProtectedRoute from '@/components/ProtectedRoute';

export default function ReportSummaryPage() {
  const params = useParams();
  const reportId = params.id as string;

  const {
    report,
    loading,
    error,
    generateSummaryReport,
    handleCopySummary,
    reload,
  } = useReport(reportId);

  if (loading) {
    return (
      <ProtectedRoute>
        <div className="flex items-center justify-center py-12">
          <div className="inline-block animate-spin rounded-full h-12 w-12 border-b-2 border-primary"></div>
        </div>
      </ProtectedRoute>
    );
  }

  if (error || !report) {
    return (
      <ProtectedRoute>
        <div className="text-center py-12">
          <div className="text-4xl mb-2">⚠️</div>
          <div className="text-foreground mb-2">Failed to load report</div>
          <div className="text-sm text-foreground-secondary mb-4">{error || 'Report not found'}</div>
          <button
            onClick={reload}
            className="bg-primary text-white px-4 py-2 rounded-lg hover:bg-primary-hover transition-colors"
          >
            Retry
          </button>
        </div>
      </ProtectedRoute>
    );
  }

  return (
    <ProtectedRoute>
      <div className="space-y-6">
      <div className="bg-primary/5 border border-primary/20 rounded-lg p-6">
        <div className="flex items-center justify-between mb-4">
          <div>
            <h3 className="text-lg font-semibold text-foreground">EOD Summary (Titles Only)</h3>
            <p className="text-sm text-foreground-secondary mt-1">Quick list of work items without descriptions</p>
          </div>
          <button
            onClick={handleCopySummary}
            className="bg-primary text-white px-4 py-2 rounded-lg hover:bg-primary-hover transition-colors flex items-center gap-2"
          >
            <span>📋</span>
            <span>Copy Summary</span>
          </button>
        </div>
        <div className="bg-background-tertiary rounded-lg p-4 border border-border">
          <pre className="whitespace-pre-wrap font-mono text-sm text-foreground leading-relaxed">{generateSummaryReport()}</pre>
        </div>
      </div>

      {/* Preview section */}
      <div className="bg-background-secondary rounded-lg border border-border p-6">
        <h4 className="text-sm font-semibold text-foreground mb-3">How to use</h4>
        <ul className="text-sm text-foreground-secondary space-y-2">
          <li>• Click &quot;Copy Summary&quot; to copy the summary to your clipboard</li>
          <li>• Use this format for quick status updates and EOD reports</li>
          <li>• Perfect for team standups or brief progress summaries</li>
        </ul>
      </div>
    </div>
    </ProtectedRoute>
  );
}
