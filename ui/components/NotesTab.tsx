'use client';

import { useState, FormEvent, ChangeEvent } from 'react';
import toast from 'react-hot-toast';
import { NotesResponse } from '@/types';
import ResultsDisplay from './ResultsDisplay';
import { Card, Button } from '@/lib/components/ui';
import { api, messageFor } from '@/lib/api';
import { downloadTextFile } from '@/lib/download';

// Sample content for downloads
const SAMPLE_UNSTRUCTURED = `# Tasks with Status Markers and Dates

# Completed tasks with completion dates
[x - 2024-12-15] Add user authentication with OAuth support
[x - yesterday] Fix mobile responsive layout bug
- [DONE - 2024-12-10] Improve database query performance
- [COMPLETE - 12/08/2024] Add error logging for production
* [FINISHED - 3 days ago] Refactor authentication module

# Completed tasks without dates
[x] Setup CI/CD pipeline (completed but no date tracked)

# In Progress tasks
- [IN PROGRESS] Write unit tests for API endpoints
* [WIP] Update deployment documentation

# Todo tasks (no status or unchecked)
TODO: Add email verification feature
FIXME: Fix broken payment gateway link

[ ] Integrate analytics tracking
[ ] Optimize image loading

# Other status examples
- [BLOCKED] Waiting for API finalization
1. Implement rate limiting for API endpoints

# Note: Supported status values:
# - DONE, COMPLETED, FINISHED, COMPLETE, X → Maps to "complete"
# - IN PROGRESS, WIP, WORKING, DOING, STARTED → Maps to "in progress"
# - TODO, PENDING, BACKLOG → Maps to "to do"
# - BLOCKED, ON HOLD, PAUSED → Maps to "blocked"

# Date format examples:
# - YYYY-MM-DD (2024-12-15)
# - MM/DD/YYYY (12/15/2024)
# - DD-MM-YYYY (15-12-2024)
# - Relative: today, yesterday, "3 days ago", "1 week ago"
# Format: [STATUS - DATE] Task description`;

const SAMPLE_STRUCTURED = `Task 1: Implement OAuth Integration
Priority: HIGH
Estimate: 6 hours
Status: complete
Completed: 2024-12-15
Description: Add Google and GitHub OAuth support to the authentication system.
Support social login and account linking.

---

Task 2: Fix Payment Processing Bug
Priority: CRITICAL
Estimate: 4 hours
Status: complete
Date: yesterday
Description: Resolve issue where payments fail for certain credit card types.
Add better error handling and logging.

---

Task 3: Database Migration Script
Priority: HIGH
Estimate: 5 hours
Status: complete
Completed Date: 12/10/2024
Description: Created migration script for user table schema changes.
Tested on staging environment.

---

Task 4: Optimize Database Queries
Priority: MEDIUM
Estimate: 3 hours
Status: in progress
Description: Add indexes to slow queries and refactor N+1 problems.
Focus on user dashboard and reports.

---

Task 5: Write API Documentation
Priority: NORMAL
Estimate: 2 hours
Status: blocked
Description: Document all REST endpoints with examples and response schemas.
Include authentication and error handling details.
Waiting for API finalization.

---

Task 6: Setup Monitoring System
Priority: HIGH
Estimate: 5 hours
Description: Implement application monitoring with alerts for errors and performance issues.
Configure logging aggregation and dashboards.
Note: No Status field means it will use ClickUp's default status (usually "to do" or "setup")

---

### Task 7: Add User Notification System
Priority: MEDIUM
Estimate: 4 hours
Status: to do
Description: Example with markdown heading (###).
Implement email and in-app notifications for users.

---

# Supported Status Values:
# - complete (or: done, completed, finished)
# - in progress (or: wip, working, doing, started)
# - to do (or: todo, pending, backlog)
# - blocked (or: on hold, paused)
# - Or use any custom status name from your ClickUp list

# Supported Date Field Names:
# - Completed: DATE
# - Date: DATE
# - Completed Date: DATE

# Date Formats Supported:
# - YYYY-MM-DD (2024-12-15)
# - MM/DD/YYYY (12/15/2024)
# - DD-MM-YYYY (15-12-2024)
# - Relative: today, yesterday, "3 days ago", "1 week ago", "2 months ago"

# Markdown Headings Support:
# You can use markdown headings with your tasks:
# ### Task 1: Task Title
# ## Task 2: Another Task
# # Task 3: Yet Another Task`;

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

  const handleClearFile = () => {
    setFileName('');
    setNotesText('');
    // Reset the file input
    const fileInput = document.getElementById('notesFile') as HTMLInputElement;
    if (fileInput) {
      fileInput.value = '';
    }
    toast.success('File cleared', { duration: 2000 });
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

    const toastId = toast.loading(
      data.createTasks
        ? '✨ Processing notes and creating tasks in ClickUp...'
        : '✨ Processing your notes...'
    );

    try {
      const processed = await api.post<NotesResponse>('/notes', data);
      setResults(processed);

      toast.success(`✅ Extracted ${processed.summary.tasksExtracted} tasks from your notes!`, {
        id: toastId,
        duration: 4000,
      });

      if (data.createTasks) {
        const failed = processed.summary.tasksFailed || 0;
        const created = processed.summary.tasksCreated || 0;

        // Deferred so it does not replace the extraction toast mid-read.
        setTimeout(() => {
          if (created > 0) {
            toast.success(
              `🎉 Created ${created} tasks in ClickUp!` + (failed > 0 ? ` (${failed} failed)` : ''),
              { duration: failed > 0 ? 5000 : 4000 }
            );
          }
          if (failed > 0 && created === 0) {
            toast.error(`❌ Failed to create all ${failed} tasks. Check the console for details.`, {
              duration: 6000,
            });
          }
        }, 500);
      }
    } catch (caught) {
      const message = messageFor(caught, 'Processing failed');
      setError(message);
      toast.error(`❌ ${message}`, { id: toastId, duration: 5000 });
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
            <div className="flex items-center justify-between mb-2">
              <label className="block text-sm font-semibold text-foreground">
                Upload Notes File
              </label>
              {fileName && (
                <button
                  type="button"
                  onClick={handleClearFile}
                  className="flex items-center gap-1 px-3 py-1 text-sm text-error hover:text-error/80 bg-error/10 hover:bg-error/20 rounded-md transition-colors"
                >
                  <span>✕</span>
                  <span>Clear File</span>
                </button>
              )}
            </div>
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

          {/* Sample Files Download Section */}
          <div className="bg-background-secondary border border-border rounded-lg p-5">
            <div className="flex items-start gap-3 mb-3">
              <span className="text-2xl">📥</span>
              <div className="flex-1">
                <h3 className="text-sm font-semibold text-foreground mb-1">
                  Download Sample Files
                </h3>
                <p className="text-xs text-foreground-tertiary">
                  Not sure about the format? Download example files to see how to structure your notes
                </p>
              </div>
            </div>
            <div className="flex flex-wrap gap-3">
              <button
                type="button"
                onClick={() => {
                  downloadTextFile(SAMPLE_UNSTRUCTURED, 'sample-unstructured-notes.txt');
                  toast.success('Downloaded unstructured sample!', { duration: 2000 });
                }}
                className="flex items-center gap-2 px-4 py-2 bg-background-tertiary hover:bg-primary/10 border border-border hover:border-primary rounded-lg text-sm font-medium text-foreground hover:text-primary transition-all duration-200"
              >
                <span>📄</span>
                <span>Unstructured Format (.txt)</span>
              </button>
              <button
                type="button"
                onClick={() => {
                  downloadTextFile(SAMPLE_STRUCTURED, 'sample-structured-notes.md');
                  toast.success('Downloaded structured sample!', { duration: 2000 });
                }}
                className="flex items-center gap-2 px-4 py-2 bg-background-tertiary hover:bg-primary/10 border border-border hover:border-primary rounded-lg text-sm font-medium text-foreground hover:text-primary transition-all duration-200"
              >
                <span>📋</span>
                <span>Structured Format (.md)</span>
              </button>
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
              className="w-full px-4 py-3 border border-border bg-background-tertiary text-foreground rounded-lg focus:outline-hidden focus:ring-2 focus:ring-primary transition-colors min-h-[160px] resize-y font-mono text-sm placeholder:text-foreground-tertiary"
            />
          </div>

          {/* Checkbox */}
          <div className="flex items-center gap-3">
            <input
              type="checkbox"
              id="createTasksNotes"
              name="createTasksNotes"
              defaultChecked
              className="w-5 h-5 text-primary rounded-sm focus:ring-primary accent-primary"
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
