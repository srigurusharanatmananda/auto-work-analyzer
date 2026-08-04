import { describe, expect, test } from "bun:test";
import { parseClickUpUrl } from "./clickupUrl.js";

describe("parseClickUpUrl", () => {
  test("reads a direct list URL", () => {
    // Form taken from this project's own .env.
    expect(parseClickUpUrl("https://app.clickup.com/9012168250/v/li/901216016381")).toEqual({
      kind: "list",
      teamId: "9012168250",
      listId: "901216016381",
    });
  });

  test("reads a list-view URL as a VIEW, not a list", () => {
    // The critical case. "6-901214252467-1" is {type}-{parentId}-{n}: the leading
    // 6 is a TYPE, and only type 6 means list. Returning listId here by slicing
    // the middle segment works for list views and silently yields a wrong id for
    // any other view type, so the parent must come from the API instead.
    expect(parseClickUpUrl("https://app.clickup.com/9012168250/v/l/6-901214252467-1")).toEqual({
      kind: "view",
      teamId: "9012168250",
      viewId: "6-901214252467-1",
    });
  });

  test("ignores query strings and fragments", () => {
    const parsed = parseClickUpUrl(
      "https://app.clickup.com/9014328984/v/l/6-901416083685-1?pr=90121234&foo=bar#top"
    );
    expect(parsed).toEqual({
      kind: "view",
      teamId: "9014328984",
      viewId: "6-901416083685-1",
    });
  });

  test("reads folder and space URLs", () => {
    expect(parseClickUpUrl("https://app.clickup.com/9012168250/v/f/90121111111")).toEqual({
      kind: "folder",
      teamId: "9012168250",
      folderId: "90121111111",
    });
    expect(parseClickUpUrl("https://app.clickup.com/9012168250/v/s/90122222222")).toEqual({
      kind: "space",
      teamId: "9012168250",
      spaceId: "90122222222",
    });
  });

  test("reads a space-overview URL, where the id is a segment further on", () => {
    expect(parseClickUpUrl("https://app.clickup.com/9012168250/v/o/s/90122222222")).toEqual({
      kind: "space",
      teamId: "9012168250",
      spaceId: "90122222222",
    });
  });

  test("reads both task URL forms", () => {
    expect(parseClickUpUrl("https://app.clickup.com/t/86abc123")).toEqual({
      kind: "task",
      taskId: "86abc123",
    });
    expect(parseClickUpUrl("https://app.clickup.com/9012168250/t/86abc123")).toEqual({
      kind: "task",
      teamId: "9012168250",
      taskId: "86abc123",
    });
  });

  test("falls back to the workspace for pages it does not model", () => {
    // A real URL from this project's .env. Returning the workspace is more useful
    // than failing, and never wrong.
    expect(parseClickUpUrl("https://app.clickup.com/9012168250/ai/brain?sidebar=x")).toEqual({
      kind: "workspace",
      teamId: "9012168250",
    });
    expect(parseClickUpUrl("https://app.clickup.com/9012168250")).toEqual({
      kind: "workspace",
      teamId: "9012168250",
    });
    // An unmodelled view type — docs — must not be mistaken for a list.
    expect(parseClickUpUrl("https://app.clickup.com/9012168250/v/dc/abc-123")).toEqual({
      kind: "workspace",
      teamId: "9012168250",
    });
  });

  test("rejects anything that is not a ClickUp URL", () => {
    expect(parseClickUpUrl("")).toBeNull();
    expect(parseClickUpUrl("not a url")).toBeNull();
    expect(parseClickUpUrl("https://example.com/9012168250/v/li/901216016381")).toBeNull();
    // A ClickUp host with no workspace id where one is required.
    expect(parseClickUpUrl("https://app.clickup.com/")).toBeNull();
    expect(parseClickUpUrl("https://app.clickup.com/not-numeric/v/li/123")).toBeNull();
  });

  test("tolerates surrounding whitespace, as a paste often carries", () => {
    expect(parseClickUpUrl("  https://app.clickup.com/9012168250/v/li/901216016381\n")!.listId).toBe(
      "901216016381"
    );
  });

  test("rejects a non-numeric id rather than passing it to the API", () => {
    // Degrades to the workspace, which is true, instead of inventing a list id
    // that would 404 later with a confusing message.
    expect(parseClickUpUrl("https://app.clickup.com/9012168250/v/li/not-an-id")).toEqual({
      kind: "workspace",
      teamId: "9012168250",
    });
  });
});
