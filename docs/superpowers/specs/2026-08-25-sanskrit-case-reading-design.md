# Sanskrit Case Reading Design

## Goal

Add one source-backed Sanskrit sentence that reads as a short scene rather than
a conjugation drill, while teaching the smallest set of forms it requires.

## Fixed scope

This tranche contains exactly five Sanskrit lessons from Wikner 6.B.2/6.B.4:

- Level 1 letters `skt-letter-le` (ले) and `skt-letter-kshe` (क्षे).
- Level 3 words `skt-word-bale` (बाले, the two girls) and
  `skt-word-vrksesu` (वृक्षेषु, among the trees).
- Level 4 sentence `skt-sentence-bale-vrksesu-tishthatah-vadatah-ca`:
  `बाले वृक्षेषु तिष्ठतः वदतः च` — “The girls (two) stand among the trees
  and speak.”

Wikner prints the form paradigms at PDF p.60 (6.B.2), the Sanskrit sentence in
Roman transliteration at PDF p.62 (6.B.4(c)6), and its English answer at PDF
p.135 (Answers: Lesson 6, misheaded 6.B.3.c.1). The manifest Devanagari must
therefore be independently established and its letter decomposition recorded
in the source comments.

## Boundaries

No other 6.B.4 form or sentence is included. In particular, do not add
instrumental, genitive, dative, or further plural forms merely because they
appear nearby in the paradigms. The target inventory becomes 269 Sanskrit
lessons: 119 letters, 101 words, and 49 sentences. Tamil remains unchanged.

## Data and validation

The new words depend only on letter lessons. The Level 4 sentence depends only
on its five word lessons: the two new words plus existing `tiṣṭhataḥ`,
`vadataḥ`, and `ca`. A regression test locks all five new IDs, their exact
text/gloss/dependencies, and the 269/119/101/49 inventory. Run manifest and
curriculum tests, TypeScript, lint, and diff checks before documenting the
tranche.
