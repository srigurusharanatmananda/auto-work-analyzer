# Sanskrit Graded Reading Design

## Goal

Make Sanskrit Level 4 closer to genuine graded reading by teaching the first
small, source-backed vocabulary slice from Wikner's lessons 5–11 and using it
in his printed, English-glossed sentences.

## Scope

- This first slice is exactly five lessons from Wikner 6.B.4: letter lessons
  `skt-letter-laa` (ला) and `skt-letter-bhe` (भे); Level 3 words
  `skt-word-bala` (बाला, girl), `skt-word-phalam` (फलम्, fruit as the
  accusative singular), and `skt-word-labhe` (लभे, I take); and the two
  Level 4 sentences below. No other Lesson 5–11 form is in scope.
- Add the two source-quoted sentences at Level 4:
  `skt-sentence-narah-tishthati-ca-bala-vadati` — नरः तिष्ठति च बाला वदति
  (“The man stands and the girl speaks”), Wikner 6.B.4(d)1 and its answer;
  `skt-sentence-ashvam-nayethe-ca-phalam-labhe` — अश्वम् नयेथे च फलम् लभे
  (“You (two) lead the horse and I take the fruit”), 6.B.4(d)2 and its
  answer.
- The completed inventory is fixed at 262 Sanskrit lessons: 117 letters, 99
  words, and 48 sentences. These bounds make any later vocabulary expansion
  an explicit follow-up tranche rather than incidental scope growth.
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
sentence declares only the exact word lessons needed to reconstruct every
token; letters compose words, never sentences. Each sentence retains an
in-file citation comment recording the Wikner lesson, source-text line or PDF
page, Sanskrit, and printed English gloss.

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
