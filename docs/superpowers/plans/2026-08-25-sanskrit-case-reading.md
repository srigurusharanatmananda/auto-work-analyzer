# Sanskrit Case Reading Implementation Plan

> **For agentic workers:** REQUIRED: Use superpowers:subagent-driven-development (if subagents available) or superpowers:executing-plans to implement this plan. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Add the five-lesson Wikner 6.B.4(c)6 case-reading slice and its Level 4 scene.

**Architecture:** Declarative Sanskrit manifest data only: two letter forms build two new declensional word forms, and a Level 4 sentence joins those with three existing words. A manifest test fixes the exact scope at 269 total Sanskrit lessons.

**Tech Stack:** TypeScript, Bun tests, existing curriculum manifest validation.

---

### Task 1: Specify the five-lesson contract

**Files:**
- Modify: `src/learn/content/manifests.test.ts`

- [ ] **Step 1: Write a failing test**

Assert 269 Sanskrit lessons: 119 letters, 101 words, 49 sentences. Lock all fields:

```ts
skt-letter-le: { stage: 'letters', level: 1, text: 'ले', gloss: 'le', composedOf: [] }
skt-letter-kshe: { stage: 'letters', level: 1, text: 'क्षे', gloss: 'kṣe', composedOf: [] }
skt-word-bale: {
  stage: 'words', level: 3, text: 'बाले',
  gloss: 'bāle — the two girls (feminine nominative dual)',
  composedOf: ['skt-letter-baa', 'skt-letter-le'],
}
skt-word-vrksesu: {
  stage: 'words', level: 3, text: 'वृक्षेषु',
  gloss: 'vṛkṣeṣu — among the trees (locative plural)',
  composedOf: ['skt-letter-vri', 'skt-letter-kshe', 'skt-letter-ssu'],
}
skt-sentence-bale-vrksesu-tishthatah-vadatah-ca: {
  stage: 'sentences', level: 4,
  text: 'बाले वृक्षेषु तिष्ठतः वदतः च',
  gloss: 'bāle vṛkṣeṣu tiṣṭhataḥ vadataḥ ca — the girls (two) stand among the trees and speak',
  composedOf: ['skt-word-bale', 'skt-word-vrksesu', 'skt-word-tishthatah', 'skt-word-vadatah', 'skt-word-ca'],
}
```

- [ ] **Step 2: Verify RED**

Run `bun test src/learn/content/manifests.test.ts`; it must fail because the new IDs and 269 total do not exist.

- [ ] **Step 3: Commit red test**

`git commit -m "test(learn): specify Sanskrit case-reading tranche"`

### Task 2: Add the source-backed manifest content

**Files:**
- Modify: `src/learn/content/sanskrit.ts`

- [ ] **Step 1: Add letters and words**

Add exactly `ले`, `क्षे`, `बाले`, and `वृक्षेषु`, using the dependencies above. Comments must cite Wikner PDF p.60 6.B.2 for the paradigms and p.62 for the Roman/diacritic forms. The Devanagari provenance is explicitly compositional: `ले` uses the consonant from `skt-letter-la` plus the e-sign attested in `skt-letter-se` (Whitney p.293 §735.a, भवसे); `क्षे` uses Wikner 7.A.3–7.A.4's established `skt-letter-ksa` conjunct plus that same Whitney e-sign attestation. State these exact locators and the deliberate letter-composition policy in the new comments.

- [ ] **Step 2: Add sentence**

Add exactly the source-quoted Level 4 sentence and word-only dependency list. Cite Wikner PDF p.62 6.B.4(c)6 and PDF p.135’s English answer (misheaded 6.B.3.c.1).

- [ ] **Step 3: Verify GREEN and commit**

Run `bun test src/learn/content/manifests.test.ts`; it must pass. Commit only `sanskrit.ts` with `feat(learn): add Sanskrit case-reading tranche`.

### Task 3: Update records and verify

**Files:**
- Modify: `STATUS.md`
- Modify: `docs/specs/2026-08-11-sanskrit-tamil-curriculum-plan.md`

- [ ] **Step 1: Update counts and backlog**

Record tranche 27, Sanskrit 264→269, Tamil unchanged at 315, and Level 4 32→33. Preserve the next backlog as further bounded vocabulary, not re-leveling.

- [ ] **Step 2: Run verification**

Run `bun test src/learn/content/manifests.test.ts src/learn/Curriculum.test.ts src/learn/content/chanting.test.ts`, `npx tsc --noEmit`, `npm run lint`, and `git diff --check`.

- [ ] **Step 3: Commit docs**

`git commit -m "docs: record Sanskrit case-reading tranche"`
