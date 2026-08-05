import { describe, expect, test } from "bun:test";
import {
  makeWorkItem,
  TYPE_LABELS,
  TYPE_EMOJI,
  PRIORITY_LABELS,
} from "./WorkItem.js";

describe("WorkItem", () => {
  test("makeWorkItem produces a valid default item", () => {
    const item = makeWorkItem();
    expect(item.title).toBe("Example work item");
    expect(item.type).toBe("feature");
    expect(item.priority).toBe("normal");
    expect(item.estimateHours).toBe(3);
    expect(item.provenance.source).toBe("git");
    expect(item.provenance.commits).toEqual([]);
    expect(item.tags).toEqual([]);
  });

  test("makeWorkItem applies overrides", () => {
    const item = makeWorkItem({ title: "Fix login", priority: "urgent" });
    expect(item.title).toBe("Fix login");
    expect(item.priority).toBe("urgent");
    expect(item.type).toBe("feature");
  });

  test("every type has a label and an emoji", () => {
    const types = Object.keys(TYPE_LABELS);
    expect(types).toContain("chore");
    expect(types).toContain("release");
    for (const type of types) {
      expect(TYPE_EMOJI[type as keyof typeof TYPE_EMOJI]).toBeTruthy();
    }
  });

  test("priority labels round-trip through NotesProcessor vocabulary", () => {
    expect(PRIORITY_LABELS.urgent).toBe("CRITICAL");
    expect(PRIORITY_LABELS.high).toBe("HIGH");
    expect(PRIORITY_LABELS.normal).toBe("MEDIUM");
    expect(PRIORITY_LABELS.low).toBe("LOW");
  });
});
