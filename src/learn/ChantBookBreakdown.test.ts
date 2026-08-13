import { describe, expect, test } from 'bun:test';
import { AiClient, type AiProvider } from '../ai/AiClient.js';
import { computeBreakdown, parseBreakdownResponse, BreakdownParseError, BreakdownReconstructionError } from './ChantBookBreakdown.js';

function fakeProvider(response: string): AiProvider {
  return { name: 'Fake', generate: async () => response };
}

describe('parseBreakdownResponse', () => {
  test('parses multiple pāda blocks, each with several words, plus the meaning', () => {
    const raw =
      '===PADA===\n' +
      'कैलास शिखरे — on the peak of Kailāsa (locative)\n' +
      'रम्ये — beautiful (locative adjective)\n' +
      '===PADA===\n' +
      'भक्तिसन्धाननायकम् — the leader of union-through-devotion (accusative)\n' +
      '===MEANING===\n' +
      'On the lovely peak of Kailāsa.';

    const parsed = parseBreakdownResponse(raw);
    expect(parsed.padaWords).toHaveLength(2);
    expect(parsed.padaWords[0]).toEqual([
      { devanagari: 'कैलास शिखरे', gloss: 'on the peak of Kailāsa (locative)' },
      { devanagari: 'रम्ये', gloss: 'beautiful (locative adjective)' },
    ]);
    expect(parsed.meaning).toBe('On the lovely peak of Kailāsa.');
  });

  test('a gloss containing its OWN em dash is still split correctly, on the FIRST occurrence only', () => {
    const raw =
      '===PADA===\n' +
      'शब्द — the word (nominative) — a longer aside using another em dash\n' +
      '===MEANING===\n' +
      'Meaning text.';
    const parsed = parseBreakdownResponse(raw);
    expect(parsed.padaWords[0][0].devanagari).toBe('शब्द');
    expect(parsed.padaWords[0][0].gloss).toBe('the word (nominative) — a longer aside using another em dash');
  });

  test('strips a whole-response code fence before parsing', () => {
    const raw = '```\n===PADA===\nशब्द — the word\n===MEANING===\nMeaning.\n```';
    const parsed = parseBreakdownResponse(raw);
    expect(parsed.padaWords[0][0].devanagari).toBe('शब्द');
  });

  test('throws BreakdownParseError when there is no ===MEANING=== section', () => {
    expect(() => parseBreakdownResponse('===PADA===\nशब्द — the word')).toThrow(BreakdownParseError);
  });

  test('throws BreakdownParseError when a word line has no " — " separator', () => {
    const raw = '===PADA===\nशब्द the word, no separator\n===MEANING===\nMeaning.';
    expect(() => parseBreakdownResponse(raw)).toThrow(BreakdownParseError);
  });

  test('throws BreakdownParseError when the meaning section is empty', () => {
    const raw = '===PADA===\nशब्द — the word\n===MEANING===\n';
    expect(() => parseBreakdownResponse(raw)).toThrow(BreakdownParseError);
  });
});

describe('computeBreakdown', () => {
  test('produces IAST via this app\'s own deterministic transliterator, matching the already-verified verse 1', async () => {
    const response =
      '===PADA===\n' +
      'कैलास शिखरे — on the peak of Kailāsa (locative)\n' +
      'रम्ये — beautiful (locative adjective)\n' +
      '===PADA===\n' +
      'भक्तिसन्धाननायकम् — the leader of union-through-devotion (accusative)\n' +
      '===PADA===\n' +
      'प्रणम्य पार्वती भक्त्या — having bowed, Pārvatī, with devotion\n' +
      '===PADA===\n' +
      'शङ्करं पर्यपृच्छत — asked Śaṅkara\n' +
      '===MEANING===\n' +
      'On the lovely peak of Kailāsa, Pārvatī, having bowed with devotion, asked Śaṅkara.';

    const client = new AiClient([fakeProvider(response)]);
    const rawText =
      'कैलास शिखरे रम्ये भक्तिसन्धाननायकम्\nप्रणम्य पार्वती भक्त्या शङ्करं पर्यपृच्छत';

    const breakdown = await computeBreakdown(client, rawText, 'sanskrit');

    expect(breakdown.padas).toHaveLength(4);
    // Matches the already-shipped, human-verified verse 1's own IAST exactly.
    expect(breakdown.padas[0].iast).toBe('kailāsa śikhare ramye');
    expect(breakdown.padas[1].iast).toBe('bhaktisandhānanāyakam');
    expect(breakdown.padas[2].iast).toBe('praṇamya pārvatī bhaktyā');
    expect(breakdown.padas[3].iast).toBe('śaṅkaraṃ paryapṛcchata');
    expect(breakdown.meaning).toContain('Kailāsa');
    expect(breakdown.citation).toContain('Fake');
  });

  test('throws BreakdownReconstructionError when the AI drops a character from the source verse', async () => {
    // "पर्यपृच्छत" is missing its final "त" here — a real, if synthetic,
    // dropped-character error the reconstruction check exists to catch.
    const response = '===PADA===\nशङ्करं पर्यपृच्छ — asked\n===MEANING===\nAsked.';
    const client = new AiClient([fakeProvider(response)]);
    await expect(computeBreakdown(client, 'शङ्करं पर्यपृच्छत', 'sanskrit')).rejects.toBeInstanceOf(
      BreakdownReconstructionError
    );
  });

  test('throws BreakdownReconstructionError when the AI invents extra text not in the source', async () => {
    const response = '===PADA===\nशङ्करं पर्यपृच्छत अतिरिक्तम् — asked, with an invented extra word\n===MEANING===\nAsked.';
    const client = new AiClient([fakeProvider(response)]);
    await expect(computeBreakdown(client, 'शङ्करं पर्यपृच्छत', 'sanskrit')).rejects.toBeInstanceOf(
      BreakdownReconstructionError
    );
  });

  test('works for Tamil text with the Tamil transliterator', async () => {
    const response = '===PADA===\nவணக்கம் — greetings/salutation\n===MEANING===\nGreetings.';
    const client = new AiClient([fakeProvider(response)]);
    const breakdown = await computeBreakdown(client, 'வணக்கம்', 'tamil');
    expect(breakdown.padas[0].words[0].iast.length).toBeGreaterThan(0);
    expect(breakdown.padas[0].text).toBe('வணக்கம்');
  });

  test('does not reject a correct breakdown just because the source and the AI response use different Unicode normalization forms (a real PDF-extraction variance, not hypothetical)', async () => {
    // Devanagari QA has a real singleton precomposed codepoint (U+0958)
    // whose canonical decomposition is क (U+0915) + nukta (U+093C) — a
    // genuine two-codepoints-vs-one-codepoint difference for visually and
    // semantically identical text, exactly the kind of variance some PDF
    // producers emit but an LLM's own generated text typically does not
    // (constructed via explicit \u escapes, not typed literals, since a
    // literal in a source file can silently get normalized by tooling
    // before this test ever runs).
    const singleCodepoint = 'क़'; // क़ as ONE codepoint
    const twoCodepoints = 'क़'; // क + nukta — canonically equivalent, but a different raw string
    expect(singleCodepoint).not.toBe(twoCodepoints); // sanity: they really do differ as raw strings
    expect(singleCodepoint.normalize('NFC')).toBe(twoCodepoints.normalize('NFC')); // sanity: NFC unifies them

    const response = `===PADA===\n${twoCodepoints} — a letter\n===MEANING===\nMeaning.`;
    const client = new AiClient([fakeProvider(response)]);
    // Source text (as if extracted from an unusual PDF) uses the single
    // precomposed codepoint; the AI's own response above uses the
    // two-codepoint form.
    const breakdown = await computeBreakdown(client, singleCodepoint, 'sanskrit');
    expect(breakdown.padas[0].words[0].devanagari).toBe(twoCodepoints);
  });
});
