'use client';

import { useState, useEffect, useRef } from 'react';
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

interface EditableWorkItem extends WorkItem {
  selected: boolean;
  isEditing: boolean;
}

export default function SavedReportsTab() {
  const [reports, setReports] = useState<SavedReport[]>([]);
  const [loading, setLoading] = useState(false);
  const [hasMore, setHasMore] = useState(true);
  const [offset, setOffset] = useState(0);
  const [total, setTotal] = useState(0);
  const [selectedReport, setSelectedReport] = useState<SavedReport | null>(null);
  const [editableWorkItems, setEditableWorkItems] = useState<EditableWorkItem[]>([]);
  const [enhancingItems, setEnhancingItems] = useState<Set<string>>(new Set());
  const loaderRef = useRef<HTMLDivElement>(null);

  // Load initial reports
  useEffect(() => {
    loadReports(0, true);
  }, []);

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
  }, [hasMore, loading, offset]);

  const loadReports = async (newOffset: number, reset: boolean = false) => {
    setLoading(true);
    try {
      const response = await fetch(`${BACKEND_URL}/api/reports?limit=${PAGE_SIZE}&offset=${newOffset}`);
      const result = await response.json();

      if (result.success) {
        setReports(prev => reset ? result.data.reports : [...prev, ...result.data.reports]);
        setHasMore(result.data.hasMore);
        setTotal(result.data.total);
        setOffset(newOffset);
      } else {
        toast.error(`Failed to load reports: ${result.error}`);
      }
    } catch (err) {
      toast.error('Failed to load reports');
      console.error(err);
    } finally {
      setLoading(false);
    }
  };

  const loadMore = () => {
    const newOffset = offset + PAGE_SIZE;
    loadReports(newOffset);
  };

  const viewReport = (report: SavedReport) => {
    setSelectedReport(report);
    const items: EditableWorkItem[] = report.workItems.map((item, index) => ({
      ...item,
      selected: true,
      isEditing: false,
    }));
    setEditableWorkItems(items);
  };

  const closeReport = () => {
    setSelectedReport(null);
    setEditableWorkItems([]);
  };

  const toggleEditMode = (id: string) => {
    setEditableWorkItems(items =>
      items.map(item =>
        item.id === id ? { ...item, isEditing: !item.isEditing } : item
      )
    );
  };

  const updateWorkItem = (id: string, field: 'name' | 'type' | 'description', value: string) => {
    setEditableWorkItems(items =>
      items.map(item =>
        item.id === id ? { ...item, [field]: value } : item
      )
    );
  };

  const handleEnhanceWithAI = async (id: string) => {
    const item = editableWorkItems.find(i => i.id === id);
    if (!item) return;

    setEnhancingItems(prev => new Set([...prev, id]));
    const toastId = toast.loading('✨ Enhancing with AI...');

    try {
      const response = await fetch(`${BACKEND_URL}/api/ai-enhance`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          workItemName: item.name,
          description: item.description,
          commits: [],
          filesChanged: [],
        }),
      });

      const result = await response.json();

      if (result.success) {
        const enhanced = result.data;

        setEditableWorkItems(items =>
          items.map(i =>
            i.id === id
              ? {
                  ...i,
                  name: enhanced.improvedTitle || i.name,
                  description: enhanced.description,
                  isEditing: true,
                }
              : i
          )
        );

        toast.success('✨ Enhanced with AI! (Title and description updated)', { id: toastId, duration: 3000 });
      } else {
        toast.error(`❌ ${result.error || 'Failed to enhance with AI'}`, { id: toastId, duration: 5000 });
      }
    } catch (err) {
      toast.error(`❌ ${err instanceof Error ? err.message : 'An error occurred'}`, { id: toastId, duration: 5000 });
    } finally {
      setEnhancingItems(prev => {
        const newSet = new Set(prev);
        newSet.delete(id);
        return newSet;
      });
    }
  };

  const generateReportText = () => {
    const lines = ['Sri Gurusharanatmanda EOD:'];
    editableWorkItems.forEach(work => {
      const emoji = work.type === 'feature' ? '✨' : work.type === 'bug-fix' ? '🐛' : '🔧';
      lines.push(`- ${emoji} ${work.name}`);
      if (work.description && work.description.trim()) {
        const descLines = work.description.split('\n').filter(line => line.trim());
        descLines.forEach(line => {
          lines.push(`  ${line.trim()}`);
        });
      }
    });
    return lines.join('\n');
  };

  const handleCopyReport = async () => {
    const reportText = generateReportText();
    try {
      await navigator.clipboard.writeText(reportText);
      toast.success('📋 Report copied to clipboard!', { duration: 2000 });
    } catch (err) {
      toast.error('Failed to copy report');
    }
  };

  const formatDate = (dateStr: string) => {
    const date = new Date(dateStr);
    return date.toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' });
  };

  if (selectedReport) {
    return (
      <div className="space-y-6">
        {/* Header */}
        <div className="flex items-center justify-between">
          <button
            onClick={closeReport}
            className="text-blue-600 hover:text-blue-800 font-medium flex items-center gap-2"
          >
            ← Back to Reports
          </button>
          <button
            onClick={handleCopyReport}
            className="bg-blue-600 text-white px-4 py-2 rounded-lg hover:bg-blue-700"
          >
            📋 Copy Report
          </button>
        </div>

        {/* Report Info */}
        <div className="bg-white rounded-lg border border-gray-200 p-6">
          <h2 className="text-2xl font-bold mb-4">Report: {formatDate(selectedReport.analysis.date)}</h2>
          <div className="grid grid-cols-2 md:grid-cols-4 gap-4 text-sm">
            <div>
              <div className="text-gray-500">Date</div>
              <div className="font-semibold">{selectedReport.analysis.date}</div>
            </div>
            <div>
              <div className="text-gray-500">Commits</div>
              <div className="font-semibold">{selectedReport.analysis.totalCommits}</div>
            </div>
            <div>
              <div className="text-gray-500">Work Items</div>
              <div className="font-semibold">{selectedReport.analysis.totalWorkItems}</div>
            </div>
            <div>
              <div className="text-gray-500">Tasks Created</div>
              <div className="font-semibold">{selectedReport.analysis.tasksCreated}</div>
            </div>
          </div>
        </div>

        {/* Work Items */}
        <div className="space-y-3">
          <h3 className="text-lg font-semibold">Work Items</h3>
          {editableWorkItems.map(item => (
            <div key={item.id} className="bg-white rounded-lg border border-gray-200 p-4">
              <div className="flex items-start justify-between gap-4">
                <div className="flex-1">
                  {item.isEditing ? (
                    <div className="space-y-3">
                      <input
                        type="text"
                        value={item.name}
                        onChange={(e) => updateWorkItem(item.id, 'name', e.target.value)}
                        className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 font-medium"
                      />
                      <select
                        value={item.type}
                        onChange={(e) => updateWorkItem(item.id, 'type', e.target.value)}
                        className="px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500"
                      >
                        <option value="feature">✨ Feature</option>
                        <option value="bug-fix">🐛 Bug Fix</option>
                        <option value="improvement">🔧 Improvement</option>
                      </select>
                      <textarea
                        value={item.description}
                        onChange={(e) => updateWorkItem(item.id, 'description', e.target.value)}
                        rows={4}
                        className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 text-sm"
                        placeholder="Description..."
                      />
                    </div>
                  ) : (
                    <div>
                      <div className="font-semibold text-lg mb-1">
                        {item.type === 'feature' ? '✨' : item.type === 'bug-fix' ? '🐛' : '🔧'} {item.name}
                      </div>
                      {item.description && (
                        <div className="text-gray-600 text-sm whitespace-pre-wrap mt-2">{item.description}</div>
                      )}
                      <div className="flex gap-4 mt-3 text-xs text-gray-500">
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
                    className="text-blue-600 hover:text-blue-800 text-sm"
                  >
                    {item.isEditing ? '✅ Save' : '✏️ Edit'}
                  </button>
                  <button
                    onClick={() => handleEnhanceWithAI(item.id)}
                    disabled={enhancingItems.has(item.id)}
                    className="text-purple-600 hover:text-purple-800 text-sm disabled:text-gray-400"
                  >
                    {enhancingItems.has(item.id) ? '⏳' : '✨ AI'}
                  </button>
                </div>
              </div>
            </div>
          ))}
        </div>

        {/* Preview */}
        <div className="bg-gray-50 border border-gray-200 rounded-lg p-4">
          <h3 className="font-semibold mb-2">Preview</h3>
          <pre className="whitespace-pre-wrap font-mono text-sm text-gray-800">{generateReportText()}</pre>
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-2xl font-bold">Saved Reports</h2>
          <p className="text-gray-600 mt-1">{total} reports saved in database</p>
        </div>
      </div>

      {/* Reports List */}
      <div className="space-y-4">
        {reports.map(report => (
          <div
            key={report.analysis.id}
            className="bg-white rounded-lg border border-gray-200 p-6 hover:shadow-lg transition-shadow cursor-pointer"
            onClick={() => viewReport(report)}
          >
            <div className="flex items-start justify-between">
              <div className="flex-1">
                <h3 className="text-lg font-semibold">
                  {formatDate(report.analysis.date)}
                  {report.analysis.endDate && ` - ${formatDate(report.analysis.endDate)}`}
                </h3>
                <p className="text-gray-600 text-sm mt-1">{report.analysis.projectPath}</p>
                <div className="flex gap-4 mt-3 text-sm text-gray-500">
                  <span>💾 {report.analysis.totalCommits} commits</span>
                  <span>📝 {report.analysis.totalWorkItems} work items</span>
                  <span>✅ {report.analysis.tasksCreated} tasks created</span>
                </div>
              </div>
              <div className="text-sm text-gray-400">
                {formatDate(report.analysis.timestamp)}
              </div>
            </div>
          </div>
        ))}

        {/* Loading indicator */}
        {loading && (
          <div className="text-center py-4">
            <div className="inline-block animate-spin rounded-full h-8 w-8 border-b-2 border-blue-600"></div>
          </div>
        )}

        {/* Load more trigger */}
        <div ref={loaderRef} className="h-10" />

        {/* No more data */}
        {!hasMore && reports.length > 0 && (
          <div className="text-center text-gray-500 py-4">
            No more reports
          </div>
        )}

        {/* Empty state */}
        {!loading && reports.length === 0 && (
          <div className="text-center text-gray-500 py-12">
            <div className="text-4xl mb-2">📊</div>
            <div>No saved reports yet</div>
            <div className="text-sm mt-1">Generate a report to see it here</div>
          </div>
        )}
      </div>
    </div>
  );
}
