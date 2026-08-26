import { expect, test } from 'bun:test';

import { summarizeSanskritCurriculum } from '../src/learn/content/sanskrit-audit.js';

test('summarizes the Sanskrit curriculum from the manifest', () => {
  expect(summarizeSanskritCurriculum()).toEqual({
    totalLessons: 304,
    letters: 123,
    words: 117,
    sentences: 64,
    level4Sentences: 48,
  });
});
