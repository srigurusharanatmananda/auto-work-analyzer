/**
 * Parses a git remote URL into an owner/name slug.
 *
 * This is how org membership is determined without any GitHub API call: a
 * clone's remote already states its owner. The slug is the repository's identity
 * throughout the scanning subsystem — registry key, ClickUp tag, and log line.
 */

export interface RepoSlug {
  owner: string;
  name: string;
  slug: string;
}

const GITHUB_HOSTS = new Set(["github.com", "www.github.com"]);

/** Returns null for anything that is not a GitHub owner/name remote. */
export function parseRemote(url: string): RepoSlug | null {
  const trimmed = url.trim().replace(/\/+$/, "");
  if (!trimmed) return null;

  // scp-style: git@github.com:owner/name(.git)
  // Also matches ssh://git@github.com:22/owner/name — the port is discarded
  // because only host and path matter here.
  const scp = trimmed.match(
    /^(?:ssh:\/\/)?[^@/]+@([^:/]+)(?::\d+)?[:/](?<path>[^/]+\/[^/]+?)(?:\.git)?$/
  );
  if (scp) {
    return fromHostAndPath(scp[1]!, scp.groups!.path!);
  }

  // https://github.com/owner/name(.git)
  const https = trimmed.match(/^https?:\/\/([^/]+)\/([^/]+\/[^/]+?)(?:\.git)?$/);
  if (https) {
    return fromHostAndPath(https[1]!, https[2]!);
  }

  return null;
}

function fromHostAndPath(authority: string, path: string): RepoSlug | null {
  // Extract hostname from authority by stripping userinfo (before @) and port (after :).
  // This handles: github.com, user@github.com, user:pass@github.com, github.com:443, etc.
  const hostWithPort = authority.includes("@") ? authority.split("@")[1]! : authority;
  const hostname = hostWithPort.split(":")[0]!;

  if (!GITHUB_HOSTS.has(hostname.toLowerCase())) return null;

  const [owner, name] = path.split("/");
  if (!owner || !name) return null;

  // Case is preserved: the slug becomes a ClickUp tag, and lowercasing it would
  // produce tags that do not match the repository. Credentials are never passed through.
  return { owner, name, slug: `${owner}/${name}` };
}
