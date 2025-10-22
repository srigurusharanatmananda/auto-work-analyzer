'use client';

import { useState, useEffect } from 'react';
import toast from 'react-hot-toast';

interface Directory {
  name: string;
  path: string;
  isGitRepo: boolean;
}

interface BrowseData {
  currentPath: string;
  parentPath: string | null;
  directories: Directory[];
  gitRepos: number;
}

interface DirectoryBrowserProps {
  onSelect: (path: string) => void;
  onCancel: () => void;
}

export default function DirectoryBrowser({ onSelect, onCancel }: DirectoryBrowserProps) {
  const [loading, setLoading] = useState(false);
  const [data, setData] = useState<BrowseData | null>(null);
  const [error, setError] = useState<string | null>(null);

  const fetchDirectories = async (path?: string) => {
    setLoading(true);
    setError(null);

    try {
      const url = path ? `/api/browse?path=${encodeURIComponent(path)}` : '/api/browse';
      const response = await fetch(url);
      const result = await response.json();

      if (result.success) {
        setData(result.data);
      } else {
        setError(result.error || 'Failed to browse directory');
        toast.error(result.error || 'Failed to browse directory');
      }
    } catch (err) {
      const errorMsg = err instanceof Error ? err.message : 'Failed to browse directory';
      setError(errorMsg);
      toast.error(errorMsg);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchDirectories();
  }, []);

  const handleNavigate = (path: string) => {
    fetchDirectories(path);
  };

  const handleSelect = () => {
    if (data?.currentPath) {
      onSelect(data.currentPath);
      // Show only the last part of the path in toast to prevent overflow
      const pathParts = data.currentPath.split('/');
      const displayPath = pathParts[pathParts.length - 1] || data.currentPath;
      toast.success(`✅ Selected: ${displayPath}`, {
        duration: 3000,
        style: {
          maxWidth: '90vw',
          wordBreak: 'break-all',
        },
      });
    }
  };

  return (
    <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4">
      <div className="bg-white rounded-2xl shadow-2xl max-w-3xl w-full max-h-[80vh] flex flex-col">
        {/* Header */}
        <div className="p-6 border-b border-gray-200">
          <h3 className="text-2xl font-bold text-gray-800 mb-2">📁 Browse Directories</h3>
          <p className="text-sm text-gray-600">Navigate to your project folder and click &quot;Select This Folder&quot;</p>
        </div>

        {/* Current Path */}
        <div className="px-6 py-4 bg-gray-50 border-b border-gray-200">
          <div className="flex flex-col sm:flex-row sm:items-center gap-2">
            <span className="text-sm font-semibold text-gray-700 shrink-0">Current:</span>
            <code className="flex-1 px-3 py-2 bg-white border border-gray-300 rounded-lg text-sm font-mono text-gray-800 overflow-x-auto whitespace-nowrap scrollbar-thin scrollbar-thumb-gray-400 scrollbar-track-gray-200">
              {data?.currentPath || 'Loading...'}
            </code>
            {data && data.gitRepos > 0 && (
              <span className="px-3 py-1 bg-green-100 text-green-700 rounded-full text-xs font-semibold shrink-0">
                {data.gitRepos} Git {data.gitRepos === 1 ? 'Repo' : 'Repos'}
              </span>
            )}
          </div>
        </div>

        {/* Directory List */}
        <div className="flex-1 overflow-y-auto p-6">
          {loading && (
            <div className="flex items-center justify-center py-12">
              <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-purple-500"></div>
            </div>
          )}

          {error && (
            <div className="text-center py-12">
              <p className="text-red-500 font-semibold">{error}</p>
              <button
                onClick={() => fetchDirectories()}
                className="mt-4 px-6 py-2 bg-gray-200 hover:bg-gray-300 rounded-lg font-semibold transition-colors"
              >
                Retry
              </button>
            </div>
          )}

          {!loading && !error && data && (
            <div className="space-y-2">
              {/* Parent Directory */}
              {data.parentPath && (
                <button
                  onClick={() => handleNavigate(data.parentPath!)}
                  className="w-full flex items-center gap-3 px-4 py-3 hover:bg-gray-100 rounded-lg transition-colors text-left"
                >
                  <span className="text-2xl">⬆️</span>
                  <span className="font-semibold text-gray-700">..</span>
                  <span className="text-sm text-gray-500">(Go up)</span>
                </button>
              )}

              {/* Subdirectories */}
              {data.directories.length === 0 ? (
                <div className="text-center py-8 text-gray-500">
                  <p>No subdirectories found</p>
                </div>
              ) : (
                data.directories.map((dir) => (
                  <button
                    key={dir.path}
                    onClick={() => handleNavigate(dir.path)}
                    className={`w-full flex items-center gap-3 px-4 py-3 hover:bg-gray-100 rounded-lg transition-colors text-left ${
                      dir.isGitRepo ? 'border-2 border-green-300 bg-green-50' : 'border border-gray-200'
                    }`}
                  >
                    <span className="text-2xl">{dir.isGitRepo ? '📦' : '📁'}</span>
                    <span className="flex-1 font-medium text-gray-800">{dir.name}</span>
                    {dir.isGitRepo && (
                      <span className="px-2 py-1 bg-green-200 text-green-800 rounded text-xs font-semibold">
                        Git Repo
                      </span>
                    )}
                  </button>
                ))
              )}
            </div>
          )}
        </div>

        {/* Footer */}
        <div className="p-6 border-t border-gray-200 flex gap-3">
          <button
            onClick={handleSelect}
            disabled={!data || loading}
            className="flex-1 bg-gradient-to-r from-purple-500 to-pink-500 text-white py-3 px-6 rounded-xl font-semibold hover:from-purple-600 hover:to-pink-600 disabled:opacity-50 disabled:cursor-not-allowed transition-all shadow-lg hover:shadow-xl"
          >
            ✅ Select This Folder
          </button>
          <button
            onClick={onCancel}
            className="px-6 py-3 bg-gray-200 hover:bg-gray-300 text-gray-700 rounded-xl font-semibold transition-colors"
          >
            Cancel
          </button>
        </div>
      </div>
    </div>
  );
}
