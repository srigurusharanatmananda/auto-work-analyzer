/**
 * Runs under `tsx --test` (Node): the stores it exercises are better-sqlite3
 * backed, which cannot open a database under this repo's Bun version
 * (oven-sh/bun#4290).
 *
 * The behaviour under test is a precedence order — explicit id, then the user's
 * default, then the .env config — and the last step is the whole backward
 * compatibility story for callers that predate destinations.
 */
import { afterEach, beforeEach, describe, test } from "node:test";
import assert from "node:assert/strict";
import { existsSync, mkdtempSync, rmSync } from "fs";
import { tmpdir } from "os";
import { join } from "path";
import { CredentialCipher, generateKeyBase64 } from "./CredentialCipher.js";
import { DestinationStore } from "./DestinationStore.js";
import { DestinationResolver } from "./DestinationResolver.js";
import { TemplateStore } from "../services/TemplateStore.js";
import type { ClickUpConfig } from "../types/index.js";

let dir: string;
let destinations: DestinationStore;
let templates: TemplateStore;
let resolver: DestinationResolver;

const envConfig: ClickUpConfig = {
  teamId: "env-team",
  apiKey: "pk_env",
  defaultListId: "env-list",
  projectName: "test",
};

beforeEach(() => {
  dir = mkdtempSync(join(tmpdir(), "awa-resolve-"));
  const dbPath = join(dir, "test.db");
  destinations = new DestinationStore(dbPath, new CredentialCipher(generateKeyBase64()));
  templates = new TemplateStore(dbPath);
  resolver = new DestinationResolver({ destinations, templates, envConfig });
});

afterEach(() => {
  destinations.close();
  templates.close();
  if (existsSync(dir)) rmSync(dir, { recursive: true, force: true });
});

describe("DestinationResolver", () => {
  test("falls back to the env config when the user has no destinations", () => {
    const resolved = resolver.resolve("user-1");
    assert.equal(resolved.destination, null);
    assert.equal(resolved.listId, "env-list");
    assert.equal(resolved.template.id, "builtin-standard");
    assert.equal(resolved.config.teamId, "env-team");
  });

  test("uses the user's default destination when one exists", () => {
    const created = destinations.create("user-1", {
      name: "Mine",
      apiKey: "pk_1",
      teamId: "t1",
      listId: "l1",
    });
    const resolved = resolver.resolve("user-1");
    assert.equal(resolved.destination!.id, created.id);
    assert.equal(resolved.listId, "l1");
  });

  test("the resolved config carries the destination's own key and list", () => {
    destinations.create("user-1", {
      name: "Mine",
      apiKey: "pk_1",
      teamId: "t1",
      listId: "l1",
      defaultAssignee: "dev@example.com",
    });
    const { config } = resolver.resolve("user-1");
    assert.equal(config.teamId, "t1");
    assert.equal(config.apiKey, "pk_1");
    assert.equal(config.defaultListId, "l1");
    assert.equal(config.defaultAssignee, "dev@example.com");
  });

  test("an explicit destinationId wins over the default", () => {
    destinations.create("user-1", { name: "First", apiKey: "pk_1", teamId: "t1", listId: "l1" });
    const second = destinations.create("user-1", {
      name: "Second",
      apiKey: "pk_2",
      teamId: "t2",
      listId: "l2",
    });
    assert.equal(resolver.resolve("user-1", second.id).listId, "l2");
  });

  test("uses the destination's default template", () => {
    const created = destinations.create("user-1", {
      name: "Mine",
      apiKey: "pk_1",
      teamId: "t1",
      listId: "l1",
      defaultTemplateId: "builtin-terse",
    });
    assert.equal(resolver.resolve("user-1", created.id).template.id, "builtin-terse");
  });

  test("an explicit templateId wins over the destination default", () => {
    const created = destinations.create("user-1", {
      name: "Mine",
      apiKey: "pk_1",
      teamId: "t1",
      listId: "l1",
      defaultTemplateId: "builtin-terse",
    });
    assert.equal(
      resolver.resolve("user-1", created.id, "builtin-commit-log").template.id,
      "builtin-commit-log"
    );
  });

  /**
   * A templateId the caller typed must 400, exactly as it did before
   * destinations existed. Silently substituting a different template would
   * render tasks the caller never asked for.
   */
  test("an explicitly named unknown template throws UnknownTemplateError", () => {
    assert.throws(() => resolver.resolve("user-1", undefined, "nope"), /Template not found/);
  });

  /**
   * A destination's stored default template, by contrast, can be a template the
   * user has since deleted. Refusing to resolve would make the destination
   * permanently unusable, so this degrades to the built-in default.
   */
  test("a destination pointing at a deleted template falls back to the built-in default", () => {
    const created = destinations.create("user-1", {
      name: "Mine",
      apiKey: "pk_1",
      teamId: "t1",
      listId: "l1",
      defaultTemplateId: "deleted-template",
    });
    assert.equal(resolver.resolve("user-1", created.id).template.id, "builtin-standard");
  });

  test("an unknown destination id throws", () => {
    assert.throws(() => resolver.resolve("user-1", "nope"), /not found/i);
  });

  test("another user's destination id throws", () => {
    const created = destinations.create("user-2", {
      name: "Theirs",
      apiKey: "pk_2",
      teamId: "t2",
      listId: "l2",
    });
    assert.throws(() => resolver.resolve("user-1", created.id), /not found/i);
  });

  test("another user's default is not used", () => {
    destinations.create("user-2", { name: "Theirs", apiKey: "pk_2", teamId: "t2", listId: "l2" });
    const resolved = resolver.resolve("user-1");
    assert.equal(resolved.destination, null);
    assert.equal(resolved.listId, "env-list");
  });
});
