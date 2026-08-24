# Sanskrit Graded Reading Implementation Plan

> **For agentic workers:** REQUIRED: Use superpowers:subagent-driven-development (if subagents available) or superpowers:executing-plans to implement this plan. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Add the bounded, source-backed first Sanskrit graded-reading tranche: three Level 3 forms and two varied Level 4 sentences from Wikner 6.B.4.

**Architecture:** Keep all production changes declarative in the Sanskrit curriculum manifest. Two new letter lessons make the new Level 3 forms renderable; the two Level 4 lessons depend exclusively on word IDs, as required by `validateManifest`. A focused manifest test locks the seven-lesson scope and final stage totals.

**Tech Stack:** TypeScript, Bun test runner, existing `Manifest`/`validateManifest` curriculum engine.

---

## File structure

- Modify: `src/learn/content/manifests.test.ts` — exact-ID and inventory regression test.
- Modify: `src/learn/content/sanskrit.ts` — two source-attested letters, three words, and two Level 4 sentences with Wikner 6.B.4 citations.
- Modify: `docs/specs/2026-08-11-sanskrit-tamil-curriculum-plan.md` — tranche log and next-step update.
- Modify: `STATUS.md` — current count and remaining curriculum status.

### Task 1: Lock the bounded curriculum contract

**Files:**
- Modify: `src/learn/content/manifests.test.ts`

- [ ] **Step 1: Write the failing test**

Add a test asserting a 264-lesson Sanskrit inventory (117 letters, 99 words, 48 sentences), and all seven additions with their exact stage, level, text, gloss, and `composedOf` values. In particular assert the two letters, all three words, and both sentences:

```ts
expect(byId.get('skt-letter-laa')).toMatchObject({
  stage: 'letters', level: 1, text: 'ला', gloss: 'lā', composedOf: [],
});
expect(byId.get('skt-letter-bhe')).toMatchObject({
  stage: 'letters', level: 1, text: 'भे', gloss: 'bhe', composedOf: [],
});
expect(byId.get('skt-word-bala')).toMatchObject({
  stage: 'words', level: 3, text: 'बाला',
  gloss: 'bālā — the girl (feminine nominative singular)',
  composedOf: ['skt-letter-baa', 'skt-letter-laa'],
});
expect(byId.get('skt-sentence-narah-tishthati-ca-bala-vadati')).toMatchObject({
  stage: 'sentences', level: 4, text: 'नरः तिष्ठति च बाला वदति',
  gloss: 'naraḥ tiṣṭhati ca bālā vadati — the man stands and the girl speaks',
  composedOf: ['skt-word-narah', 'skt-word-tishthati', 'skt-word-ca', 'skt-word-bala', 'skt-word-vadati'],
});
expect(byId.get('skt-word-phalam')).toMatchObject({
  stage: 'words', level: 3, text: 'फलम्',
  gloss: 'phalam — the fruit (neuter accusative singular)',
  composedOf: ['skt-letter-pha', 'skt-letter-la', 'skt-letter-ma-halanta'],
});
expect(byId.get('skt-word-labhe')).toMatchObject({
  stage: 'words', level: 3, text: 'लभे',
  gloss: 'labhe — I take (1st person singular present, ātmanepada)',
  composedOf: ['skt-letter-la', 'skt-letter-bhe'],
});
expect(byId.get('skt-sentence-ashvam-nayethe-ca-phalam-labhe')).toMatchObject({
  stage: 'sentences', level: 4, text: 'अश्वम् नयेथे च फलम् लभे',
  gloss: 'aśvam nayethe ca phalam labhe — you (two) lead the horse and I take the fruit',
  composedOf: ['skt-word-ashvam', 'skt-word-nayethe', 'skt-word-ca', 'skt-word-phalam', 'skt-word-labhe'],
});
```

- [ ] **Step 2: Run the focused test to verify it fails**

Run: `bun test src/learn/content/manifests.test.ts`

Expected: FAIL because the new lesson IDs and 264-item inventory do not yet exist.

- [ ] **Step 3: Commit the red test only**

```bash
git add src/learn/content/manifests.test.ts
git commit -m "test(learn): specify Sanskrit graded-reading tranche"
```

### Task 2: Add the source-attested content

**Files:**
- Modify: `src/learn/content/sanskrit.ts`

- [ ] **Step 1: Add the two needed letter lessons**

Add `skt-letter-laa` (ला) and `skt-letter-bhe` (भे) to the existing letters stage, citing Wikner 6.A.1's vowel-sign rule plus the exact PDF page or source-text locator, and the current file's established same-sign-on-another-consonant evidence. Confirm each new glyph against a rendered scan; use independent confirmation for any glyph the scan does not make certain. Do not add unrelated signs.

- [ ] **Step 2: Add the three Level 3 words**

Add `skt-word-bala` (बाला, feminine nominative singular), `skt-word-phalam` (फलम्, neuter accusative singular), and `skt-word-labhe` (लभे, first-person singular present ātmanepada). Use only letter dependencies and retain comments with the exact Wikner 6.B.1/6.B.4 PDF page or source-text line, a rendered-scan/independent Devanagari verification, and printed English gloss.

- [ ] **Step 3: Add the two Level 4 sentences**

Add exactly these word-only dependency lists and Wikner 6.B.4(d)/answer comments, each carrying the exact PDF page or source-text line, rendered-scan confirmation of the Sanskrit, and Wikner's printed English:

```text
नरः तिष्ठति च बाला वदति — The man stands and the girl speaks.
अश्वम् नयेथे च फलम् लभे — You (two) lead the horse and I take the fruit.
```

- [ ] **Step 4: Run the focused test to verify it passes**

Run: `bun test src/learn/content/manifests.test.ts`

Expected: PASS, including `validateManifest` over Sanskrit.

- [ ] **Step 5: Commit the green implementation**

```bash
git add src/learn/content/sanskrit.ts src/learn/content/manifests.test.ts
git commit -m "feat(learn): add Sanskrit graded-reading tranche"
```

### Task 3: Record status and verify the integration

**Files:**
- Modify: `docs/specs/2026-08-11-sanskrit-tamil-curriculum-plan.md`
- Modify: `STATUS.md`

- [ ] **Step 1: Update the plan and status**

Record tranche 26, the exact seven lessons, update Sanskrit from 257 to 264 while preserving Tamil at 315, and state that future Level 4 work remains a separate vocabulary tranche.

- [ ] **Step 2: Run focused regression checks**

Run: `bun test src/learn/content/manifests.test.ts src/learn/Curriculum.test.ts src/learn/content/chanting.test.ts`; `npx tsc --noEmit`; `npm run lint`; `git diff --check`.

Expected: all commands succeed.

- [ ] **Step 3: Commit documentation**

```bash
git add STATUS.md docs/specs/2026-08-11-sanskrit-tamil-curriculum-plan.md
git commit -m "docs: record Sanskrit graded-reading tranche"
```
