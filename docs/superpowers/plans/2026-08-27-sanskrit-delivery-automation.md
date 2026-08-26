# Sanskrit Delivery Automation Implementation Plan

> **For agentic workers:** REQUIRED: Use superpowers:subagent-driven-development (if subagents available) or superpowers:executing-plans to implement this plan. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Make each Sanskrit curriculum tranche independently auditable and repeatably verifiable with one repository command and a reusable Codex skill.

**Architecture:** A small TypeScript audit script imports the manifest and reports stable lesson/stage/Level 4 counts. A focused npm command runs the audit plus the existing manifest and curriculum tests. A project skill directs agents through source evidence, test-first changes, provenance updates, and the focused gate. CI runs the focused gate when curriculum files change.

**Tech Stack:** TypeScript, tsx, Bun tests, GitHub Actions, Codex skills.

---

## Chunk 1: Repository verification

### Task 1: Curriculum count audit

**Files:**
- Create: `scripts/audit-sanskrit-curriculum.ts`
- Create: `scripts/audit-sanskrit-curriculum.test.ts`
- Modify: `package.json`

- [ ] Write a failing test for stable aggregate counts and Level 4 sentence count.
- [ ] Implement an audit script that prints a single JSON summary from the actual manifest.
- [ ] Add `learn:audit-sanskrit` and `learn:verify-sanskrit` npm scripts.
- [ ] Run the focused command and commit.

### Task 2: Pull-request gate

**Files:**
- Create: `.github/workflows/sanskrit-curriculum.yml`

- [ ] Run the focused verification command on changes to Sanskrit curriculum files and workflow/script files.
- [ ] Validate the workflow YAML locally and commit.

## Chunk 2: Reusable agent workflow

### Task 3: Project skill

**Files:**
- Create: `.codex/skills/sanskrit-curriculum-delivery/SKILL.md`

- [ ] Record the non-obvious source, test, provenance, verification, and stopping rules.
- [ ] Validate its frontmatter and ensure it directs agents to the repository commands.
- [ ] Commit the skill and update `STATUS.md` with the delivery workflow.

## Chunk 3: Account-level automation handoff

### Task 4: Scheduled-task instructions

**Files:**
- Create: `docs/operations/codex-sanskrit-delivery.md`

- [ ] Provide a ready-to-paste durable-goal prompt and setup instructions.
- [ ] Make clear that scheduling/enabling a cloud teammate requires the account owner in Codex.
- [ ] Commit after the focused verification command passes.
