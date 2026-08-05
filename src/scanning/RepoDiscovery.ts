/**
 * Finds locally-cloned repositories belonging to one GitHub organisation.
 *
 * Organisation membership comes from each clone's `git remote`, not from the
 * GitHub API — which is what keeps this feature tokenless. A directory that is
 * not a repo, has no remote, or belongs to another owner is skipped WITH A
 * REASON: the settings page shows those reasons, because "the repo I expected is
 * missing and I cannot tell why" is the failure this avoids.
 *
 * Skip reasons never include the remote URL. A clone made with a token in its
 * URL (`https://x-access-token:ghp_...@github.com/...`) would otherwise put that
 * credential into a message the UI renders.
 */

import { execFile } from "child_process";
import { promisify } from "util";
import { readdir } from "fs/promises";
import { join } from "path";
import { parseRemote } from "./repoSlug.js";

const execFileAsync = promisify(execFile);

export interface DiscoveredRepo {
  path: string;
  slug: string;
  owner: string;
  name: string;
}

export interface SkippedDir {
  path: string;
  reason: string;
}

export interface DiscoveryResult {
  repos: DiscoveredRepo[];
  skipped: SkippedDir[];
}

/** Guards against a hung `git` on a pathological directory. */
const GIT_TIMEOUT_MS = 10_000;

export async function discoverRepos(root: string, owner: string): Promise<DiscoveryResult> {
  const repos: DiscoveredRepo[] = [];
  const skipped: SkippedDir[] = [];

  let entries: string[];
  try {
    const dirents = await readdir(root, { withFileTypes: true });
    entries = dirents.filter((d) => d.isDirectory()).map((d) => d.name);
  } catch {
    return { repos, skipped: [{ path: root, reason: "Scan root not found or not readable" }] };
  }

  for (const entry of entries.sort()) {
    const path = join(root, entry);

    let remote: string;
    try {
      const { stdout } = await execFileAsync("git", ["remote", "get-url", "origin"], {
        cwd: path,
        timeout: GIT_TIMEOUT_MS,
      });
      remote = stdout;
    } catch (error) {
      const message = error instanceof Error ? error.message : String(error);
      skipped.push({
        path,
        reason: /not a git repository/i.test(message)
          ? "Not a git repository"
          : "No git remote named origin",
      });
      continue;
    }

    const parsed = parseRemote(remote);
    if (!parsed) {
      // Deliberately does NOT echo `remote`: it may embed a credential, and this
      // string is rendered in the settings UI.
      skipped.push({ path, reason: "Remote is not a GitHub owner/name URL" });
      continue;
    }

    // GitHub owners resolve case-insensitively.
    if (parsed.owner.toLowerCase() !== owner.toLowerCase()) {
      skipped.push({ path, reason: `Different owner: ${parsed.owner}` });
      continue;
    }

    repos.push({ path, slug: parsed.slug, owner: parsed.owner, name: parsed.name });
  }

  return { repos, skipped };
}
