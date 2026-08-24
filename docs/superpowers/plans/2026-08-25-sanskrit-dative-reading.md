# Sanskrit Dative Reading Implementation Plan

> **For agentic workers:** REQUIRED: Use superpowers:subagent-driven-development (if subagents available) or superpowers:executing-plans to implement this plan. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Add `phalāya` and Wikner 6.B.4(c)1 as a bounded Sanskrit dative-reading slice.

**Architecture:** One new Level 3 word uses existing letter lessons; one Level 4 sentence joins it with four existing word lessons. A focused manifest test owns the 271/119/102/50 inventory boundary.

**Tech Stack:** TypeScript, Bun, existing curriculum manifest validation.

---

### Task 1: Write the failing manifest contract

- [ ] Add a `manifests.test.ts` test for 271 Sanskrit lessons (119 letters, 102 words, 50 sentences), `skt-word-phalaya` (`फलाय`; `phalāya — for fruit (neuter dative singular)`; `[skt-letter-pha, skt-letter-laa, skt-letter-ya]`), and `skt-sentence-bala-ashvam-vrksam-phalaya-nayate` (`बाला अश्वम् वृक्षम् फलाय नयते`; exact gloss; `[skt-word-bala, skt-word-ashvam, skt-word-vrksam, skt-word-phalaya, skt-word-nayate]`).
- [ ] Run `bun test src/learn/content/manifests.test.ts` and confirm RED because 271/new IDs are absent.
- [ ] Commit the test as `test(learn): specify Sanskrit dative-reading tranche`.

### Task 2: Add the manifest data

- [ ] Add exactly the word and sentence in `src/learn/content/sanskrit.ts`, at Levels 3 and 4.
- [ ] Cite Wikner PDF p.60 6.B.2, p.62 6.B.4(c)1, and p.135's English answer. Note that p.62 is Roman transliteration and Devanagari is reconstructed only from existing attested `pha`/`lā`/`ya` word components.
- [ ] Run the focused manifest test to GREEN and commit as `feat(learn): add Sanskrit dative-reading tranche`.

### Task 3: Record and verify

- [ ] Update `STATUS.md` and `docs/specs/2026-08-11-sanskrit-tamil-curriculum-plan.md` for tranche 28, Sanskrit 269→271, Tamil 315, and Level 4 33→34.
- [ ] Run focused curriculum/chanting tests, `npx tsc --noEmit`, `npm run lint`, and `git diff --check`.
- [ ] Commit docs as `docs: record Sanskrit dative-reading tranche`.
