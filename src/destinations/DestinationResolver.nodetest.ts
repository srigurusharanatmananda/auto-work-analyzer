/**
 * Runs against a real Postgres schema of its own, under `tsx --test`.
 *
 * The behaviour under test is a precedence order — explicit id, then the user's
 * default, then the .env config — and the last step is the whole backward
 * compatibility story for callers that predate destinations.
 */
import { after, afterEach, before, beforeEach, describe, test } from "node:test";
import assert from "node:assert/strict";
import { CredentialCipher, generateKeyBase64 } from "./CredentialCipher.js";
import { DestinationStore } from "./DestinationStore.js";
import { DestinationResolver } from "./DestinationResolver.js";
import { TemplateStore } from "../services/TemplateStore.js";
import { createTestDatabase, type TestDatabase } from "../testing/postgresFixture.js";
import type { ClickUpConfig } from "../types/index.js";

let db: TestDatabase;
let destinations: DestinationStore;
let templates: TemplateStore;
let resolver: DestinationResolver;

const envConfig: ClickUpConfig = {
  teamId: "env-team",
  apiKey: "pk_env",
  defaultListId: "env-list",
  projectName: "test",
};

before(async () => {
  db = await createTestDatabase();
});

after(async () => {
  await db?.drop();
});

beforeEach(async () => {
  await db.sql`TRUNCATE clickup_destinations, task_templates`;
  destinations = new DestinationStore(new CredentialCipher(generateKeyBase64()), db);
  templates = new TemplateStore(db);
  // The resolver's last fallback is the built-in template, so seeding is part
  // of the arrangement rather than incidental setup.
  await templates.seedBuiltins();
  resolver = new DestinationResolver({ destinations, templates, envConfig });
});

afterEach(() => {
  destinations.close();
  templates.close();
});

describe("DestinationResolver", () => {
  test("falls back to the env config when the user has no destinations", async () => {
    const resolved = await resolver.resolve("user-1");
    assert.equal(resolved.destination, null);
    assert.equal(resolved.listId, "env-list");
    assert.equal(resolved.template.id, "builtin-standard");
    assert.equal(resolved.config.teamId, "env-team");
  });

  test("uses the user's default destination when one exists", async () => {
    const created = await destinations.create("user-1", {
      name: "Mine",
      apiKey: "pk_1",
      teamId: "t1",
      listId: "l1",
    });
    const resolved = await resolver.resolve("user-1");
    assert.equal(resolved.destination!.id, created.id);
    assert.equal(resolved.listId, "l1");
  });

  test("the resolved config carries the destination's own key and list", async () => {
    await destinations.create("user-1", {
      name: "Mine",
      apiKey: "pk_1",
      teamId: "t1",
      listId: "l1",
      defaultAssignee: "dev@example.com",
    });
    const { config } = await resolver.resolve("user-1");
    assert.equal(config.teamId, "t1");
    assert.equal(config.apiKey, "pk_1");
    assert.equal(config.defaultListId, "l1");
    assert.equal(config.defaultAssignee, "dev@example.com");
  });

  test("an explicit destinationId wins over the default", async () => {
    await destinations.create("user-1", { name: "First", apiKey: "pk_1", teamId: "t1", listId: "l1" });
    const second = await destinations.create("user-1", {
      name: "Second",
      apiKey: "pk_2",
      teamId: "t2",
      listId: "l2",
    });
    assert.equal((await resolver.resolve("user-1", second.id)).listId, "l2");
  });

  test("uses the destination's default template", async () => {
    const created = await destinations.create("user-1", {
      name: "Mine",
      apiKey: "pk_1",
      teamId: "t1",
      listId: "l1",
      defaultTemplateId: "builtin-terse",
    });
    assert.equal((await resolver.resolve("user-1", created.id)).template.id, "builtin-terse");
  });

  test("an explicit templateId wins over the destination default", async () => {
    const created = await destinations.create("user-1", {
      name: "Mine",
      apiKey: "pk_1",
      teamId: "t1",
      listId: "l1",
      defaultTemplateId: "builtin-terse",
    });
    assert.equal(
      (await resolver.resolve("user-1", created.id, "builtin-commit-log")).template.id,
      "builtin-commit-log"
    );
  });

  /**
   * A templateId the caller typed must 400, exactly as it did before
   * destinations existed. Silently substituting a different template would
   * render tasks the caller never asked for.
   */
  test("an explicitly named unknown template throws UnknownTemplateError", async () => {
    await assert.rejects(() => resolver.resolve("user-1", undefined, "nope"), /Template not found/);
  });

  /**
   * A destination's stored default template, by contrast, can be a template the
   * user has since deleted. Refusing to resolve would make the destination
   * permanently unusable, so this degrades to the built-in default.
   */
  test("a destination pointing at a deleted template falls back to the built-in default", async () => {
    const created = await destinations.create("user-1", {
      name: "Mine",
      apiKey: "pk_1",
      teamId: "t1",
      listId: "l1",
      defaultTemplateId: "deleted-template",
    });
    assert.equal((await resolver.resolve("user-1", created.id)).template.id, "builtin-standard");
  });

  test("an unknown destination id throws", async () => {
    await assert.rejects(() => resolver.resolve("user-1", "nope"), /not found/i);
  });

  test("another user's destination id throws", async () => {
    const created = await destinations.create("user-2", {
      name: "Theirs",
      apiKey: "pk_2",
      teamId: "t2",
      listId: "l2",
    });
    await assert.rejects(() => resolver.resolve("user-1", created.id), /not found/i);
  });

  test("another user's default is not used", async () => {
    await destinations.create("user-2", { name: "Theirs", apiKey: "pk_2", teamId: "t2", listId: "l2" });
    const resolved = await resolver.resolve("user-1");
    assert.equal(resolved.destination, null);
    assert.equal(resolved.listId, "env-list");
  });
});
