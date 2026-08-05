/**
 * Shells out to real `git` in temp directories. Kept out of `bun test` with the
 * rest of the subprocess/DB-touching suites, and run one file per invocation by
 * scripts/run-nodetests.sh.
 */
import { after, before, describe, test } from "node:test";
import assert from "node:assert/strict";
import { execFileSync } from "node:child_process";
import { mkdtempSync, mkdirSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { discoverRepos } from "./RepoDiscovery.js";

let root: string;

function makeRepo(name: string, remote?: string): string {
  const path = join(root, name);
  mkdirSync(path, { recursive: true });
  execFileSync("git", ["init", "-q"], { cwd: path });
  if (remote) execFileSync("git", ["remote", "add", "origin", remote], { cwd: path });
  return path;
}

before(() => {
  root = mkdtempSync(join(tmpdir(), "awa-discovery-"));
  makeRepo("in-org", "git@github.com:kailasa-ngpt/in-org.git");
  makeRepo("also-in-org", "https://github.com/kailasa-ngpt/also-in-org");
  makeRepo("other-org", "git@github.com:someone-else/other-org.git");
  makeRepo("no-remote");
  mkdirSync(join(root, "not-a-repo"), { recursive: true });
});

after(() => {
  rmSync(root, { recursive: true, force: true });
});

describe("discoverRepos", () => {
  test("returns only repos whose remote owner matches", async () => {
    const { repos } = await discoverRepos(root, "kailasa-ngpt");
    assert.deepEqual(repos.map((r) => r.slug).sort(), [
      "kailasa-ngpt/also-in-org",
      "kailasa-ngpt/in-org",
    ]);
  });

  test("reports each skipped directory with a reason", async () => {
    const { skipped } = await discoverRepos(root, "kailasa-ngpt");
    const byName = Object.fromEntries(skipped.map((s) => [s.path.split("/").pop(), s.reason]));

    // Every skip must carry a reason, so the settings page can explain why a
    // directory the user expected is absent instead of silently omitting it.
    assert.match(byName["other-org"]!, /owner/i);
    assert.match(byName["no-remote"]!, /remote/i);
    assert.match(byName["not-a-repo"]!, /git/i);
  });

  test("never echoes a remote URL into a skip reason", async () => {
    // A clone made with a token in its URL must not have that token surfaced in
    // a message the settings page renders. The host here is non-GitHub so the
    // remote is rejected; this asserts the rejection carries no credential.
    const path = join(root, "credentialed");
    mkdirSync(path, { recursive: true });
    execFileSync("git", ["init", "-q"], { cwd: path });
    execFileSync(
      "git",
      ["remote", "add", "origin", "https://x-access-token:ghp_SECRETVALUE@gitlab.com/kailasa-ngpt/x.git"],
      { cwd: path }
    );

    const { repos, skipped } = await discoverRepos(root, "kailasa-ngpt");

    assert.ok(!repos.some((r) => r.path.endsWith("credentialed")));
    const serialized = JSON.stringify(skipped);
    assert.ok(!serialized.includes("ghp_SECRETVALUE"), `credential leaked: ${serialized}`);
    assert.ok(!serialized.includes("x-access-token"), `credential leaked: ${serialized}`);

    rmSync(path, { recursive: true, force: true });
  });

  test("returns an absolute path for each repo", async () => {
    const { repos } = await discoverRepos(root, "kailasa-ngpt");
    for (const repo of repos) assert.ok(repo.path.startsWith("/"), repo.path);
  });

  test("a missing root is an empty result, not a throw", async () => {
    const result = await discoverRepos(join(root, "does-not-exist"), "kailasa-ngpt");
    assert.deepEqual(result.repos, []);
    assert.equal(result.skipped.length, 1);
    assert.match(result.skipped[0]!.reason, /not found|not readable/i);
  });

  test("matches the owner case-insensitively", async () => {
    // GitHub owners resolve case-insensitively, so a clone remote written
    // "Kailasa-NGPT" must not be silently excluded.
    const { repos } = await discoverRepos(root, "KAILASA-NGPT");
    assert.equal(repos.length, 2);
  });
});
