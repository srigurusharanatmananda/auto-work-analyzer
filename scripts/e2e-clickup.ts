/**
 * End-to-end smoke test against a REAL ClickUp workspace.
 *
 * Creates a throwaway list, drives the full canonical pipeline into it
 * (notes text -> WorkItems -> renderer -> ClickUpService -> ClickUp), reads the
 * tasks back off the API to assert on what ClickUp actually stored, checks the
 * markdown round-trip, and deletes the list on the way out.
 *
 * Why this exists: every test in the suite stubs the ClickUp write. Auth,
 * field-shape and status-mapping bugs live precisely in the part that gets
 * stubbed, so nothing in `bun test` can catch them.
 *
 * Scope note: this deliberately does NOT exercise GitWorkAnalyzer.createTasksFromWork.
 * That path calls markCommitsAsProcessed, which would mutate the real commit-dedup
 * state of whatever repo it ran against — the one piece of state whose corruption
 * produces no error and no failing test. The git path's rendered payload is covered
 * by GitWorkAnalyzer.createTasks.nodetest.ts against a stubbed fetch instead.
 *
 * Run: bun run e2e:clickup
 */

import "dotenv/config";
import { workItemsFromNotes } from "../src/sources/NotesWorkSource.js";
import { renderTasks } from "../src/formatting/ClickUpRenderer.js";
import { renderMarkdown } from "../src/formatting/MarkdownRenderer.js";
import { BUILTIN_TEMPLATES } from "../src/formatting/builtinTemplates.js";
import { ClickUpService } from "../src/services/ClickUpService.js";
import type { ClickUpConfig } from "../src/types/index.js";

const API = "https://api.clickup.com/api/v2";

const failures: string[] = [];
const notes: string[] = [];

function check(label: string, condition: boolean, detail?: string): void {
  if (condition) {
    console.log(`  ✔ ${label}`);
  } else {
    console.log(`  ✖ ${label}${detail ? ` — ${detail}` : ""}`);
    failures.push(label + (detail ? ` — ${detail}` : ""));
  }
}

function requireEnv(name: string): string {
  const value = process.env[name];
  if (!value) {
    console.error(`Missing ${name} in .env — cannot run a real end-to-end test.`);
    process.exit(2);
  }
  return value;
}

const API_KEY = requireEnv("CLICKUP_API_KEY");
const TEAM_ID = requireEnv("CLICKUP_TEAM_ID");

async function clickup(path: string, init: RequestInit = {}): Promise<any> {
  const res = await fetch(`${API}${path}`, {
    ...init,
    headers: {
      Authorization: API_KEY,
      "Content-Type": "application/json",
      ...(init.headers ?? {}),
    },
  });
  const text = await res.text();
  if (!res.ok) {
    // Never echo the Authorization header or the key itself.
    throw new Error(`ClickUp ${init.method ?? "GET"} ${path} -> ${res.status}: ${text}`);
  }
  return text ? JSON.parse(text) : {};
}

/**
 * Realistic notes covering the cases that actually broke during slice 1:
 *  - an explicit Priority line (the structured path)
 *  - a high- and a low-complexity item, to prove priority is not flattened
 *  - zero commits on every item, which is what surfaced the "**Commits:** 0
 *    across 0 files" render bug
 *  - a Status/Completed pair
 *  - tags, so the tag strategy is exercised
 */
const NOTES = [
  "Task 1: Rework the meditation player layout",
  "Priority: HIGH",
  "Estimate: 6 hours",
  "Status: complete",
  "Completed: 2026-08-01",
  "Tags: mobile, meditation",
  "Description: Rebuilt the player so the transport controls stay reachable on small screens.",
  "",
  "---",
  "",
  "Task 2: Fix the typo on the settings footer",
  "Priority: LOW",
  "Estimate: 1 hours",
  "Description: Corrected a mislabelled support link.",
  "",
  "---",
  "",
].join("\n");

async function main(): Promise<void> {
  console.log("\n=== 0. Credentials and workspace ===");
  const team = await clickup(`/team/${TEAM_ID}`);
  console.log(`  team: ${team.team?.name ?? "(unnamed)"} (${TEAM_ID})`);

  const spaces = await clickup(`/team/${TEAM_ID}/space?archived=false`);
  const space = spaces.spaces?.[0];
  if (!space) throw new Error("No spaces in this team — cannot create a throwaway list.");
  console.log(`  space: ${space.name} (${space.id})`);

  console.log("\n=== 1. Create throwaway list ===");
  const listName = `awa-e2e-${process.env.E2E_STAMP ?? "run"}`;
  const list = await clickup(`/space/${space.id}/list`, {
    method: "POST",
    body: JSON.stringify({ name: listName }),
  });
  const listId: string = list.id;
  console.log(`  created list ${listName} (${listId})`);

  try {
    const config: ClickUpConfig = {
      teamId: TEAM_ID,
      apiKey: API_KEY,
      defaultListId: listId,
      projectName: "auto-work-analyzer e2e",
    };
    const service = new ClickUpService(config);

    console.log("\n=== 2. Pipeline: notes -> WorkItems ===");
    const items = await workItemsFromNotes(NOTES);
    check("two work items parsed", items.length === 2, `got ${items.length}`);
    check(
      "explicit HIGH priority survives",
      items[0]?.priority === "high",
      `got ${items[0]?.priority}`
    );
    check("explicit LOW priority survives", items[1]?.priority === "low", `got ${items[1]?.priority}`);
    check("status carried through", items[0]?.status === "complete", `got ${items[0]?.status}`);
    check("estimate carried through", items[0]?.estimateHours === 6, `got ${items[0]?.estimateHours}`);
    check(
      "notes items genuinely have zero commits",
      items.every((i) => i.provenance.commits.length === 0)
    );
    // Found by this script on its first run: the "Tags:" line was not parsed at
    // all, so it leaked into the description AND the author's tags were replaced
    // by keyword guesses.
    check(
      "the author's own tags are kept",
      ["mobile", "meditation"].every((t) => items[0]?.tags.includes(t)),
      JSON.stringify(items[0]?.tags)
    );
    check(
      "no metadata label leaks into the description",
      !/^(Tags|Description|Priority|Estimate|Status|Completed):/im.test(items[0]?.description ?? ""),
      JSON.stringify(items[0]?.description?.slice(0, 90))
    );

    console.log("\n=== 3. Render + create in ClickUp, per built-in template ===");
    const createdIds: Record<string, string[]> = {};

    for (const template of BUILTIN_TEMPLATES) {
      console.log(`\n  --- ${template.id} ---`);
      const rendered = renderTasks(items, template);
      check(
        `${template.id}: renders one task per item`,
        rendered.length === items.length,
        `got ${rendered.length}`
      );

      // The bug that shipped past a green review: a 0-commit item must not
      // advertise "**Commits:** 0 across 0 files".
      const leaked = rendered.filter((r) => /Commits:\*\*\s*0\b/.test(r.task.description ?? ""));
      check(`${template.id}: no "Commits: 0" line on zero-commit items`, leaked.length === 0);

      createdIds[template.id] = [];
      for (const r of rendered) {
        const task = await service.createTask(r.task, listId);
        createdIds[template.id].push(task.id);
      }
      check(
        `${template.id}: created ${rendered.length} tasks`,
        createdIds[template.id].length === rendered.length
      );
    }

    console.log("\n=== 4. Read back from ClickUp and verify stored fields ===");
    const standard = BUILTIN_TEMPLATES.find((t) => t.id === "builtin-standard")!;
    const renderedStandard = renderTasks(items, standard);

    for (let i = 0; i < renderedStandard.length; i++) {
      const expected = renderedStandard[i]!.task;
      const stored = await clickup(
        `/task/${createdIds["builtin-standard"]![i]}?include_markdown_description=true`
      );
      const label = `stored task ${i + 1}`;

      check(`${label}: name matches the rendered name`, stored.name === expected.name,
        `ClickUp has ${JSON.stringify(stored.name)}, rendered ${JSON.stringify(expected.name)}`);
      // Compare against `markdown_description`: ClickUp's plain `description`
      // has the markdown stripped (`**Type:**` comes back as `Type:`), so
      // comparing to that reports a mismatch for every template that emits any
      // markdown at all. Fall back to `description` only if the markdown field
      // is absent.
      // ClickUp strips the trailing two-space markdown hard-break markers the
      // built-in templates emit, so compare modulo per-line trailing whitespace.
      // Everything else must match exactly.
      const normalize = (text: string) =>
        text
          .split("\n")
          .map((l) => l.replace(/\s+$/, ""))
          .join("\n")
          .trim();
      const storedDescription = normalize(stored.markdown_description ?? stored.description ?? "");
      check(
        `${label}: description round-trips through ClickUp`,
        storedDescription === normalize(expected.description ?? ""),
        `ClickUp has ${JSON.stringify(storedDescription.slice(0, 90))}`
      );

      if (expected.priority) {
        const PRIORITY_NAMES: Record<string, string> = {
          urgent: "urgent", high: "high", normal: "normal", low: "low",
        };
        check(`${label}: priority round-trips (${expected.priority})`,
          stored.priority?.priority === PRIORITY_NAMES[expected.priority],
          `ClickUp has ${JSON.stringify(stored.priority?.priority)}`);
      }
      if (expected.timeEstimate) {
        check(`${label}: time estimate round-trips`,
          Number(stored.time_estimate) === expected.timeEstimate,
          `ClickUp has ${stored.time_estimate}, expected ${expected.timeEstimate}`);
      }
      if (expected.tags?.length) {
        const storedTags = (stored.tags ?? []).map((t: any) => t.name).sort();
        const missing = expected.tags.filter((t) => !storedTags.includes(t));
        check(`${label}: tags round-trip`, missing.length === 0,
          `missing ${JSON.stringify(missing)}, ClickUp has ${JSON.stringify(storedTags)}`);
      }
      // Status is informational: a fresh list's available statuses are not
      // guaranteed to include "complete", and ClickUpService deliberately omits
      // an unknown status rather than failing the create.
      notes.push(`${label}: rendered status ${JSON.stringify(expected.status)}, ClickUp stored ${JSON.stringify(stored.status?.status)}`);
    }

    console.log("\n=== 5. Markdown round-trip (export -> re-ingest) ===");
    const markdown = renderMarkdown(items, standard, { title: "E2E Report" });
    const reingested = await workItemsFromNotes(markdown);
    check("round-trip preserves item count", reingested.length === items.length,
      `${items.length} out -> ${reingested.length} back`);
    check("round-trip preserves titles",
      reingested.every((r, i) => r.title === items[i]!.title),
      JSON.stringify(reingested.map((r) => r.title)));
    check("round-trip preserves priority",
      reingested.every((r, i) => r.priority === items[i]!.priority),
      JSON.stringify(reingested.map((r) => r.priority)));
    check("round-trip preserves estimate",
      reingested.every((r, i) => r.estimateHours === items[i]!.estimateHours),
      JSON.stringify(reingested.map((r) => r.estimateHours)));
    check("markdown has no unresolved placeholders", !/\{\{|\}\}/.test(markdown));
  } finally {
    console.log("\n=== 6. Teardown ===");
    try {
      await clickup(`/list/${listId}`, { method: "DELETE" });
      console.log(`  deleted list ${listId}`);
    } catch (error) {
      console.log(`  !! FAILED to delete list ${listId} — delete it by hand: ${error}`);
      failures.push(`teardown: list ${listId} was not deleted`);
    }
  }

  if (notes.length) {
    console.log("\n=== Informational ===");
    for (const n of notes) console.log(`  · ${n}`);
  }

  console.log("\n=== Result ===");
  if (failures.length === 0) {
    console.log("  ALL CHECKS PASSED");
  } else {
    console.log(`  ${failures.length} FAILED:`);
    for (const f of failures) console.log(`   - ${f}`);
    process.exit(1);
  }
}

main().catch((error) => {
  console.error("\nE2E aborted:", error instanceof Error ? error.message : error);
  process.exit(1);
});
