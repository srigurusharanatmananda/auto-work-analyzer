/**
 * Adversarial tests for the authentication and authorisation holes.
 *
 * Every test in the first two describe blocks FAILS on the commit that
 * introduced this file. That is deliberate and is the point: each one documents
 * a live defect, so a green run here is the evidence that the defect is closed
 * rather than merely believed to be.
 *
 * Runs under `tsx --test` (Node), not `bun test`: AuthService opens
 * better-sqlite3, which cannot run under Bun (oven-sh/bun#4290). Own temp cwd,
 * because AuthDatabaseService resolves its file from process.cwd().
 */
import { after, before, describe, test } from "node:test";
import assert from "node:assert/strict";
import { mkdtempSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import type { AddressInfo } from "node:net";
import express from "express";
import cookieParser from "cookie-parser";
import authRoutes from "./auth.routes.js";
import { AuthDatabaseService } from "../services/AuthDatabaseService.js";
import { JWTService } from "../services/JWTService.js";

const originalCwd = process.cwd();
const tmpDbDir = mkdtempSync(join(tmpdir(), "awa-authsec-"));
process.chdir(tmpDbDir);

let server: ReturnType<express.Express["listen"]>;
let baseUrl: string;

const PASSWORD = "CorrectHorse9!";

before(() => {
  const app = express();
  app.use(express.json());
  app.use(cookieParser());
  app.use("/api/auth", authRoutes);

  server = app.listen(0);
  baseUrl = `http://localhost:${(server.address() as AddressInfo).port}/api/auth`;
});

after(() => {
  server.close();
  process.chdir(originalCwd);
  rmSync(tmpDbDir, { recursive: true, force: true });
});

async function post(path: string, body: unknown, token?: string) {
  const res = await fetch(`${baseUrl}${path}`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      ...(token ? { Authorization: `Bearer ${token}` } : {}),
    },
    body: JSON.stringify(body),
  });
  return { status: res.status, body: (await res.json()) as any };
}

/**
 * POST /register returns only `{ userId }` — no user record and no token. The
 * role a registration actually produced is therefore only observable by logging
 * in afterwards, which is also the shape that matters: the login response and
 * the token it mints are what the rest of the system authorises against.
 */
async function register(email: string, extra: Record<string, unknown> = {}) {
  return post("/register", {
    email,
    password: PASSWORD,
    fullName: "Test Person",
    ...extra,
  });
}

/** Registers then logs in, returning the login body (user + accessToken). */
async function registerAndLogin(email: string, extra: Record<string, unknown> = {}) {
  const created = await register(email, extra);
  assert.equal(created.status, 201, `registration failed: ${JSON.stringify(created.body)}`);

  const loggedIn = await post("/login", { email, password: PASSWORD });
  assert.equal(loggedIn.status, 200, `login failed: ${JSON.stringify(loggedIn.body)}`);

  return {
    userId: created.body.data.userId as string,
    user: loggedIn.body.data.user as { id: string; role: string },
    accessToken: loggedIn.body.data.accessToken as string,
  };
}

describe("privilege escalation via registration", () => {
  /**
   * POST /api/auth/register is public and unauthenticated, and passes
   * req.body.role straight through to AuthService.register, which does
   * `role: input.role || 'user'`. registerValidation only checks the value is
   * one of the three role strings — it does not reject the field.
   *
   * So anyone who can reach the port can mint themselves an admin. This is
   * latent only because nothing currently checks role; the moment authorisation
   * is enforced it becomes the way around it.
   */
  test("a self-registered user cannot choose the admin role", async () => {
    const { user } = await registerAndLogin("escalate@example.com", { role: "admin" });

    assert.equal(user.role, "user", "a public registration must never produce an admin");
  });

  test("the role is not honoured even when it is a valid enum value", async () => {
    const { user } = await registerAndLogin("escalate2@example.com", { role: "manager" });
    assert.equal(user.role, "user");
  });

  test("the access token does not claim an elevated role", async () => {
    // Belt and braces: even if the stored row were correct, the token is what
    // every request is authorised against.
    const { accessToken } = await registerAndLogin("escalate3@example.com", { role: "admin" });
    const decoded = JWTService.verifyAccessToken(accessToken);
    assert.equal(decoded!.role, "user");
  });
});

describe("a deactivated user's unexpired token", () => {
  /**
   * `authenticate` verifies the signature, issuer, audience, expiry, type and
   * blacklist — but never re-reads the user row, so it cannot see is_active.
   * Deactivating an account therefore has no effect for up to 15 minutes, which
   * is precisely the window in which you want deactivation to work.
   */
  test("is rejected once the account is deactivated", async () => {
    const { accessToken: token } = await registerAndLogin("deactivate@example.com");

    // Confirm the token works first, so a failure below cannot be blamed on a
    // bad token.
    const before = await fetch(`${baseUrl}/me`, {
      headers: { Authorization: `Bearer ${token}` },
    });
    assert.equal(before.status, 200, "token should be valid before deactivation");

    // Deactivate out of band, the way an admin route will: straight against the
    // store, on its own connection, with the server still running.
    const db = new AuthDatabaseService();
    try {
      const user = db.getUserByEmail("deactivate@example.com");
      assert.ok(user, "the registered user should exist");
      db.updateUser(user.id, { is_active: false });
    } finally {
      db.close();
    }

    const after = await fetch(`${baseUrl}/me`, {
      headers: { Authorization: `Bearer ${token}` },
    });
    assert.equal(after.status, 401, "a deactivated user's token must stop working");
  });
});

describe("what already works — regression guards, not new requirements", () => {
  test("registration rejects a weak password", async () => {
    const result = await post("/register", {
      email: "weak@example.com",
      password: "short",
      fullName: "Test Person",
    });
    assert.equal(result.status, 400);
  });

  test("login with a wrong password does not reveal whether the email exists", async () => {
    await register("known@example.com");

    const wrongPassword = await post("/login", {
      email: "known@example.com",
      password: "WrongPassword9!",
    });
    const unknownEmail = await post("/login", {
      email: "nobody@example.com",
      password: "WrongPassword9!",
    });

    assert.equal(wrongPassword.status, unknownEmail.status);
    assert.equal(wrongPassword.body.error, unknownEmail.body.error);
  });

  test("/me requires a token", async () => {
    const res = await fetch(`${baseUrl}/me`);
    assert.equal(res.status, 401);
  });

  test("POST /setup refuses once a user exists", async () => {
    await register("first@example.com");
    const result = await post("/setup", {
      email: "sneaky-admin@example.com",
      password: PASSWORD,
      fullName: "Sneaky",
    });
    assert.equal(result.status, 403);
  });
});
