'use client';

import { useState } from 'react';
import { Card, Button, LoadingSpinner, EmptyState } from '@/lib/components/ui';
import { useApiQuery } from '@/lib/api/useApiQuery';
import type { HistoryData } from '@/types';

export default function HistoryTab() {
  const {
    data,
    error,
    isLoading: loading,
    reload: fetchHistory,
  } = useApiQuery<HistoryData>('/history', { errorMessage: 'Failed to load history' });

  const [filterProject, setFilterProject] = useState<string>('all');

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

  if (loading) {
    return (
      <div className="flex items-center justify-center py-12">
        <LoadingSpinner size="lg" />
      </div>
    );
  }

  if (error) {
    return (
      <Card className="p-6 border-error bg-error/10">
        <div className="flex items-center gap-3">
          <svg className="h-6 w-6 text-error" fill="none" strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" viewBox="0 0 24 24" stroke="currentColor">
            <path d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z" />
          </svg>
          <p className="text-error font-medium">{error}</p>
        </div>
      </Card>
    );
  }

  if (!data) return null;

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <p className="text-foreground-secondary">
            Track your recent analyses and task creations
          </p>
        </div>
        <Button
          onClick={fetchHistory}
          variant="secondary"
          disabled={loading}
        >
          🔄 Refresh
        </Button>
      </div>

      {/* Statistics Cards */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
        <Card className="p-6 bg-primary/10 border-primary/20">
          <div className="flex items-center gap-3 mb-2">
            <span className="text-3xl">📈</span>
            <h3 className="text-lg font-semibold text-foreground">Total Analyses</h3>
          </div>
          <p className="text-4xl font-bold text-primary">
            {data.statistics.totalAnalyses}
          </p>
        </Card>

        <Card className="p-6 bg-secondary/10 border-secondary/20">
          <div className="flex items-center gap-3 mb-2">
            <span className="text-3xl">💻</span>
            <h3 className="text-lg font-semibold text-foreground">Commits Processed</h3>
          </div>
          <p className="text-4xl font-bold text-secondary">
            {data.statistics.totalCommitsProcessed}
          </p>
        </Card>

        <Card className="p-6 bg-success/10 border-success/20">
          <div className="flex items-center gap-3 mb-2">
            <span className="text-3xl">✅</span>
            <h3 className="text-lg font-semibold text-foreground">Tasks Created</h3>
          </div>
          <p className="text-4xl font-bold text-success">
            {data.statistics.totalTasksCreated}
          </p>
        </Card>
      </div>

      {/* Filter */}
      {uniqueProjects.length > 1 && (
        <div>
          <label htmlFor="filterProject" className="block text-sm font-semibold text-foreground mb-2">
            Filter by Project
          </label>
          <select
            id="filterProject"
            value={filterProject}
            onChange={(e) => setFilterProject(e.target.value)}
            className="w-full md:w-auto px-4 py-2 border border-border bg-background-tertiary text-foreground rounded-lg focus:outline-none focus:ring-2 focus:ring-primary transition-colors"
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
        <EmptyState
          icon={<span className="text-6xl">📭</span>}
          title="No analysis history yet"
          description="Run your first analysis to see results here!"
        />
      ) : (
        <div className="space-y-4">
          <h3 className="text-xl font-bold text-foreground">
            Recent Analyses ({filteredHistory.length})
          </h3>
          {filteredHistory.map((entry) => (
            <Card
              key={entry.id}
              hover
              className="p-5"
            >
              <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
                <div className="flex-1">
                  <div className="flex items-center gap-2 mb-2">
                    <span className="text-xl">📁</span>
                    <h4 className="font-bold text-foreground text-lg">
                      {formatPath(entry.projectPath)}
                    </h4>
                  </div>
                  <p className="text-sm text-foreground-secondary mb-3">
                    🕐 {formatDate(entry.timestamp)}
                  </p>
                  <div className="flex flex-wrap gap-2 text-sm">
                    <span className="px-3 py-1 bg-primary/10 text-primary rounded-full font-semibold">
                      📅 {entry.date}
                    </span>
                    <span className="px-3 py-1 bg-secondary/10 text-secondary rounded-full font-semibold">
                      💻 {entry.totalCommits} commits
                    </span>
                    <span className="px-3 py-1 bg-warning/10 text-warning rounded-full font-semibold">
                      📋 {entry.totalWorkItems} work items
                    </span>
                    <span className="px-3 py-1 bg-success/10 text-success rounded-full font-semibold">
                      ✅ {entry.tasksCreated} tasks
                    </span>
                  </div>
                  {entry.author && (
                    <p className="text-sm text-foreground-secondary mt-2">
                      👤 Author: {entry.author}
                    </p>
                  )}
                </div>
              </div>
              {entry.summary && (
                <div className="mt-4 pt-4 border-t border-border">
                  <p className="text-sm text-foreground-secondary leading-relaxed">
                    {entry.summary}
                  </p>
                </div>
              )}
            </Card>
          ))}
        </div>
      )}

      {/* Project Statistics */}
      {data.statistics.projectStats.length > 0 && (
        <div className="pt-6 border-t border-border">
          <h3 className="text-xl font-bold text-foreground mb-4">
            📁 Project Statistics
          </h3>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            {data.statistics.projectStats.map((project) => (
              <Card
                key={project.path}
                className="p-4"
              >
                <div className="flex items-center justify-between">
                  <div className="flex-1 min-w-0">
                    <p className="font-semibold text-foreground truncate">
                      {formatPath(project.path)}
                    </p>
                    <p className="text-xs text-foreground-tertiary truncate">
                      {project.path}
                    </p>
                  </div>
                  <div className="ml-4 shrink-0">
                    <span className="px-3 py-1 bg-secondary/10 text-secondary rounded-full text-sm font-bold">
                      {project.commitsProcessed}
                    </span>
                  </div>
                </div>
              </Card>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}
