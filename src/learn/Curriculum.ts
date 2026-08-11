/**
 * The engine for "what is next", language-agnostic by construction. See
 * `docs/specs/2026-08-08-learning-module-design.md` ("Decided: both
 * languages" / "The curriculum is data, not code").
 *
 * A `Manifest` is one language's lesson graph. There is exactly one engine
 * reading it — the moment a lesson's shape needs a TypeScript branch instead
 * of a manifest field, that is a sign the engine is missing a concept, not
 * that the language needs an exception. Sanskrit and Tamil are both meant to
 * be ordinary data to this file.
 *
 * The property that makes a manifest a *curriculum* rather than a flat list:
 * a lesson may only be composed of material the stage before it already
 * taught. `validateManifest` checks that mechanically; `nextLesson` trusts a
 * manifest that has already passed it, so it stays cheap enough to call on
 * every "what's next" request.
 */

import type { Language } from './Transliterator.js';

export type Stage = 'letters' | 'words' | 'sentences';

/** Stage 4 ("Chanting") is deferred per the spec and has no lesson shape yet. */
const STAGE_SEQUENCE: readonly Stage[] = ['letters', 'words', 'sentences'];

/**
 * The learner-facing tier a lesson belongs to — coarser than `stage`, and
 * answering a different question. `stage` is the engine's dependency
 * mechanism ("a word is built from letters, in order"); `level` is what a
 * learner sees as "how far along am I" and never gates anything itself —
 * two lessons in the same stage can be different levels (a first, common
 * word versus an obscure one built the same way), and `validateManifest`
 * only checks that level is monotonic with dependency order, not that it
 * lines up with stage. See `docs/specs/2026-08-11-sanskrit-tamil-curriculum-plan.md`
 * for why these five and not some other number — they are that plan's own
 * beginner/intermediate/upper-intermediate/advanced tiers, given names and
 * numbers so the UI can show a learner where they actually are.
 */
export type LevelId = 1 | 2 | 3 | 4 | 5;

export interface LevelInfo {
  readonly id: LevelId;
  readonly name: string;
  readonly description: string;
}

/**
 * Order matters here in exactly one way: it is display order, not a
 * dependency chain like `STAGE_SEQUENCE` — nothing checks that level 3
 * content exists before level 4 does, only that a given LESSON's level is
 * not lower than what it depends on (see `validateManifest`). A language
 * can genuinely have level 4 content before level 3, if that is what its
 * primer actually teaches first; the UI showing "coming soon" for an empty
 * level is a content-completeness signal, not an engine rule.
 */
export const LEVELS: readonly LevelInfo[] = [
  { id: 1, name: 'The Alphabet', description: 'Every letter, read on sight — no meaning yet, just recognition.' },
  { id: 2, name: 'First Words', description: 'Real vocabulary, built only from letters already taught.' },
  {
    id: 3,
    name: 'Grammar & Sentences',
    description: 'Sandhi (Sanskrit) or letter-junction rules (Tamil), noun cases, verb forms — sentences that read like real text, not two words placed side by side.',
  },
  { id: 4, name: 'Reading Practice', description: 'Graded reading of real text, dictionary in hand.' },
  { id: 5, name: 'Classical Texts', description: 'Unglossed reading of real scripture/literature, and composition.' },
];

export interface Lesson {
  /** Unique within the manifest. Stable — `Progress` persists it. */
  readonly id: string;
  readonly stage: Stage;
  /** Which of `LEVELS` this lesson belongs to — see that constant's own comment for what level is and is not. */
  readonly level: LevelId;
  /** What the learner sees, in the language's native script. */
  readonly text: string;
  /** English gloss, for the UI — not used by the engine itself. */
  readonly gloss: string;
  /**
   * Ids of earlier lessons this one is built from — the letters a word uses,
   * or the words a sentence uses. Empty for `letters`, which are atomic.
   *
   * Declared by the content author rather than parsed out of `text`:
   * segmenting Devanagari or Tamil into the graphemes a curriculum actually
   * teaches (conjuncts, vowel signs) is exactly the kind of judgment call a
   * parser gets silently wrong, and this is the file where a silent wrong
   * answer is unrecoverable.
   */
  readonly composedOf: readonly string[];
}

/**
 * How a stage's `text` must reconstruct from its `composedOf` dependencies'
 * `text` — the one thing `validateManifest` could not check until this rule
 * existed, and content authors were relying on comments alone to get right.
 * `words` concatenate directly (`कण` = `क` + `ण`); `sentences` join with a
 * single space (`नरः वदति` = `नरः` + ` ` + `वदति`) — Sanskrit and Tamil are
 * both written left-to-right with spaces between words but none within one,
 * so this is a property of the stage, not a per-language choice.
 */
const JOINER: Readonly<Record<'words' | 'sentences', string>> = {
  words: '',
  sentences: ' ',
};

export interface Manifest {
  readonly language: Language;
  /**
   * Curriculum order. This *is* the dependency order — a lesson's
   * prerequisites, per `composedOf`, must appear earlier in this array.
   */
  readonly lessons: readonly Lesson[];
}

export interface ManifestError {
  readonly lessonId: string;
  readonly reason: string;
}

function prerequisiteStage(stage: Stage): Stage | null {
  const index = STAGE_SEQUENCE.indexOf(stage);
  return index <= 0 ? null : STAGE_SEQUENCE[index - 1];
}

/** Everything a dependency lookup needs to know about an earlier lesson, one entry per lesson id. */
interface LessonMeta {
  readonly index: number;
  readonly stage: Stage;
  readonly text: string;
  readonly level: LevelId;
}

/**
 * Every way a manifest can fail to be a curriculum: a lesson id reused, a
 * dependency that does not exist, a dependency from the wrong stage, a
 * dependency that has not been taught yet because it appears later, a
 * dependency whose level is higher than the lesson built from it, or a
 * `text` that does not actually reconstruct from `composedOf` per `JOINER`.
 * That last check is what stops `composedOf` from silently drifting out of
 * sync with `text` — a typo, a stale copy-paste, or swapped word order would
 * previously pass every other check here.
 *
 * Returns every violation found rather than stopping at the first, since a
 * content author fixing a manifest by hand wants the whole list in one pass.
 */
export function validateManifest(manifest: Manifest): readonly ManifestError[] {
  const errors: ManifestError[] = [];
  const metaById = new Map<string, LessonMeta>();

  manifest.lessons.forEach((lesson, index) => {
    if (metaById.has(lesson.id)) {
      errors.push({ lessonId: lesson.id, reason: 'duplicate lesson id' });
      return;
    }
    metaById.set(lesson.id, { index, stage: lesson.stage, text: lesson.text, level: lesson.level });
  });

  manifest.lessons.forEach((lesson, index) => {
    const wantStage = prerequisiteStage(lesson.stage);

    if (wantStage === null) {
      if (lesson.composedOf.length > 0) {
        errors.push({
          lessonId: lesson.id,
          reason: `a '${lesson.stage}' lesson is atomic and must not declare composedOf`,
        });
      }
      return;
    }

    if (lesson.composedOf.length === 0) {
      errors.push({
        lessonId: lesson.id,
        reason: `a '${lesson.stage}' lesson must be composed of '${wantStage}' lessons already taught`,
      });
      return;
    }

    let everyDepResolved = true;

    for (const depId of lesson.composedOf) {
      const dep = metaById.get(depId);

      if (dep === undefined) {
        errors.push({ lessonId: lesson.id, reason: `composedOf references unknown lesson '${depId}'` });
        everyDepResolved = false;
        continue;
      }
      if (dep.stage !== wantStage) {
        errors.push({
          lessonId: lesson.id,
          reason: `composedOf '${depId}' is a '${dep.stage}' lesson, expected '${wantStage}'`,
        });
      }
      if (dep.index >= index) {
        errors.push({
          lessonId: lesson.id,
          reason: `composedOf '${depId}' has not been taught yet — it appears later in the manifest`,
        });
      }

      // Level is a display grouping, not a dependency chain (see LEVELS's own
      // comment) — but a lesson claiming an EARLIER level than something it
      // is built from is not a display choice, it is incoherent: a learner
      // "at level 1" would be shown a word that reaches back into level 2
      // content they have not been told exists yet.
      if (dep.level > lesson.level) {
        errors.push({
          lessonId: lesson.id,
          reason: `is level ${lesson.level} but depends on '${depId}', which is level ${dep.level}`,
        });
      }
    }

    // Only checked once every dependency actually resolved — an unknown-id
    // error above already explains why reconstruction can't be checked, and
    // piling a second, derived error on top of it would just be noise.
    // `lesson.stage`, not `wantStage`: the joiner is a property of what this
    // lesson IS (a word or a sentence), not of the prerequisite stage it
    // draws on.
    if (everyDepResolved) {
      const joiner = JOINER[lesson.stage as 'words' | 'sentences'];
      const reconstructed = lesson.composedOf.map((depId) => metaById.get(depId)?.text).join(joiner);
      if (reconstructed !== lesson.text) {
        errors.push({
          lessonId: lesson.id,
          reason:
            `text '${lesson.text}' does not match composedOf reconstructed as '${reconstructed}' ` +
            `(joining ${lesson.stage} with ${JSON.stringify(joiner)})`,
        });
      }
    }
  });

  return errors;
}

/**
 * The single "continue" affordance the spec asks for, not a menu: the
 * learner's next lesson, in manifest order, or `null` once every lesson in
 * the manifest has been seen.
 *
 * Takes the seen-lesson-id set as a plain argument rather than reading
 * `Progress` itself, so this stays a pure function of its inputs — easy to
 * test, and reusable if `Progress` ever gains a richer notion of "learned"
 * than "seen at least once".
 */
export function nextLesson(manifest: Manifest, seenLessonIds: ReadonlySet<string>): Lesson | null {
  return manifest.lessons.find((lesson) => !seenLessonIds.has(lesson.id)) ?? null;
}
