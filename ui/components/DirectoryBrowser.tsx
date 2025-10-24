'use client';

import { useState, useEffect } from 'react';
import toast from 'react-hot-toast';
import { useAuth } from '@/lib/context/AuthContext';
import Button from '@/lib/components/ui/Button';

const BACKEND_URL = 'http://localhost:3009';

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
  const { accessToken } = useAuth();
  const [loading, setLoading] = useState(false);
  const [data, setData] = useState<BrowseData | null>(null);
  const [error, setError] = useState<string | null>(null);

  const fetchDirectories = async (path?: string) => {
    if (!accessToken) {
      setError('Not authenticated');
      return;
    }

    setLoading(true);
    setError(null);

    try {
      const url = path
        ? `${BACKEND_URL}/api/browse?path=${encodeURIComponent(path)}`
        : `${BACKEND_URL}/api/browse`;
      const response = await fetch(url, {
        headers: {
          'Authorization': `Bearer ${accessToken}`,
        },
        credentials: 'include',
      });
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
      <div className="bg-background-secondary rounded-2xl shadow-2xl max-w-3xl w-full max-h-[80vh] flex flex-col">
        {/* Header */}
        <div className="p-6 border-b border-border">
          <h3 className="text-2xl font-bold text-foreground mb-2">📁 Browse Directories</h3>
          <p className="text-sm text-foreground-secondary">Navigate to your project folder and click &quot;Select This Folder&quot;</p>
        </div>

        {/* Current Path */}
        <div className="px-6 py-4 bg-background-tertiary border-b border-border">
          <div className="flex flex-col sm:flex-row sm:items-center gap-2">
            <span className="text-sm font-semibold text-foreground shrink-0">Current:</span>
            <code className="flex-1 px-3 py-2 bg-background-secondary border border-border rounded-lg text-sm font-mono text-foreground overflow-x-auto whitespace-nowrap scrollbar-thin scrollbar-thumb-foreground-tertiary scrollbar-track-background-tertiary">
              {data?.currentPath || 'Loading...'}
            </code>
            {data && data.gitRepos > 0 && (
              <span className="px-3 py-1 bg-success/10 text-success rounded-full text-xs font-semibold shrink-0">
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
              <p className="text-error font-semibold">{error}</p>
              <Button
                onClick={() => fetchDirectories()}
                variant="secondary"
                className="mt-4"
              >
                Retry
              </Button>
            </div>
          )}

          {!loading && !error && data && (
            <div className="space-y-2">
              {/* Parent Directory */}
              {data.parentPath && (
                <button
                  onClick={() => handleNavigate(data.parentPath!)}
                  className="w-full flex items-center gap-3 px-4 py-3 hover:bg-background-tertiary rounded-lg transition-colors text-left"
                >
                  <span className="text-2xl">⬆️</span>
                  <span className="font-semibold text-foreground">..</span>
                  <span className="text-sm text-foreground-tertiary">(Go up)</span>
                </button>
              )}

              {/* Subdirectories */}
              {data.directories.length === 0 ? (
                <div className="text-center py-8 text-foreground-tertiary">
                  <p>No subdirectories found</p>
                </div>
              ) : (
                data.directories.map((dir) => (
                  <button
                    key={dir.path}
                    onClick={() => handleNavigate(dir.path)}
                    className={`w-full flex items-center gap-3 px-4 py-3 hover:bg-background-tertiary rounded-lg transition-colors text-left ${
                      dir.isGitRepo ? 'border-2 border-success/30 bg-success/5' : 'border border-border'
                    }`}
                  >
                    <span className="text-2xl">{dir.isGitRepo ? '📦' : '📁'}</span>
                    <span className="flex-1 font-medium text-foreground">{dir.name}</span>
                    {dir.isGitRepo && (
                      <span className="px-2 py-1 bg-success/10 text-success rounded text-xs font-semibold">
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
        <div className="p-6 border-t border-border flex gap-3">
          <Button
            onClick={handleSelect}
            disabled={!data || loading}
            variant="primary"
            size="lg"
            className="flex-1"
          >
            ✅ Select This Folder
          </Button>
          <Button
            onClick={onCancel}
            variant="secondary"
            size="lg"
          >
            Cancel
          </Button>
        </div>
      </div>
    </div>
  );
}
