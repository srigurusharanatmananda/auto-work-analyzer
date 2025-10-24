'use client';

import { useState, FormEvent, ChangeEvent } from 'react';
import toast from 'react-hot-toast';
import { NotesResponse } from '@/types';
import ResultsDisplay from './ResultsDisplay';
import { Card, Button } from '@/lib/components/ui';
import { useAuth } from '@/lib/context/AuthContext';

const BACKEND_URL = 'http://localhost:3009';

export default function NotesTab() {
  const { accessToken } = useAuth();
  const [loading, setLoading] = useState(false);
  const [results, setResults] = useState<NotesResponse | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [fileName, setFileName] = useState<string>('');
  const [notesText, setNotesText] = useState<string>('');

  const handleFileSelect = (e: ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) {
      setFileName(file.name);
      toast.success(`📄 Loaded ${file.name}`, { duration: 2000 });

      const reader = new FileReader();
      reader.onload = (event) => {
        setNotesText(event.target?.result as string);
      };
      reader.readAsText(file);
    }
  };

  const handleSubmit = async (e: FormEvent<HTMLFormElement>) => {
    e.preventDefault();

    if (!accessToken) {
      toast.error('Not authenticated');
      return;
    }

    setLoading(true);
    setError(null);
    setResults(null);

    if (!notesText.trim()) {
      const errorMessage = 'Please provide some notes to process';
      setError(errorMessage);
      toast.error(`⚠️ ${errorMessage}`, { duration: 3000 });
      setLoading(false);
      return;
    }

    const formData = new FormData(e.currentTarget);
    const data = {
      notes: notesText,
      createTasks: formData.get('createTasksNotes') === 'on',
    };

    const toastId = toast.loading('✨ Processing your notes...');

    try {
      const response = await fetch(`${BACKEND_URL}/api/notes`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${accessToken}`,
        },
        credentials: 'include',
        body: JSON.stringify(data),
      });

      const result = await response.json();

      if (result.success) {
        setResults(result.data);

        toast.success(
          `✅ Extracted ${result.data.summary.tasksExtracted} tasks from your notes!`,
          { id: toastId, duration: 4000 }
        );

        if (data.createTasks && result.data.summary.tasksCreated > 0) {
          setTimeout(() => {
            toast.success(
              `🎉 Created ${result.data.summary.tasksCreated} tasks in ClickUp!`,
              { duration: 4000 }
            );
          }, 500);
        }
      } else {
        const errorMessage = result.error || 'Processing failed';
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
    <div className="space-y-6">
      <Card className="p-8">
        <form onSubmit={handleSubmit} className="space-y-6">
          {/* File Upload */}
          <div>
            <label className="block text-sm font-semibold text-foreground mb-2">
              Upload Notes File
            </label>
            <div className="relative">
              <input
                type="file"
                id="notesFile"
                accept=".txt,.md"
                onChange={handleFileSelect}
                className="hidden"
              />
              <label
                htmlFor="notesFile"
                className="flex flex-col items-center justify-center border-2 border-dashed border-border hover:border-primary rounded-lg p-8 cursor-pointer hover:bg-background-tertiary transition-all duration-300"
              >
                <span className="text-5xl mb-3">📄</span>
                <span className="text-lg font-semibold text-primary">
                  {fileName || 'Click to upload or drag file here'}
                </span>
                <span className="text-sm text-foreground-tertiary mt-2">
                  Supports .txt and .md files
                </span>
              </label>
            </div>
          </div>

          {/* Text Area */}
          <div>
            <label htmlFor="notesText" className="block text-sm font-semibold text-foreground mb-2">
              Or Paste Your Notes Here
            </label>
            <textarea
              id="notesText"
              value={notesText}
              onChange={(e) => setNotesText(e.target.value)}
              placeholder="- Add authentication feature&#10;- Fix bug in payment flow&#10;- Improve dashboard performance&#10;TODO: Update documentation"
              className="w-full px-4 py-3 border border-border bg-background-tertiary text-foreground rounded-lg focus:outline-none focus:ring-2 focus:ring-primary transition-colors min-h-[160px] resize-y font-mono text-sm placeholder:text-foreground-tertiary"
            />
          </div>

          {/* Checkbox */}
          <div className="flex items-center gap-3">
            <input
              type="checkbox"
              id="createTasksNotes"
              name="createTasksNotes"
              defaultChecked
              className="w-5 h-5 text-primary rounded focus:ring-primary accent-primary"
            />
            <label htmlFor="createTasksNotes" className="text-sm font-medium text-foreground">
              Automatically create tasks in ClickUp
            </label>
          </div>

          {/* Submit Button */}
          <Button
            type="submit"
            disabled={loading}
            isLoading={loading}
            variant="primary"
            className="w-full text-lg py-6"
          >
            {!loading && (
              <>
                <span>✨</span>
                <span>Process Notes</span>
              </>
            )}
          </Button>
        </form>

        {/* Error Message */}
        {error && (
          <div className="mt-6 bg-error/10 border-l-4 border-error p-4 rounded-r-lg">
            <div className="flex items-center gap-2">
              <span className="text-2xl">❌</span>
              <p className="text-error font-medium">{error}</p>
            </div>
          </div>
        )}
      </Card>

      {/* Results */}
      {results && <ResultsDisplay type="notes" data={results} />}
    </div>
  );
}
