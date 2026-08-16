/**
 * `LEARN_LEVELS` (ui/types/index.ts) is a hand-copied mirror of `LEVELS`
 * (src/learn/Curriculum.ts). Nothing generated it and, until this file,
 * nothing checked it — the two could drift apart silently, and the UI reads
 * only its own copy, so the drift would surface as a learner being shown a
 * level name or description the engine does not agree with.
 *
 * Guarded from the UI side rather than the API side because this is the side
 * that would be wrong: the engine's `LEVELS` is the definition, the UI's copy
 * exists only so the front-end need not fetch a constant. The reach across
 * the package boundary is deliberate and is what makes the test meaningful —
 * `Curriculum.ts` imports nothing at runtime (its one import is `import type`,
 * erased at compile time), so importing it here costs nothing and drags in no
 * server code.
 *
 * Deliberately compares the full objects, not just ids or length. A
 * description that drifted while the names still matched is exactly the kind
 * of divergence a shallower check would wave through, and the descriptions
 * are learner-facing copy.
 */
import { describe, expect, test } from 'bun:test';
import { LEVELS } from '../../src/learn/Curriculum.js';
import { LEARN_LEVELS } from './index.js';

describe('LEARN_LEVELS mirrors the engine LEVELS', () => {
  test('the two lists are identical, field for field and in the same order', () => {
    // `toEqual` over the whole array covers count, order, ids, names and
    // descriptions in one assertion — and reports the exact differing field
    // when it fails, which is what someone editing one copy needs to see.
    expect(LEARN_LEVELS.map((level) => ({ ...level }))).toEqual(
      LEVELS.map((level) => ({ ...level }))
    );
  });
});
