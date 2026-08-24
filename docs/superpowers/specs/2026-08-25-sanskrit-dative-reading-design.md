# Sanskrit Dative Reading Design

## Goal

Add the smallest source-backed vocabulary slice that turns Wikner 6.B.4(c)1
into a Level 4 reading sentence.

## Fixed scope

This tranche is exactly two Sanskrit lessons:

- Level 3 word `skt-word-phalaya`: `फलाय` (*phalāya*), “for fruit” (neuter
  dative singular), composed of existing `pha`, `lā`, and `ya` letters.
- Level 4 sentence `skt-sentence-bala-ashvam-vrksam-phalaya-nayate`:
  `बाला अश्वम् वृक्षम् फलाय नयते` — “The girl leads the horse to the tree for
  fruit.” Its dependencies are the new word plus existing `bālā`, `aśvam`,
  `vṛkṣam`, and `nayate` words.

No letter lessons are required. Wikner's 6.B.2 paradigm at PDF p.60 gives
*phalāya*; 6.B.4(c)1 at p.62 supplies the Roman-transliterated sentence; and
the Lesson 6 answer at PDF p.135 supplies the printed English. Devanagari is
recorded through existing independently attested letter forms, not inferred
from a purported Devanagari source text.

## Boundaries and validation

The inventory becomes 271 Sanskrit lessons: 119 letters, 102 words, and 50
sentences. No nearby feminine or instrumental forms are in scope. A manifest
test locks the two IDs, exact text/gloss/dependencies, and these totals; then
the focused curriculum suite, TypeScript, lint, and diff checks validate it.
