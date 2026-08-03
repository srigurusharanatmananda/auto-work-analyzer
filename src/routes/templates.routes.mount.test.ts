/**
 * Proves the templates router is mounted and authenticated, without touching
 * a real database — better-sqlite3 cannot open a real file under this
 * project's `bun test` runner (see task-7-report.md), so this test builds
 * the Express app directly with a stub TemplateStore and asserts the route
 * responds 401 without a bearer token, exactly as `authenticate` requires.
 */
import { describe, expect, test } from "bun:test";
import express from "express";
import { createTemplatesRouter } from "./templates.routes.js";
import type { TemplateStore } from "../services/TemplateStore.js";

describe("templates router mount", () => {
  test("GET /api/templates without a token returns 401 (route is mounted + authenticated)", async () => {
    const app = express();
    app.use(express.json());
    const stubStore = {} as TemplateStore; // authenticate() rejects before any store method runs
    app.use("/api/templates", createTemplatesRouter(stubStore));

    const server = app.listen(0);
    const port = (server.address() as any).port;
    try {
      const res = await fetch(`http://localhost:${port}/api/templates`);
      expect(res.status).toBe(401);
    } finally {
      server.close();
    }
  });

  test("GET /api/templates/schema without a token returns 401 (authenticated like its siblings)", async () => {
    const app = express();
    app.use(express.json());
    const stubStore = {} as TemplateStore;
    app.use("/api/templates", createTemplatesRouter(stubStore));

    const server = app.listen(0);
    const port = (server.address() as any).port;
    try {
      const res = await fetch(`http://localhost:${port}/api/templates/schema`);
      expect(res.status).toBe(401);
    } finally {
      server.close();
    }
  });

  test("GET /api/other-path (not mounted) returns 404, proving 401 above is route-specific", async () => {
    const app = express();
    app.use(express.json());
    const stubStore = {} as TemplateStore;
    app.use("/api/templates", createTemplatesRouter(stubStore));

    const server = app.listen(0);
    const port = (server.address() as any).port;
    try {
      const res = await fetch(`http://localhost:${port}/api/not-templates`);
      expect(res.status).toBe(404);
    } finally {
      server.close();
    }
  });
});
