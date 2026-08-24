# Sanskrit Vocabulary Tranche Implementation Plan

> **For agentic workers:** REQUIRED: Use superpowers:subagent-driven-development (if subagents available) or superpowers:executing-plans to implement this plan. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Add the next source-attested Sanskrit vocabulary slice—√gam, √labh, and √vah—without expanding into later noun declensions or Level 4 curation.

**Architecture:** Extend the data-only Sanskrit manifest with the smallest set of prerequisite letter lessons and present-indicative word lessons. Preserve the existing rule that each item cites the primary source, has an exact gloss, and reconstructs only from already taught dependencies.

**Tech Stack:** TypeScript, Bun tests, the curriculum manifest validator.

---

## Chunk 1: Source-backed manifest content

### Task 1: Specify the new vocabulary contract

**Files:**
- Modify: `src/learn/content/manifests.test.ts`
- Modify: `src/learn/content/sanskrit.ts`

- [ ] **Step 1: Write failing manifest assertions**

Assert the minimal tranche delta: the sole new letter lesson is `skt-letter-chcha` (`च्छ`, `ccha`); the new Level-3 word lessons are `skt-word-gacchati` (`गच्छति`, “he goes”), `skt-word-labhate` (`लभते`, “he takes”), and `skt-word-vahati` (`वहति`, “he carries”). Assert each word's exact `composedOf` array and that no other vocabulary root is added.

- [ ] **Step 2: Run the focused test to verify it fails**

Run: `bun test src/learn/content/manifests.test.ts`
Expected: FAIL because the vocabulary lessons do not yet exist.

- [ ] **Step 3: Read the primary-source reference sheet**

Use Wikner 4.B.1 (source-text lines 1087–1092) as the authority for the roman forms and English meanings, and its 7.A.6 conjunct table as the authority for `च्छ`. Establish the three word spellings by reading the rendered Wikner PDF directly; record its PDF page alongside the source-text lines. Cross-check the glyphs against *Sanskritabodhini 2*'s printed present-tense table, which prints `गच्छति`, `वहति`, and `लभते` together. Do not construct a form or glyph from remembered morphology.

- [ ] **Step 4: Add only required letter lessons and the three word lessons**

Add `च्छ` in the initial `letters` section—never adjacent to the words—then add the three source-attested present forms at Level 3. `ग`, `ल`, `भ`, `व`, `ह`, `ति`, and `ते` already exist, so no other letter lesson is in scope. Follow existing comment density and `composedOf` conventions.

- [ ] **Step 5: Run focused content tests**

Run: `bun test src/learn/content/manifests.test.ts src/learn/Curriculum.test.ts`
Expected: PASS.

- [ ] **Step 6: Commit**

```bash
git add src/learn/content/sanskrit.ts src/learn/content/manifests.test.ts
git commit -m "feat(learn): add Sanskrit vocabulary tranche"
```

## Chunk 2: Documentation and verification

### Task 2: Record the shipped tranche and verify regressions

**Files:**
- Modify: `docs/specs/2026-08-11-sanskrit-tamil-curriculum-plan.md`
- Modify: `STATUS.md`

- [ ] **Step 1: Document source, scope, lesson counts, and remaining blockers**

Append the tranche result to the curriculum plan and update the status document's next-step wording. Preserve the explicit distinction between source-attested content and future Level 4 work.

- [ ] **Step 2: Run complete available verification**

Run: `bun test src/learn/content/manifests.test.ts src/learn/Curriculum.test.ts src/learn/content/chanting.test.ts`, `npx tsc --noEmit`, and `npm run lint`.
Expected: all commands pass; report any full-suite limitation separately.

- [ ] **Step 3: Commit**

```bash
git add docs/specs/2026-08-11-sanskrit-tamil-curriculum-plan.md STATUS.md
git commit -m "docs(learn): record Sanskrit vocabulary tranche"
```
