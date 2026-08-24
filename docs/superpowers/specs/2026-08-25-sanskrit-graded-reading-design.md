# Sanskrit Graded Reading Design

## Goal

Make Sanskrit Level 4 closer to genuine graded reading by teaching the first
small, source-backed vocabulary slice from Wikner's lessons 5–11 and using it
in his printed, English-glossed sentences.

## Scope

- Add only vocabulary and inflected forms that Wikner actually prints and
  glosses in the selected sentences, beginning with *bālā* (girl) and *phala*
  (fruit).
- Add any genuinely required Devanagari letter lessons before a word that
  depends on them.
- Add the resulting source-quoted sentences at Level 4. Prefer varied noun,
  case, and verb constructions over further two-verb-plus-च agreement drills.
- Preserve the existing Level 4 drills. Re-leveling or removing them needs a
  separate curriculum-quality decision once there is enough replacement prose.

## Non-goals

- Do not add unsourced paradigm cells, Sanskrit moods, or a new Tamil source.
- Do not expand vocabulary merely because it is nearby in a grammar table.
- Do not treat a reconstructed English gloss as sufficient: each shipped
  sentence must have Wikner's printed English or an already-approved source
  policy that supplies it.

## Data and dependency design

Content remains declarative in `src/learn/content/sanskrit.ts`. A new Level 3
word declares the smallest `composedOf` list needed to render it. A Level 4
sentence declares the exact word or letter lessons needed to reconstruct every
token, and retains an in-file citation comment recording the Wikner lesson,
source-text line or PDF page, Sanskrit, and printed English gloss.

No engine changes are expected. Existing manifest validation remains the
boundary that prevents missing dependencies, illegal stages, duplicate IDs,
or invalid Sanskrit rendering.

## Validation

The implementation adds manifest tests that assert the exact new IDs, text,
glosses, dependencies, and bounded inventory totals. The focused manifest,
curriculum, and chanting suites must pass, followed by TypeScript, lint, and a
whitespace diff check. Documentation will record the actual sources, counts,
and the next remaining backlog item.

## Risks and guardrails

Wikner's extracted Devanagari is unreliable, so Roman text and English may be
read from the text layer but any uncertain Sanskrit glyph must be confirmed
from a rendered scan and independently supported where the project policy
requires it. A candidate sentence is excluded if even one token lacks a
taught, source-attested form or if its English gloss cannot be sourced.
