/**
 * `Manifest` content here is shaped like Sanskrit or Tamil, not authored
 * Sanskrit or Tamil — the real manifests are their own task. The point of
 * having two independently-shaped fixtures is the design doc's own
 * requirement: "a test that only covers Sanskrit proves half of it." If
 * `validateManifest` or `nextLesson` ever grew a branch that happened to work
 * for one language's data shape and not the other, one of these two would
 * catch it and the other would not.
 */

import { describe, expect, test } from 'bun:test';
import { type Manifest, nextLesson, validateManifest } from './Curriculum.js';

const sanskritManifest: Manifest = {
  language: 'sanskrit',
  lessons: [
    { id: 'skt-ma', stage: 'letters', level: 1, text: 'म', gloss: 'ma', composedOf: [] },
    { id: 'skt-na', stage: 'letters', level: 1, text: 'न', gloss: 'na', composedOf: [] },
    { id: 'skt-ra', stage: 'letters', level: 1, text: 'र', gloss: 'ra', composedOf: [] },
    {
      id: 'skt-mana',
      stage: 'words',
      level: 2,
      text: 'मन',
      gloss: 'mind',
      composedOf: ['skt-ma', 'skt-na'],
    },
    {
      id: 'skt-nara',
      stage: 'words',
      level: 2,
      text: 'नर',
      gloss: 'man',
      composedOf: ['skt-na', 'skt-ra'],
    },
    {
      id: 'skt-sentence',
      stage: 'sentences',
      level: 2,
      text: 'मन नर',
      gloss: 'illustrative only — not authored Sanskrit grammar',
      composedOf: ['skt-mana', 'skt-nara'],
    },
  ],
};

const tamilManifest: Manifest = {
  language: 'tamil',
  lessons: [
    { id: 'tam-ma', stage: 'letters', level: 1, text: 'ம', gloss: 'ma', composedOf: [] },
    { id: 'tam-na', stage: 'letters', level: 1, text: 'ந', gloss: 'na', composedOf: [] },
    { id: 'tam-ra', stage: 'letters', level: 1, text: 'ர', gloss: 'ra', composedOf: [] },
    {
      id: 'tam-mana',
      stage: 'words',
      level: 2,
      // மந, with ந (dental na, tam-na's own text) — not மன with ன (alveolar
      // na), an easy typo given how visually similar the two are. Caught by
      // validateManifest's own text/composedOf reconstruction check when
      // this fixture briefly had the wrong one, which is the whole point of
      // that check existing.
      text: 'மந',
      gloss: 'illustrative only — not authored Tamil vocabulary',
      composedOf: ['tam-ma', 'tam-na'],
    },
    {
      id: 'tam-nara',
      stage: 'words',
      level: 2,
      text: 'நர',
      gloss: 'illustrative only',
      composedOf: ['tam-na', 'tam-ra'],
    },
    {
      id: 'tam-sentence',
      stage: 'sentences',
      level: 2,
      text: 'மந நர',
      gloss: 'illustrative only',
      composedOf: ['tam-mana', 'tam-nara'],
    },
  ],
};

describe.each([
  ['sanskrit-shaped', sanskritManifest],
  ['tamil-shaped', tamilManifest],
])('validateManifest — %s manifest', (_label, manifest) => {
  test('a well-formed manifest has no errors', () => {
    expect(validateManifest(manifest)).toEqual([]);
  });

  test('a letters lesson may not declare composedOf', () => {
    const broken: Manifest = {
      ...manifest,
      lessons: manifest.lessons.map((lesson, index) =>
        index === 0 ? { ...lesson, composedOf: [manifest.lessons[1].id] } : lesson
      ),
    };

    const errors = validateManifest(broken);
    expect(errors).toContainEqual({
      lessonId: manifest.lessons[0].id,
      reason: expect.stringContaining('atomic'),
    });
  });

  test('a non-letters lesson must declare at least one dependency', () => {
    const wordLesson = manifest.lessons.find((lesson) => lesson.stage === 'words')!;
    const broken: Manifest = {
      ...manifest,
      lessons: manifest.lessons.map((lesson) =>
        lesson.id === wordLesson.id ? { ...lesson, composedOf: [] } : lesson
      ),
    };

    const errors = validateManifest(broken);
    expect(errors).toContainEqual({
      lessonId: wordLesson.id,
      reason: expect.stringContaining('must be composed of'),
    });
  });

  test('a dependency on an unknown lesson id is rejected', () => {
    const wordLesson = manifest.lessons.find((lesson) => lesson.stage === 'words')!;
    const broken: Manifest = {
      ...manifest,
      lessons: manifest.lessons.map((lesson) =>
        lesson.id === wordLesson.id ? { ...lesson, composedOf: ['does-not-exist'] } : lesson
      ),
    };

    const errors = validateManifest(broken);
    expect(errors).toContainEqual({
      lessonId: wordLesson.id,
      reason: expect.stringContaining("unknown lesson 'does-not-exist'"),
    });
  });

  test('a dependency from the wrong stage is rejected', () => {
    const [firstWord, secondWord] = manifest.lessons.filter((lesson) => lesson.stage === 'words');
    // Point one word at another word instead of at a letter.
    const broken: Manifest = {
      ...manifest,
      lessons: manifest.lessons.map((lesson) =>
        lesson.id === firstWord.id ? { ...lesson, composedOf: [secondWord.id] } : lesson
      ),
    };

    const errors = validateManifest(broken);
    expect(errors).toContainEqual({
      lessonId: firstWord.id,
      reason: expect.stringContaining("expected 'letters'"),
    });
  });

  test('a dependency that has not been taught yet — it appears later — is rejected', () => {
    // Reverse the order: every composedOf id now points forward, not back.
    const reversed: Manifest = { ...manifest, lessons: [...manifest.lessons].reverse() };

    const errors = validateManifest(reversed);
    expect(errors.some((error) => error.reason.includes('has not been taught yet'))).toBe(true);
  });

  test('a word whose text does not match its composedOf reconstruction is rejected', () => {
    const wordLesson = manifest.lessons.find((lesson) => lesson.stage === 'words')!;
    const broken: Manifest = {
      ...manifest,
      lessons: manifest.lessons.map((lesson) =>
        lesson.id === wordLesson.id ? { ...lesson, text: 'not-what-composedOf-spells' } : lesson
      ),
    };

    const errors = validateManifest(broken);
    expect(errors).toContainEqual({
      lessonId: wordLesson.id,
      reason: expect.stringContaining('does not match composedOf reconstructed as'),
    });
  });

  test('a sentence whose text does not join its composedOf words with a single space is rejected', () => {
    const sentenceLesson = manifest.lessons.find((lesson) => lesson.stage === 'sentences')!;
    const broken: Manifest = {
      ...manifest,
      lessons: manifest.lessons.map((lesson) =>
        lesson.id === sentenceLesson.id ? { ...lesson, text: lesson.text.replace(' ', '') } : lesson
      ),
    };

    const errors = validateManifest(broken);
    expect(errors).toContainEqual({
      lessonId: sentenceLesson.id,
      reason: expect.stringContaining('does not match composedOf reconstructed as'),
    });
  });

  test('a sandhiRule lesson is exempt from exact-reconstruction, but only that check', () => {
    const sentenceLesson = manifest.lessons.find((lesson) => lesson.stage === 'sentences')!;
    const withSandhi: Manifest = {
      ...manifest,
      lessons: manifest.lessons.map((lesson) =>
        lesson.id === sentenceLesson.id
          ? { ...lesson, text: 'not-what-composedOf-spells', sandhiRule: 'illustrative rule for this test' }
          : lesson
      ),
    };

    expect(validateManifest(withSandhi)).toEqual([]);
  });

  test('a sandhiRule lesson still gets every other check — an unknown dependency is still rejected', () => {
    const sentenceLesson = manifest.lessons.find((lesson) => lesson.stage === 'sentences')!;
    const broken: Manifest = {
      ...manifest,
      lessons: manifest.lessons.map((lesson) =>
        lesson.id === sentenceLesson.id
          ? { ...lesson, composedOf: ['does-not-exist'], sandhiRule: 'illustrative rule for this test' }
          : lesson
      ),
    };

    const errors = validateManifest(broken);
    expect(errors).toContainEqual({
      lessonId: sentenceLesson.id,
      reason: expect.stringContaining("unknown lesson 'does-not-exist'"),
    });
  });

  test('an empty sandhiRule is rejected — it must name the rule, not just opt out', () => {
    const sentenceLesson = manifest.lessons.find((lesson) => lesson.stage === 'sentences')!;
    const broken: Manifest = {
      ...manifest,
      lessons: manifest.lessons.map((lesson) =>
        lesson.id === sentenceLesson.id ? { ...lesson, sandhiRule: '   ' } : lesson
      ),
    };

    const errors = validateManifest(broken);
    expect(errors).toContainEqual({
      lessonId: sentenceLesson.id,
      reason: expect.stringContaining('sandhiRule is set but empty'),
    });
  });

  test('an empty sandhiRule is rejected even on a letters lesson — the check must not depend on composedOf ever being non-empty', () => {
    const letterLesson = manifest.lessons.find((lesson) => lesson.stage === 'letters')!;
    const broken: Manifest = {
      ...manifest,
      lessons: manifest.lessons.map((lesson) =>
        lesson.id === letterLesson.id ? { ...lesson, sandhiRule: '' } : lesson
      ),
    };

    const errors = validateManifest(broken);
    expect(errors).toContainEqual({
      lessonId: letterLesson.id,
      reason: expect.stringContaining('sandhiRule is set but empty'),
    });
  });

  test('a duplicate lesson id is rejected', () => {
    const broken: Manifest = {
      ...manifest,
      lessons: [...manifest.lessons, manifest.lessons[0]],
    };

    const errors = validateManifest(broken);
    expect(errors).toContainEqual({
      lessonId: manifest.lessons[0].id,
      reason: 'duplicate lesson id',
    });
  });

  test('a lesson claiming a lower level than what it depends on is rejected', () => {
    const wordLesson = manifest.lessons.find((lesson) => lesson.stage === 'words')!;
    const [depId] = wordLesson.composedOf;
    // Bump one of the word's own letter dependencies to level 3 — now higher
    // than the level-2 word built from it, which is the violation this checks.
    const broken: Manifest = {
      ...manifest,
      lessons: manifest.lessons.map((lesson) => (lesson.id === depId ? { ...lesson, level: 3 } : lesson)),
    };

    const errors = validateManifest(broken);
    expect(errors).toContainEqual({
      lessonId: wordLesson.id,
      reason: expect.stringContaining(`is level 2 but depends on '${depId}', which is level 3`),
    });
  });
});

describe.each([
  ['sanskrit-shaped', sanskritManifest],
  ['tamil-shaped', tamilManifest],
])('nextLesson — %s manifest', (_label, manifest) => {
  test('with nothing seen, returns the first lesson', () => {
    expect(nextLesson(manifest, new Set())?.id).toBe(manifest.lessons[0].id);
  });

  test('returns the first lesson not yet seen, in manifest order', () => {
    const seen = new Set([manifest.lessons[0].id, manifest.lessons[1].id]);
    expect(nextLesson(manifest, seen)?.id).toBe(manifest.lessons[2].id);
  });

  test('returns null once every lesson has been seen', () => {
    const seen = new Set(manifest.lessons.map((lesson) => lesson.id));
    expect(nextLesson(manifest, seen)).toBeNull();
  });

  test('ids in the seen set that are not in the manifest are simply ignored', () => {
    const seen = new Set(['some-id-from-a-different-manifest']);
    expect(nextLesson(manifest, seen)?.id).toBe(manifest.lessons[0].id);
  });
});
