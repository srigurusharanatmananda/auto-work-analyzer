/**
 * The lookups the destination picker walks: teams -> spaces -> folders ->
 * lists, plus a list's real statuses.
 *
 * `fetch` is stubbed throughout — these assert the endpoint each method hits
 * and the shape it returns, because a picker built on the wrong endpoint fails
 * by showing an empty list rather than by throwing.
 */
import { afterEach, describe, expect, test } from "bun:test";
import { ClickUpService } from "./ClickUpService.js";
import type { ClickUpConfig } from "../types/index.js";

const config: ClickUpConfig = {
  teamId: "team-1",
  apiKey: "pk_test",
  projectName: "test",
};

const realFetch = globalThis.fetch;
afterEach(() => {
  globalThis.fetch = realFetch;
});

function stubFetch(handler: (url: string) => { status?: number; body: unknown }): string[] {
  const calls: string[] = [];
  globalThis.fetch = (async (input: any) => {
    const url = String(input);
    calls.push(url);
    const { status = 200, body } = handler(url);
    return {
      ok: status >= 200 && status < 300,
      status,
      statusText: status === 200 ? "OK" : "Error",
      json: async () => body,
      text: async () => JSON.stringify(body),
    } as any;
  }) as any;
  return calls;
}

describe("ClickUpService hierarchy", () => {
  test("getTeams lists every workspace the key can see", async () => {
    const calls = stubFetch(() => ({ body: { teams: [{ id: "t1", name: "USK" }] } }));
    const teams = await new ClickUpService(config).getTeams();
    expect(calls[0]).toContain("/team");
    expect(teams).toEqual([{ id: "t1", name: "USK" }]);
  });

  test("getFolders returns id and name pairs", async () => {
    stubFetch(() => ({ body: { folders: [{ id: "f1", name: "Sprints" }] } }));
    const folders = await new ClickUpService(config).getFolders("space-1");
    expect(folders).toEqual([{ id: "f1", name: "Sprints" }]);
  });

  test("getFolders hits the space folder endpoint", async () => {
    const calls = stubFetch(() => ({ body: { folders: [] } }));
    await new ClickUpService(config).getFolders("space-1");
    expect(calls[0]).toContain("/space/space-1/folder");
  });

  test("getListsInFolder hits the folder list endpoint", async () => {
    const calls = stubFetch(() => ({ body: { lists: [{ id: "l1", name: "Dev" }] } }));
    const lists = await new ClickUpService(config).getListsInFolder("f1");
    expect(calls[0]).toContain("/folder/f1/list");
    expect(lists).toEqual([{ id: "l1", name: "Dev" }]);
  });

  test("getFolderlessLists hits the space list endpoint", async () => {
    const calls = stubFetch(() => ({ body: { lists: [{ id: "l9", name: "Inbox" }] } }));
    const lists = await new ClickUpService(config).getFolderlessLists("space-1");
    expect(calls[0]).toContain("/space/space-1/list");
    expect(lists).toEqual([{ id: "l9", name: "Inbox" }]);
  });

  test("getListStatuses returns status names in order", async () => {
    stubFetch(() => ({
      body: {
        id: "l1",
        statuses: [
          { status: "in progress", orderindex: 1 },
          { status: "to do", orderindex: 0 },
          { status: "done", orderindex: 2 },
        ],
      },
    }));
    expect(await new ClickUpService(config).getListStatuses("l1")).toEqual([
      "to do",
      "in progress",
      "done",
    ]);
  });

  test("getListStatuses returns an empty array when the list has none", async () => {
    stubFetch(() => ({ body: { id: "l1" } }));
    expect(await new ClickUpService(config).getListStatuses("l1")).toEqual([]);
  });

  test("a non-OK response throws with the status code", async () => {
    stubFetch(() => ({ status: 401, body: { err: "Token invalid" } }));
    await expect(new ClickUpService(config).getFolders("space-1")).rejects.toThrow(/401/);
  });

  test("a non-OK status lookup throws with the status code", async () => {
    stubFetch(() => ({ status: 404, body: { err: "List not found" } }));
    await expect(new ClickUpService(config).getListStatuses("gone")).rejects.toThrow(/404/);
  });
});
