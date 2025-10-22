'use client';

import { useState, FormEvent, ChangeEvent } from 'react';
import toast from 'react-hot-toast';
import { NotesResponse } from '@/types';
import ResultsDisplay from './ResultsDisplay';

export default function NotesTab() {
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

    // Show loading toast
    const toastId = toast.loading('✨ Processing your notes...');

    try {
      const response = await fetch('/api/notes', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(data),
      });

      const result = await response.json();

      if (result.success) {
        setResults(result.data);

        // Success toast with details
        toast.success(
          `✅ Extracted ${result.data.summary.tasksExtracted} tasks from your notes!`,
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
    <div className="bg-white rounded-2xl shadow-2xl p-8">
      <h2 className="text-3xl font-bold text-gray-800 mb-2 flex items-center gap-3">
        <span>📝</span>
        <span>Upload Notes</span>
      </h2>
      <p className="text-gray-600 mb-8">
        Upload your work notes and convert them into structured tasks
      </p>

      <form onSubmit={handleSubmit} className="space-y-6">
        <div>
          <label className="block text-sm font-semibold text-gray-700 mb-2">
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
              className="flex flex-col items-center justify-center border-4 border-dashed border-purple-300 rounded-xl p-8 cursor-pointer hover:border-purple-500 hover:bg-purple-50 transition-all duration-300"
            >
              <span className="text-5xl mb-3">📄</span>
              <span className="text-lg font-semibold text-purple-600">
                {fileName || 'Click to upload or drag file here'}
              </span>
              <span className="text-sm text-gray-500 mt-2">
                Supports .txt and .md files
              </span>
            </label>
          </div>
        </div>

        <div>
          <label htmlFor="notesText" className="block text-sm font-semibold text-gray-700 mb-2">
            Or Paste Your Notes Here
          </label>
          <textarea
            id="notesText"
            value={notesText}
            onChange={(e) => setNotesText(e.target.value)}
            placeholder="- Add authentication feature&#10;- Fix bug in payment flow&#10;- Improve dashboard performance&#10;TODO: Update documentation"
            className="w-full px-4 py-3 border-2 border-gray-300 rounded-xl focus:outline-none focus:border-purple-500 transition-colors min-h-[160px] resize-y font-mono text-sm"
          />
        </div>

        <div className="flex items-center gap-3">
          <input
            type="checkbox"
            id="createTasksNotes"
            name="createTasksNotes"
            defaultChecked
            className="w-5 h-5 text-purple-600 rounded focus:ring-purple-500"
          />
          <label htmlFor="createTasksNotes" className="text-sm font-medium text-gray-700">
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
              <span>Processing...</span>
            </>
          ) : (
            <>
              <span>✨</span>
              <span>Process Notes</span>
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

      {results && <ResultsDisplay type="notes" data={results} />}
    </div>
  );
}
