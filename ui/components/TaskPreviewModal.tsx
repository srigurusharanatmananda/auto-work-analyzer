'use client';

/**
 * Review-before-create, with a template picker.
 *
 * Two shapes meet here and it matters which one wins (see task-9 A2).
 *
 * The modal edits DETECTED WORK — `workAnalysis.detectedWork`, the legacy shape
 * — because that is what it is handed (ReportsTab reads it straight off
 * /api/analyze) and what it must hand back (/api/create-tasks' legacy branch is
 * the only path that writes history and marks commits processed, and it takes
 * `workAnalysis`). It deliberately does NOT adopt `src/domain/WorkItem`'s field
 * names: there would be nothing to gain but a rename and an un-rename, and
 * sending `workItems` alongside `workAnalysis` is a 400 by design (A5).
 *
 * The canonical conversion therefore happens SERVER-side. Both requests below
 * send `workAnalysis`, so `/api/preview-tasks` derives its items through
 * `workItemsFromAnalysis` — the very same adapter the create path uses. The
 * preview cannot disagree with what gets created, because neither side maps
 * anything itself.
 */

import { useEffect, useState } from 'react';
import { useAuth } from '@/lib/context/AuthContext';
import { Button, LoadingSpinner } from '@/lib/components/ui';
import toast from 'react-hot-toast';
import {
  Destination,
  DetectedWork,
  GroupingInfo,
  RenderedTaskPreview,
  StatusMapping,
  Template,
  WorkAnalysisResult,
} from '@/types';

const BACKEND_URL = 'http://localhost:3009';

/** Used until the user picks otherwise — matches the backend's own default. */
const DEFAULT_TEMPLATE_ID = 'builtin-standard';

/** Debounce on re-rendering the preview after an edit. */
const PREVIEW_DEBOUNCE_MS = 400;

/**
 * The single definition of the body both `/api/preview-tasks` and
 * `/api/create-tasks` are sent. Exported and used by ReportsTab for the create
 * request too — if the two ever built their `detectedWork` separately, the
 * preview would drift from what is created, which is the exact failure the
 * canonical pipeline exists to remove.
 *
 * `estimatedHours` and `complexity` are carried through deliberately (A3): the
 * mapping used to drop them, so a user's edits were discarded and the renderer
 * fell back to a default estimate and the lowest priority.
 */
export function workAnalysisWithEditedItems(
  base: WorkAnalysisResult,
  items: DetectedWork[]
): WorkAnalysisResult {
  return {
    ...base,
    detectedWork: items.map((item) => ({
      name: item.name,
      type: item.type,
      description: item.description,
      commits: item.commits || [],
      tags: item.tags || [],
      files: item.files || [],
      estimatedHours: item.estimatedHours,
      complexity: item.complexity,
    })),
  };
}

/**
 * Derives the `{{repository}}` placeholder value from the analysed project path.
 * Sent on BOTH requests or neither (A6) — a repository name present in the
 * preview but absent from the create call would render two different tasks.
 */
export function repositoryFromProjectPath(projectPath: string): string | undefined {
  const name = projectPath.replace(/\/+$/, '').split('/').pop();
  return name && name.length > 0 ? name : undefined;
}

interface TaskPreviewModalProps {
  workItems: DetectedWork[];
  /** The analysis the items came from; re-sent with the user's edits applied. */
  baseWorkAnalysis: WorkAnalysisResult;
  projectPath: string;
  date: string;
  onClose: () => void;
  /**
   * `destinationId` is empty when the user has no saved destinations — the
   * backend then falls back to its .env configuration, which is what every run
   * did before destinations existed.
   */
  onCreateTasks: (
    editedWorkItems: DetectedWork[],
    templateId: string,
    destinationId: string
  ) => void;
}

export default function TaskPreviewModal({
  workItems: initialWorkItems,
  baseWorkAnalysis,
  projectPath,
  date,
  onClose,
  onCreateTasks,
}: TaskPreviewModalProps) {
  const { accessToken } = useAuth();
  const [workItems, setWorkItems] = useState<DetectedWork[]>(initialWorkItems);
  const [editingIndex, setEditingIndex] = useState<number | null>(null);
  const [enhancingIndex, setEnhancingIndex] = useState<number | null>(null);
  const [creatingTasks, setCreatingTasks] = useState(false);

  const [templates, setTemplates] = useState<Template[]>([]);
  const [templateId, setTemplateId] = useState(DEFAULT_TEMPLATE_ID);
  const [destinations, setDestinations] = useState<Destination[]>([]);
  const [destinationId, setDestinationId] = useState('');
  const [rendered, setRendered] = useState<RenderedTaskPreview[]>([]);
  const [target, setTarget] = useState<{
    name: string;
    listName?: string;
    teamName?: string;
  } | null>(null);
  const [statusMapping, setStatusMapping] = useState<StatusMapping[]>([]);
  const [warnings, setWarnings] = useState<string[]>([]);
  const [grouping, setGrouping] = useState<GroupingInfo | null>(null);
  const [renderError, setRenderError] = useState<string | null>(null);
  const [rendering, setRendering] = useState(false);

  useEffect(() => {
    if (!accessToken) return;

    let cancelled = false;
    (async () => {
      try {
        const response = await fetch(`${BACKEND_URL}/api/templates`, {
          headers: { Authorization: `Bearer ${accessToken}` },
          credentials: 'include',
        });
        const result = await response.json();
        if (!cancelled && result.success) setTemplates(result.data as Template[]);
      } catch (error) {
        console.error('Failed to load templates:', error);
      }
    })();

    return () => {
      cancelled = true;
    };
  }, [accessToken]);

  // Destinations, defaulting to whichever one is marked default — the same one
  // the backend would pick for a request that names none, so the picker opens
  // showing what would happen anyway.
  useEffect(() => {
    if (!accessToken) return;

    let cancelled = false;
    (async () => {
      try {
        const response = await fetch(`${BACKEND_URL}/api/destinations`, {
          headers: { Authorization: `Bearer ${accessToken}` },
          credentials: 'include',
        });
        const result = await response.json();
        if (cancelled || !result.success) return;
        const loaded = result.data as Destination[];
        setDestinations(loaded);
        const preferred = loaded.find((entry) => entry.isDefault) ?? loaded[0];
        if (preferred) setDestinationId(preferred.id);
      } catch (error) {
        console.error('Failed to load destinations:', error);
      }
    })();

    return () => {
      cancelled = true;
    };
  }, [accessToken]);

  // Re-renders the preview whenever the template, the destination OR the items
  // change, so the pane always shows the output of the template that will
  // actually be used, against the list it will actually be written to.
  useEffect(() => {
    if (!accessToken) return;

    const timer = setTimeout(async () => {
      setRendering(true);
      try {
        const response = await fetch(`${BACKEND_URL}/api/preview-tasks`, {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            Authorization: `Bearer ${accessToken}`,
          },
          credentials: 'include',
          body: JSON.stringify({
            workAnalysis: workAnalysisWithEditedItems(baseWorkAnalysis, workItems),
            repository: repositoryFromProjectPath(projectPath),
            templateId,
            // Omitted rather than sent empty, so the backend takes its own
            // default-then-.env fallback instead of being handed "".
            ...(destinationId ? { destinationId } : {}),
          }),
        });
        const result = await response.json();

        if (result.success) {
          setRendered(result.data.items as RenderedTaskPreview[]);
          setWarnings((result.data.warnings as string[]) ?? []);
          setStatusMapping((result.data.statusMapping as StatusMapping[]) ?? []);
          // Absent unless the request supplied raw commits, which is the only
          // shape that needed grouping. This modal posts a workAnalysis, so it is
          // normally null — the badge appears only when the server actually
          // grouped something.
          setGrouping((result.data.grouping as GroupingInfo) ?? null);
          setTarget(result.data.destination ?? null);
          setRenderError(null);
        } else {
          setRendered([]);
          setWarnings([]);
          setStatusMapping([]);
          setTarget(null);
          setRenderError(
            typeof result.details === 'string'
              ? result.details
              : result.error || 'Failed to render preview'
          );
        }
      } catch (error) {
        console.error('Failed to render preview:', error);
        setRendered([]);
        setRenderError('Could not reach the backend to render a preview.');
      } finally {
        setRendering(false);
      }
    }, PREVIEW_DEBOUNCE_MS);

    return () => clearTimeout(timer);
  }, [accessToken, templateId, destinationId, workItems, baseWorkAnalysis, projectPath]);

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
      // The chosen template AND destination go out with the items — without
      // either, the pickers would restyle/retarget the preview and leave the
      // created tasks unchanged.
      onCreateTasks(workItems, templateId, destinationId);
    } catch (error) {
      console.error('Failed to create tasks:', error);
    } finally {
      setCreatingTasks(false);
    }
  };

  const selectedTemplateName =
    templates.find((template) => template.id === templateId)?.name ?? templateId;

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

          <div className="mt-4 flex flex-col sm:flex-row sm:items-end gap-3">
            <div className="flex-1">
              <label
                htmlFor="templateId"
                className="block text-xs font-semibold text-foreground-secondary mb-1"
              >
                Task template
              </label>
              <select
                id="templateId"
                value={templateId}
                onChange={(e) => setTemplateId(e.target.value)}
                className="w-full px-3 py-2 border border-border bg-background-tertiary text-foreground rounded-lg focus:outline-none focus:ring-2 focus:ring-primary"
              >
                {templates.length === 0 && (
                  <option value={DEFAULT_TEMPLATE_ID}>Standard (default)</option>
                )}
                {templates.map((template) => (
                  <option key={template.id} value={template.id}>
                    {template.name}
                    {template.isBuiltin ? ' (built-in)' : ''}
                  </option>
                ))}
              </select>
            </div>
            <div className="flex-1">
              <label
                htmlFor="destinationId"
                className="block text-xs font-semibold text-foreground-secondary mb-1"
              >
                Destination
              </label>
              <select
                id="destinationId"
                value={destinationId}
                onChange={(e) => setDestinationId(e.target.value)}
                className="w-full px-3 py-2 border border-border bg-background-tertiary text-foreground rounded-lg focus:outline-none focus:ring-2 focus:ring-primary"
              >
                <option value="">Server default (from configuration)</option>
                {destinations.map((destination) => (
                  <option key={destination.id} value={destination.id}>
                    {destination.name}
                    {destination.isDefault ? ' (default)' : ''}
                  </option>
                ))}
              </select>
            </div>
            {rendering && (
              <div className="flex items-center gap-2 text-xs text-foreground-tertiary pb-2">
                <LoadingSpinner size="sm" />
                <span>Rendering...</span>
              </div>
            )}
          </div>

          {/* Where these tasks are about to land. Unmissable on purpose: the
              whole risk of multiple destinations is creating in the wrong one. */}
          <div className="mt-3 rounded-lg border border-primary/40 bg-primary/5 p-3 text-sm text-foreground">
            <span className="font-semibold">Creating in:</span>{' '}
            {target
              ? [target.teamName, target.listName].filter(Boolean).join(' → ') || target.name
              : 'the list configured on the server'}
          </div>

          {statusMapping.length > 0 && (
            <div className="mt-3 rounded-lg border border-border bg-background-tertiary p-3">
              <p className="mb-2 text-xs font-semibold text-foreground-secondary">
                Status mapping for this list
              </p>
              <table className="w-full text-xs">
                <tbody>
                  {statusMapping.map((mapping) => (
                    <tr key={mapping.from}>
                      <td className="py-0.5 pr-3 text-foreground-secondary">{mapping.from}</td>
                      <td className="py-0.5 pr-3 text-foreground-tertiary">→</td>
                      <td className="py-0.5 text-foreground">
                        {mapping.to ?? (
                          <span className="text-warning">
                            not in this list — will use the list default
                          </span>
                        )}
                      </td>
                      <td className="py-0.5 pl-3 text-right text-foreground-tertiary">
                        {mapping.method}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}

          {grouping && (
            <div className="mt-3 rounded-lg border border-border bg-background-tertiary p-3">
              <p className="text-xs font-semibold text-foreground-secondary">
                {grouping.mode === 'ai'
                  ? '🤖 Commits grouped by AI'
                  : '🔤 Commits grouped by keyword rules'}
              </p>
              {grouping.fallbackReason && (
                <p className="mt-1 whitespace-pre-wrap break-words text-xs text-warning">
                  {/* Raw provider/validator text: rendered as escaped content, and
                      truncated because an all-providers-failed reason lists four. */}
                  AI grouping was unavailable, so keyword rules were used:{' '}
                  {grouping.fallbackReason.length > 300
                    ? `${grouping.fallbackReason.slice(0, 300)}…`
                    : grouping.fallbackReason}
                </p>
              )}
            </div>
          )}

          {warnings.length > 0 && (
            <div className="mt-3 rounded-lg border border-warning/40 bg-warning/10 p-3">
              <ul className="list-disc list-inside space-y-1 text-sm text-warning">
                {warnings.map((warning, index) => (
                  <li key={index}>{warning}</li>
                ))}
              </ul>
            </div>
          )}

          {renderError && (
            <div className="mt-3 rounded-lg border border-error/40 bg-error/10 p-3 text-sm text-error">
              {renderError}
            </div>
          )}
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

                  {/* Rendered output — what the chosen template actually produces */}
                  <div>
                    <label className="block text-xs font-semibold text-foreground-secondary mb-1">
                      Rendered by &quot;{selectedTemplateName}&quot;
                    </label>
                    {rendered[index] ? (
                      <div className="border border-primary/40 rounded-lg bg-background-secondary p-3 space-y-2">
                        <div
                          className="text-sm font-semibold text-foreground break-words"
                          data-testid={`rendered-name-${index}`}
                        >
                          {rendered[index].task.name}
                        </div>
                        <pre className="text-xs text-foreground-secondary whitespace-pre-wrap font-mono max-h-40 overflow-y-auto">
{rendered[index].task.description}
                        </pre>
                      </div>
                    ) : (
                      <div className="text-xs text-foreground-tertiary">
                        {rendering ? 'Rendering...' : 'No rendered output.'}
                      </div>
                    )}
                  </div>

                  {/* Metadata */}
                  <div className="flex gap-4 text-xs text-foreground-tertiary">
                    <span>📁 {(item.files || []).length} files</span>
                    <span>💾 {(item.commits || []).length} commits</span>
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
