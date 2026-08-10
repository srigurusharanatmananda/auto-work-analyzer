'use client';

import { useCallback, useEffect, useState } from 'react';
import { api, messageFor } from '@/lib/api';
import { Card, Button, Input, LoadingSpinner } from '@/lib/components/ui';
import toast from 'react-hot-toast';
import ProtectedRoute from '@/components/ProtectedRoute';
import type {
  Destination,
  ScanRunSummary,
  ScanSettings,
  ScannedRepo,
  SkippedDir,
  Template,
} from '@/types';

/** `GET /api/scanning/repos`. */
interface RepoListing {
  repos: ScannedRepo[];
  skipped: SkippedDir[];
}

export default function ScanningSettingsPage() {
  const [loading, setLoading] = useState(true);
  const [running, setRunning] = useState(false);
  const [settings, setSettings] = useState<ScanSettings | null>(null);
  const [repos, setRepos] = useState<ScannedRepo[]>([]);
  const [skipped, setSkipped] = useState<SkippedDir[]>([]);
  const [destinations, setDestinations] = useState<Destination[]>([]);
  const [templates, setTemplates] = useState<Template[]>([]);
  const [summary, setSummary] = useState<ScanRunSummary | null>(null);
  const [newIdentity, setNewIdentity] = useState('');

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const [loadedSettings, listing, loadedDestinations, loadedTemplates, lastRun] =
        await Promise.all([
          api.get<ScanSettings | null>('/scanning/settings'),
          api.get<RepoListing | null>('/scanning/repos'),
          api.get<Destination[]>('/destinations'),
          api.get<Template[]>('/templates'),
          api.get<{ summary?: ScanRunSummary } | null>('/scanning/last-run'),
        ]);

      setSettings(loadedSettings ?? null);
      setRepos(listing?.repos ?? []);
      setSkipped(listing?.skipped ?? []);
      setDestinations(loadedDestinations ?? []);
      setTemplates(loadedTemplates ?? []);
      // The persisted summary, so a SCHEDULED run's failures are visible without
      // re-running anything.
      setSummary(lastRun?.summary ?? null);
    } catch (caught) {
      toast.error(messageFor(caught, 'Could not load scan settings'));
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    void load();
  }, [load]);

  const saveSettings = async (patch: Partial<ScanSettings>) => {
    try {
      setSettings(await api.put<ScanSettings>('/scanning/settings', patch));
      toast.success('Saved');
    } catch (caught) {
      // Render the server's reason. Swallowing it wastes the validation.
      toast.error(messageFor(caught, 'Could not save'));
    }
  };

  const saveBinding = async (slug: string, patch: Partial<ScannedRepo>) => {
    try {
      await api.put(`/scanning/repos/${slug}`, patch);
      setRepos((current) =>
        current.map((repo) => (repo.slug === slug ? { ...repo, ...patch } : repo))
      );
    } catch (caught) {
      toast.error(messageFor(caught, 'Could not save'));
    }
  };

  const run = async (dryRun: boolean) => {
    setRunning(true);
    try {
      const result = await api.post<ScanRunSummary>('/scanning/run', { dryRun });
      setSummary(result);
      toast.success(
        dryRun
          ? 'Dry run complete — nothing was created'
          : `Created ${result.totalTasksCreated} task(s)`
      );
      await load();
    } catch (caught) {
      toast.error(messageFor(caught, 'Scan failed'));
    } finally {
      setRunning(false);
    }
  };

  return (
    <ProtectedRoute>
      <div className="mx-auto max-w-5xl p-6">
        <h1 className="mb-1 text-2xl font-bold text-foreground">Daily repo scan</h1>
        <p className="mb-6 text-sm text-foreground-secondary">
          Scans every locally-cloned repository in your organisation and creates the day&apos;s
          ClickUp tasks.
        </p>

        {loading || !settings ? (
          <LoadingSpinner />
        ) : (
          <div className="space-y-6">
            <Card className="p-6">
              <h2 className="mb-4 text-lg font-semibold text-foreground">Configuration</h2>

              <div className="space-y-4">
                <div>
                  <label className="mb-2 block text-sm font-medium text-foreground">
                    Scan root
                  </label>
                  <Input
                    value={settings.root}
                    onChange={(e) => setSettings({ ...settings, root: e.target.value })}
                    placeholder="/Users/you/Documents/GitHub"
                  />
                  <p className="mt-1 text-xs text-foreground-tertiary">
                    Searched one level deep. A repository must be cloned locally to be scanned.
                  </p>
                </div>

                <div>
                  <label className="mb-2 block text-sm font-medium text-foreground">
                    Organisation
                  </label>
                  <Input
                    value={settings.owner}
                    onChange={(e) => setSettings({ ...settings, owner: e.target.value })}
                    placeholder="kailasa-ngpt"
                  />
                  <p className="mt-1 text-xs text-foreground-tertiary">
                    Matched against each clone&apos;s git remote — no GitHub token needed.
                  </p>
                </div>

                <div>
                  <label className="mb-2 block text-sm font-medium text-foreground">
                    Scan time
                  </label>
                  <input
                    type="time"
                    value={settings.scanTime}
                    onChange={(e) => setSettings({ ...settings, scanTime: e.target.value })}
                    className="rounded-xl border border-border bg-background-tertiary px-4 py-3 text-foreground focus:outline-hidden focus:ring-2 focus:ring-primary"
                  />
                </div>

                <div>
                  <label className="mb-2 block text-sm font-medium text-foreground">
                    Your commit identities
                  </label>
                  <p className="mb-2 text-xs text-foreground-tertiary">
                    Emails or names you commit under. Add every one you use — a single identity
                    silently finds nothing in repositories where you commit as someone else.
                  </p>
                  <div className="mb-2 flex flex-wrap gap-2">
                    {(settings.authorIdentities ?? []).map((identity) => (
                      <span
                        key={identity}
                        className="inline-flex items-center gap-2 rounded-lg bg-background-tertiary px-3 py-1 text-sm text-foreground"
                      >
                        {identity}
                        <button
                          type="button"
                          onClick={() =>
                            setSettings({
                              ...settings,
                              authorIdentities: settings.authorIdentities.filter(
                                (i) => i !== identity
                              ),
                            })
                          }
                          className="text-foreground-tertiary hover:text-error"
                          aria-label={`Remove ${identity}`}
                        >
                          &times;
                        </button>
                      </span>
                    ))}
                    {(settings.authorIdentities ?? []).length === 0 && (
                      <span className="text-xs text-warning">
                        None set — every commit in every repository will be reported, not just
                        yours.
                      </span>
                    )}
                  </div>
                  <div className="flex gap-2">
                    <Input
                      value={newIdentity}
                      onChange={(e) => setNewIdentity(e.target.value)}
                      placeholder="you@example.com"
                    />
                    <Button
                      variant="secondary"
                      onClick={() => {
                        const value = newIdentity.trim();
                        if (!value) return;
                        if (settings.authorIdentities.includes(value)) {
                          setNewIdentity('');
                          return;
                        }
                        setSettings({
                          ...settings,
                          authorIdentities: [...settings.authorIdentities, value],
                        });
                        setNewIdentity('');
                      }}
                    >
                      Add
                    </Button>
                  </div>
                </div>

                <label className="flex items-center gap-3">
                  <input
                    type="checkbox"
                    checked={settings.enabled}
                    onChange={(e) => setSettings({ ...settings, enabled: e.target.checked })}
                    className="h-4 w-4"
                  />
                  <span className="text-sm text-foreground">
                    Run automatically at the scheduled time
                  </span>
                </label>
                {!settings.enabled && (
                  <p className="text-xs text-foreground-tertiary">
                    Disabled — nothing will be created automatically.
                  </p>
                )}

                <div className="flex flex-wrap gap-3 pt-2">
                  <Button
                    onClick={() =>
                      saveSettings({
                        root: settings.root,
                        owner: settings.owner,
                        scanTime: settings.scanTime,
                        enabled: settings.enabled,
                        authorIdentities: settings.authorIdentities,
                      })
                    }
                  >
                    Save settings
                  </Button>
                  <Button variant="secondary" onClick={() => run(true)} disabled={running}>
                    {running ? <LoadingSpinner size="sm" /> : 'Dry run'}
                  </Button>
                  <Button variant="secondary" onClick={() => run(false)} disabled={running}>
                    {running ? <LoadingSpinner size="sm" /> : 'Run now'}
                  </Button>
                </div>
                <p className="text-xs text-foreground-tertiary">
                  A dry run reports exactly what it would create and writes nothing.
                </p>
              </div>
            </Card>

            <Card className="p-6">
              <h2 className="mb-4 text-lg font-semibold text-foreground">
                Repositories ({repos.length})
              </h2>

              {repos.length === 0 ? (
                <p className="text-sm text-foreground-secondary">
                  No repositories found under {settings.root} for {settings.owner}.
                </p>
              ) : (
                <div className="overflow-x-auto">
                  <table className="w-full text-sm">
                    <thead>
                      <tr className="text-left text-xs uppercase text-foreground-tertiary">
                        <th className="pb-2 pr-4">On</th>
                        <th className="pb-2 pr-4">Repository</th>
                        <th className="pb-2 pr-4">Destination</th>
                        <th className="pb-2 pr-4">Template</th>
                        <th className="pb-2">Last scanned</th>
                      </tr>
                    </thead>
                    <tbody>
                      {repos.map((repo) => (
                        <tr key={repo.path} className="border-t border-border">
                          <td className="py-2 pr-4">
                            <input
                              type="checkbox"
                              checked={repo.enabled}
                              onChange={(e) =>
                                saveBinding(repo.slug, { enabled: e.target.checked })
                              }
                              className="h-4 w-4"
                              aria-label={`Scan ${repo.slug}`}
                            />
                          </td>
                          <td className="py-2 pr-4">
                            <div className="font-medium text-foreground">{repo.slug}</div>
                            {/*
                              The directory, because the same repository can be
                              cloned twice under different names. Without this the
                              two rows are indistinguishable — and they share one
                              binding, since bindings are keyed by slug.
                            */}
                            <div className="text-xs text-foreground-tertiary">
                              {repo.path.split('/').pop()}
                            </div>
                          </td>
                          <td className="py-2 pr-4">
                            <select
                              value={repo.destinationId ?? ''}
                              onChange={(e) =>
                                saveBinding(repo.slug, {
                                  destinationId: e.target.value || null,
                                })
                              }
                              className="rounded-lg border border-border bg-background-tertiary px-2 py-1 text-foreground"
                            >
                              <option value="">Default destination</option>
                              {destinations.map((destination) => (
                                <option key={destination.id} value={destination.id}>
                                  {destination.name}
                                </option>
                              ))}
                            </select>
                          </td>
                          <td className="py-2 pr-4">
                            <select
                              value={repo.templateId ?? ''}
                              onChange={(e) =>
                                saveBinding(repo.slug, { templateId: e.target.value || null })
                              }
                              className="rounded-lg border border-border bg-background-tertiary px-2 py-1 text-foreground"
                            >
                              <option value="">Destination default</option>
                              {templates.map((template) => (
                                <option key={template.id} value={template.id}>
                                  {template.name}
                                </option>
                              ))}
                            </select>
                          </td>
                          <td className="py-2 text-foreground-secondary">
                            {repo.lastScannedDate ?? 'never'}
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              )}

              {skipped.length > 0 && (
                <div className="mt-4 rounded-lg border border-border bg-background-tertiary p-3">
                  <p className="mb-2 text-xs font-semibold text-foreground-secondary">
                    Skipped directories
                  </p>
                  <ul className="space-y-1 text-xs text-foreground-tertiary">
                    {skipped.map((dir) => (
                      <li key={dir.path}>
                        <span className="text-foreground-secondary">
                          {dir.path.split('/').pop()}
                        </span>{' '}
                        — {dir.reason}
                      </li>
                    ))}
                  </ul>
                </div>
              )}
            </Card>

            {summary && (
              <Card className="p-6">
                <h2 className="mb-1 text-lg font-semibold text-foreground">
                  {summary.dryRun ? 'Dry run' : 'Last run'} — {summary.date}
                </h2>
                <p className="mb-4 text-sm text-foreground-secondary">
                  {summary.dryRun
                    ? 'Nothing was created.'
                    : `${summary.totalTasksCreated} task(s) created across ${summary.repos.length} repository(ies).`}
                </p>

                <div className="space-y-3">
                  {(summary.repos ?? []).map((repo) => (
                    <div
                      key={repo.path}
                      className="rounded-lg border border-border bg-background-tertiary p-3"
                    >
                      <div className="flex flex-wrap items-baseline justify-between gap-2">
                        <span className="font-medium text-foreground">{repo.slug}</span>
                        <span className="text-xs text-foreground-tertiary">
                          {repo.commits} commit(s) → {repo.workItems} item(s)
                          {summary.dryRun ? '' : ` → ${repo.tasksCreated} task(s)`}
                          {repo.destination ? ` · ${repo.destination}` : ''}
                        </span>
                      </div>

                      {repo.fetchFailed && (
                        <p className="mt-1 text-xs text-warning">
                          Fetch failed, scanned local history only: {repo.fetchFailed}
                        </p>
                      )}
                      {repo.analyzeTimedOut && (
                        <p className="mt-1 text-xs text-error">
                          Skipped — took too long to analyze: {repo.analyzeTimedOut}
                        </p>
                      )}
                      {repo.error && <p className="mt-1 text-xs text-error">{repo.error}</p>}

                      {(repo.wouldCreate ?? []).length > 0 && (
                        <ul className="mt-2 list-inside list-disc space-y-1 text-xs text-foreground-secondary">
                          {repo.wouldCreate!.map((task, index) => (
                            <li key={index}>{task.name}</li>
                          ))}
                        </ul>
                      )}
                    </div>
                  ))}
                  {(summary.repos ?? []).length === 0 && (
                    <p className="text-sm text-foreground-tertiary">
                      No repositories produced any work for this date.
                    </p>
                  )}
                </div>
              </Card>
            )}
          </div>
        )}
      </div>
    </ProtectedRoute>
  );
}
