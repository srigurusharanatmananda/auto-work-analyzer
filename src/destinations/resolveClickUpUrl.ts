/**
 * Turns a pasted ClickUp URL into a destination the user can save.
 *
 * The parsing is pure (`clickupUrl.ts`); this is the half that needs the API,
 * because some URL forms name a view or a task rather than a list, and only
 * ClickUp can say what those point at.
 *
 * The point of the feature: users know which list they want — they are looking at
 * it — but not which of four nested dropdowns it lives under, nor which numeric id
 * is which. This resolves the whole chain from one paste, then reports the names
 * so the user can confirm it found the right thing before saving.
 *
 * It does NOT remove the need for an API key. No ClickUp URL carries a
 * credential, and an unauthenticated lookup fails.
 */

import { parseClickUpUrl, VIEW_PARENT_TYPE } from "./clickupUrl.js";
import type { ClickUpService } from "../services/ClickUpService.js";

export interface ResolvedUrlDestination {
  teamId: string;
  teamName?: string;
  spaceId?: string;
  spaceName?: string;
  folderId?: string;
  folderName?: string;
  listId: string;
  listName: string;
  /** The list's real statuses, so the caller can warn about mapping up front. */
  statuses: string[];
  /** How the list was arrived at, for a UI that wants to explain itself. */
  via: "list" | "view" | "task";
}

export class ClickUpUrlError extends Error {
  constructor(
    message: string,
    public readonly code: "unparseable" | "no_list" | "no_access" | "lookup_failed"
  ) {
    super(message);
    this.name = "ClickUpUrlError";
  }
}

/**
 * `clickUp` must already be authenticated with the key the user supplied — the
 * URL cannot provide one.
 */
export async function resolveClickUpUrl(
  url: string,
  clickUp: ClickUpService
): Promise<ResolvedUrlDestination> {
  const parsed = parseClickUpUrl(url);
  if (!parsed) {
    throw new ClickUpUrlError(
      "That does not look like a ClickUp URL. Copy the address of the list you want to use.",
      "unparseable"
    );
  }

  // Checked BEFORE any lookup, because this is the most likely real failure and
  // the API's own answer for it is actively misleading: a resource in a workspace
  // the token cannot see comes back as a plain 404 "Not Found", which sends the
  // user hunting for a deleted list instead of a missing invitation.
  if (parsed.teamId) {
    // This is a DIAGNOSTIC, not a gate. If the workspace list is unavailable we
    // skip it and let the real lookup speak: a transient /team outage must not
    // block resolving a URL that would otherwise work.
    let visible: Array<{ id: string; name: string }> | null = null;
    try {
      visible = await clickUp.getTeams();
    } catch {
      visible = null;
    }

    if (visible && !visible.some((team) => team.id === parsed.teamId)) {
      throw new ClickUpUrlError(
        `That URL is in ClickUp workspace ${parsed.teamId}, which this API key cannot see. ` +
          `The key you supplied has access to: ${
            visible.map((t) => `${t.name} (${t.id})`).join(", ") || "no workspaces"
          }. Use a token from an account that is a member of that workspace.`,
        "no_access"
      );
    }
  }

  let listId: string | undefined;
  let via: ResolvedUrlDestination["via"] = "list";

  switch (parsed.kind) {
    case "list":
      listId = parsed.listId;
      break;

    case "view": {
      // The leading number in a view id is a TYPE, not an id. Ask rather than
      // slice: only type 6 is a list, and any other type would yield a plausible
      // wrong id that fails later with a confusing message.
      const parent = await lookup(
        () => clickUp.getViewParent(parsed.viewId!),
        "Could not read that view."
      );
      if (parent.type !== VIEW_PARENT_TYPE.LIST) {
        throw new ClickUpUrlError(
          "That view belongs to a space or folder rather than a list. Open the list you want and copy its URL.",
          "no_list"
        );
      }
      listId = parent.id;
      via = "view";
      break;
    }

    case "task": {
      // A task URL is a reasonable thing to paste — "put tasks alongside this
      // one" — so resolve it to its list rather than rejecting it.
      const task = await lookup(
        () => clickUp.getTask(parsed.taskId!),
        "Could not read that task."
      );
      listId = (task as unknown as { list?: { id?: string } }).list?.id;
      via = "task";
      if (!listId) {
        throw new ClickUpUrlError(
          "That task is not in a list this key can read.",
          "no_list"
        );
      }
      break;
    }

    case "folder":
    case "space":
    case "workspace":
      throw new ClickUpUrlError(
        parsed.kind === "workspace"
          ? "That URL names a workspace, not a list. Open the list you want and copy its URL."
          : `That URL names a ${parsed.kind}, not a list. Open a list inside it and copy that URL.`,
        "no_list"
      );
  }

  if (!listId) {
    throw new ClickUpUrlError("Could not find a list in that URL.", "no_list");
  }

  const list = await lookup(
    () => clickUp.getListDetails(listId!),
    "Could not read that list. The key you supplied may not have access to it."
  );

  // The team id from the URL is trusted over a lookup: it is what the user was
  // actually looking at. It is absent only for a bare /t/{id} task short link.
  const teamId = parsed.teamId ?? (await teamIdFor(clickUp));

  return {
    teamId,
    teamName: await teamNameFor(clickUp, teamId),
    spaceId: list.spaceId,
    spaceName: list.spaceName,
    folderId: list.folderId,
    folderName: list.folderName,
    listId: list.id,
    listName: list.name,
    statuses: list.statuses,
    via,
  };
}

/** Wraps an API call so a network/permission failure carries a usable message. */
async function lookup<T>(call: () => Promise<T>, context: string): Promise<T> {
  try {
    return await call();
  } catch (error) {
    const detail = error instanceof Error ? error.message : String(error);
    throw new ClickUpUrlError(`${context} ${detail}`, "lookup_failed");
  }
}

async function teamIdFor(clickUp: ClickUpService): Promise<string> {
  const teams = await lookup(() => clickUp.getTeams(), "Could not list workspaces.");
  if (teams.length === 0) {
    throw new ClickUpUrlError("That key can see no workspaces.", "lookup_failed");
  }
  return teams[0]!.id;
}

async function teamNameFor(clickUp: ClickUpService, teamId: string): Promise<string | undefined> {
  try {
    const teams = await clickUp.getTeams();
    return teams.find((team) => team.id === teamId)?.name;
  } catch {
    // A missing display name must not fail the resolution — the ids are what
    // matter, and the caller already has everything it needs to save.
    return undefined;
  }
}
