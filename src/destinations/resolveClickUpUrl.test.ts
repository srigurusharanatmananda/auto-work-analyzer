import { describe, expect, test } from "bun:test";
import { ClickUpUrlError, resolveClickUpUrl } from "./resolveClickUpUrl.js";
import type { ClickUpService } from "../services/ClickUpService.js";

const LIST = {
  id: "901214252467",
  name: "KAILASA Store 2.0",
  spaceId: "90121000001",
  spaceName: "Ministry of Digital Services",
  folderId: "90121000002",
  folderName: "Projects",
  statuses: ["setup", "development", "completed"],
};

function stub(overrides: Partial<Record<string, unknown>> = {}): ClickUpService {
  return {
    getListDetails: async () => LIST,
    getViewParent: async () => ({ id: LIST.id, type: 6 }),
    getTask: async () => ({ list: { id: LIST.id } }),
    getTeams: async () => [
      { id: "9012168250", name: "KAILASA Male" },
      { id: "9014328984", name: "Third Workspace" },
    ],
    ...overrides,
  } as unknown as ClickUpService;
}

describe("resolveClickUpUrl", () => {
  test("resolves a direct list URL, filling in space and folder", () => {
    // The whole point: the URL names only the list, but a destination wants the
    // space and folder too, and GET /list/{id} already carries both.
    return resolveClickUpUrl(
      "https://app.clickup.com/9012168250/v/li/901214252467",
      stub()
    ).then((resolved) => {
      expect(resolved.listId).toBe("901214252467");
      expect(resolved.listName).toBe("KAILASA Store 2.0");
      expect(resolved.spaceName).toBe("Ministry of Digital Services");
      expect(resolved.folderName).toBe("Projects");
      expect(resolved.teamId).toBe("9012168250");
      expect(resolved.teamName).toBe("KAILASA Male");
      expect(resolved.via).toBe("list");
    });
  });

  test("resolves a list-view URL by asking the API for the parent", async () => {
    let askedFor: string | undefined;
    const resolved = await resolveClickUpUrl(
      "https://app.clickup.com/9012168250/v/l/6-901214252467-1",
      stub({
        getViewParent: async (viewId: string) => {
          askedFor = viewId;
          return { id: LIST.id, type: 6 };
        },
      })
    );

    // It must ask with the WHOLE view id, not a sliced middle segment.
    expect(askedFor).toBe("6-901214252467-1");
    expect(resolved.listId).toBe("901214252467");
    expect(resolved.via).toBe("view");
  });

  test("refuses a view whose parent is not a list", async () => {
    // Type 4 is a space. Slicing the middle number out of the URL would have
    // produced a plausible id that fails much later with a confusing message.
    await expect(
      resolveClickUpUrl(
        "https://app.clickup.com/9012168250/v/l/4-90121000001-1",
        stub({ getViewParent: async () => ({ id: "90121000001", type: 4 }) })
      )
    ).rejects.toThrow(/space or folder rather than a list/i);
  });

  test("resolves a task URL to the list the task lives in", async () => {
    const resolved = await resolveClickUpUrl("https://app.clickup.com/t/86abc123", stub());
    expect(resolved.listId).toBe("901214252467");
    expect(resolved.via).toBe("task");
    // A bare task short link carries no workspace, so it falls back to the key's.
    expect(resolved.teamId).toBe("9012168250");
  });

  test("rejects a workspace, space or folder URL with an actionable message", async () => {
    for (const [url, expected] of [
      ["https://app.clickup.com/9012168250", /workspace, not a list/i],
      ["https://app.clickup.com/9012168250/v/s/90121000001", /space, not a list/i],
      ["https://app.clickup.com/9012168250/v/f/90121000002", /folder, not a list/i],
    ] as const) {
      await expect(resolveClickUpUrl(url, stub())).rejects.toThrow(expected);
    }
  });

  test("rejects a non-ClickUp URL as unparseable", async () => {
    try {
      await resolveClickUpUrl("https://example.com/whatever", stub());
      throw new Error("should have thrown");
    } catch (error) {
      expect(error).toBeInstanceOf(ClickUpUrlError);
      expect((error as ClickUpUrlError).code).toBe("unparseable");
    }
  });

  test("a permission failure explains that the key may lack access", async () => {
    // The likeliest real failure: the URL is fine, the key cannot see that
    // workspace. A bare 404 would send the user looking in the wrong place.
    await expect(
      resolveClickUpUrl(
        "https://app.clickup.com/9014328984/v/li/901416083685",
        stub({
          getListDetails: async () => {
            throw new Error('404 - {"err":"Not found","ECODE":"SHARD_006"}');
          },
        })
      )
    ).rejects.toThrow(/may not have access/i);
  });

  test("returns the list's statuses so the caller can warn about mapping", async () => {
    const resolved = await resolveClickUpUrl(
      "https://app.clickup.com/9012168250/v/li/901214252467",
      stub()
    );
    // This list defines no "complete", which is what git-derived tasks carry —
    // surfacing it here is what lets the UI say so before anything is created.
    expect(resolved.statuses).toEqual(["setup", "development", "completed"]);
    expect(resolved.statuses).not.toContain("complete");
  });

  test("a missing team name does not fail the resolution", async () => {
    const resolved = await resolveClickUpUrl(
      "https://app.clickup.com/9012168250/v/li/901214252467",
      stub({
        getTeams: async () => {
          throw new Error("teams endpoint down");
        },
      })
    );
    // The ids are what matter; a display name is cosmetic.
    expect(resolved.listId).toBe("901214252467");
    expect(resolved.teamName).toBeUndefined();
  });

  test("names the inaccessible workspace instead of reporting a bare 404", async () => {
    // The most likely real failure, and the API's own answer for it is
    // misleading: a resource in an invisible workspace returns a plain 404, which
    // sends the user hunting for a deleted list rather than a missing invitation.
    try {
      await resolveClickUpUrl(
        "https://app.clickup.com/9099999999/v/li/901416083685",
        stub()
      );
      throw new Error("should have thrown");
    } catch (error) {
      expect(error).toBeInstanceOf(ClickUpUrlError);
      expect((error as ClickUpUrlError).code).toBe("no_access");
      // It must say which workspace, and what the key CAN see.
      expect((error as Error).message).toContain("9099999999");
      expect((error as Error).message).toContain("KAILASA Male");
    }
  });
});
