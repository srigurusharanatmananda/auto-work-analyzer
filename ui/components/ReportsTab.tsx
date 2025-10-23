'use client';

import { useState, useEffect, FormEvent } from 'react';
import toast from 'react-hot-toast';
import { AnalysisResponse } from '@/types';
import DirectoryBrowser from './DirectoryBrowser';

interface ReportsTabProps {
  selectedProjectPath: string;
  setSelectedProjectPath: (path: string) => void;
}

interface EditableWorkItem {
  id: string;
  name: string;
  type: string;
  description: string;
  selected: boolean;
  isEditing: boolean;
}

// Backend API URL (webhook server runs on port 3009)
const BACKEND_URL = 'http://localhost:3009';

export default function ReportsTab({ selectedProjectPath, setSelectedProjectPath }: ReportsTabProps) {
  const [loading, setLoading] = useState(false);
  const [summaryReport, setSummaryReport] = useState<string>('');
  const [detailedReport, setDetailedReport] = useState<string>('');
  const [viewMode, setViewMode] = useState<'summary' | 'detailed'>('summary');
  const [workAnalysis, setWorkAnalysis] = useState<AnalysisResponse | null>(null);
  const [showBrowser, setShowBrowser] = useState(false);
  const [branches, setBranches] = useState<string[]>([]);
  const [currentBranch, setCurrentBranch] = useState<string>('');
  const [userEmail, setUserEmail] = useState<string>('');
  const [loadingGitInfo, setLoadingGitInfo] = useState(false);
  const [editableWorkItems, setEditableWorkItems] = useState<EditableWorkItem[]>([]);
  const [creatingTasks, setCreatingTasks] = useState(false);
  const [enhancingItems, setEnhancingItems] = useState<Set<string>>(new Set());

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

  // Get current report based on view mode
  const currentReport = viewMode === 'summary' ? summaryReport : detailedReport;

  const handleGenerateReport = async (e: FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    setLoading(true);
    setSummaryReport('');
    setDetailedReport('');
    setWorkAnalysis(null);

    const formData = new FormData(e.currentTarget);
    const data = {
      date: formData.get('startDate') as string,
      endDate: (formData.get('endDate') as string) || undefined,
      author: (formData.get('author') as string) || undefined,
      branch: (formData.get('branch') as string) || undefined,
      projectPath: selectedProjectPath || undefined,
      createTasks: false, // Don't create tasks for reports
    };

    const toastId = toast.loading('📊 Generating report...');

    try {
      const response = await fetch(`${BACKEND_URL}/api/analyze`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(data),
      });

      const result = await response.json();

      if (result.success) {
        setWorkAnalysis(result.data);

        // Populate editable work items
        const workItems: EditableWorkItem[] = result.data.workAnalysis.detectedWork.map((work: any, index: number) => ({
          id: `work-${index}-${Date.now()}`,
          name: work.name,
          type: work.type,
          description: work.description || '',
          selected: true,
          isEditing: false,
        }));
        setEditableWorkItems(workItems);

        // Generate Summary Report (just main points)
        const summaryLines = ['Sri Gurusharanatmanda EOD:'];

        // Generate Detailed Report (with descriptions)
        const detailedLines = ['Sri Gurusharanatmanda EOD:'];

        if (result.data.workAnalysis.detectedWork.length === 0) {
          summaryLines.push('- No work items detected for the selected period');
          detailedLines.push('- No work items detected for the selected period');
        } else {
          result.data.workAnalysis.detectedWork.forEach((work: any) => {
            const emoji = work.type === 'feature' ? '✨' : work.type === 'bug-fix' ? '🐛' : '🔧';

            // Summary: just the main point
            summaryLines.push(`- ${emoji} ${work.name}`);

            // Detailed: main point + descriptions
            detailedLines.push(`- ${emoji} ${work.name}`);
            if (work.description && work.description.length > 0) {
              const descLines = work.description.split('\n').filter((line: string) => line.trim());
              descLines.forEach((line: string) => {
                detailedLines.push(`  ${line.trim()}`);
              });
            }
          });
        }

        setSummaryReport(summaryLines.join('\n'));
        setDetailedReport(detailedLines.join('\n'));

        toast.success(
          `✅ Generated report with ${result.data.workAnalysis.detectedWork.length} work items!`,
          { id: toastId, duration: 3000 }
        );
      } else {
        const errorMessage = result.error || 'Report generation failed';
        toast.error(`❌ ${errorMessage}`, { id: toastId, duration: 5000 });
      }
    } catch (err) {
      const errorMessage = err instanceof Error ? err.message : 'An error occurred';
      toast.error(`❌ ${errorMessage}`, { id: toastId, duration: 5000 });
    } finally {
      setLoading(false);
    }
  };

  const handleCopyReport = async () => {
    if (!currentReport) {
      toast.error('No report to copy!');
      return;
    }

    try {
      await navigator.clipboard.writeText(currentReport);
      toast.success(`📋 ${viewMode === 'summary' ? 'Summary' : 'Detailed'} report copied to clipboard!`, { duration: 2000 });
    } catch (err) {
      toast.error('Failed to copy report');
    }
  };

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

  // Regenerate reports from current editable work items
  const regenerateReports = () => {
    const summaryLines = ['Sri Gurusharanatmanda EOD:'];
    const detailedLines = ['Sri Gurusharanatmanda EOD:'];

    if (editableWorkItems.length === 0) {
      summaryLines.push('- No work items detected for the selected period');
      detailedLines.push('- No work items detected for the selected period');
    } else {
      editableWorkItems.forEach((work) => {
        const emoji = work.type === 'feature' ? '✨' : work.type === 'bug-fix' ? '🐛' : '🔧';

        // Summary: just the title
        summaryLines.push(`- ${emoji} ${work.name}`);

        // Detailed: title + descriptions
        detailedLines.push(`- ${emoji} ${work.name}`);
        if (work.description && work.description.length > 0) {
          const descLines = work.description.split('\n').filter((line: string) => line.trim());
          descLines.forEach((line: string) => {
            detailedLines.push(`  ${line.trim()}`);
          });
        }
      });
    }

    setSummaryReport(summaryLines.join('\n'));
    setDetailedReport(detailedLines.join('\n'));
  };

  // Work item management functions
  const toggleWorkItemSelection = (id: string) => {
    setEditableWorkItems(items =>
      items.map(item =>
        item.id === id ? { ...item, selected: !item.selected } : item
      )
    );
  };

  const toggleEditMode = (id: string) => {
    setEditableWorkItems(items => {
      const item = items.find(i => i.id === id);
      const wasEditing = item?.isEditing;
      const updatedItems = items.map(item =>
        item.id === id ? { ...item, isEditing: !item.isEditing } : item
      );
      // Regenerate reports when user finishes editing (switches from edit to view mode)
      if (wasEditing) {
        setTimeout(() => regenerateReports(), 100);
      }
      return updatedItems;
    });
  };

  const updateWorkItem = (id: string, field: 'name' | 'type' | 'description', value: string) => {
    setEditableWorkItems(items => {
      const updatedItems = items.map(item =>
        item.id === id ? { ...item, [field]: value } : item
      );
      // Regenerate reports when name or description changes
      if (field === 'name' || field === 'description') {
        setTimeout(() => regenerateReports(), 100);
      }
      return updatedItems;
    });
  };

  const deleteWorkItem = (id: string) => {
    setEditableWorkItems(items => {
      const updatedItems = items.filter(item => item.id !== id);
      setTimeout(() => regenerateReports(), 100);
      return updatedItems;
    });
  };

  const addNewWorkItem = () => {
    const newItem: EditableWorkItem = {
      id: `work-new-${Date.now()}`,
      name: 'New task',
      type: 'feature',
      description: '',
      selected: true,
      isEditing: true,
    };
    setEditableWorkItems(items => [...items, newItem]);
  };

  const selectAll = () => {
    setEditableWorkItems(items => items.map(item => ({ ...item, selected: true })));
  };

  const deselectAll = () => {
    setEditableWorkItems(items => items.map(item => ({ ...item, selected: false })));
  };

  const handleEnhanceWithAI = async (id: string) => {
    const item = editableWorkItems.find(i => i.id === id);
    if (!item) return;

    // Mark as enhancing
    setEnhancingItems(prev => new Set([...prev, id]));
    const toastId = toast.loading('✨ Enhancing with AI...');

    try {
      // Find original work item from analysis for commits and files
      const originalWork = workAnalysis?.workAnalysis.detectedWork.find(
        w => w.name === item.name
      );

      const response = await fetch(`${BACKEND_URL}/api/ai-enhance`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          workItemName: item.name,
          description: item.description,
          commits: originalWork?.commits || [],
          filesChanged: originalWork?.files || [],
        }),
      });

      const result = await response.json();

      if (result.success) {
        const enhanced = result.data;

        // Update the work item with enhanced data and open edit mode
        setEditableWorkItems(items => {
          const updatedItems = items.map(i =>
            i.id === id
              ? {
                  ...i,
                  name: enhanced.improvedTitle || i.name, // Update title if provided
                  description: enhanced.description,
                  isEditing: true, // Open edit mode so user can see the enhanced description
                  // Optionally update type based on suggested tags
                }
              : i
          );
          // Regenerate reports with updated data
          setTimeout(() => regenerateReports(), 100);
          return updatedItems;
        });

        toast.success('✨ Enhanced with AI! (Title and description updated)', { id: toastId, duration: 3000 });

        // Show additional info as separate toasts
        if (enhanced.suggestedTags.length > 0) {
          setTimeout(() => {
            toast.success(`💡 Suggested tags: ${enhanced.suggestedTags.join(', ')}`, { duration: 4000 });
          }, 500);
        }

        if (enhanced.priority !== 'normal') {
          setTimeout(() => {
            toast.success(`⚠️ Detected priority: ${enhanced.priority}`, { duration: 4000 });
          }, 1000);
        }
      } else {
        toast.error(`❌ ${result.error || 'Failed to enhance with AI'}`, { id: toastId, duration: 5000 });
      }
    } catch (err) {
      const errorMessage = err instanceof Error ? err.message : 'An error occurred';
      toast.error(`❌ ${errorMessage}`, { id: toastId, duration: 5000 });
    } finally {
      setEnhancingItems(prev => {
        const newSet = new Set(prev);
        newSet.delete(id);
        return newSet;
      });
    }
  };

  const handleCreateTasksInClickUp = async () => {
    const selectedItems = editableWorkItems.filter(item => item.selected);

    if (selectedItems.length === 0) {
      toast.error('Please select at least one task to create');
      return;
    }

    setCreatingTasks(true);
    const toastId = toast.loading(`Creating ${selectedItems.length} tasks in ClickUp...`);

    try {
      // Create a modified work analysis with only selected items
      const modifiedWorkAnalysis = {
        ...workAnalysis!.workAnalysis,
        detectedWork: selectedItems.map(item => ({
          name: item.name,
          type: item.type,
          description: item.description,
          commits: [], // Empty commits since we're manually creating
          tags: [], // Empty tags array
          files: [], // Empty files array
        })),
      };

      const response = await fetch(`${BACKEND_URL}/api/create-tasks`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          workAnalysis: modifiedWorkAnalysis,
          projectPath: selectedProjectPath,
        }),
      });

      const result = await response.json();

      if (result.success) {
        toast.success(
          `✅ Created ${result.data.tasksCreated} tasks in ClickUp!`,
          { id: toastId, duration: 4000 }
        );
      } else {
        toast.error(`❌ ${result.error || 'Failed to create tasks'}`, { id: toastId, duration: 5000 });
      }
    } catch (err) {
      const errorMessage = err instanceof Error ? err.message : 'An error occurred';
      toast.error(`❌ ${errorMessage}`, { id: toastId, duration: 5000 });
    } finally {
      setCreatingTasks(false);
    }
  };

  return (
    <div className="bg-white rounded-2xl shadow-2xl p-8">
      <h2 className="text-3xl font-bold text-gray-800 mb-2 flex items-center gap-3">
        <span>📄</span>
        <span>Daily Reports</span>
      </h2>
      <p className="text-gray-600 mb-8">
        Generate formatted daily reports for easy submission
      </p>

      <form onSubmit={handleGenerateReport} className="space-y-6">
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
            Project Path {selectedProjectPath ? '✅' : '(Required)'}
          </label>
          <div className="flex gap-3">
            <input
              type="text"
              id="projectPath"
              name="projectPath"
              value={selectedProjectPath}
              onChange={(e) => setSelectedProjectPath(e.target.value)}
              placeholder="/path/to/your/project"
              required
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
            💡 Select the git repository you want to generate a report for
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
            💡 Leave empty to include commits from all authors
          </p>
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
              <span>Generating...</span>
            </>
          ) : (
            <>
              <span>📊</span>
              <span>Generate Report</span>
            </>
          )}
        </button>
      </form>

      {currentReport && (
        <div className="mt-8 space-y-4">
          {/* Report Preview */}
          <div className="bg-gray-50 border-2 border-gray-300 rounded-xl p-6">
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 mb-4">
              <div className="flex items-center gap-3">
                <h3 className="text-xl font-bold text-gray-800">Report Preview</h3>
                <div className="flex bg-white border-2 border-gray-300 rounded-lg overflow-hidden">
                  <button
                    onClick={() => setViewMode('summary')}
                    className={`px-4 py-2 text-sm font-semibold transition-colors ${
                      viewMode === 'summary'
                        ? 'bg-purple-500 text-white'
                        : 'bg-white text-gray-700 hover:bg-gray-100'
                    }`}
                  >
                    📝 Summary
                  </button>
                  <button
                    onClick={() => setViewMode('detailed')}
                    className={`px-4 py-2 text-sm font-semibold transition-colors border-l-2 border-gray-300 ${
                      viewMode === 'detailed'
                        ? 'bg-purple-500 text-white'
                        : 'bg-white text-gray-700 hover:bg-gray-100'
                    }`}
                  >
                    📄 Detailed
                  </button>
                </div>
              </div>
              <button
                onClick={handleCopyReport}
                className="px-4 py-2 bg-green-500 hover:bg-green-600 text-white rounded-lg font-semibold transition-colors flex items-center gap-2 whitespace-nowrap"
              >
                <span>📋</span>
                <span>Copy {viewMode === 'summary' ? 'Summary' : 'Detailed'}</span>
              </button>
            </div>
            <pre className="whitespace-pre-wrap font-mono text-sm text-gray-800 bg-white p-4 rounded-lg border border-gray-200">
{currentReport}
            </pre>
          </div>

          {/* Editable Work Items List */}
          {editableWorkItems.length > 0 && (
            <div className="bg-gradient-to-r from-blue-50 to-purple-50 border-2 border-blue-300 rounded-xl p-6">
              <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 mb-4">
                <h3 className="text-xl font-bold text-gray-800 flex items-center gap-2">
                  <span>✏️</span>
                  <span>Edit Tasks Before Creating</span>
                </h3>
                <div className="flex gap-2 flex-wrap">
                  <button
                    onClick={selectAll}
                    className="px-3 py-1.5 bg-white border-2 border-gray-300 rounded-lg text-sm font-semibold text-gray-700 hover:bg-gray-50 transition-colors"
                  >
                    Select All
                  </button>
                  <button
                    onClick={deselectAll}
                    className="px-3 py-1.5 bg-white border-2 border-gray-300 rounded-lg text-sm font-semibold text-gray-700 hover:bg-gray-50 transition-colors"
                  >
                    Deselect All
                  </button>
                  <button
                    onClick={addNewWorkItem}
                    className="px-3 py-1.5 bg-green-500 text-white rounded-lg text-sm font-semibold hover:bg-green-600 transition-colors flex items-center gap-1"
                  >
                    <span>➕</span>
                    <span>Add Task</span>
                  </button>
                </div>
              </div>

              <div className="space-y-3 mb-4">
                {editableWorkItems.map((item) => {
                  const emoji = item.type === 'feature' ? '✨' : item.type === 'bug-fix' ? '🐛' : '🔧';

                  return (
                    <div
                      key={item.id}
                      className={`bg-white border-2 rounded-lg p-4 transition-all ${
                        item.selected ? 'border-purple-400 shadow-md' : 'border-gray-300 opacity-60'
                      }`}
                    >
                      {item.isEditing ? (
                        <div className="space-y-3">
                          <div className="flex items-start gap-3">
                            <input
                              type="checkbox"
                              checked={item.selected}
                              onChange={() => toggleWorkItemSelection(item.id)}
                              className="w-5 h-5 text-purple-600 rounded mt-1 flex-shrink-0"
                            />
                            <div className="flex-1 space-y-2">
                              <input
                                type="text"
                                value={item.name}
                                onChange={(e) => updateWorkItem(item.id, 'name', e.target.value)}
                                className="w-full px-3 py-2 border-2 border-gray-300 rounded-lg font-semibold text-gray-800 focus:outline-none focus:border-purple-500"
                                placeholder="Task name"
                              />
                              <select
                                value={item.type}
                                onChange={(e) => updateWorkItem(item.id, 'type', e.target.value)}
                                className="px-3 py-2 border-2 border-gray-300 rounded-lg text-sm focus:outline-none focus:border-purple-500"
                              >
                                <option value="feature">✨ Feature</option>
                                <option value="bug-fix">🐛 Bug Fix</option>
                                <option value="other">🔧 Other</option>
                              </select>
                              <textarea
                                value={item.description}
                                onChange={(e) => updateWorkItem(item.id, 'description', e.target.value)}
                                className="w-full px-3 py-2 border-2 border-gray-300 rounded-lg text-sm text-gray-700 focus:outline-none focus:border-purple-500"
                                placeholder="Description (optional)"
                                rows={2}
                              />
                            </div>
                            <div className="flex gap-2 flex-shrink-0">
                              <button
                                onClick={() => toggleEditMode(item.id)}
                                className="px-3 py-1.5 bg-green-500 text-white rounded-lg text-sm font-semibold hover:bg-green-600 transition-colors"
                              >
                                ✓ Save
                              </button>
                              <button
                                onClick={() => deleteWorkItem(item.id)}
                                className="px-3 py-1.5 bg-red-500 text-white rounded-lg text-sm font-semibold hover:bg-red-600 transition-colors"
                              >
                                🗑️
                              </button>
                            </div>
                          </div>
                        </div>
                      ) : (
                        <div className="flex items-start gap-3">
                          <input
                            type="checkbox"
                            checked={item.selected}
                            onChange={() => toggleWorkItemSelection(item.id)}
                            className="w-5 h-5 text-purple-600 rounded mt-1 flex-shrink-0"
                          />
                          <div className="flex-1 min-w-0">
                            <div className="font-semibold text-gray-800 flex items-center gap-2">
                              <span>{emoji}</span>
                              <span>{item.name}</span>
                              <span className="px-2 py-0.5 bg-gray-200 text-gray-700 rounded text-xs">
                                {item.type}
                              </span>
                            </div>
                            {item.description && (
                              <p className="text-sm text-gray-600 mt-1">{item.description}</p>
                            )}
                          </div>
                          <div className="flex gap-2 flex-shrink-0">
                            <button
                              onClick={() => handleEnhanceWithAI(item.id)}
                              disabled={enhancingItems.has(item.id)}
                              className="px-3 py-1.5 bg-gradient-to-r from-purple-500 to-pink-500 text-white rounded-lg text-sm font-semibold hover:from-purple-600 hover:to-pink-600 disabled:opacity-50 disabled:cursor-not-allowed transition-colors flex items-center gap-1"
                              title="Enhance description with AI"
                            >
                              {enhancingItems.has(item.id) ? (
                                <>
                                  <svg className="animate-spin h-3 w-3" viewBox="0 0 24 24">
                                    <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" fill="none" />
                                    <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z" />
                                  </svg>
                                  <span>AI...</span>
                                </>
                              ) : (
                                <>
                                  <span>✨</span>
                                  <span>AI</span>
                                </>
                              )}
                            </button>
                            <button
                              onClick={() => toggleEditMode(item.id)}
                              className="px-3 py-1.5 bg-blue-500 text-white rounded-lg text-sm font-semibold hover:bg-blue-600 transition-colors"
                            >
                              ✏️ Edit
                            </button>
                            <button
                              onClick={() => deleteWorkItem(item.id)}
                              className="px-3 py-1.5 bg-red-500 text-white rounded-lg text-sm font-semibold hover:bg-red-600 transition-colors"
                            >
                              🗑️
                            </button>
                          </div>
                        </div>
                      )}
                    </div>
                  );
                })}
              </div>

              <button
                onClick={handleCreateTasksInClickUp}
                disabled={creatingTasks || editableWorkItems.filter(item => item.selected).length === 0}
                className="w-full bg-gradient-to-r from-green-500 to-emerald-500 text-white py-3 px-6 rounded-xl font-semibold text-lg hover:from-green-600 hover:to-emerald-600 disabled:opacity-50 disabled:cursor-not-allowed transition-all duration-300 flex items-center justify-center gap-2 shadow-lg hover:shadow-xl"
              >
                {creatingTasks ? (
                  <>
                    <svg className="animate-spin h-5 w-5" viewBox="0 0 24 24">
                      <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" fill="none" />
                      <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z" />
                    </svg>
                    <span>Creating Tasks...</span>
                  </>
                ) : (
                  <>
                    <span>✅</span>
                    <span>Create {editableWorkItems.filter(item => item.selected).length} Tasks in ClickUp</span>
                  </>
                )}
              </button>
            </div>
          )}

          {/* Statistics */}
          {workAnalysis && (
            <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
              <div className="bg-blue-50 border-2 border-blue-200 rounded-xl p-4">
                <div className="flex items-center gap-2 mb-1">
                  <span className="text-2xl">💻</span>
                  <h4 className="font-semibold text-blue-800">Commits</h4>
                </div>
                <p className="text-3xl font-bold text-blue-900">
                  {workAnalysis.summary.totalCommits}
                </p>
              </div>

              <div className="bg-purple-50 border-2 border-purple-200 rounded-xl p-4">
                <div className="flex items-center gap-2 mb-1">
                  <span className="text-2xl">📋</span>
                  <h4 className="font-semibold text-purple-800">Work Items</h4>
                </div>
                <p className="text-3xl font-bold text-purple-900">
                  {workAnalysis.summary.totalWorkItems}
                </p>
              </div>

              <div className="bg-green-50 border-2 border-green-200 rounded-xl p-4">
                <div className="flex items-center gap-2 mb-1">
                  <span className="text-2xl">📝</span>
                  <h4 className="font-semibold text-green-800">Files Changed</h4>
                </div>
                <p className="text-3xl font-bold text-green-900">
                  {workAnalysis.summary.totalFilesChanged}
                </p>
              </div>
            </div>
          )}
        </div>
      )}

      {showBrowser && (
        <DirectoryBrowser
          onSelect={handleSelectDirectory}
          onCancel={handleCancelBrowse}
        />
      )}
    </div>
  );
}
