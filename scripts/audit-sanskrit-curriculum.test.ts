import { expect, test } from 'bun:test';

import { summarizeSanskritCurriculum } from '../src/learn/content/sanskrit-audit.js';

test('summarizes the Sanskrit curriculum from the manifest', () => {
  expect(summarizeSanskritCurriculum()).toEqual({
    totalLessons: 307,
    letters: 123,
    words: 117,
    sentences: 67,
    level4Sentences: 51,
  });
});
