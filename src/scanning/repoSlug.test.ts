import { describe, expect, test } from "bun:test";
import { parseRemote } from "./repoSlug.js";

describe("parseRemote", () => {
  test("parses an SSH remote", () => {
    expect(parseRemote("git@github.com:kailasa-ngpt/ask_nithyananda_app.git")).toEqual({
      owner: "kailasa-ngpt",
      name: "ask_nithyananda_app",
      slug: "kailasa-ngpt/ask_nithyananda_app",
    });
  });

  test("parses an HTTPS remote, with and without .git", () => {
    expect(parseRemote("https://github.com/kailasa-ngpt/soma_v2")!.slug).toBe(
      "kailasa-ngpt/soma_v2"
    );
    expect(parseRemote("https://github.com/kailasa-ngpt/soma_v2.git")!.slug).toBe(
      "kailasa-ngpt/soma_v2"
    );
  });

  test("tolerates a trailing slash and surrounding whitespace", () => {
    // `git remote get-url` output arrives with a trailing newline.
    expect(parseRemote("  https://github.com/kailasa-ngpt/x/\n")!.slug).toBe("kailasa-ngpt/x");
  });

  test("parses an SSH remote carrying an explicit ssh:// scheme and port", () => {
    expect(parseRemote("ssh://git@github.com:22/kailasa-ngpt/x.git")!.slug).toBe(
      "kailasa-ngpt/x"
    );
  });

  test("returns null for a non-GitHub host", () => {
    expect(parseRemote("git@gitlab.com:kailasa-ngpt/x.git")).toBeNull();
    expect(parseRemote("https://bitbucket.org/kailasa-ngpt/x")).toBeNull();
  });

  test("returns null for anything that is not a parseable remote", () => {
    expect(parseRemote("")).toBeNull();
    expect(parseRemote("not a url")).toBeNull();
    expect(parseRemote("https://github.com/onlyowner")).toBeNull();
  });

  test("does not lowercase the owner or name", () => {
    // GitHub slugs are case-insensitive to resolve but case-preserving to
    // display, and the slug is used as a ClickUp tag, so mangling case would
    // produce tags that do not match the repo.
    expect(parseRemote("git@github.com:Kailasa-NGPT/Ask_App.git")!.slug).toBe(
      "Kailasa-NGPT/Ask_App"
    );
  });

  test("parses HTTPS remotes with credentials (userinfo)", () => {
    // Credentialed HTTPS URLs must be parsed correctly, extracting only owner/name.
    expect(parseRemote("https://x-access-token:ghp_TOKEN@github.com/kailasa-ngpt/soma_v2.git")!.slug).toBe(
      "kailasa-ngpt/soma_v2"
    );
    expect(parseRemote("https://user@github.com/kailasa-ngpt/x")!.slug).toBe(
      "kailasa-ngpt/x"
    );
  });

  test("parses HTTPS remotes with an explicit port", () => {
    expect(parseRemote("https://github.com:443/kailasa-ngpt/x")!.slug).toBe(
      "kailasa-ngpt/x"
    );
  });

  test("does not leak credentials into the returned object", () => {
    // A critical security requirement: tokens and passwords must not survive
    // into any field of RepoSlug. They would otherwise appear in UI messages
    // for unparseable remotes in a later task.
    const credentialedUrl = "https://x-access-token:ghp_TOKEN@github.com/kailasa-ngpt/soma_v2.git";
    const result = parseRemote(credentialedUrl);
    const stringified = JSON.stringify(result);
    expect(stringified).not.toContain("ghp_TOKEN");
    expect(stringified).not.toContain("x-access-token");
  });

  test("returns null for credentialed non-GitHub hosts", () => {
    expect(parseRemote("https://user:pass@gitlab.com/owner/repo")).toBeNull();
    expect(parseRemote("git@bitbucket.org:user:token@owner/repo.git")).toBeNull();
  });
});
