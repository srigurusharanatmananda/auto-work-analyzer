import { describe, expect, test } from 'bun:test';
import { guruGitaVerses, verseById } from './chanting.js';
import { splitIntoSyllables } from '../Akshara.js';

describe('chanting content — structural consistency', () => {
  for (const verse of guruGitaVerses) {
    describe(verse.id, () => {
      test('each pāda\'s words concatenate (space-joined) back to its own text field', () => {
        for (const pada of verse.padas) {
          const rebuilt = pada.words.map((w) => w.devanagari).join(' ');
          expect(rebuilt).toBe(pada.text);
        }
      });

      test('each pāda has 8 syllables, matching anuṣṭubh metre', () => {
        for (const pada of verse.padas) {
          expect(splitIntoSyllables(pada.text)).toHaveLength(8);
        }
      });

      test('every pāda has a non-empty iast field distinct from its Devanagari text', () => {
        for (const pada of verse.padas) {
          expect(pada.iast.length).toBeGreaterThan(0);
          expect(pada.iast).not.toBe(pada.text);
        }
      });
    });
  }

  test('verseById finds an existing verse and returns null for an unknown id', () => {
    expect(verseById('guru-gita-1')?.verseNumber).toBe(1);
    expect(verseById('does-not-exist')).toBeNull();
  });
});
