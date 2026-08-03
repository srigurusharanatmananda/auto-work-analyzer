import { describe, expect, test } from "bun:test";
import { mapStatus, mapStatuses } from "./StatusMapper.js";

const LIST = ["to do", "in progress", "in review", "Complete"];

describe("mapStatus", () => {
  test("returns null when no status is desired", () => {
    expect(mapStatus(undefined, LIST)).toBeNull();
    expect(mapStatus("", LIST)).toBeNull();
  });

  test("matches exactly, case-insensitively", () => {
    expect(mapStatus("complete", LIST)).toEqual({
      from: "complete",
      to: "Complete",
      method: "exact",
    });
  });

  test("matches through the synonym map", () => {
    expect(mapStatus("done", LIST)).toEqual({ from: "done", to: "Complete", method: "synonym" });
    expect(mapStatus("wip", LIST)).toEqual({ from: "wip", to: "in progress", method: "synonym" });
  });

  // "in-progress" is in the synonym table, so it never reaches the fuzzy
  // branch — a typo does.
  test("matches a hyphenated variant through the synonym table", () => {
    expect(mapStatus("in-progress", LIST)).toEqual({
      from: "in-progress",
      to: "in progress",
      method: "synonym",
    });
  });

  test("fuzzy-matches a typo", () => {
    expect(mapStatus("in reviw", LIST)).toEqual({
      from: "in reviw",
      to: "in review",
      method: "fuzzy",
    });
  });

  test("drops a status with no plausible match", () => {
    expect(mapStatus("archived-forever", LIST)).toEqual({
      from: "archived-forever",
      to: null,
      method: "unmatched",
    });
  });

  test("drops everything when the list reports no statuses", () => {
    expect(mapStatus("complete", [])).toEqual({
      from: "complete",
      to: null,
      method: "unmatched",
    });
  });

  test("does not fuzzy-match across genuinely different statuses", () => {
    expect(mapStatus("to do", ["Complete"])!.to).toBeNull();
  });

  /**
   * The case this whole module exists for: commit af716cd removed a hardcoded
   * "complete", because a list whose done-column is named something else
   * rejects the create outright.
   */
  test("maps our default 'complete' onto a differently-named done column", () => {
    expect(mapStatus("complete", ["Open", "Closed"])).toEqual({
      from: "complete",
      to: "Closed",
      method: "synonym",
    });
  });

  test("trims and reports the trimmed value as `from`", () => {
    expect(mapStatus("  done  ", LIST)!.from).toBe("done");
  });
});

describe("mapStatuses", () => {
  test("maps a batch and skips undefined entries", () => {
    const mappings = mapStatuses(["complete", undefined, "nonsense"], LIST);
    expect(mappings.length).toBe(2);
    expect(mappings[0]!.to).toBe("Complete");
    expect(mappings[1]!.to).toBeNull();
  });

  test("deduplicates repeated statuses", () => {
    expect(mapStatuses(["complete", "complete"], LIST).length).toBe(1);
  });

  test("deduplicates case-insensitively", () => {
    expect(mapStatuses(["Complete", "complete"], LIST).length).toBe(1);
  });
});
