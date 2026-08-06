'use client';

import { useState, useEffect, FormEvent } from 'react';
import toast from 'react-hot-toast';
import { api, messageFor } from '@/lib/api';
import { AnalysisResponse, GitInfo } from '@/types';
import ResultsDisplay from './ResultsDisplay';
import DirectoryBrowser from './DirectoryBrowser';
import { Button, LoadingSpinner } from '@/lib/components/ui';

interface AnalyzeTabProps {
  selectedProjectPath: string;
  setSelectedProjectPath: (path: string) => void;
}

export default function AnalyzeTab({ selectedProjectPath, setSelectedProjectPath }: AnalyzeTabProps) {
  const [loading, setLoading] = useState(false);
  const [results, setResults] = useState<AnalysisResponse | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [showBrowser, setShowBrowser] = useState(false);
  const [branches, setBranches] = useState<string[]>([]);
  const [currentBranch, setCurrentBranch] = useState<string>('');
  const [userEmail, setUserEmail] = useState<string>('');
  const [loadingGitInfo, setLoadingGitInfo] = useState(false);

  // Set default date to today
  const today = new Date().toISOString().split('T')[0];

  // Fetch git info when project path changes
  const fetchGitInfo = async (path: string) => {
    if (!path) {
      setBranches([]);
      setCurrentBranch('');
      setUserEmail('');
      return;
    }

    setLoadingGitInfo(true);
    try {
      const info = await api.get<GitInfo>('/git-info', { query: { path } });
      setBranches(info.branches ?? []);
      setCurrentBranch(info.currentBranch ?? '');
      setUserEmail(info.userEmail ?? '');
    } catch (caught) {
      // Expected whenever the chosen directory is not a git repository, so this
      // clears the fields rather than shouting at the user.
      console.error('Failed to fetch git info:', caught);
      setBranches([]);
      setCurrentBranch('');
      setUserEmail('');
    } finally {
      setLoadingGitInfo(false);
    }
  };

  // Fetch git info when selected project path changes
  useEffect(() => {
    if (selectedProjectPath) {
      fetchGitInfo(selectedProjectPath);
    }
  }, [selectedProjectPath]);

  const handleBrowseClick = () => {
    setShowBrowser(true);
  };

  const handleSelectDirectory = (path: string) => {
    setSelectedProjectPath(path);
    setShowBrowser(false);
  };

  const handleCancelBrowse = () => {
    setShowBrowser(false);
  };

  const handleSubmit = async (e: FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    setLoading(true);
    setError(null);
    setResults(null);

    const formData = new FormData(e.currentTarget);
    const data = {
      date: formData.get('startDate') as string,
      endDate: (formData.get('endDate') as string) || undefined,
      author: (formData.get('author') as string) || undefined,
      branch: (formData.get('branch') as string) || undefined,
      projectPath: (formData.get('projectPath') as string) || undefined,
      createTasks: formData.get('createTasks') === 'on',
    };

    // Show loading toast
    const toastId = toast.loading('🔍 Analyzing commits...');

    try {
      const analysis = await api.post<AnalysisResponse>('/analyze', data);
      setResults(analysis);

      toast.success(
        `✅ Found ${analysis.summary.totalWorkItems} work items from ${analysis.summary.totalCommits} commits!`,
        { id: toastId, duration: 4000 }
      );

      if (data.createTasks && analysis.summary.tasksCreated > 0) {
        setTimeout(() => {
          toast.success(`🎉 Created ${analysis.summary.tasksCreated} tasks in ClickUp!`, {
            duration: 4000,
          });
        }, 500);
      }
    } catch (caught) {
      const message = messageFor(caught, 'Analysis failed');
      setError(message);
      toast.error(`❌ ${message}`, { id: toastId, duration: 5000 });
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="bg-background-secondary rounded-2xl shadow-2xl p-8">
      <h2 className="text-3xl font-bold text-foreground mb-2 flex items-center gap-3">
        <span>📊</span>
        <span>Analyze Git Commits</span>
      </h2>
      <p className="text-foreground-secondary mb-8">
        Analyze your git commits and automatically create tasks in ClickUp
      </p>

      <form onSubmit={handleSubmit} className="space-y-6">
        <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
          <div>
            <label htmlFor="startDate" className="block text-sm font-semibold text-foreground mb-2">
              Start Date
            </label>
            <input
              type="date"
              id="startDate"
              name="startDate"
              required
              defaultValue={today}
              className="w-full px-4 py-3 border border-border bg-background-tertiary text-foreground rounded-xl focus:outline-none focus:ring-2 focus:ring-primary transition-colors placeholder:text-foreground-tertiary"
            />
          </div>

          <div>
            <label htmlFor="endDate" className="block text-sm font-semibold text-foreground mb-2">
              End Date (Optional)
            </label>
            <input
              type="date"
              id="endDate"
              name="endDate"
              className="w-full px-4 py-3 border border-border bg-background-tertiary text-foreground rounded-xl focus:outline-none focus:ring-2 focus:ring-primary transition-colors placeholder:text-foreground-tertiary"
            />
          </div>
        </div>

        <div>
          <label htmlFor="projectPath" className="block text-sm font-semibold text-foreground mb-2">
            Project Path (Optional)
          </label>
          <div className="flex gap-3">
            <input
              type="text"
              id="projectPath"
              name="projectPath"
              value={selectedProjectPath}
              onChange={(e) => setSelectedProjectPath(e.target.value)}
              placeholder="/path/to/your/project (leave empty for current project)"
              className="flex-1 px-4 py-3 border border-border bg-background-tertiary text-foreground rounded-xl focus:outline-none focus:ring-2 focus:ring-primary transition-colors font-mono text-sm placeholder:text-foreground-tertiary"
            />
            <Button
              type="button"
              onClick={handleBrowseClick}
              variant="secondary"
            >
              <span>📁</span>
              <span>Browse</span>
            </Button>
          </div>
          <p className="text-xs text-foreground-tertiary mt-1">
            💡 Click &quot;Browse&quot; to select a folder, or type the absolute path to any git repository
          </p>
        </div>

        <div>
          <label htmlFor="branch" className="block text-sm font-semibold text-foreground mb-2">
            Branch {loadingGitInfo && <span className="text-xs text-foreground-tertiary">(Loading...)</span>}
          </label>
          <select
            id="branch"
            name="branch"
            defaultValue={currentBranch}
            className="w-full px-4 py-3 border border-border bg-background-tertiary text-foreground rounded-xl focus:outline-none focus:ring-2 focus:ring-primary transition-colors"
            disabled={!selectedProjectPath || loadingGitInfo}
          >
            <option value="">All Branches</option>
            {branches.length > 0 && branches.map((branch) => (
              <option key={branch} value={branch}>
                {branch} {branch === currentBranch ? '(current)' : ''}
              </option>
            ))}
          </select>
          <p className="text-xs text-foreground-tertiary mt-1">
            💡 Select a specific branch to analyze, or leave as &quot;All Branches&quot; to analyze all commits
          </p>
        </div>

        <div>
          <label htmlFor="author" className="block text-sm font-semibold text-foreground mb-2">
            Author Email (Optional) {userEmail && <span className="text-xs text-primary">✓ Auto-filled</span>}
          </label>
          <input
            type="email"
            id="author"
            name="author"
            value={userEmail}
            onChange={(e) => setUserEmail(e.target.value)}
            placeholder="developer@example.com"
            className="w-full px-4 py-3 border border-border bg-background-tertiary text-foreground rounded-xl focus:outline-none focus:ring-2 focus:ring-primary transition-colors placeholder:text-foreground-tertiary"
          />
          <p className="text-xs text-foreground-tertiary mt-1">
            💡 Leave empty to analyze commits from all authors
          </p>
        </div>

        <div className="flex items-center gap-3">
          <input
            type="checkbox"
            id="createTasks"
            name="createTasks"
            defaultChecked
            className="w-5 h-5 accent-primary rounded focus:ring-primary"
          />
          <label htmlFor="createTasks" className="text-sm font-medium text-foreground">
            Automatically create tasks in ClickUp
          </label>
        </div>

        <Button
          type="submit"
          disabled={loading}
          variant="primary"
          className="w-full py-4 text-lg"
        >
          {loading ? (
            <>
              <LoadingSpinner size="sm" />
              <span>Analyzing...</span>
            </>
          ) : (
            <>
              <span>🔍</span>
              <span>Analyze Commits</span>
            </>
          )}
        </Button>
      </form>

      {error && (
        <div className="mt-6 bg-red-500/10 border-l-4 border-red-500 p-4 rounded-r-xl">
          <div className="flex items-center gap-2">
            <span className="text-2xl">❌</span>
            <p className="text-red-500 font-medium">{error}</p>
          </div>
        </div>
      )}

      {results && <ResultsDisplay type="analysis" data={results} />}

      {showBrowser && (
        <DirectoryBrowser
          onSelect={handleSelectDirectory}
          onCancel={handleCancelBrowse}
        />
      )}
    </div>
  );
}
