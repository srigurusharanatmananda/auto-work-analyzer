import { expect, test } from 'bun:test';

import { summarizeSanskritCurriculum } from '../src/learn/content/sanskrit-audit.js';

test('summarizes the Sanskrit curriculum from the manifest', () => {
  expect(summarizeSanskritCurriculum()).toEqual({
    totalLessons: 349,
    letters: 134,
    words: 137,
    sentences: 78,
    level4Sentences: 62,
  });
});
