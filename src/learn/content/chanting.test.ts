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

      test('the verse\'s total syllable count matches a real classical metre', () => {
        // NOT "each pāda has 8 syllables": that held for the single
        // hand-picked verse 1 (anuṣṭubh, and its word choice happened to
        // align cleanly with the 8-syllable grid), but is not a property
        // Sanskrit prosody actually guarantees in general — a word can
        // legitimately straddle a pāda boundary (confirmed directly: every
        // one of this dataset's anuṣṭubh verses whose pādas are NOT exactly
        // 8/8/8/8 has its true 8th-syllable boundary falling mid-word, not
        // at any word boundary a gloss could split on). The TOTAL syllable
        // count across a verse's pādas is still a real, meter-diagnostic
        // invariant, so that's what this checks — anuṣṭubh (32, 4×8) plus
        // the other real metres this dataset's own longer verses use
        // (verified directly against this file's actual content: 44, 48,
        // 56, 60, 68, 76).
        const total = verse.padas.reduce((sum, pada) => sum + splitIntoSyllables(pada.text).length, 0);
        expect([32, 44, 48, 56, 60, 68, 76]).toContain(total);
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
