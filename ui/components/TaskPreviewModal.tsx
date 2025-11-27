'use client';

import { useState } from 'react';
import { useAuth } from '@/lib/context/AuthContext';
import { Button, LoadingSpinner } from '@/lib/components/ui';
import toast from 'react-hot-toast';

const BACKEND_URL = 'http://localhost:3009';

interface WorkItem {
  name: string;
  type: string;
  description: string;
  estimatedHours: number;
  complexity: string;
  files: string[];
  commits: any[];
  filesCount: number;
  commitsCount: number;
  tags: string[];
}

interface TaskPreviewModalProps {
  workItems: WorkItem[];
  projectPath: string;
  date: string;
  onClose: () => void;
  onCreateTasks: (editedWorkItems: WorkItem[]) => void;
}

export default function TaskPreviewModal({
  workItems: initialWorkItems,
  projectPath,
  date,
  onClose,
  onCreateTasks,
}: TaskPreviewModalProps) {
  const { accessToken } = useAuth();
  const [workItems, setWorkItems] = useState<WorkItem[]>(initialWorkItems);
  const [editingIndex, setEditingIndex] = useState<number | null>(null);
  const [enhancingIndex, setEnhancingIndex] = useState<number | null>(null);
  const [creatingTasks, setCreatingTasks] = useState(false);

  const handleEdit = (index: number, field: 'name' | 'description', value: string) => {
    const updated = [...workItems];
    updated[index] = { ...updated[index], [field]: value };
    setWorkItems(updated);
  };

  const handleEnhanceWithAI = async (index: number) => {
    if (!accessToken) {
      toast.error('Not authenticated');
      return;
    }

    setEnhancingIndex(index);
    const toastId = toast.loading('✨ Enhancing with AI...');
    const item = workItems[index];

    try {
      const response = await fetch(`${BACKEND_URL}/api/ai-enhance`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${accessToken}`,
        },
        credentials: 'include',
        body: JSON.stringify({
          workItemName: item.name,
          description: item.description,
          commits: item.commits || [],
          filesChanged: item.files || [],
        }),
      });

      const result = await response.json();

      if (result.success) {
        const enhanced = result.data;
        const updated = [...workItems];
        updated[index] = {
          ...updated[index],
          name: enhanced.improvedTitle || item.name,
          description: enhanced.description,
        };
        setWorkItems(updated);
        toast.success('✨ Enhanced with AI!', { id: toastId });
      } else {
        toast.error(`❌ ${result.error || 'Failed to enhance with AI'}`, { id: toastId });
      }
    } catch (error) {
      console.error('Failed to enhance with AI:', error);
      toast.error('❌ Failed to enhance with AI', { id: toastId });
    } finally {
      setEnhancingIndex(null);
    }
  };

  const handleCreateTasks = async () => {
    setCreatingTasks(true);
    try {
      onCreateTasks(workItems);
    } catch (error) {
      console.error('Failed to create tasks:', error);
    } finally {
      setCreatingTasks(false);
    }
  };

  return (
    <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4">
      <div className="bg-background-secondary rounded-2xl shadow-2xl max-w-6xl w-full max-h-[90vh] flex flex-col">
        {/* Header */}
        <div className="p-6 border-b border-border">
          <h2 className="text-2xl font-bold text-foreground mb-2">
            Review Tasks Before Creating in ClickUp
          </h2>
          <p className="text-sm text-foreground-secondary">
            Review and edit your work items. Use AI to enhance descriptions with meaningful summaries.
          </p>
          <div className="mt-3 text-xs text-foreground-tertiary">
            <span className="font-semibold">Project:</span> {projectPath} • <span className="font-semibold">Date:</span> {date}
          </div>
        </div>

        {/* Work Items List */}
        <div className="flex-1 overflow-y-auto p-6 space-y-4">
          {workItems.map((item, index) => (
            <div
              key={index}
              className="bg-background-tertiary rounded-lg border border-border p-4"
            >
              <div className="flex items-start justify-between gap-4">
                <div className="flex-1 space-y-3">
                  {/* Task Name */}
                  <div>
                    <label className="block text-xs font-semibold text-foreground-secondary mb-1">
                      Task Name
                    </label>
                    {editingIndex === index ? (
                      <input
                        type="text"
                        value={item.name}
                        onChange={(e) => handleEdit(index, 'name', e.target.value)}
                        className="w-full px-3 py-2 border border-border bg-background-secondary rounded-lg focus:ring-2 focus:ring-primary text-foreground font-medium"
                        autoFocus
                      />
                    ) : (
                      <div className="font-semibold text-lg text-foreground flex items-center gap-2">
                        {item.type === 'feature' ? '✨' : item.type === 'bug-fix' ? '🐛' : '🔧'}
                        <span>{item.name}</span>
                      </div>
                    )}
                  </div>

                  {/* Description */}
                  <div>
                    <label className="block text-xs font-semibold text-foreground-secondary mb-1">
                      Description
                    </label>
                    {editingIndex === index ? (
                      <textarea
                        value={item.description}
                        onChange={(e) => handleEdit(index, 'description', e.target.value)}
                        rows={6}
                        className="w-full px-3 py-2 border border-border bg-background-secondary rounded-lg focus:ring-2 focus:ring-primary text-foreground text-sm font-mono"
                      />
                    ) : (
                      <div className="text-sm text-foreground-secondary whitespace-pre-wrap max-h-32 overflow-y-auto border border-border rounded-lg p-3 bg-background-secondary font-mono">
                        {item.description}
                      </div>
                    )}
                  </div>

                  {/* Metadata */}
                  <div className="flex gap-4 text-xs text-foreground-tertiary">
                    <span>📁 {item.filesCount} files</span>
                    <span>💾 {item.commitsCount} commits</span>
                    <span>⏱️ {item.estimatedHours}h</span>
                    <span className={`px-2 py-0.5 rounded ${
                      item.complexity === 'high' ? 'bg-red-500/10 text-red-500' :
                      item.complexity === 'medium' ? 'bg-yellow-500/10 text-yellow-500' :
                      'bg-green-500/10 text-green-500'
                    }`}>
                      {item.complexity}
                    </span>
                  </div>
                </div>

                {/* Action Buttons */}
                <div className="flex flex-col gap-2">
                  <button
                    onClick={() => setEditingIndex(editingIndex === index ? null : index)}
                    className="px-3 py-1.5 text-sm font-medium rounded-lg bg-primary/10 text-primary hover:bg-primary/20 transition-colors"
                  >
                    {editingIndex === index ? '✅ Save' : '✏️ Edit'}
                  </button>
                  <button
                    onClick={() => handleEnhanceWithAI(index)}
                    disabled={enhancingIndex === index}
                    className="px-3 py-1.5 text-sm font-medium rounded-lg bg-secondary/10 text-secondary hover:bg-secondary/20 transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
                  >
                    {enhancingIndex === index ? '⏳' : '✨ AI'}
                  </button>
                </div>
              </div>
            </div>
          ))}
        </div>

        {/* Footer */}
        <div className="p-6 border-t border-border flex gap-3 justify-between">
          <div className="text-sm text-foreground-secondary">
            {workItems.length} task{workItems.length !== 1 ? 's' : ''} ready to create
          </div>
          <div className="flex gap-3">
            <Button
              onClick={onClose}
              variant="secondary"
              disabled={creatingTasks}
            >
              Cancel
            </Button>
            <Button
              onClick={handleCreateTasks}
              variant="primary"
              disabled={creatingTasks}
              className="min-w-[200px]"
            >
              {creatingTasks ? (
                <>
                  <LoadingSpinner size="sm" />
                  <span>Creating Tasks...</span>
                </>
              ) : (
                <>
                  <span>🚀</span>
                  <span>Create Tasks in ClickUp</span>
                </>
              )}
            </Button>
          </div>
        </div>
      </div>
    </div>
  );
}
