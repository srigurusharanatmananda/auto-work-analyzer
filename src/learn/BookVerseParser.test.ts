/**
 * The two marker conventions here are not invented — they're the exact
 * shapes this session's own Guru Gita sourcing already confirmed real:
 * danda-wrapped (sanskritdocuments.org's edition, `॥ N॥` terminating each
 * verse) and standalone-numeral-line (the veda.harekrsna.cz cross-reference
 * PDF, `N.` preceding each verse).
 */
import { describe, expect, test } from 'bun:test';
import { parseBookVerses, BookParseError } from './BookVerseParser.js';

describe('parseBookVerses — danda-wrapped convention', () => {
  test('splits three consecutive verses terminated by ॥ N॥', () => {
    const text =
      'कैलास शिखरे रम्ये भक्तिसन्धाननायकम् ।\n' +
      'प्रणम्य पार्वती भक्त्या शङ्करं पर्यपृच्छत ॥ १॥\n\n' +
      'ॐ नमो देवदेवेश परात्परजगद्गुरो ।\n' +
      'सदाशिव महादेव गुरुदीक्षां प्रदेहि मे ॥ २॥\n\n' +
      'केन मार्गेण भो स्वामिन् देहि ब्रह्ममयो भवेत् ॥ ३॥';

    const verses = parseBookVerses(text);

    expect(verses).toHaveLength(3);
    expect(verses[0].verseNumber).toBe(1);
    expect(verses[0].rawText).toContain('कैलास शिखरे रम्ये');
    expect(verses[1].verseNumber).toBe(2);
    expect(verses[2].verseNumber).toBe(3);
    expect(verses[2].rawText).toContain('केन मार्गेण');
  });

  test('known limitation: unmarked front matter before the FIRST terminator has nowhere else to go, so it folds into verse 1', () => {
    // There is no marker between front matter and verse 1 in this
    // convention — only each verse's OWN terminator exists, and the first
    // one terminates whatever text precedes it, front matter included.
    // Documented, not silently wrong: see this file's own header comment.
    const text =
      'ॐ नमो गुरुभ्यो गुरुपादुकाभ्यो नमः परेभ्यः\n' +
      'कैलास शिखरे रम्ये भक्तिसन्धाननायकम् ॥ १॥\n' +
      'प्रणम्य पार्वती भक्त्या शङ्करं पर्यपृच्छत ॥ २॥';

    const verses = parseBookVerses(text);
    expect(verses[0].rawText).toContain('गुरुपादुकाभ्यो');
    expect(verses[0].rawText).toContain('कैलास शिखरे रम्ये');
  });

  test('handles plain Arabic-digit dandas too, not just Devanagari numerals', () => {
    const text = 'first verse text ॥ 1॥\nsecond verse text ॥ 2॥';
    const verses = parseBookVerses(text);
    expect(verses.map((v) => v.verseNumber)).toEqual([1, 2]);
  });
});

describe('parseBookVerses — standalone-numeral-line convention', () => {
  test('splits verses where a bare number on its own line precedes the verse text', () => {
    const text =
      '1.\n' +
      'SUta uvAca:\n' +
      'KailAsa zikhare ramye,\n' +
      'bhakti sandhAna nAyakam;\n\n' +
      '2.\n' +
      'zrI devy uvAca:\n' +
      'OM namo deva deveza,\n' +
      'parAtpara jagadguro;\n\n' +
      '3.\n' +
      'Kena mArgeNa bho svAmin,\n' +
      'dehI brahma mayo bhavet;';

    const verses = parseBookVerses(text);

    expect(verses).toHaveLength(3);
    expect(verses[0].verseNumber).toBe(1);
    expect(verses[0].rawText).toContain('KailAsa zikhare ramye');
    expect(verses[1].verseNumber).toBe(2);
    expect(verses[2].verseNumber).toBe(3);
  });

  test('accepts a trailing period on the numeral line', () => {
    const text = '1.\nverse one text\n2.\nverse two text';
    const verses = parseBookVerses(text);
    expect(verses.map((v) => v.verseNumber)).toEqual([1, 2]);
  });

  test('handles a marker that shares its line with the verse\'s first word — a real PDF-text-extraction artifact, not hypothetical (confirmed on the actual veda.harekrsna.cz Guru Gita PDF this app was sourced from, at verse 67)', () => {
    const text = '66.\nMAnanaM yad bhavaM kAryaM,\ntad vadAmi mahAmate.\n67. AkhaNDa maNDalA kAraM,\nvyAptaM yena carAcaram.\n68.\nSarva zruti ziro ratna.';
    const verses = parseBookVerses(text);
    expect(verses.map((v) => v.verseNumber)).toEqual([66, 67, 68]);
    expect(verses[1].rawText).toBe('AkhaNDa maNDalA kAraM,\nvyAptaM yena carAcaram.');
  });

  test('Tamil-numeral standalone lines work the same way', () => {
    const text = '௧\nதமிழ் வரி ஒன்று\n௨\nதமிழ் வரி இரண்டு';
    const verses = parseBookVerses(text);
    expect(verses.map((v) => v.verseNumber)).toEqual([1, 2]);
    expect(verses[0].rawText).toBe('தமிழ் வரி ஒன்று');
  });
});

describe('parseBookVerses — rejection', () => {
  test('throws BookParseError for plain prose with no verse markers at all', () => {
    const text = 'This is just an ordinary paragraph of text with no numbering convention whatsoever.';
    expect(() => parseBookVerses(text)).toThrow(BookParseError);
  });

  test('throws for a single stray number that does not make a real sequence', () => {
    const text = 'Some text mentioning the number 42 once, with nothing else numbered.';
    expect(() => parseBookVerses(text)).toThrow(BookParseError);
  });

  test('throws when candidate markers are found but not in increasing order (a false-positive pattern match, not real verse numbers)', () => {
    const text = '5.\nsome text\n3.\nmore text\n1.\neven more text';
    expect(() => parseBookVerses(text)).toThrow(BookParseError);
  });

  test('does not require verse numbers to start at 1 or be contiguous — a book excerpt starting mid-canto is still valid', () => {
    const text = 'text for verse fifty ॥ ५०॥\ntext for verse fifty-five ॥ ५५॥';
    const verses = parseBookVerses(text);
    expect(verses.map((v) => v.verseNumber)).toEqual([50, 55]);
  });

  test('prefers the MORE complete parse over whichever convention happens to match first — two unrelated danda-wrapped-looking fragments must not pre-empt a real, far more complete standalone-line numbering', () => {
    const text =
      'See footnote ॥ 1॥ for context, and a second reference ॥ 2॥ elsewhere in this preface.\n\n' +
      '1.\n' +
      'the actual first verse of the book\n' +
      '2.\n' +
      'the actual second verse of the book\n' +
      '3.\n' +
      'the actual third verse of the book';

    const verses = parseBookVerses(text);
    // The standalone-line parse (3 real verses) must win over the
    // danda-wrapped parse (2 unrelated footnote references), even though
    // danda-wrapped is checked first internally.
    expect(verses).toHaveLength(3);
    expect(verses[0].rawText).toContain('actual first verse');
    expect(verses[2].rawText).toContain('actual third verse');
  });
});
