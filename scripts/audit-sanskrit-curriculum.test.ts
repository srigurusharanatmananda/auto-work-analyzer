import { expect, test } from 'bun:test';

import { summarizeSanskritCurriculum } from '../src/learn/content/sanskrit-audit.js';

test('summarizes the Sanskrit curriculum from the manifest', () => {
  expect(summarizeSanskritCurriculum()).toEqual({
    totalLessons: 364,
    letters: 137,
    words: 143,
    sentences: 84,
    level4Sentences: 68,
  });
});
