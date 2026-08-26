---
name: sanskrit-curriculum-delivery
description: Deliver source-attested Sanskrit curriculum tranches with provenance, manifest validation, and concise review-ready commits. Use for Sanskrit lesson or vocabulary additions; not for unrelated learning features.
---

## Workflow

1. Confirm the source prints the target form and supports its English gloss. For OCR ambiguity, corroborate from the source's answer key or a scan before adding the form.
2. Check that every Devanagari component is already taught. If not, cite the source that attests each necessary atomic form.
3. Add a focused expectation to `src/learn/content/manifests.test.ts` first and run it red.
4. Add the minimal manifest records. A `sentences` record must space-join its word lessons exactly.
5. Record the tranche, source pages, and changed counts in `docs/specs/2026-08-11-sanskrit-tamil-curriculum-plan.md`; keep `STATUS.md` aligned.
6. Run `npm run learn:audit-sanskrit` and `npm run learn:verify-sanskrit`. Do not claim success without their fresh output.

## Boundaries

- Keep beginner Wikner material separate from Lanman's classical-reading pilot unless the user deliberately changes curriculum policy.
- Do not infer missing glyphs or English glosses from model knowledge. A new source or a user decision is required.
- Commit tests, implementation, and provenance as reviewable units; push only when authorized.
