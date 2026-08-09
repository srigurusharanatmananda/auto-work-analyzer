'use client';

/**
 * Task template management.
 *
 * Two things here are load-bearing and easy to undo by accident:
 *
 * 1. The placeholder reference panel is FETCHED from `GET /api/templates/schema`,
 *    never hardcoded. The backend owns the vocabulary; a local copy would keep
 *    advertising placeholders that save-time validation has started rejecting.
 * 2. `POST /api/templates/preview` renders an UNSAVED draft. That is the whole
 *    reason the endpoint accepts a body instead of an id — the user sees the
 *    rendered output before committing to saving it.
 */

import { useCallback, useEffect, useState } from 'react';
import Link from 'next/link';
import { api, ApiError, messageFor } from '@/lib/api';
import { Card, Button, Input, LoadingSpinner } from '@/lib/components/ui';
import toast from 'react-hot-toast';
import ProtectedRoute from '@/components/ProtectedRoute';
import {
  DEFAULT_TEMPLATE_OPTIONS,
  PlaceholderSchema,
  RenderedTaskPreview,
  Template,
  TemplateOptions,
} from '@/types';

/** How long to wait after a keystroke before re-rendering the live preview. */
const PREVIEW_DEBOUNCE_MS = 500;

interface Draft {
  id: string;
  name: string;
  description: string;
  nameTemplate: string;
  descriptionTemplate: string;
  options: TemplateOptions;
}

function toDraft(template: Template): Draft {
  return {
    id: template.id,
    name: template.name,
    description: template.description ?? '',
    nameTemplate: template.nameTemplate,
    descriptionTemplate: template.descriptionTemplate,
    options: { ...DEFAULT_TEMPLATE_OPTIONS, ...template.options },
  };
}

export default function TemplatesSettingsPage() {
  const [templates, setTemplates] = useState<Template[]>([]);
  const [schema, setSchema] = useState<PlaceholderSchema | null>(null);
  const [loading, setLoading] = useState(true);
  const [draft, setDraft] = useState<Draft | null>(null);
  const [saving, setSaving] = useState(false);
  const [duplicatingId, setDuplicatingId] = useState<string | null>(null);
  // In-page confirmation, not window.confirm — a native dialog blocks the page
  // (and any automation driving it) until it is dismissed.
  const [pendingDeleteId, setPendingDeleteId] = useState<string | null>(null);
  const [validationErrors, setValidationErrors] = useState<string[]>([]);

  const [preview, setPreview] = useState<{ name: string; description: string } | null>(null);
  const [previewErrors, setPreviewErrors] = useState<string[]>([]);
  const [previewing, setPreviewing] = useState(false);

  const loadTemplates = useCallback(async () => {
    try {
      setTemplates(await api.get<Template[]>('/templates'));
    } catch (caught) {
      toast.error(messageFor(caught, 'Failed to load templates'));
    }
  }, []);

  const loadSchema = useCallback(async () => {
    try {
      setSchema(await api.get<PlaceholderSchema>('/templates/schema'));
    } catch (error) {
      // Only costs the placeholder reference panel.
      console.error('Failed to load placeholder schema:', error);
    }
  }, []);

  useEffect(() => {
    setLoading(true);
    Promise.all([loadTemplates(), loadSchema()]).finally(() => setLoading(false));
  }, [loadTemplates, loadSchema]);

  // Live preview. Debounced so a typed template does not fire a request per
  // keystroke, and re-run on `options` too — dueDateSource/statusMode/tags all
  // change the rendered task even though they are not in either textarea.
  useEffect(() => {
    if (!draft) {
      setPreview(null);
      setPreviewErrors([]);
      return;
    }

    const timer = setTimeout(async () => {
      setPreviewing(true);
      try {
        const rendered = await api.post<{ items: RenderedTaskPreview[] }>('/templates/preview', {
          nameTemplate: draft.nameTemplate,
          descriptionTemplate: draft.descriptionTemplate,
          options: draft.options,
        });

        const first = rendered.items[0];
        setPreview(first ? { name: first.task.name, description: first.task.description } : null);
        setPreviewErrors([]);
      } catch (caught) {
        setPreview(null);
        setPreviewErrors(detailsToLines(caught));
      } finally {
        setPreviewing(false);
      }
    }, PREVIEW_DEBOUNCE_MS);

    return () => clearTimeout(timer);
  }, [draft]);

  const updateDraft = (patch: Partial<Draft>) => {
    setDraft((current) => (current ? { ...current, ...patch } : current));
  };

  const updateOptions = (patch: Partial<TemplateOptions>) => {
    setDraft((current) =>
      current ? { ...current, options: { ...current.options, ...patch } } : current
    );
  };

  const handleDuplicate = async (template: Template) => {
    setDuplicatingId(template.id);
    const toastId = toast.loading(`Duplicating "${template.name}"...`);
    try {
      const copy = await api.post<Template>('/templates', {
        name: `${template.name} (copy)`,
        description: template.description,
        nameTemplate: template.nameTemplate,
        descriptionTemplate: template.descriptionTemplate,
        options: template.options,
      });

      toast.success('Duplicated — now editable', { id: toastId });
      await loadTemplates();
      setValidationErrors([]);
      setDraft(toDraft(copy));
    } catch (caught) {
      toast.error(messageFor(caught, 'Failed to duplicate template'), { id: toastId });
      setValidationErrors(detailsToLines(caught));
    } finally {
      setDuplicatingId(null);
    }
  };

  const handleSave = async () => {
    if (!draft) return;

    setSaving(true);
    setValidationErrors([]);
    const toastId = toast.loading('Saving template...');
    try {
      await api.put(`/templates/${draft.id}`, {
        name: draft.name,
        description: draft.description,
        nameTemplate: draft.nameTemplate,
        descriptionTemplate: draft.descriptionTemplate,
        options: draft.options,
      });

      toast.success('Template saved', { id: toastId });
      await loadTemplates();
    } catch (caught) {
      // `details` is the array of named validation failures. Rendering it is
      // the entire point of save-time validation — a bare "Invalid template"
      // tells the user nothing about which placeholder is wrong.
      const lines = detailsToLines(caught);
      setValidationErrors(lines);
      toast.error(messageFor(caught, 'Failed to save template'), { id: toastId });
      lines.forEach((line) => toast.error(line, { duration: 6000 }));
    } finally {
      setSaving(false);
    }
  };

  const handleDelete = async (template: Template) => {
    const toastId = toast.loading(`Deleting "${template.name}"...`);
    try {
      await api.delete(`/templates/${template.id}`);
      toast.success('Template deleted', { id: toastId });
      setPendingDeleteId(null);
      if (draft?.id === template.id) setDraft(null);
      await loadTemplates();
    } catch (caught) {
      toast.error(messageFor(caught, 'Failed to delete template'), { id: toastId });
    }
  };

  if (loading) {
    return (
      <ProtectedRoute>
        <div className="flex items-center justify-center min-h-screen">
          <LoadingSpinner size="lg" />
        </div>
      </ProtectedRoute>
    );
  }

  const builtins = templates.filter((template) => template.isBuiltin);
  const userTemplates = templates.filter((template) => !template.isBuiltin);

  return (
    <ProtectedRoute>
      <div className="p-8">
        <div className="mb-6">
          <Link
            href="/settings"
            className="text-sm text-foreground-secondary hover:text-foreground transition-colors"
          >
            ← Back to Settings
          </Link>
          <h1 className="mt-2 text-3xl font-bold text-foreground">Task Templates</h1>
          <p className="mt-2 text-foreground-secondary">
            Control how work items are turned into ClickUp task names and descriptions.
          </p>
        </div>

        <div className="grid grid-cols-1 xl:grid-cols-2 gap-6 max-w-7xl">
          <div className="space-y-6">
            <Card className="p-6">
              <h2 className="mb-1 text-xl font-semibold text-foreground">Built-in templates</h2>
              <p className="mb-4 text-sm text-foreground-tertiary">
                Read-only. Duplicate one to make an editable copy.
              </p>
              <div className="space-y-3">
                {builtins.map((template) => (
                  <TemplateRow
                    key={template.id}
                    template={template}
                    duplicating={duplicatingId === template.id}
                    onDuplicate={() => handleDuplicate(template)}
                  />
                ))}
                {builtins.length === 0 && (
                  <p className="text-sm text-foreground-tertiary">No built-in templates found.</p>
                )}
              </div>
            </Card>

            <Card className="p-6">
              <h2 className="mb-1 text-xl font-semibold text-foreground">Your templates</h2>
              <p className="mb-4 text-sm text-foreground-tertiary">
                {userTemplates.length === 0
                  ? 'You have no templates yet — duplicate a built-in to start.'
                  : 'Editable and deletable.'}
              </p>
              <div className="space-y-3">
                {userTemplates.map((template) => (
                  <TemplateRow
                    key={template.id}
                    template={template}
                    editing={draft?.id === template.id}
                    duplicating={duplicatingId === template.id}
                    confirmingDelete={pendingDeleteId === template.id}
                    onDuplicate={() => handleDuplicate(template)}
                    onEdit={() => {
                      setValidationErrors([]);
                      setDraft(toDraft(template));
                    }}
                    onRequestDelete={() => setPendingDeleteId(template.id)}
                    onCancelDelete={() => setPendingDeleteId(null)}
                    onConfirmDelete={() => handleDelete(template)}
                  />
                ))}
              </div>
            </Card>

            <PlaceholderReference schema={schema} />
          </div>

          <div className="space-y-6">
            {draft ? (
              <>
                <Card className="p-6">
                  <div className="flex items-start justify-between gap-4 mb-4">
                    <h2 className="text-xl font-semibold text-foreground">Edit template</h2>
                    <Button variant="ghost" size="sm" onClick={() => setDraft(null)}>
                      Close
                    </Button>
                  </div>

                  <div className="space-y-4">
                    <Input
                      label="Template name"
                      value={draft.name}
                      onChange={(e) => updateDraft({ name: e.target.value })}
                      placeholder="My template"
                    />
                    <Input
                      label="Description (optional)"
                      value={draft.description}
                      onChange={(e) => updateDraft({ description: e.target.value })}
                      placeholder="What this template is for"
                    />

                    <div>
                      <label
                        htmlFor="nameTemplate"
                        className="block text-sm font-medium text-foreground mb-2"
                      >
                        Task name template
                      </label>
                      <textarea
                        id="nameTemplate"
                        value={draft.nameTemplate}
                        onChange={(e) => updateDraft({ nameTemplate: e.target.value })}
                        rows={2}
                        spellCheck={false}
                        className="w-full px-3 py-2 border border-border bg-background-tertiary text-foreground rounded-xl font-mono text-sm focus:outline-hidden focus:ring-2 focus:ring-primary placeholder:text-foreground-tertiary"
                        placeholder="{{typeEmoji}} {{title}}"
                      />
                    </div>

                    <div>
                      <label
                        htmlFor="descriptionTemplate"
                        className="block text-sm font-medium text-foreground mb-2"
                      >
                        Task description template
                      </label>
                      <textarea
                        id="descriptionTemplate"
                        value={draft.descriptionTemplate}
                        onChange={(e) => updateDraft({ descriptionTemplate: e.target.value })}
                        rows={12}
                        spellCheck={false}
                        className="w-full px-3 py-2 border border-border bg-background-tertiary text-foreground rounded-xl font-mono text-sm focus:outline-hidden focus:ring-2 focus:ring-primary placeholder:text-foreground-tertiary"
                        placeholder="{{description}}"
                      />
                    </div>
                  </div>
                </Card>

                <Card className="p-6">
                  <h2 className="mb-4 text-xl font-semibold text-foreground">Options</h2>
                  <div className="space-y-4">
                    <CheckboxRow
                      id="emitSubtasks"
                      label="Emit subtasks for sub-items"
                      checked={draft.options.emitSubtasks}
                      onChange={(emitSubtasks) => updateOptions({ emitSubtasks })}
                    />
                    <CheckboxRow
                      id="applyPriority"
                      label="Apply priority to the created task"
                      checked={draft.options.applyPriority}
                      onChange={(applyPriority) => updateOptions({ applyPriority })}
                    />
                    <CheckboxRow
                      id="applyTimeEstimate"
                      label="Apply the time estimate"
                      checked={draft.options.applyTimeEstimate}
                      onChange={(applyTimeEstimate) => updateOptions({ applyTimeEstimate })}
                    />

                    <SelectRow
                      id="dueDateSource"
                      label="Due date source"
                      value={draft.options.dueDateSource}
                      options={[
                        ['completedDate', 'Completed date'],
                        ['lastCommitDate', 'Last commit date'],
                        ['none', 'No due date'],
                      ]}
                      onChange={(value) =>
                        updateOptions({ dueDateSource: value as TemplateOptions['dueDateSource'] })
                      }
                    />

                    <SelectRow
                      id="startDateSource"
                      label="Start date source"
                      hint="ClickUp only shows a task on the Timeline, Gantt and Workload views when it has a start date as well as a due date."
                      value={draft.options.startDateSource}
                      options={[
                        ['firstCommitDate', 'First commit date (falls back to the due date)'],
                        ['matchDueDate', 'Same as the due date (one-day bar)'],
                        ['none', 'No start date — leaves the task unscheduled'],
                      ]}
                      onChange={(value) =>
                        updateOptions({
                          startDateSource: value as TemplateOptions['startDateSource'],
                        })
                      }
                    />

                    <SelectRow
                      id="statusMode"
                      label="Status"
                      value={draft.options.statusMode}
                      options={[
                        ['fromWorkItem', "From the work item's own status"],
                        ['destinationDefault', "Leave the destination's default"],
                        ['fixed', 'Always a fixed status'],
                      ]}
                      onChange={(value) =>
                        updateOptions({ statusMode: value as TemplateOptions['statusMode'] })
                      }
                    />
                    {draft.options.statusMode === 'fixed' && (
                      <Input
                        label="Fixed status"
                        value={draft.options.fixedStatus ?? ''}
                        onChange={(e) => updateOptions({ fixedStatus: e.target.value })}
                        placeholder="complete"
                      />
                    )}

                    <SelectRow
                      id="tagMode"
                      label="Tags"
                      value={draft.options.tagStrategy.mode}
                      options={[
                        ['fromWorkItem', "From the work item's own tags"],
                        ['none', 'No tags'],
                        ['fixed', 'Only a fixed set'],
                        ['merge', "Fixed set merged with the work item's"],
                      ]}
                      onChange={(value) =>
                        updateOptions({
                          tagStrategy: {
                            ...draft.options.tagStrategy,
                            mode: value as TemplateOptions['tagStrategy']['mode'],
                          },
                        })
                      }
                    />
                    {(draft.options.tagStrategy.mode === 'fixed' ||
                      draft.options.tagStrategy.mode === 'merge') && (
                      <Input
                        label="Fixed tags (comma separated)"
                        value={(draft.options.tagStrategy.fixed ?? []).join(', ')}
                        onChange={(e) =>
                          updateOptions({
                            tagStrategy: {
                              ...draft.options.tagStrategy,
                              fixed: e.target.value
                                .split(',')
                                .map((tag) => tag.trim())
                                .filter((tag) => tag.length > 0),
                            },
                          })
                        }
                        placeholder="git-analyzed, eod"
                      />
                    )}
                  </div>
                </Card>

                <Card className="p-6">
                  <div className="flex items-center justify-between gap-4 mb-3">
                    <h2 className="text-xl font-semibold text-foreground">Live preview</h2>
                    {previewing && <LoadingSpinner size="sm" />}
                  </div>
                  <p className="mb-4 text-xs text-foreground-tertiary">
                    Rendered against a representative work item, before saving.
                  </p>

                  {previewErrors.length > 0 ? (
                    <ErrorList title="This template will not render" lines={previewErrors} />
                  ) : preview ? (
                    <div className="space-y-3">
                      <div>
                        <div className="text-xs font-semibold text-foreground-secondary mb-1">
                          Task name
                        </div>
                        <div className="px-3 py-2 rounded-lg border border-border bg-background-tertiary text-foreground font-medium wrap-break-word">
                          {preview.name}
                        </div>
                      </div>
                      <div>
                        <div className="text-xs font-semibold text-foreground-secondary mb-1">
                          Task description
                        </div>
                        <pre className="px-3 py-2 rounded-lg border border-border bg-background-tertiary text-foreground-secondary text-sm font-mono whitespace-pre-wrap max-h-80 overflow-y-auto">
{preview.description}
                        </pre>
                      </div>
                    </div>
                  ) : (
                    <p className="text-sm text-foreground-tertiary">Nothing to preview yet.</p>
                  )}
                </Card>

                {validationErrors.length > 0 && (
                  <ErrorList title="Save rejected" lines={validationErrors} />
                )}

                <div className="flex justify-end gap-3">
                  <Button variant="secondary" onClick={() => setDraft(null)} disabled={saving}>
                    Cancel
                  </Button>
                  <Button
                    variant="primary"
                    onClick={handleSave}
                    disabled={saving}
                    className="min-w-[150px]"
                  >
                    {saving ? (
                      <>
                        <LoadingSpinner size="sm" />
                        <span>Saving...</span>
                      </>
                    ) : (
                      <span>Save Template</span>
                    )}
                  </Button>
                </div>
              </>
            ) : (
              <Card className="p-6">
                <h2 className="mb-2 text-xl font-semibold text-foreground">No template open</h2>
                <p className="text-sm text-foreground-secondary">
                  Pick one of your templates to edit, or duplicate a built-in to get an editable
                  copy. Built-ins themselves cannot be changed.
                </p>
              </Card>
            )}
          </div>
        </div>
      </div>
    </ProtectedRoute>
  );
}

/**
 * A 400 from the template routes carries `details`: an array of named validation
 * errors for create/update, or a single message string for a render failure.
 * Normalising both to lines means neither is swallowed.
 *
 * Takes the thrown value rather than a response body, because `ApiClient` turns
 * a failed envelope into an `ApiError` that carries `details` through.
 */
function detailsToLines(error: unknown): string[] {
  if (error instanceof ApiError) {
    if (Array.isArray(error.details)) return error.details.map(String);
    if (typeof error.details === 'string') return [error.details];
  }
  return [messageFor(error, 'Unknown error')];
}

function ErrorList({ title, lines }: { title: string; lines: string[] }) {
  return (
    <div className="rounded-lg border border-error/40 bg-error/10 p-4">
      <div className="text-sm font-semibold text-error mb-2">{title}</div>
      <ul className="list-disc list-inside space-y-1 text-sm text-error">
        {lines.map((line, index) => (
          <li key={index}>{line}</li>
        ))}
      </ul>
    </div>
  );
}

function TemplateRow({
  template,
  editing,
  duplicating,
  confirmingDelete,
  onDuplicate,
  onEdit,
  onRequestDelete,
  onCancelDelete,
  onConfirmDelete,
}: {
  template: Template;
  editing?: boolean;
  duplicating?: boolean;
  confirmingDelete?: boolean;
  onDuplicate: () => void;
  onEdit?: () => void;
  onRequestDelete?: () => void;
  onCancelDelete?: () => void;
  onConfirmDelete?: () => void;
}) {
  return (
    <div
      className={`rounded-lg border p-4 bg-background-tertiary ${
        editing ? 'border-primary' : 'border-border'
      }`}
    >
      <div className="flex items-start justify-between gap-4">
        <div className="min-w-0">
          <div className="flex items-center gap-2 flex-wrap">
            <span className="font-semibold text-foreground">{template.name}</span>
            {template.isBuiltin && (
              <span className="px-2 py-0.5 text-xs font-medium rounded-full bg-foreground/10 text-foreground-secondary">
                Built-in · read-only
              </span>
            )}
          </div>
          {template.description && (
            <p className="mt-1 text-sm text-foreground-secondary">{template.description}</p>
          )}
          <code className="mt-2 block text-xs text-foreground-tertiary font-mono break-all">
            {template.nameTemplate}
          </code>
        </div>

        <div className="flex flex-col gap-2 shrink-0">
          <Button variant="secondary" size="sm" onClick={onDuplicate} disabled={duplicating}>
            {duplicating ? 'Copying...' : 'Duplicate'}
          </Button>
          {onEdit && (
            <Button variant="secondary" size="sm" onClick={onEdit}>
              {editing ? 'Editing' : 'Edit'}
            </Button>
          )}
          {onRequestDelete && !confirmingDelete && (
            <Button variant="danger" size="sm" onClick={onRequestDelete}>
              Delete
            </Button>
          )}
        </div>
      </div>

      {confirmingDelete && (
        <div className="mt-3 rounded-lg border border-error/40 bg-error/10 p-3">
          <p className="text-sm text-error mb-2">
            Delete &quot;{template.name}&quot;? This cannot be undone.
          </p>
          <div className="flex gap-2">
            <Button variant="danger" size="sm" onClick={onConfirmDelete}>
              Yes, delete it
            </Button>
            <Button variant="secondary" size="sm" onClick={onCancelDelete}>
              Keep it
            </Button>
          </div>
        </div>
      )}
    </div>
  );
}

function CheckboxRow({
  id,
  label,
  checked,
  onChange,
}: {
  id: string;
  label: string;
  checked: boolean;
  onChange: (checked: boolean) => void;
}) {
  return (
    <div className="flex items-center gap-3">
      <input
        id={id}
        type="checkbox"
        checked={checked}
        onChange={(e) => onChange(e.target.checked)}
        className="w-5 h-5 accent-primary rounded-sm"
      />
      <label htmlFor={id} className="text-sm font-medium text-foreground cursor-pointer">
        {label}
      </label>
    </div>
  );
}

function SelectRow({
  id,
  label,
  hint,
  value,
  options,
  onChange,
}: {
  id: string;
  label: string;
  /** Optional one-liner for options whose consequence is not self-evident. */
  hint?: string;
  value: string;
  options: Array<[string, string]>;
  onChange: (value: string) => void;
}) {
  return (
    <div>
      <label htmlFor={id} className="block text-sm font-medium text-foreground mb-2">
        {label}
      </label>
      {hint && <p className="text-xs text-foreground-tertiary mb-2 -mt-1">{hint}</p>}
      <select
        id={id}
        value={value}
        onChange={(e) => onChange(e.target.value)}
        className="w-full px-3 py-2 border border-border bg-background-tertiary text-foreground rounded-xl focus:outline-hidden focus:ring-2 focus:ring-primary"
      >
        {options.map(([optionValue, optionLabel]) => (
          <option key={optionValue} value={optionValue}>
            {optionLabel}
          </option>
        ))}
      </select>
    </div>
  );
}

/**
 * The legal `{{placeholders}}`, straight from the backend. Users cannot guess
 * these, and an out-of-vocabulary one is rejected at save time — so this panel
 * has to be right, which is exactly why it is not a local copy.
 */
function PlaceholderReference({ schema }: { schema: PlaceholderSchema | null }) {
  if (!schema) {
    return (
      <Card className="p-6">
        <h2 className="mb-2 text-xl font-semibold text-foreground">Placeholders</h2>
        <p className="text-sm text-foreground-tertiary">
          Could not load the placeholder reference from the backend.
        </p>
      </Card>
    );
  }

  return (
    <Card className="p-6">
      <h2 className="mb-1 text-xl font-semibold text-foreground">Placeholders</h2>
      <p className="mb-4 text-xs text-foreground-tertiary">
        Anything not listed here is rejected when you save.
      </p>

      <div className="mb-4">
        <div className="text-sm font-semibold text-foreground-secondary mb-2">Values</div>
        <div className="flex flex-wrap gap-2">
          {schema.scalars.map((scalar) => (
            <code
              key={scalar}
              className="px-2 py-1 rounded-sm bg-background-tertiary border border-border text-xs font-mono text-foreground"
            >
              {`{{${scalar}}}`}
            </code>
          ))}
        </div>
      </div>

      <div>
        <div className="text-sm font-semibold text-foreground-secondary mb-2">
          Sections (repeat a block)
        </div>
        <div className="space-y-3">
          {Object.keys(schema.sections).map((section) => (
            <div key={section}>
              <code className="text-xs font-mono text-foreground">
                {`{{#${section}}} ... {{/${section}}}`}
              </code>
              <div className="mt-1 flex flex-wrap gap-2">
                {schema.sections[section].scalars.map((scalar) => (
                  <code
                    key={scalar}
                    className="px-2 py-0.5 rounded-sm bg-background-tertiary border border-border text-xs font-mono text-foreground-secondary"
                  >
                    {scalar === '.' ? '{{.}}' : `{{${scalar}}}`}
                  </code>
                ))}
              </div>
            </div>
          ))}
        </div>
      </div>
    </Card>
  );
}
