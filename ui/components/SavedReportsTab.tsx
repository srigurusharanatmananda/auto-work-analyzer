'use client';

import { useState, useEffect, useRef } from 'react';
import { useRouter } from 'next/navigation';
import { useAuth } from '@/lib/context/AuthContext';
import toast from 'react-hot-toast';

const BACKEND_URL = 'http://localhost:3009';
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

export default function SavedReportsTab() {
  const router = useRouter();
  const { accessToken } = useAuth();
  const [reports, setReports] = useState<SavedReport[]>([]);
  const [loading, setLoading] = useState(false);
  const [hasMore, setHasMore] = useState(true);
  const [offset, setOffset] = useState(0);
  const [total, setTotal] = useState(0);
  const [error, setError] = useState<string | null>(null);
  const loaderRef = useRef<HTMLDivElement>(null);
  const reportsLengthRef = useRef(0);

  // Keep ref in sync with reports length
  useEffect(() => {
    reportsLengthRef.current = reports.length;
  }, [reports.length]);

  // Load initial reports
  useEffect(() => {
    if (accessToken) {
      loadReports(0, true);
    }
  }, [accessToken]);

  // Infinite scroll observer
  useEffect(() => {
    const observer = new IntersectionObserver(
      (entries) => {
        if (entries[0].isIntersecting && hasMore && !loading) {
          loadMore();
        }
      },
      { threshold: 0.5 }
    );

    if (loaderRef.current) {
      observer.observe(loaderRef.current);
    }

    return () => {
      if (loaderRef.current) {
        observer.unobserve(loaderRef.current);
      }
    };
  }, [hasMore, loading]);

  const loadReports = async (newOffset: number, reset: boolean = false) => {
    if (!accessToken) {
      setError('Not authenticated');
      return;
    }

    setLoading(true);
    setError(null);
    try {
      const response = await fetch(`${BACKEND_URL}/api/reports?limit=${PAGE_SIZE}&offset=${newOffset}`, {
        headers: {
          'Authorization': `Bearer ${accessToken}`,
        },
        credentials: 'include',
      });
      const result = await response.json();

      if (result.success) {
        setReports(prev => {
          if (reset) {
            return result.data.reports;
          }
          // Deduplicate reports by ID
          const existingIds = new Set(prev.map(r => r.analysis.id));
          const newReports = result.data.reports.filter((r: SavedReport) => !existingIds.has(r.analysis.id));
          return [...prev, ...newReports];
        });
        setHasMore(result.data.hasMore);
        setTotal(result.data.total);
        setOffset(newOffset);
      } else {
        setHasMore(false);
        setError(result.error || 'Failed to load reports');
        toast.error(`Failed to load reports: ${result.error}`);
      }
    } catch (err) {
      // On connection error, stop trying to load more and show error
      setHasMore(false);
      const errorMsg = err instanceof Error ? err.message : 'Failed to connect to backend server';
      setError(errorMsg);
      toast.error('Failed to load reports - backend server may not be running');
      console.error(err);
    } finally {
      setLoading(false);
    }
  };

  const loadMore = () => {
    const newOffset = reportsLengthRef.current;
    loadReports(newOffset);
  };

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
