import { describe, expect, test } from 'bun:test';
import { guruGitaVerses, verseById } from './chanting.js';
import { splitIntoSyllables } from '../Akshara.js';

// Every verse in this dataset, anuṣṭubh or not, turns out to actually have
// 4 pādas — confirmed directly per-verse, not assumed; a verse whose pādas
// array comes out to 2 or 3 elements (a whole printed line left unsplit)
// is a real segmentation defect, not a legitimate metrical variant, and
// this caught exactly that class of bug once already (5 verses shipped
// with 2-3 "pādas" instead of 4, fixed before this test existed).
const EXPECTED_PADA_COUNT = 4;

// Unicode formatting/joiner characters (ZWJ U+200D, ZWNJ U+200C, BOM
// U+FEFF) should never appear in Devanagari or IAST text — they have no
// legitimate role here and silently corrupt both the rendered glyph and
// any transliteration/syllabification derived from it. Caught exactly
// this once already (a stray ZWJ mid-grapheme in श‍ृणु turned it into
// "śaṛṇu", a different, wrong word).
const STRAY_FORMATTING_CHARS = /[\u200B-\u200F\uFEFF]/;

// A Devanagari codepoint directly adjacent to a Latin letter with no
// space between them is never legitimate in a gloss — every real
// Devanagari quotation in this file's glosses is its own space- or
// quote-delimited word (e.g. "गुरुः 'Guru'"), never a combining vowel
// sign glued onto an English word. Caught exactly this once already
// ("Viṣṇु", "sandhि-fused" — a stray Devanagari vowel-sign character
// where a Latin letter belonged).
const DEVANAGARI_GLUED_TO_LATIN = /[a-zA-Z][ऀ-ॿ]|[ऀ-ॿ][a-zA-Z]/;

describe('chanting content — structural consistency', () => {
  for (const verse of guruGitaVerses) {
    describe(verse.id, () => {
      test(`has exactly ${EXPECTED_PADA_COUNT} pādas`, () => {
        expect(verse.padas).toHaveLength(EXPECTED_PADA_COUNT);
      });

      test('no Devanagari/IAST field contains a stray Unicode formatting character', () => {
        for (const pada of verse.padas) {
          expect(pada.text).not.toMatch(STRAY_FORMATTING_CHARS);
          expect(pada.iast).not.toMatch(STRAY_FORMATTING_CHARS);
          for (const word of pada.words) {
            expect(word.devanagari).not.toMatch(STRAY_FORMATTING_CHARS);
            expect(word.iast).not.toMatch(STRAY_FORMATTING_CHARS);
          }
        }
      });

      test('no gloss has a Devanagari character glued directly onto a Latin word', () => {
        for (const pada of verse.padas) {
          for (const word of pada.words) {
            expect(word.gloss).not.toMatch(DEVANAGARI_GLUED_TO_LATIN);
          }
        }
      });

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
