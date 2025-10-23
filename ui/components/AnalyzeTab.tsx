'use client';

import { useState, useEffect, FormEvent } from 'react';
import toast from 'react-hot-toast';
import { AnalysisResponse } from '@/types';
import ResultsDisplay from './ResultsDisplay';
import DirectoryBrowser from './DirectoryBrowser';

interface AnalyzeTabProps {
  selectedProjectPath: string;
  setSelectedProjectPath: (path: string) => void;
}

// Backend API URL (webhook server runs on port 3009)
const BACKEND_URL = 'http://localhost:3009';

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
      const response = await fetch(`${BACKEND_URL}/api/git-info?path=${encodeURIComponent(path)}`);
      const result = await response.json();

      if (result.success) {
        setBranches(result.data.branches || []);
        setCurrentBranch(result.data.currentBranch || '');
        setUserEmail(result.data.userEmail || '');
      } else {
        // Not a git repo or error - clear state
        setBranches([]);
        setCurrentBranch('');
        setUserEmail('');
      }
    } catch (err) {
      console.error('Failed to fetch git info:', err);
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
      const response = await fetch(`${BACKEND_URL}/api/analyze`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(data),
      });

      const result = await response.json();

      if (result.success) {
        setResults(result.data);

        // Success toast with details
        toast.success(
          `✅ Found ${result.data.summary.totalWorkItems} work items from ${result.data.summary.totalCommits} commits!`,
          { id: toastId, duration: 4000 }
        );

        // Additional toast for created tasks
        if (data.createTasks && result.data.summary.tasksCreated > 0) {
          setTimeout(() => {
            toast.success(
              `🎉 Created ${result.data.summary.tasksCreated} tasks in ClickUp!`,
              { duration: 4000 }
            );
          }, 500);
        }
      } else {
        const errorMessage = result.error || 'Analysis failed';
        setError(errorMessage);
        toast.error(`❌ ${errorMessage}`, { id: toastId, duration: 5000 });
      }
    } catch (err) {
      const errorMessage = err instanceof Error ? err.message : 'An error occurred';
      setError(errorMessage);
      toast.error(`❌ ${errorMessage}`, { id: toastId, duration: 5000 });
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="bg-white rounded-2xl shadow-2xl p-8">
      <h2 className="text-3xl font-bold text-gray-800 mb-2 flex items-center gap-3">
        <span>📊</span>
        <span>Analyze Git Commits</span>
      </h2>
      <p className="text-gray-600 mb-8">
        Analyze your git commits and automatically create tasks in ClickUp
      </p>

      <form onSubmit={handleSubmit} className="space-y-6">
        <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
          <div>
            <label htmlFor="startDate" className="block text-sm font-semibold text-gray-700 mb-2">
              Start Date
            </label>
            <input
              type="date"
              id="startDate"
              name="startDate"
              required
              defaultValue={today}
              className="w-full px-4 py-3 border-2 border-gray-300 rounded-xl focus:outline-none focus:border-purple-500 transition-colors"
            />
          </div>

          <div>
            <label htmlFor="endDate" className="block text-sm font-semibold text-gray-700 mb-2">
              End Date (Optional)
            </label>
            <input
              type="date"
              id="endDate"
              name="endDate"
              className="w-full px-4 py-3 border-2 border-gray-300 rounded-xl focus:outline-none focus:border-purple-500 transition-colors"
            />
          </div>
        </div>

        <div>
          <label htmlFor="projectPath" className="block text-sm font-semibold text-gray-700 mb-2">
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
              className="flex-1 px-4 py-3 border-2 border-gray-300 rounded-xl focus:outline-none focus:border-purple-500 transition-colors font-mono text-sm"
            />
            <button
              type="button"
              onClick={handleBrowseClick}
              className="px-6 py-3 bg-gray-100 hover:bg-gray-200 border-2 border-gray-300 rounded-xl font-semibold text-gray-700 transition-colors flex items-center gap-2 whitespace-nowrap"
            >
              <span>📁</span>
              <span>Browse</span>
            </button>
          </div>
          <p className="text-xs text-gray-500 mt-1">
            💡 Click &quot;Browse&quot; to select a folder, or type the absolute path to any git repository
          </p>
        </div>

        <div>
          <label htmlFor="branch" className="block text-sm font-semibold text-gray-700 mb-2">
            Branch {loadingGitInfo && <span className="text-xs text-gray-500">(Loading...)</span>}
          </label>
          <select
            id="branch"
            name="branch"
            defaultValue={currentBranch}
            className="w-full px-4 py-3 border-2 border-gray-300 rounded-xl focus:outline-none focus:border-purple-500 transition-colors"
            disabled={!selectedProjectPath || loadingGitInfo}
          >
            <option value="">All Branches</option>
            {branches.length > 0 && branches.map((branch) => (
              <option key={branch} value={branch}>
                {branch} {branch === currentBranch ? '(current)' : ''}
              </option>
            ))}
          </select>
          <p className="text-xs text-gray-500 mt-1">
            💡 Select a specific branch to analyze, or leave as "All Branches" to analyze all commits
          </p>
        </div>

        <div>
          <label htmlFor="author" className="block text-sm font-semibold text-gray-700 mb-2">
            Author Email (Optional) {userEmail && <span className="text-xs text-green-600">✓ Auto-filled</span>}
          </label>
          <input
            type="email"
            id="author"
            name="author"
            value={userEmail}
            onChange={(e) => setUserEmail(e.target.value)}
            placeholder="developer@example.com"
            className="w-full px-4 py-3 border-2 border-gray-300 rounded-xl focus:outline-none focus:border-purple-500 transition-colors"
          />
          <p className="text-xs text-gray-500 mt-1">
            💡 Leave empty to analyze commits from all authors
          </p>
        </div>

        <div className="flex items-center gap-3">
          <input
            type="checkbox"
            id="createTasks"
            name="createTasks"
            defaultChecked
            className="w-5 h-5 text-purple-600 rounded focus:ring-purple-500"
          />
          <label htmlFor="createTasks" className="text-sm font-medium text-gray-700">
            Automatically create tasks in ClickUp
          </label>
        </div>

        <button
          type="submit"
          disabled={loading}
          className="w-full bg-gradient-to-r from-purple-500 to-pink-500 text-white py-4 px-6 rounded-xl font-semibold text-lg hover:from-purple-600 hover:to-pink-600 disabled:opacity-50 disabled:cursor-not-allowed transition-all duration-300 flex items-center justify-center gap-2 shadow-lg hover:shadow-xl"
        >
          {loading ? (
            <>
              <svg className="animate-spin h-5 w-5" viewBox="0 0 24 24">
                <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" fill="none" />
                <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z" />
              </svg>
              <span>Analyzing...</span>
            </>
          ) : (
            <>
              <span>🔍</span>
              <span>Analyze Commits</span>
            </>
          )}
        </button>
      </form>

      {error && (
        <div className="mt-6 bg-red-50 border-l-4 border-red-500 p-4 rounded-r-xl">
          <div className="flex items-center gap-2">
            <span className="text-2xl">❌</span>
            <p className="text-red-700 font-medium">{error}</p>
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
