/**
 * Parses a ClickUp app URL into the ids it contains.
 *
 * Why this exists: a destination needs a workspace, optionally a space and
 * folder, and a list. Users know which list they want — they are looking at it —
 * but they do not reliably know which of four nested dropdowns it lives under, or
 * which numeric id is which. A pasted URL answers that.
 *
 * What it CANNOT do: a ClickUp URL contains no credential. No URL form carries a
 * token, so pasting one never removes the need for an API key — it only removes
 * the navigation.
 *
 * This module is pure and does no I/O. Some URL forms name a *view*, whose parent
 * can only be learned from the API; `resolveClickUpUrl` (which does the network
 * call) handles those. The split matters because the parsing rules are worth
 * testing without a network, and the resolution is worth testing with a stub.
 */

export type ClickUpUrlKind = "list" | "view" | "folder" | "space" | "task" | "workspace";

export interface ParsedClickUpUrl {
  kind: ClickUpUrlKind;
  /** Present for every app URL except a bare task short-link. */
  teamId?: string;
  listId?: string;
  folderId?: string;
  spaceId?: string;
  taskId?: string;
  /**
   * A view id such as "6-901214252467-1". Its parent must be read from the API:
   * the leading number is a TYPE, not an id, and only type 6 means list. Treating
   * the middle segment as a list id happens to work for list views and silently
   * produces a wrong id for any other view type.
   */
  viewId?: string;
}

const NUMERIC = /^\d+$/;

/**
 * Returns null when the URL is not a recognisable ClickUp app URL.
 *
 * Deliberately permissive about the host (self-hosted and regional hosts exist)
 * but strict about shape: a URL we cannot read must be rejected rather than
 * half-parsed into a plausible-looking wrong id.
 */
export function parseClickUpUrl(input: string): ParsedClickUpUrl | null {
  let url: URL;
  try {
    url = new URL(input.trim());
  } catch {
    return null;
  }

  if (!/clickup\.com$/i.test(url.hostname) && !/^app\./i.test(url.hostname)) {
    return null;
  }

  const parts = url.pathname.split("/").filter(Boolean);
  if (parts.length === 0) return null;

  // Task short link: /t/{taskId} — no workspace in the path.
  if (parts[0] === "t" && parts[1]) {
    return { kind: "task", taskId: parts[1] };
  }

  const teamId = NUMERIC.test(parts[0]!) ? parts[0]! : undefined;
  if (!teamId) return null;

  // /{team}/t/{taskId}
  if (parts[1] === "t" && parts[2]) {
    return { kind: "task", teamId, taskId: parts[2] };
  }

  // Everything else worth reading is under /{team}/v/...
  if (parts[1] !== "v") {
    // /{team} alone, or a non-navigational page such as /{team}/ai/brain — the
    // workspace is all it tells us, which is still useful.
    return { kind: "workspace", teamId };
  }

  const segment = parts[2];
  const value = parts[3];

  switch (segment) {
    // /{team}/v/li/{listId} — the list id directly.
    case "li":
      return value && NUMERIC.test(value)
        ? { kind: "list", teamId, listId: value }
        : { kind: "workspace", teamId };

    // /{team}/v/l/{viewId} — a view, whose parent needs the API.
    case "l":
      return value ? { kind: "view", teamId, viewId: value } : { kind: "workspace", teamId };

    // /{team}/v/f/{folderId}
    case "f":
      return value && NUMERIC.test(value)
        ? { kind: "folder", teamId, folderId: value }
        : { kind: "workspace", teamId };

    // /{team}/v/s/{spaceId}
    case "s":
      return value && NUMERIC.test(value)
        ? { kind: "space", teamId, spaceId: value }
        : { kind: "workspace", teamId };

    // /{team}/v/o/s/{spaceId} — space overview. The id is one segment further on.
    case "o": {
      if (parts[3] === "s" && parts[4] && NUMERIC.test(parts[4])) {
        return { kind: "space", teamId, spaceId: parts[4] };
      }
      return { kind: "workspace", teamId };
    }

    default:
      // A view type we do not model (docs, dashboards, chat). The workspace is
      // still worth returning rather than failing outright.
      return { kind: "workspace", teamId };
  }
}

/**
 * ClickUp view/parent type codes, from `GET /view/{id}` -> `view.parent.type`.
 *
 * Verified against a real workspace: a list view's parent is
 * `{ id: "901214252467", type: 6 }`. The others are inferred from ClickUp's
 * hierarchy and are treated defensively — an unrecognised type resolves to
 * "unknown" rather than being guessed at.
 */
export const VIEW_PARENT_TYPE = {
  SPACE: 4,
  FOLDER: 5,
  LIST: 6,
} as const;
