/**
 * The date fields of the create payload.
 *
 * These exist because the failure is silent: ClickUp accepts a task with no
 * start date perfectly happily, creates it, returns 200 — and then files it
 * under "Unscheduled", where no Timeline, Gantt or Workload report can see it.
 * Nothing short of asserting the outgoing body catches that.
 */
import { afterEach, describe, expect, test } from "bun:test";
import { ClickUpService } from "./ClickUpService.js";
import type { ClickUpConfig } from "../types/index.js";

const config: ClickUpConfig = {
  teamId: "team-1",
  apiKey: "pk_test",
  projectName: "test",
  defaultListId: "list-1",
};

const realFetch = globalThis.fetch;
afterEach(() => {
  globalThis.fetch = realFetch;
});

/** Captures the JSON body of every POST the service sends. */
function captureBodies(): Record<string, unknown>[] {
  const bodies: Record<string, unknown>[] = [];
  globalThis.fetch = (async (_input: any, init: any) => {
    if (init?.body) bodies.push(JSON.parse(init.body));
    return {
      ok: true,
      status: 200,
      statusText: "OK",
      json: async () => ({ id: "task-1", name: "t", url: "https://app.clickup.com/t/task-1" }),
      text: async () => "{}",
    } as any;
  }) as any;
  return bodies;
}

const utcMidnight = (day: string) => new Date(day).getTime();

describe("ClickUpService date fields", () => {
  test("sends start_date alongside due_date", async () => {
    const bodies = captureBodies();
    await new ClickUpService(config).createTask({
      name: "Ship the thing",
      startDate: "2026-07-12",
      dueDate: "2026-07-29",
    });

    expect(bodies[0]!.start_date).toBe(utcMidnight("2026-07-12"));
    expect(bodies[0]!.due_date).toBe(utcMidnight("2026-07-29"));
  });

  /**
   * Without these flags ClickUp treats the timestamp as a moment, and UTC
   * midnight renders as the previous day for anyone west of Greenwich — the
   * off-by-one visible on tasks created before this was added.
   */
  test("marks both as date-only so the day does not shift by timezone", async () => {
    const bodies = captureBodies();
    await new ClickUpService(config).createTask({
      name: "t",
      startDate: "2026-07-12",
      dueDate: "2026-07-29",
    });

    expect(bodies[0]!.due_date_time).toBe(false);
    expect(bodies[0]!.start_date_time).toBe(false);
  });

  /** A `*_date_time: false` next to a null date is a contradiction. */
  test("omits the date-only flags when there is no date", async () => {
    const bodies = captureBodies();
    await new ClickUpService(config).createTask({ name: "t" });

    expect(bodies[0]!.start_date).toBeNull();
    expect(bodies[0]!.due_date).toBeNull();
    expect(bodies[0]).not.toHaveProperty("start_date_time");
    expect(bodies[0]).not.toHaveProperty("due_date_time");
  });

  /** A subtask with no start date is as invisible to a report as a task with none. */
  test("subtasks carry the same date fields", async () => {
    const bodies = captureBodies();
    await new ClickUpService(config).createSubtask("parent-1", {
      name: "sub",
      startDate: "2026-07-12",
      dueDate: "2026-07-29",
    });

    expect(bodies[0]!.parent).toBe("parent-1");
    expect(bodies[0]!.start_date).toBe(utcMidnight("2026-07-12"));
    expect(bodies[0]!.start_date_time).toBe(false);
  });
});
