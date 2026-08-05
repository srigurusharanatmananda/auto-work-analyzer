'use client';

/**
 * ClickUp destination management.
 *
 * Two things here are load-bearing:
 *
 * 1. The hierarchy is walked with the API key the user has just TYPED, before
 *    any destination exists to hold it — that is why the browse endpoints take a
 *    raw `apiKey` and are POSTs (a key in a query string lands in access logs).
 * 2. The list step offers both a folder's lists AND a space's folderless lists.
 *    ClickUp allows lists directly under a space, and a folder-only picker
 *    silently hides them — the user just never finds their list.
 *
 * Display names are captured alongside every id as it is chosen. The API stores
 * them, and they are the only thing that makes a saved row readable: an id tells
 * you nothing about where tasks are going.
 */

import { useCallback, useEffect, useState } from 'react';
import Link from 'next/link';
import { useAuth } from '@/lib/context/AuthContext';
import { Card, Button, Input, LoadingSpinner } from '@/lib/components/ui';
import toast from 'react-hot-toast';
import ProtectedRoute from '@/components/ProtectedRoute';
import { ClickUpNode, Destination, Template } from '@/types';

const BACKEND_URL = 'http://localhost:3009';

/** The value the folder `<select>` uses for "no folder — a list under the space". */
const NO_FOLDER = '__none__';

type Step = 'key' | 'team' | 'space' | 'folder' | 'list' | 'name';

interface Draft {
  apiKey: string;
  teamId: string;
  teamName: string;
  spaceId: string;
  spaceName: string;
  /** Empty string means the user chose "no folder". */
  folderId: string;
  folderName: string;
  listId: string;
  listName: string;
  name: string;
  defaultTemplateId: string;
}

const EMPTY_DRAFT: Draft = {
  apiKey: '',
  teamId: '',
  teamName: '',
  spaceId: '',
  spaceName: '',
  folderId: '',
  folderName: '',
  listId: '',
  listName: '',
  name: '',
  defaultTemplateId: '',
};

function pathOf(destination: Destination): string {
  return [
    destination.teamName ?? destination.teamId,
    destination.spaceName ?? destination.spaceId,
    destination.folderName ?? destination.folderId,
    destination.listName ?? destination.listId,
  ]
    .filter(Boolean)
    .join(' → ');
}

export default function DestinationsSettingsPage() {
  const { accessToken } = useAuth();

  const [destinations, setDestinations] = useState<Destination[]>([]);
  const [templates, setTemplates] = useState<Template[]>([]);
  const [loading, setLoading] = useState(true);
  const [busyId, setBusyId] = useState<string | null>(null);
  // In-page confirmation rather than window.confirm, which blocks the page (and
  // anything driving it) until dismissed.
  const [pendingDeleteId, setPendingDeleteId] = useState<string | null>(null);

  const [adding, setAdding] = useState(false);
  const [step, setStep] = useState<Step>('key');
  const [draft, setDraft] = useState<Draft>(EMPTY_DRAFT);
  const [teams, setTeams] = useState<ClickUpNode[]>([]);
  const [spaces, setSpaces] = useState<ClickUpNode[]>([]);
  const [folders, setFolders] = useState<ClickUpNode[]>([]);
  const [lists, setLists] = useState<ClickUpNode[]>([]);
  const [browsing, setBrowsing] = useState(false);
  const [saving, setSaving] = useState(false);
  const [pastedUrl, setPastedUrl] = useState('');
  const [resolvingUrl, setResolvingUrl] = useState(false);

  const authHeaders = useCallback(
    (json = false): HeadersInit => ({
      ...(json ? { 'Content-Type': 'application/json' } : {}),
      Authorization: `Bearer ${accessToken}`,
    }),
    [accessToken]
  );

  const loadDestinations = useCallback(async () => {
    if (!accessToken) return;
    try {
      const response = await fetch(`${BACKEND_URL}/api/destinations`, {
        headers: authHeaders(),
        credentials: 'include',
      });
      const result = await response.json();
      if (result.success) setDestinations(result.data as Destination[]);
      else toast.error(result.error || 'Failed to load destinations');
    } catch {
      toast.error('Could not reach the backend to load destinations.');
    } finally {
      setLoading(false);
    }
  }, [accessToken, authHeaders]);

  useEffect(() => {
    loadDestinations();
  }, [loadDestinations]);

  useEffect(() => {
    if (!accessToken) return;
    let cancelled = false;
    (async () => {
      try {
        const response = await fetch(`${BACKEND_URL}/api/templates`, {
          headers: authHeaders(),
          credentials: 'include',
        });
        const result = await response.json();
        if (!cancelled && result.success) setTemplates(result.data as Template[]);
      } catch {
        // A missing template list only costs the optional default-template
        // picker; it must not block destination management.
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [accessToken, authHeaders]);

  /** Every browse call shares this shape; `body` carries whatever the step knows. */
  const browse = async (
    endpoint: string,
    body: Record<string, string | undefined>
  ): Promise<ClickUpNode[] | null> => {
    setBrowsing(true);
    try {
      const response = await fetch(`${BACKEND_URL}/api/clickup/${endpoint}`, {
        method: 'POST',
        headers: authHeaders(true),
        credentials: 'include',
        body: JSON.stringify({ apiKey: draft.apiKey, ...body }),
      });
      const result = await response.json();
      if (!result.success) {
        toast.error(result.error || 'ClickUp request failed');
        return null;
      }
      return result.data as ClickUpNode[];
    } catch {
      toast.error('Could not reach the backend.');
      return null;
    } finally {
      setBrowsing(false);
    }
  };

  const startAdding = () => {
    setDraft(EMPTY_DRAFT);
    setTeams([]);
    setSpaces([]);
    setFolders([]);
    setLists([]);
    setStep('key');
    setAdding(true);
  };

  const useKey = async () => {
    if (!draft.apiKey.trim()) {
      toast.error('Paste a ClickUp API key first');
      return;
    }
    const found = await browse('teams', {});
    if (!found) return;
    if (found.length === 0) {
      toast.error('That key can see no workspaces.');
      return;
    }
    setTeams(found);
    setStep('team');
  };

  /**
   * The shortcut past the four-level picker: paste the URL of the list you are
   * already looking at and let the server resolve the ids.
   *
   * Still needs the key — a ClickUp URL carries no credential — so it runs from
   * the same step, reusing whatever key is in the field above.
   */
  const useUrl = async () => {
    if (!draft.apiKey.trim()) {
      toast.error('Paste a ClickUp API key first — a URL does not contain one');
      return;
    }
    if (!pastedUrl.trim()) {
      toast.error('Paste a ClickUp list URL');
      return;
    }

    setResolvingUrl(true);
    try {
      const res = await fetch(`${BACKEND_URL}/api/destinations/resolve-url`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${accessToken}`,
        },
        credentials: 'include',
        body: JSON.stringify({ url: pastedUrl.trim(), apiKey: draft.apiKey }),
      });
      const body = await res.json();
      if (!res.ok) {
        // The server's message is the product here: which workspace the key
        // cannot see, or that a space was pasted instead of a list.
        toast.error(body.error ?? 'Could not read that URL', { duration: 8000 });
        return;
      }

      const resolved = body.data;
      setDraft((current) => ({
        ...current,
        teamId: resolved.teamId ?? '',
        teamName: resolved.teamName ?? '',
        spaceId: resolved.spaceId ?? '',
        spaceName: resolved.spaceName ?? '',
        folderId: resolved.folderId ?? '',
        folderName: resolved.folderName ?? '',
        listId: resolved.listId,
        listName: resolved.listName,
        name: current.name || resolved.listName,
      }));

      // Straight to naming: the URL answered everything the picker would ask.
      setStep('name');
      toast.success(`Found "${resolved.listName}"`);

      const statuses: string[] = resolved.statuses ?? [];
      if (statuses.length > 0 && !statuses.includes('complete')) {
        // Said up front rather than discovered later: git-derived tasks carry
        // "complete", and ClickUp rejects a status a list does not define.
        toast(
          `This list has no "complete" status (${statuses.join(', ')}). Completed work will be mapped to the closest match, or left at the list default.`,
          { duration: 9000 }
        );
      }
    } catch {
      toast.error('Could not reach the server');
    } finally {
      setResolvingUrl(false);
    }
  };

  const chooseTeam = async (team: ClickUpNode) => {
    setDraft((current) => ({ ...current, teamId: team.id, teamName: team.name }));
    const found = await browse('spaces', { teamId: team.id });
    if (!found) return;
    setSpaces(found);
    setStep('space');
  };

  const chooseSpace = async (space: ClickUpNode) => {
    setDraft((current) => ({ ...current, spaceId: space.id, spaceName: space.name }));
    const found = await browse('folders', { teamId: draft.teamId, spaceId: space.id });
    if (!found) return;
    setFolders(found);
    setStep('folder');
  };

  const chooseFolder = async (folderId: string) => {
    const folder = folders.find((entry) => entry.id === folderId);
    const isNone = folderId === NO_FOLDER;
    setDraft((current) => ({
      ...current,
      folderId: isNone ? '' : folderId,
      folderName: isNone ? '' : folder?.name ?? '',
    }));
    // With no folder chosen this asks for the space's folderless lists, which is
    // a different ClickUp endpoint — see the note at the top of the file.
    const found = await browse('lists', {
      teamId: draft.teamId,
      spaceId: draft.spaceId,
      folderId: isNone ? undefined : folderId,
    });
    if (!found) return;
    setLists(found);
    setStep('list');
  };

  const chooseList = (list: ClickUpNode) => {
    setDraft((current) => ({
      ...current,
      listId: list.id,
      listName: list.name,
      name:
        current.name ||
        [current.teamName, current.spaceName, list.name].filter(Boolean).join(' → '),
    }));
    setStep('name');
  };

  const save = async () => {
    if (!draft.name.trim()) {
      toast.error('Give this destination a name');
      return;
    }
    setSaving(true);
    const toastId = toast.loading('Saving destination...');
    try {
      const response = await fetch(`${BACKEND_URL}/api/destinations`, {
        method: 'POST',
        headers: authHeaders(true),
        credentials: 'include',
        body: JSON.stringify({
          name: draft.name.trim(),
          apiKey: draft.apiKey,
          teamId: draft.teamId,
          teamName: draft.teamName || undefined,
          spaceId: draft.spaceId || undefined,
          spaceName: draft.spaceName || undefined,
          folderId: draft.folderId || undefined,
          folderName: draft.folderName || undefined,
          listId: draft.listId,
          listName: draft.listName || undefined,
          defaultTemplateId: draft.defaultTemplateId || undefined,
        }),
      });
      const result = await response.json();
      if (result.success) {
        toast.success('Destination saved', { id: toastId });
        setAdding(false);
        // Drops the typed key from component state as soon as it is stored.
        setDraft(EMPTY_DRAFT);
        await loadDestinations();
      } else {
        toast.error(result.error || 'Failed to save destination', { id: toastId });
      }
    } catch {
      toast.error('Could not reach the backend.', { id: toastId });
    } finally {
      setSaving(false);
    }
  };

  const testDestination = async (destination: Destination) => {
    setBusyId(destination.id);
    const toastId = toast.loading(`Testing ${destination.name}...`);
    try {
      const response = await fetch(`${BACKEND_URL}/api/destinations/${destination.id}/test`, {
        method: 'POST',
        headers: authHeaders(true),
        credentials: 'include',
      });
      const result = await response.json();
      if (result.success) {
        const statuses = (result.data.statuses as string[]) ?? [];
        toast.success(
          statuses.length > 0
            ? `Reachable. List statuses: ${statuses.join(', ')}`
            : 'Reachable, but the list reports no statuses.',
          { id: toastId, duration: 6000 }
        );
      } else {
        toast.error(result.error || 'Test failed', { id: toastId, duration: 6000 });
      }
    } catch {
      toast.error('Could not reach the backend.', { id: toastId });
    } finally {
      setBusyId(null);
    }
  };

  const makeDefault = async (destination: Destination) => {
    setBusyId(destination.id);
    try {
      const response = await fetch(
        `${BACKEND_URL}/api/destinations/${destination.id}/default`,
        { method: 'POST', headers: authHeaders(true), credentials: 'include' }
      );
      const result = await response.json();
      if (result.success) {
        toast.success(`${destination.name} is now the default`);
        await loadDestinations();
      } else {
        toast.error(result.error || 'Failed to set the default');
      }
    } catch {
      toast.error('Could not reach the backend.');
    } finally {
      setBusyId(null);
    }
  };

  const remove = async (destination: Destination) => {
    setBusyId(destination.id);
    try {
      const response = await fetch(`${BACKEND_URL}/api/destinations/${destination.id}`, {
        method: 'DELETE',
        headers: authHeaders(),
        credentials: 'include',
      });
      const result = await response.json();
      if (result.success) {
        toast.success(`Deleted ${destination.name}`);
        setPendingDeleteId(null);
        await loadDestinations();
      } else {
        toast.error(result.error || 'Failed to delete');
      }
    } catch {
      toast.error('Could not reach the backend.');
    } finally {
      setBusyId(null);
    }
  };

  return (
    <ProtectedRoute>
      <div className="mx-auto max-w-4xl space-y-6 p-6">
        <div>
          <Link
            href="/settings"
            className="text-sm text-foreground-secondary hover:text-foreground"
          >
            ← Back to settings
          </Link>
          <h1 className="mt-2 text-2xl font-bold text-foreground">ClickUp Destinations</h1>
          <p className="mt-1 text-sm text-foreground-secondary">
            Each destination is an account, workspace and list that tasks can be created into.
            The one marked default is used when a run does not pick another.
          </p>
        </div>

        <Card className="p-6">
          <div className="mb-4 flex items-center justify-between">
            <h2 className="text-xl font-semibold text-foreground">Saved destinations</h2>
            {!adding && (
              <Button onClick={startAdding} variant="primary">
                Add destination
              </Button>
            )}
          </div>

          {loading ? (
            <div className="flex justify-center py-8">
              <LoadingSpinner />
            </div>
          ) : destinations.length === 0 ? (
            <p className="py-6 text-sm text-foreground-tertiary">
              No destinations yet. Until one exists, tasks are created using the list configured
              in the server&apos;s environment.
            </p>
          ) : (
            <ul className="space-y-3">
              {destinations.map((destination) => (
                <li
                  key={destination.id}
                  className="rounded-lg border border-border bg-background-tertiary p-4"
                >
                  <div className="flex flex-wrap items-start justify-between gap-3">
                    <div className="min-w-0">
                      <div className="flex items-center gap-2">
                        <span className="font-semibold text-foreground">{destination.name}</span>
                        {destination.isDefault && (
                          <span className="rounded bg-primary/20 px-2 py-0.5 text-xs font-medium text-primary">
                            Default
                          </span>
                        )}
                      </div>
                      <div className="mt-1 break-words text-xs text-foreground-secondary">
                        {pathOf(destination)}
                      </div>
                      {destination.defaultTemplateId && (
                        <div className="mt-1 text-xs text-foreground-tertiary">
                          Template:{' '}
                          {templates.find((t) => t.id === destination.defaultTemplateId)?.name ??
                            destination.defaultTemplateId}
                        </div>
                      )}
                    </div>
                    <div className="flex flex-wrap gap-2">
                      {!destination.isDefault && (
                        <Button
                          onClick={() => makeDefault(destination)}
                          variant="secondary"
                          disabled={busyId === destination.id}
                        >
                          Set default
                        </Button>
                      )}
                      <Button
                        onClick={() => testDestination(destination)}
                        variant="secondary"
                        disabled={busyId === destination.id}
                      >
                        Test
                      </Button>
                      {pendingDeleteId === destination.id ? (
                        <>
                          <Button
                            onClick={() => remove(destination)}
                            variant="danger"
                            disabled={busyId === destination.id}
                          >
                            Confirm delete
                          </Button>
                          <Button onClick={() => setPendingDeleteId(null)} variant="secondary">
                            Cancel
                          </Button>
                        </>
                      ) : (
                        <Button
                          onClick={() => setPendingDeleteId(destination.id)}
                          variant="secondary"
                          disabled={busyId === destination.id}
                        >
                          Delete
                        </Button>
                      )}
                    </div>
                  </div>
                </li>
              ))}
            </ul>
          )}
        </Card>

        {adding && (
          <Card className="p-6">
            <div className="mb-4 flex items-center justify-between">
              <h2 className="text-xl font-semibold text-foreground">Add a destination</h2>
              <Button onClick={() => setAdding(false)} variant="secondary">
                Cancel
              </Button>
            </div>

            <div className="space-y-5">
              <div>
                <label
                  htmlFor="apiKey"
                  className="mb-1 block text-xs font-semibold text-foreground-secondary"
                >
                  ClickUp API key
                </label>
                <div className="flex gap-2">
                  <Input
                    id="apiKey"
                    type="password"
                    autoComplete="off"
                    placeholder="pk_..."
                    value={draft.apiKey}
                    onChange={(e) =>
                      setDraft((current) => ({ ...current, apiKey: e.target.value }))
                    }
                    disabled={step !== 'key'}
                  />
                  {step === 'key' && (
                    <Button onClick={useKey} variant="primary" disabled={browsing}>
                      {browsing ? <LoadingSpinner size="sm" /> : 'Continue'}
                    </Button>
                  )}
                </div>
                <p className="mt-1 text-xs text-foreground-tertiary">
                  Stored encrypted. It is never shown again after saving.
                </p>
              </div>

              {step === 'key' && (
                <div className="rounded-xl border border-border bg-background-tertiary p-4">
                  <label
                    htmlFor="clickupUrl"
                    className="mb-1 block text-xs font-semibold text-foreground-secondary"
                  >
                    Or paste a ClickUp list URL
                  </label>
                  <p className="mb-2 text-xs text-foreground-tertiary">
                    Open the list you want in ClickUp and copy the address. This fills in the
                    workspace, space, folder and list for you, so you do not have to know which
                    is which. A URL contains no API key, so the field above is still required.
                  </p>
                  <div className="flex gap-2">
                    <Input
                      id="clickupUrl"
                      placeholder="https://app.clickup.com/9012168250/v/li/901216016381"
                      value={pastedUrl}
                      onChange={(e) => setPastedUrl(e.target.value)}
                    />
                    <Button onClick={useUrl} variant="secondary" disabled={resolvingUrl}>
                      {resolvingUrl ? <LoadingSpinner size="sm" /> : 'Use URL'}
                    </Button>
                  </div>
                </div>
              )}

              {step !== 'key' && (
                <div className="text-xs text-foreground-secondary">
                  {[draft.teamName, draft.spaceName, draft.folderName, draft.listName]
                    .filter(Boolean)
                    .join(' → ') || 'Choose a workspace'}
                </div>
              )}

              {step === 'team' && (
                <Chooser
                  label="Workspace"
                  nodes={teams}
                  busy={browsing}
                  onChoose={chooseTeam}
                  emptyMessage="This key can see no workspaces."
                />
              )}

              {step === 'space' && (
                <Chooser
                  label="Space"
                  nodes={spaces}
                  busy={browsing}
                  onChoose={chooseSpace}
                  emptyMessage="No spaces in this workspace."
                />
              )}

              {step === 'folder' && (
                <div>
                  <p className="mb-2 text-xs font-semibold text-foreground-secondary">Folder</p>
                  <div className="flex flex-wrap gap-2">
                    <Button
                      onClick={() => chooseFolder(NO_FOLDER)}
                      variant="secondary"
                      disabled={browsing}
                    >
                      No folder (lists directly in the space)
                    </Button>
                    {folders.map((folder) => (
                      <Button
                        key={folder.id}
                        onClick={() => chooseFolder(folder.id)}
                        variant="secondary"
                        disabled={browsing}
                      >
                        {folder.name}
                      </Button>
                    ))}
                  </div>
                </div>
              )}

              {step === 'list' && (
                <Chooser
                  label="List"
                  nodes={lists}
                  busy={browsing}
                  onChoose={chooseList}
                  emptyMessage={
                    draft.folderId
                      ? 'No lists in this folder.'
                      : 'No lists directly under this space. Go back and pick a folder.'
                  }
                />
              )}

              {step === 'name' && (
                <div className="space-y-4">
                  <div>
                    <label
                      htmlFor="destinationName"
                      className="mb-1 block text-xs font-semibold text-foreground-secondary"
                    >
                      Name
                    </label>
                    <Input
                      id="destinationName"
                      value={draft.name}
                      onChange={(e) =>
                        setDraft((current) => ({ ...current, name: e.target.value }))
                      }
                    />
                  </div>
                  <div>
                    <label
                      htmlFor="destinationTemplate"
                      className="mb-1 block text-xs font-semibold text-foreground-secondary"
                    >
                      Default template (optional)
                    </label>
                    <select
                      id="destinationTemplate"
                      value={draft.defaultTemplateId}
                      onChange={(e) =>
                        setDraft((current) => ({
                          ...current,
                          defaultTemplateId: e.target.value,
                        }))
                      }
                      className="w-full rounded-lg border border-border bg-background-tertiary px-3 py-2 text-foreground focus:outline-none focus:ring-2 focus:ring-primary"
                    >
                      <option value="">Use the standard template</option>
                      {templates.map((template) => (
                        <option key={template.id} value={template.id}>
                          {template.name}
                          {template.isBuiltin ? ' (built-in)' : ''}
                        </option>
                      ))}
                    </select>
                  </div>
                  <Button onClick={save} variant="primary" disabled={saving}>
                    {saving ? <LoadingSpinner size="sm" /> : 'Save destination'}
                  </Button>
                </div>
              )}
            </div>
          </Card>
        )}
      </div>
    </ProtectedRoute>
  );
}

function Chooser({
  label,
  nodes,
  busy,
  onChoose,
  emptyMessage,
}: {
  label: string;
  nodes: ClickUpNode[];
  busy: boolean;
  onChoose: (node: ClickUpNode) => void;
  emptyMessage: string;
}) {
  return (
    <div>
      <p className="mb-2 text-xs font-semibold text-foreground-secondary">{label}</p>
      {nodes.length === 0 ? (
        <p className="text-xs text-foreground-tertiary">{emptyMessage}</p>
      ) : (
        <div className="flex flex-wrap gap-2">
          {nodes.map((node) => (
            <Button
              key={node.id}
              onClick={() => onChoose(node)}
              variant="secondary"
              disabled={busy}
            >
              {node.name}
            </Button>
          ))}
        </div>
      )}
    </div>
  );
}
