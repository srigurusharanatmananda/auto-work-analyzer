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
});
