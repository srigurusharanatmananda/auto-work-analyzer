'use client';

import { useParams } from 'next/navigation';
import { useReport } from '@/lib/hooks/useReport';
import ProtectedRoute from '@/components/ProtectedRoute';
import { useState } from 'react';
import { copyToClipboard } from '@/lib/clipboard';

export default function ReportManagerSummaryPage() {
  const params = useParams();
  const reportId = params.id as string;
  const [viewMode, setViewMode] = useState<'full' | 'quick'>('full');

  const {
    report,
    loading,
    error,
    managerSummary,
    isGeneratingManagerSummary,
    generateManagerSummary,
    handleCopyManagerSummary,
    reload,
  } = useReport(reportId);

  // Extract main points from the full summary
  const extractQuickList = (summary: string): string => {
    if (!summary) return '';

    const lines = summary.split('\n');
    const quickPoints: string[] = [];

    // Keep the header
    const header = lines.find(line => line.includes('EOD:'));
    if (header) {
      quickPoints.push(header);
    }

    // Extract main bullet points (lines starting with - and emoji)
    for (const line of lines) {
      const trimmed = line.trim();
      // Match lines that start with - followed by emoji and text
      if (trimmed.match(/^-\s*[✨🐛🔧]/)) {
        // Get just the main point, remove sub-descriptions (lines starting with →)
        const mainPoint = trimmed.split('→')[0].trim();
        quickPoints.push(mainPoint);
      }
    }

    return quickPoints.join('\n');
  };

  const handleCopyQuickList = async () => {
    const quickList = extractQuickList(managerSummary);
    await copyToClipboard(quickList, 'Quick list');
  };

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
              <h3 className="text-lg font-semibold text-foreground">Manager-Friendly Summary</h3>
              <p className="text-sm text-foreground-secondary mt-1">
                Business-oriented summary for non-technical stakeholders
              </p>
            </div>
            <div className="flex gap-3">
              <button
                onClick={generateManagerSummary}
                disabled={isGeneratingManagerSummary}
                className="bg-accent text-white px-4 py-2 rounded-lg hover:bg-accent-hover transition-colors flex items-center gap-2 disabled:opacity-50 disabled:cursor-not-allowed"
              >
                <span>🤖</span>
                <span>{isGeneratingManagerSummary ? 'Generating...' : 'Generate Summary'}</span>
              </button>
            </div>
          </div>

          {isGeneratingManagerSummary && (
            <div className="bg-background-tertiary rounded-lg p-8 border border-border">
              <div className="flex flex-col items-center justify-center gap-4">
                <div className="inline-block animate-spin rounded-full h-12 w-12 border-b-2 border-primary"></div>
                <p className="text-foreground-secondary text-center">
                  AI is translating technical details into business language...
                </p>
              </div>
            </div>
          )}

          {!isGeneratingManagerSummary && managerSummary && (
            <>
              {/* View mode toggle */}
              <div className="flex items-center gap-4 mb-4">
                <div className="flex rounded-lg border border-border overflow-hidden">
                  <button
                    onClick={() => setViewMode('full')}
                    className={`px-4 py-2 text-sm font-medium transition-colors ${
                      viewMode === 'full'
                        ? 'bg-primary text-white'
                        : 'bg-background text-foreground-secondary hover:bg-background-secondary'
                    }`}
                  >
                    Full Summary
                  </button>
                  <button
                    onClick={() => setViewMode('quick')}
                    className={`px-4 py-2 text-sm font-medium transition-colors ${
                      viewMode === 'quick'
                        ? 'bg-primary text-white'
                        : 'bg-background text-foreground-secondary hover:bg-background-secondary'
                    }`}
                  >
                    Quick List
                  </button>
                </div>
                <button
                  onClick={viewMode === 'full' ? handleCopyManagerSummary : handleCopyQuickList}
                  className="bg-primary text-white px-4 py-2 rounded-lg hover:bg-primary-hover transition-colors flex items-center gap-2"
                >
                  <span>📋</span>
                  <span>Copy {viewMode === 'full' ? 'Summary' : 'Quick List'}</span>
                </button>
              </div>

              {/* Content display */}
              <div className="bg-background-tertiary rounded-lg p-4 border border-border">
                <pre className="whitespace-pre-wrap font-mono text-sm text-foreground leading-relaxed">
                  {viewMode === 'full' ? managerSummary : extractQuickList(managerSummary)}
                </pre>
              </div>
            </>
          )}

          {!isGeneratingManagerSummary && !managerSummary && (
            <div className="bg-background-tertiary rounded-lg p-8 border border-border text-center">
              <div className="text-4xl mb-3">📊</div>
              <p className="text-foreground mb-2">No manager summary generated yet</p>
              <p className="text-sm text-foreground-secondary">
                Click &quot;Generate Summary&quot; to create a business-friendly version of this report
              </p>
            </div>
          )}
        </div>

        {/* Info section */}
        <div className="bg-background-secondary rounded-lg border border-border p-6">
          <h4 className="text-sm font-semibold text-foreground mb-3">About Manager Summaries</h4>
          <ul className="text-sm text-foreground-secondary space-y-2">
            <li>• <strong>Full Summary:</strong> Detailed business-friendly descriptions with explanations of impact</li>
            <li>• <strong>Quick List:</strong> Just the main points without descriptions - perfect for quick updates</li>
            <li>• AI translates technical work items into clear, non-technical language</li>
            <li>• Focuses on business value and outcomes rather than implementation details</li>
            <li>• Perfect for sharing with non-technical stakeholders and managers</li>
            <li>• Toggle between views and copy whichever format you need</li>
          </ul>
        </div>
      </div>
    </ProtectedRoute>
  );
}
