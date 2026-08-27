import { expect, test } from 'bun:test';

import { summarizeSanskritCurriculum } from '../src/learn/content/sanskrit-audit.js';

test('summarizes the Sanskrit curriculum from the manifest', () => {
  expect(summarizeSanskritCurriculum()).toEqual({
    totalLessons: 319,
    letters: 123,
    words: 124,
    sentences: 72,
    level4Sentences: 56,
  });
});
