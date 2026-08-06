/**
 * Admin user management, and the role gate in front of it.
 *
 * Two things are under test and they are separable: that `adminOnly` actually
 * refuses non-admins (the point of Phase 1 — `authorize()` was applied nowhere),
 * and that the lockout invariants hold, since an installation whose last admin
 * has just demoted themselves cannot be recovered through the API at all.
 *
 * Runs under `tsx --test` (Node), not `bun test`: AuthDatabaseService opens
 * better-sqlite3, which cannot run under Bun (oven-sh/bun#4290). Own temp cwd,
 * because AuthDatabaseService resolves its file from process.cwd().
 */
import { after, before, beforeEach, describe, test } from "node:test";
import assert from "node:assert/strict";
import { mkdtempSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import type { AddressInfo } from "node:net";
import express from "express";
import { createUsersRouter } from "./users.routes.js";
import { AuthDatabaseService } from "../services/AuthDatabaseService.js";
import { createTestUser } from "../testing/authFixture.js";
import { createTestDatabase, type TestDatabase } from "../testing/postgresFixture.js";
import { resetSharedAuthService } from "../services/AuthService.js";

const originalCwd = process.cwd();
const tmpDbDir = mkdtempSync(join(tmpdir(), "awa-users-"));
process.chdir(tmpDbDir);

let server: ReturnType<express.Express["listen"]>;
let baseUrl: string;

let pg: TestDatabase;
let admin: Awaited<ReturnType<typeof createTestUser>>;
let secondAdmin: Awaited<ReturnType<typeof createTestUser>>;
let manager: Awaited<ReturnType<typeof createTestUser>>;
let plainUser: Awaited<ReturnType<typeof createTestUser>>;

before(async () => {
  pg = await createTestDatabase();
  const app = express();
  app.use(express.json());
  app.use("/api/users", createUsersRouter());

  server = app.listen(0);
  baseUrl = `http://localhost:${(server.address() as AddressInfo).port}/api/users`;
});

after(async () => {
  await pg?.drop();
  server.close();
  resetSharedAuthService();
  process.chdir(originalCwd);
  rmSync(tmpDbDir, { recursive: true, force: true });
});

/** A clean users table before each test, so lockout counting is deterministic. */
beforeEach(async () => {
  const db = new AuthDatabaseService();
  try {
    for (const user of await db.getAllUsers(1000, 0)) await db.deleteUser(user.id);
  } finally {
    db.close();
  }

  admin = await createTestUser({ userId: "admin-1", role: "admin" });
  secondAdmin = await createTestUser({ userId: "admin-2", role: "admin" });
  manager = await createTestUser({ userId: "manager-1", role: "manager" });
  plainUser = await createTestUser({ userId: "user-1", role: "user" });
});

async function call(
  method: string,
  path: string,
  token?: string,
  body?: unknown
) {
  const res = await fetch(`${baseUrl}${path}`, {
    method,
    headers: {
      "Content-Type": "application/json",
      ...(token ? { Authorization: token } : {}),
    },
    ...(body === undefined ? {} : { body: JSON.stringify(body) }),
  });
  return { status: res.status, body: (await res.json()) as any };
}

describe("the admin gate", () => {
  test("an unauthenticated caller gets 401", async () => {
    assert.equal((await call("GET", "/")).status, 401);
  });

  test("a plain user gets 403, not 200", async () => {
    // Asserting the code, not merely "not 200": a 500 or a 404 would also be
    // "not 200" and would mean something entirely different.
    const result = await call("GET", "/", plainUser.authHeader);
    assert.equal(result.status, 403);
  });

  test("a manager gets 403 — this surface is admin-only", async () => {
    assert.equal((await call("GET", "/", manager.authHeader)).status, 403);
  });

  test("an admin gets the list", async () => {
    const result = await call("GET", "/", admin.authHeader);
    assert.equal(result.status, 200);
    assert.equal(result.body.data.users.length, 4);
  });

  test("every write is gated too, not just the read", async () => {
    for (const [method, path, body] of [
      ["GET", `/${plainUser.userId}`, undefined],
      ["PUT", `/${plainUser.userId}`, { role: "admin" }],
      ["DELETE", `/${plainUser.userId}`, undefined],
    ] as const) {
      const result = await call(method, path, plainUser.authHeader, body);
      assert.equal(result.status, 403, `${method} ${path} should be forbidden`);
    }
  });
});

describe("what a listing exposes", () => {
  test("password hashes never appear in a response", async () => {
    const result = await call("GET", "/", admin.authHeader);

    const serialised = JSON.stringify(result.body);
    assert.ok(!serialised.includes("password"), "no password field of any kind");
    assert.ok(!serialised.includes("argon2"), "no hash material");
  });

  test("a single user reads back without a hash", async () => {
    const result = await call("GET", `/${plainUser.userId}`, admin.authHeader);

    assert.equal(result.status, 200);
    assert.equal(result.body.data.user.id, plainUser.userId);
    assert.ok(!("password_hash" in result.body.data.user));
    assert.ok(!("passwordHash" in result.body.data.user));
  });

  test("an unknown id is 404", async () => {
    assert.equal((await call("GET", "/nope", admin.authHeader)).status, 404);
  });
});

describe("role changes", () => {
  test("an admin can promote a user", async () => {
    const result = await call("PUT", `/${plainUser.userId}`, admin.authHeader, {
      role: "manager",
    });

    assert.equal(result.status, 200);
    assert.equal(result.body.data.user.role, "manager");
  });

  test("an invalid role is rejected", async () => {
    const result = await call("PUT", `/${plainUser.userId}`, admin.authHeader, {
      role: "superuser",
    });
    assert.equal(result.status, 400);
  });

  test("an empty body is rejected rather than silently doing nothing", async () => {
    const result = await call("PUT", `/${plainUser.userId}`, admin.authHeader, {});
    assert.equal(result.status, 400);
  });

  test("changing a role revokes that user's refresh tokens", async () => {
    const db = new AuthDatabaseService();
    try {
      db.storeRefreshToken({
        id: "rt-1",
        user_id: plainUser.userId,
        token_hash: "hash-1",
        expires_at: new Date(Date.now() + 86_400_000).toISOString(),
        user_agent: "test",
        ip_address: "127.0.0.1",
      });
    } finally {
      db.close();
    }

    await call("PUT", `/${plainUser.userId}`, admin.authHeader, { role: "manager" });

    const after = new AuthDatabaseService();
    try {
      // Revocation flags the row rather than deleting it, so that a later
      // presentation of the same token is a detectable reuse rather than an
      // unknown token.
      assert.equal(
        (await after.getRefreshToken("hash-1"))?.revoked,
        true,
        "a role change must not leave a live refresh token behind"
      );
    } finally {
      after.close();
    }
  });
});

describe("lockout protection: at least one active admin must remain", () => {
  /**
   * Every case here is a self-edit, and that is not incidental. The acting
   * caller must be an active admin to get through the gate at all, so if the
   * target is someone else there are necessarily two active admins and the
   * invariant cannot be at risk. Standing down is the only way to reach it.
   */
  test("one admin can demote another while two remain", async () => {
    const result = await call("PUT", `/${secondAdmin.userId}`, admin.authHeader, {
      role: "user",
    });
    assert.equal(result.status, 200);
  });

  test("an admin may stand down while another active admin remains", async () => {
    const result = await call("PUT", `/${admin.userId}`, admin.authHeader, {
      role: "user",
    });
    assert.equal(result.status, 200, "admin-2 is still there");
    assert.equal(result.body.data.user.role, "user");
  });

  test("the last active admin cannot demote themselves", async () => {
    await call("PUT", `/${secondAdmin.userId}`, admin.authHeader, { role: "user" });

    const result = await call("PUT", `/${admin.userId}`, admin.authHeader, {
      role: "user",
    });
    assert.equal(result.status, 409);
    assert.match(result.body.error, /last active admin/i);
  });

  test("the last active admin cannot deactivate themselves", async () => {
    await call("PUT", `/${secondAdmin.userId}`, admin.authHeader, { isActive: false });

    const result = await call("PUT", `/${admin.userId}`, admin.authHeader, {
      isActive: false,
    });
    assert.equal(result.status, 409);
  });

  test("the last active admin cannot delete themselves", async () => {
    await call("PUT", `/${secondAdmin.userId}`, admin.authHeader, { role: "user" });

    const result = await call("DELETE", `/${admin.userId}`, admin.authHeader);
    assert.equal(result.status, 409);
  });

  test("a deactivated admin already counts as gone", async () => {
    // admin-2 deactivated leaves admin-1 as the only *active* admin, even though
    // two admin rows still exist. Counting rows rather than active rows would
    // wrongly allow this and lock the installation out.
    await call("PUT", `/${secondAdmin.userId}`, admin.authHeader, { isActive: false });

    const result = await call("DELETE", `/${admin.userId}`, admin.authHeader);
    assert.equal(result.status, 409);
  });

  test("standing down is possible once a successor is promoted", async () => {
    await call("PUT", `/${secondAdmin.userId}`, admin.authHeader, { role: "user" });
    assert.equal(
      (await call("PUT", `/${admin.userId}`, admin.authHeader, { role: "user" })).status,
      409,
      "no successor yet"
    );

    await call("PUT", `/${plainUser.userId}`, admin.authHeader, { role: "admin" });

    assert.equal(
      (await call("PUT", `/${admin.userId}`, admin.authHeader, { role: "user" })).status,
      200
    );
  });

  test("a demoted admin's own token stops working on the next request", async () => {
    // The point of re-reading the role in `authenticate`: the token still says
    // admin, the row no longer does, and the row is what counts.
    await call("PUT", `/${admin.userId}`, admin.authHeader, { role: "user" });

    const result = await call("GET", "/", admin.authHeader);
    assert.equal(result.status, 403);
  });
});
