'use client';

import { useParams } from 'next/navigation';
import { useReport } from '@/lib/hooks/useReport';
import ProtectedRoute from '@/components/ProtectedRoute';

export default function ReportOverviewPage() {
  const params = useParams();
  const reportId = params.id as string;

  const {
    report,
    loading,
    error,
    editableWorkItems,
    enhancingItems,
    toggleEditMode,
    updateWorkItem,
    handleEnhanceWithAI,
    reload,
  } = useReport(reportId);

  const formatDate = (dateStr: string) => {
    const date = new Date(dateStr);
    return date.toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' });
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
      {/* Report Info */}
      <div className="bg-background-secondary rounded-lg border border-border p-6">
        <h2 className="text-2xl font-bold mb-4 text-foreground">Report: {formatDate(report.analysis.date)}</h2>
        <div className="grid grid-cols-2 md:grid-cols-4 gap-4 text-sm">
          <div>
            <div className="text-foreground-secondary">Date</div>
            <div className="font-semibold text-foreground">{report.analysis.date}</div>
          </div>
          <div>
            <div className="text-foreground-secondary">Commits</div>
            <div className="font-semibold text-foreground">{report.analysis.totalCommits}</div>
          </div>
          <div>
            <div className="text-foreground-secondary">Work Items</div>
            <div className="font-semibold text-foreground">{report.analysis.totalWorkItems}</div>
          </div>
          <div>
            <div className="text-foreground-secondary">Tasks Created</div>
            <div className="font-semibold text-foreground">{report.analysis.tasksCreated}</div>
          </div>
        </div>
        {report.analysis.projectPath && (
          <div className="mt-4 text-sm">
            <div className="text-foreground-secondary">Project Path</div>
            <div className="font-mono text-foreground-tertiary">{report.analysis.projectPath}</div>
          </div>
        )}
      </div>

      {/* Work Items */}
      <div className="space-y-3">
        <h3 className="text-lg font-semibold text-foreground">Work Items</h3>
        {editableWorkItems.length === 0 ? (
          <div className="text-center text-foreground-secondary py-8">
            No work items found
          </div>
        ) : (
          editableWorkItems.map(item => (
            <div key={item.id} className="bg-background-secondary rounded-lg border border-border p-4 hover:border-border-hover transition-colors">
              <div className="flex items-start justify-between gap-4">
                <div className="flex-1">
                  {item.isEditing ? (
                    <div className="space-y-3">
                      <input
                        type="text"
                        value={item.name}
                        onChange={(e) => updateWorkItem(item.id, 'name', e.target.value)}
                        className="w-full px-3 py-2 border border-border bg-background-tertiary rounded-lg focus:ring-2 focus:ring-primary text-foreground font-medium"
                      />
                      <select
                        value={item.type}
                        onChange={(e) => updateWorkItem(item.id, 'type', e.target.value)}
                        className="px-3 py-2 border border-border bg-background-tertiary rounded-lg focus:ring-2 focus:ring-primary text-foreground"
                      >
                        <option value="feature">✨ Feature</option>
                        <option value="bug-fix">🐛 Bug Fix</option>
                        <option value="improvement">🔧 Improvement</option>
                      </select>
                      <textarea
                        value={item.description}
                        onChange={(e) => updateWorkItem(item.id, 'description', e.target.value)}
                        rows={4}
                        className="w-full px-3 py-2 border border-border bg-background-tertiary rounded-lg focus:ring-2 focus:ring-primary text-foreground text-sm"
                        placeholder="Description..."
                      />
                    </div>
                  ) : (
                    <div>
                      <div className="font-semibold text-lg mb-1 text-foreground">
                        {item.type === 'feature' ? '✨' : item.type === 'bug-fix' ? '🐛' : '🔧'} {item.name}
                      </div>
                      {item.description && (
                        <div className="text-foreground-secondary text-sm whitespace-pre-wrap mt-2">{item.description}</div>
                      )}
                      <div className="flex gap-4 mt-3 text-xs text-foreground-tertiary">
                        <span>📁 {item.filesCount} files</span>
                        <span>💾 {item.commitsCount} commits</span>
                        <span>⏱️ {item.estimatedHours}h</span>
                      </div>
                    </div>
                  )}
                </div>
                <div className="flex flex-col gap-2">
                  <button
                    onClick={() => toggleEditMode(item.id)}
                    className="text-primary hover:text-primary-hover text-sm transition-colors"
                  >
                    {item.isEditing ? '✅ Save' : '✏️ Edit'}
                  </button>
                  <button
                    onClick={() => handleEnhanceWithAI(item.id)}
                    disabled={enhancingItems.has(item.id)}
                    className="text-secondary hover:text-secondary-hover text-sm disabled:text-foreground-tertiary transition-colors"
                  >
                    {enhancingItems.has(item.id) ? '⏳' : '✨ AI'}
                  </button>
                </div>
              </div>
            </div>
          ))
        )}
      </div>
    </div>
    </ProtectedRoute>
  );
}
