'use client';

import { useCallback, useEffect, useRef, useState } from 'react';
import { useRouter } from 'next/navigation';
import { api, messageFor } from '@/lib/api';
import toast from 'react-hot-toast';

const PAGE_SIZE = 10;

interface WorkItem {
  id: string;
  analysisId: string;
  name: string;
  type: string;
  description: string;
  estimatedHours: number;
  complexity: number;
  filesCount: number;
  commitsCount: number;
  createdAt: string;
}

interface Analysis {
  id: string;
  timestamp: string;
  projectPath: string;
  date: string;
  endDate?: string;
  author?: string;
  branch?: string;
  totalCommits: number;
  totalWorkItems: number;
  tasksCreated: number;
  summary: string;
}

interface SavedReport {
  analysis: Analysis;
  workItems: WorkItem[];
}

/** One page of `GET /api/reports`. */
interface ReportPage {
  reports: SavedReport[];
  hasMore: boolean;
  total: number;
}

export default function SavedReportsTab() {
  const router = useRouter();
  const [reports, setReports] = useState<SavedReport[]>([]);
  const [loading, setLoading] = useState(false);
  const [hasMore, setHasMore] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const loaderRef = useRef<HTMLDivElement>(null);

  /**
   * How many rows are already shown, readable without re-creating the loader.
   *
   * The next page starts where the list ends, so paging off `reports.length`
   * directly would make `loadReports` change on every load and re-run the
   * observer effect with it.
   */
  const loadedCount = useRef(0);

  const loadReports = useCallback(async (offset: number, reset = false) => {
    setLoading(true);
    setError(null);
    try {
      const page = await api.get<ReportPage>('/reports', {
        query: { limit: PAGE_SIZE, offset },
      });

      setReports((previous) => {
        const next = reset
          ? page.reports
          : // The observer can fire twice for one intersection, so a page can
            // arrive that overlaps what is already shown.
            [
              ...previous,
              ...page.reports.filter(
                (report) =>
                  !previous.some((existing) => existing.analysis.id === report.analysis.id)
              ),
            ];
        loadedCount.current = next.length;
        return next;
      });
      setHasMore(page.hasMore);
    } catch (caught) {
      // Stop the infinite scroll from retrying into a wall.
      setHasMore(false);
      const message = messageFor(caught, 'Failed to load reports');
      setError(message);
      toast.error(message);
    } finally {
      setLoading(false);
    }
  }, []);

  // Load the first page on mount. No token check: `ProtectedRoute` does not
  // render this component until a session exists, so it is the one place that
  // decides readiness.
  useEffect(() => {
    void loadReports(0, true);
  }, [loadReports]);

  // Infinite scroll.
  useEffect(() => {
    // Captured now: by the time the cleanup runs, `loaderRef.current` may
    // already point somewhere else (or nowhere), so unobserving it would leave
    // the original node observed.
    const sentinel = loaderRef.current;
    if (!sentinel) return;

    const observer = new IntersectionObserver(
      (entries) => {
        if (entries[0]?.isIntersecting && hasMore && !loading) {
          void loadReports(loadedCount.current);
        }
      },
      { threshold: 0.5 }
    );

    observer.observe(sentinel);
    return () => observer.unobserve(sentinel);
  }, [hasMore, loading, loadReports]);

  const viewReport = (reportId: string) => {
    router.push(`/saved-reports/${reportId}`);
  };

  const formatDate = (dateStr: string) => {
    const date = new Date(dateStr);
    return date.toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' });
  };

  return (
    <div className="space-y-6">
      {/* Reports List */}
      <div className="space-y-4">
        {reports.map((report, index) => (
          <div
            key={`${report.analysis.id}-${index}`}
            className="bg-background-secondary rounded-lg border border-border p-6 hover:border-border-hover transition-all cursor-pointer"
            onClick={() => viewReport(report.analysis.id)}
          >
            <div className="flex items-start justify-between">
              <div className="flex-1">
                <h3 className="text-lg font-semibold text-foreground">
                  {formatDate(report.analysis.date)}
                  {report.analysis.endDate && ` - ${formatDate(report.analysis.endDate)}`}
                </h3>
                <p className="text-foreground-secondary text-sm mt-1">{report.analysis.projectPath}</p>
                <div className="flex gap-4 mt-3 text-sm text-foreground-tertiary">
                  <span>💾 {report.analysis.totalCommits} commits</span>
                  <span>📝 {report.analysis.totalWorkItems} work items</span>
                  <span>✅ {report.analysis.tasksCreated} tasks created</span>
                </div>
              </div>
              <div className="text-sm text-foreground-tertiary">
                {formatDate(report.analysis.timestamp)}
              </div>
            </div>
          </div>
        ))}

        {/* Loading indicator */}
        {loading && (
          <div className="text-center py-4">
            <div className="inline-block animate-spin rounded-full h-8 w-8 border-b-2 border-primary"></div>
          </div>
        )}

        {/* Load more trigger */}
        <div ref={loaderRef} className="h-10" />

        {/* No more data */}
        {!hasMore && reports.length > 0 && (
          <div className="text-center text-foreground-secondary py-4">
            No more reports
          </div>
        )}

        {/* Error state */}
        {error && reports.length === 0 && (
          <div className="text-center py-12">
            <div className="text-4xl mb-2">⚠️</div>
            <div className="text-foreground mb-2">Failed to load reports</div>
            <div className="text-sm text-foreground-secondary mb-4">{error}</div>
            <button
              onClick={() => {
                setHasMore(true);
                setError(null);
                loadReports(0, true);
              }}
              className="bg-primary text-white px-4 py-2 rounded-lg hover:bg-primary-hover transition-colors"
            >
              Retry
            </button>
          </div>
        )}

        {/* Empty state */}
        {!loading && !error && reports.length === 0 && (
          <div className="text-center text-foreground-secondary py-12">
            <div className="text-4xl mb-2">📊</div>
            <div className="text-foreground">No saved reports yet</div>
            <div className="text-sm mt-1 text-foreground-tertiary">Generate a report to see it here</div>
          </div>
        )}
      </div>
    </div>
  );
}
