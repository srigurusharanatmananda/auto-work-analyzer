'use client';

import { useState, useEffect } from 'react';
import toast from 'react-hot-toast';

interface AnalysisHistory {
  id: string;
  timestamp: string;
  projectPath: string;
  date: string;
  endDate?: string;
  author?: string;
  totalCommits: number;
  totalWorkItems: number;
  tasksCreated: number;
  summary: string;
}

interface ProjectStats {
  path: string;
  commitsProcessed: number;
}

interface Statistics {
  totalAnalyses: number;
  totalCommitsProcessed: number;
  totalTasksCreated: number;
  projectStats: ProjectStats[];
  oldestEntry?: string;
  newestEntry?: string;
}

interface HistoryData {
  history: AnalysisHistory[];
  statistics: Statistics;
}

export default function HistoryTab() {
  const [loading, setLoading] = useState(true);
  const [data, setData] = useState<HistoryData | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [filterProject, setFilterProject] = useState<string>('all');

  const fetchHistory = async () => {
    setLoading(true);
    setError(null);

    try {
      const response = await fetch('/api/history');
      const result = await response.json();

      if (result.success) {
        setData(result.data);
      } else {
        setError(result.error || 'Failed to load history');
        toast.error(result.error || 'Failed to load history');
      }
    } catch (err) {
      const errorMsg = err instanceof Error ? err.message : 'Failed to load history';
      setError(errorMsg);
      toast.error(errorMsg);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchHistory();
  }, []);

  const formatDate = (isoString: string) => {
    const date = new Date(isoString);
    return date.toLocaleString('en-US', {
      month: 'short',
      day: 'numeric',
      year: 'numeric',
      hour: '2-digit',
      minute: '2-digit',
    });
  };

  const formatPath = (path: string) => {
    const parts = path.split('/');
    return parts[parts.length - 1] || path;
  };

  const filteredHistory = data?.history.filter((entry) => {
    if (filterProject === 'all') return true;
    return entry.projectPath === filterProject;
  }) || [];

  const uniqueProjects = Array.from(
    new Set(data?.history.map((entry) => entry.projectPath) || [])
  );

  return (
    <div className="bg-white rounded-2xl shadow-2xl p-8">
      <div className="flex items-center justify-between mb-6">
        <div>
          <h2 className="text-3xl font-bold text-gray-800 mb-2 flex items-center gap-3">
            <span>📊</span>
            <span>Analysis History</span>
          </h2>
          <p className="text-gray-600">
            Track your recent analyses and task creations
          </p>
        </div>
        <button
          onClick={fetchHistory}
          disabled={loading}
          className="px-4 py-2 bg-purple-100 hover:bg-purple-200 text-purple-700 rounded-xl font-semibold transition-colors disabled:opacity-50"
        >
          🔄 Refresh
        </button>
      </div>

      {loading && (
        <div className="flex items-center justify-center py-12">
          <svg className="animate-spin h-10 w-10 text-purple-500" viewBox="0 0 24 24">
            <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" fill="none" />
            <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z" />
          </svg>
        </div>
      )}

      {error && (
        <div className="bg-red-50 border-l-4 border-red-500 p-4 rounded-r-xl">
          <div className="flex items-center gap-2">
            <span className="text-2xl">❌</span>
            <p className="text-red-700 font-medium">{error}</p>
          </div>
        </div>
      )}

      {!loading && !error && data && (
        <>
          {/* Statistics Cards */}
          <div className="grid grid-cols-1 md:grid-cols-3 gap-6 mb-8">
            <div className="bg-gradient-to-br from-purple-50 to-purple-100 p-6 rounded-xl border-2 border-purple-200">
              <div className="flex items-center gap-3 mb-2">
                <span className="text-3xl">📈</span>
                <h3 className="text-lg font-semibold text-purple-800">Total Analyses</h3>
              </div>
              <p className="text-4xl font-bold text-purple-900">
                {data.statistics.totalAnalyses}
              </p>
            </div>

            <div className="bg-gradient-to-br from-blue-50 to-blue-100 p-6 rounded-xl border-2 border-blue-200">
              <div className="flex items-center gap-3 mb-2">
                <span className="text-3xl">💻</span>
                <h3 className="text-lg font-semibold text-blue-800">Commits Processed</h3>
              </div>
              <p className="text-4xl font-bold text-blue-900">
                {data.statistics.totalCommitsProcessed}
              </p>
            </div>

            <div className="bg-gradient-to-br from-green-50 to-green-100 p-6 rounded-xl border-2 border-green-200">
              <div className="flex items-center gap-3 mb-2">
                <span className="text-3xl">✅</span>
                <h3 className="text-lg font-semibold text-green-800">Tasks Created</h3>
              </div>
              <p className="text-4xl font-bold text-green-900">
                {data.statistics.totalTasksCreated}
              </p>
            </div>
          </div>

          {/* Filter */}
          {uniqueProjects.length > 1 && (
            <div className="mb-6">
              <label htmlFor="filterProject" className="block text-sm font-semibold text-gray-700 mb-2">
                Filter by Project
              </label>
              <select
                id="filterProject"
                value={filterProject}
                onChange={(e) => setFilterProject(e.target.value)}
                className="w-full md:w-auto px-4 py-2 border-2 border-gray-300 rounded-xl focus:outline-none focus:border-purple-500 transition-colors"
              >
                <option value="all">All Projects ({data.history.length})</option>
                {uniqueProjects.map((project) => {
                  const count = data.history.filter((h) => h.projectPath === project).length;
                  return (
                    <option key={project} value={project}>
                      {formatPath(project)} ({count})
                    </option>
                  );
                })}
              </select>
            </div>
          )}

          {/* History List */}
          {filteredHistory.length === 0 ? (
            <div className="text-center py-12 bg-gray-50 rounded-xl">
              <span className="text-6xl mb-4 block">📭</span>
              <p className="text-xl text-gray-600 font-medium">No analysis history yet</p>
              <p className="text-gray-500 mt-2">Run your first analysis to see results here!</p>
            </div>
          ) : (
            <div className="space-y-4">
              <h3 className="text-xl font-bold text-gray-800 mb-4">
                Recent Analyses ({filteredHistory.length})
              </h3>
              {filteredHistory.map((entry) => (
                <div
                  key={entry.id}
                  className="border-2 border-gray-200 rounded-xl p-5 hover:border-purple-300 hover:shadow-lg transition-all"
                >
                  <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
                    <div className="flex-1">
                      <div className="flex items-center gap-2 mb-2">
                        <span className="text-xl">📁</span>
                        <h4 className="font-bold text-gray-800 text-lg">
                          {formatPath(entry.projectPath)}
                        </h4>
                      </div>
                      <p className="text-sm text-gray-600 mb-3">
                        🕐 {formatDate(entry.timestamp)}
                      </p>
                      <div className="flex flex-wrap gap-4 text-sm">
                        <span className="px-3 py-1 bg-blue-100 text-blue-700 rounded-full font-semibold">
                          📅 {entry.date}
                        </span>
                        <span className="px-3 py-1 bg-purple-100 text-purple-700 rounded-full font-semibold">
                          💻 {entry.totalCommits} commits
                        </span>
                        <span className="px-3 py-1 bg-orange-100 text-orange-700 rounded-full font-semibold">
                          📋 {entry.totalWorkItems} work items
                        </span>
                        <span className="px-3 py-1 bg-green-100 text-green-700 rounded-full font-semibold">
                          ✅ {entry.tasksCreated} tasks
                        </span>
                      </div>
                      {entry.author && (
                        <p className="text-sm text-gray-600 mt-2">
                          👤 Author: {entry.author}
                        </p>
                      )}
                    </div>
                  </div>
                  {entry.summary && (
                    <div className="mt-4 pt-4 border-t border-gray-200">
                      <p className="text-sm text-gray-700 leading-relaxed">
                        {entry.summary}
                      </p>
                    </div>
                  )}
                </div>
              ))}
            </div>
          )}

          {/* Project Statistics */}
          {data.statistics.projectStats.length > 0 && (
            <div className="mt-8 pt-8 border-t-2 border-gray-200">
              <h3 className="text-xl font-bold text-gray-800 mb-4">
                📁 Project Statistics
              </h3>
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                {data.statistics.projectStats.map((project) => (
                  <div
                    key={project.path}
                    className="bg-gray-50 border border-gray-200 rounded-xl p-4"
                  >
                    <div className="flex items-center justify-between">
                      <div className="flex-1 min-w-0">
                        <p className="font-semibold text-gray-800 truncate">
                          {formatPath(project.path)}
                        </p>
                        <p className="text-xs text-gray-500 truncate">
                          {project.path}
                        </p>
                      </div>
                      <div className="ml-4 shrink-0">
                        <span className="px-3 py-1 bg-purple-100 text-purple-700 rounded-full text-sm font-bold">
                          {project.commitsProcessed}
                        </span>
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          )}
        </>
      )}
    </div>
  );
}
