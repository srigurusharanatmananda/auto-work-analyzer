/**
 * The property that makes these files a curriculum rather than authored
 * strings that happen to be in a .ts file: run through the same engine used
 * by Curriculum.test.ts's synthetic fixtures, but over the real content.
 * "Run it over both manifests" (design doc, Verification) means this file,
 * not just the shape-proving fixtures.
 */

import { describe, expect, test } from 'bun:test';
import { nextLesson, validateManifest } from '../Curriculum.js';
import { sanskritManifest } from './sanskrit.js';
import { tamilManifest } from './tamil.js';

describe.each([
  ['sanskrit', sanskritManifest],
  ['tamil', tamilManifest],
])('%s manifest', (_label, manifest) => {
  test('is a valid curriculum — no lesson introduces material the stage before it did not teach', () => {
    expect(validateManifest(manifest)).toEqual([]);
  });

  test('walking nextLesson from empty progress visits every lesson exactly once, in order', () => {
    const seen = new Set<string>();
    const visited: string[] = [];

    for (let i = 0; i < manifest.lessons.length; i++) {
      const lesson = nextLesson(manifest, seen);
      expect(lesson).not.toBeNull();
      visited.push(lesson!.id);
      seen.add(lesson!.id);
    }

    expect(visited).toEqual(manifest.lessons.map((lesson) => lesson.id));
    expect(nextLesson(manifest, seen)).toBeNull();
  });

  test('no letters lesson appears after a words or sentences lesson has started', () => {
    // Trivially true for an empty stage (tamil's words/sentences today) —
    // the property only bites once a stage actually has content.
    let seenNonLetter = false;
    for (const lesson of manifest.lessons) {
      if (lesson.stage !== 'letters') {
        seenNonLetter = true;
      } else if (seenNonLetter) {
        throw new Error(`letters lesson '${lesson.id}' appears after a non-letters lesson`);
      }
    }
  });
});

describe('sanskrit manifest content', () => {
  test('teaches the next three source-attested vocabulary verbs with only the needed conjunct', () => {
    const byId = new Map(sanskritManifest.lessons.map((lesson) => [lesson.id, lesson]));

    expect(byId.get('skt-letter-chcha')).toMatchObject({
      stage: 'letters',
      level: 1,
      text: 'च्छ',
      gloss: 'ccha',
      composedOf: [],
    });
    expect(byId.get('skt-word-gacchati')).toMatchObject({
      stage: 'words',
      level: 3,
      text: 'गच्छति',
      gloss: 'gacchati — he goes (3rd person singular present, parasmaipada)',
      composedOf: ['skt-letter-ga', 'skt-letter-chcha', 'skt-letter-ti'],
    });
    expect(byId.get('skt-word-labhate')).toMatchObject({
      stage: 'words',
      level: 3,
      text: 'लभते',
      gloss: 'labhate — he takes (3rd person singular present, ātmanepada)',
      composedOf: ['skt-letter-la', 'skt-letter-bha', 'skt-letter-te'],
    });
    expect(byId.get('skt-word-vahati')).toMatchObject({
      stage: 'words',
      level: 3,
      text: 'वहति',
      gloss: 'vahati — he carries (3rd person singular present, parasmaipada)',
      composedOf: ['skt-letter-va', 'skt-letter-ha', 'skt-letter-ti'],
    });
  });

  test('specifies the next graded-reading letters, words, and sentences', () => {
    const byId = new Map(sanskritManifest.lessons.map((lesson) => [lesson.id, lesson]));

    expect(byId.get('skt-letter-laa')).toMatchObject({
      stage: 'letters',
      level: 1,
      text: 'ला',
      gloss: 'lā',
      composedOf: [],
    });
    expect(byId.get('skt-letter-bhe')).toMatchObject({
      stage: 'letters',
      level: 1,
      text: 'भे',
      gloss: 'bhe',
      composedOf: [],
    });
    expect(byId.get('skt-word-bala')).toMatchObject({
      stage: 'words',
      level: 3,
      text: 'बाला',
      gloss: 'bālā — the girl (feminine nominative singular)',
      composedOf: ['skt-letter-baa', 'skt-letter-laa'],
    });
    expect(byId.get('skt-word-phalam')).toMatchObject({
      stage: 'words',
      level: 3,
      text: 'फलम्',
      gloss: 'phalam — the fruit (neuter accusative singular)',
      composedOf: ['skt-letter-pha', 'skt-letter-la', 'skt-letter-ma-halanta'],
    });
    expect(byId.get('skt-word-labhe')).toMatchObject({
      stage: 'words',
      level: 3,
      text: 'लभे',
      gloss: 'labhe — I take (1st person singular present, ātmanepada)',
      composedOf: ['skt-letter-la', 'skt-letter-bhe'],
    });
    expect(byId.get('skt-sentence-narah-tishthati-ca-bala-vadati')).toMatchObject({
      stage: 'sentences',
      level: 4,
      text: 'नरः तिष्ठति च बाला वदति',
      gloss: 'naraḥ tiṣṭhati ca bālā vadati — the man stands and the girl speaks',
      composedOf: ['skt-word-narah', 'skt-word-tishthati', 'skt-word-ca', 'skt-word-bala', 'skt-word-vadati'],
    });
    expect(byId.get('skt-sentence-ashvam-nayethe-ca-phalam-labhe')).toMatchObject({
      stage: 'sentences',
      level: 4,
      text: 'अश्वम् नयेथे च फलम् लभे',
      gloss: 'aśvam nayethe ca phalam labhe — you (two) lead the horse and I take the fruit',
      composedOf: ['skt-word-ashvam', 'skt-word-nayethe', 'skt-word-ca', 'skt-word-phalam', 'skt-word-labhe'],
    });
  });

  test('specifies the case-reading letters, words, and sentence', () => {
    const byId = new Map(sanskritManifest.lessons.map((lesson) => [lesson.id, lesson]));

    expect(byId.get('skt-letter-le')).toMatchObject({
      stage: 'letters',
      level: 1,
      text: 'ले',
      gloss: 'le',
      composedOf: [],
    });
    expect(byId.get('skt-letter-kshe')).toMatchObject({
      stage: 'letters',
      level: 1,
      text: 'क्षे',
      gloss: 'kṣe',
      composedOf: [],
    });
    expect(byId.get('skt-word-bale')).toMatchObject({
      stage: 'words',
      level: 3,
      text: 'बाले',
      gloss: 'bāle — the two girls (feminine nominative dual)',
      composedOf: ['skt-letter-baa', 'skt-letter-le'],
    });
    expect(byId.get('skt-word-vrksesu')).toMatchObject({
      stage: 'words',
      level: 3,
      text: 'वृक्षेषु',
      gloss: 'vṛkṣeṣu — among the trees (locative plural)',
      composedOf: ['skt-letter-vri', 'skt-letter-kshe', 'skt-letter-ssu'],
    });
    expect(byId.get('skt-sentence-bale-vrksesu-tishthatah-vadatah-ca')).toMatchObject({
      stage: 'sentences',
      level: 4,
      text: 'बाले वृक्षेषु तिष्ठतः वदतः च',
      gloss: 'bāle vṛkṣeṣu tiṣṭhataḥ vadataḥ ca — the girls (two) stand among the trees and speak',
      composedOf: [
        'skt-word-bale',
        'skt-word-vrksesu',
        'skt-word-tishthatah',
        'skt-word-vadatah',
        'skt-word-ca',
      ],
    });
  });

  test('specifies the dative-reading word and sentence', () => {
    const byId = new Map(sanskritManifest.lessons.map((lesson) => [lesson.id, lesson]));

    expect(byId.get('skt-word-phalaya')).toMatchObject({
      stage: 'words',
      level: 3,
      text: 'फलाय',
      gloss: 'phalāya — for fruit (neuter dative singular)',
      composedOf: ['skt-letter-pha', 'skt-letter-laa', 'skt-letter-ya'],
    });
    expect(byId.get('skt-sentence-bala-ashvam-vrksam-phalaya-nayate')).toMatchObject({
      stage: 'sentences',
      level: 4,
      text: 'बाला अश्वम् वृक्षम् फलाय नयते',
      gloss: 'bālā aśvam vṛkṣam phalāya nayate — the girl leads the horse to the tree for fruit',
      composedOf: [
        'skt-word-bala',
        'skt-word-ashvam',
        'skt-word-vrksam',
        'skt-word-phalaya',
        'skt-word-nayate',
      ],
    });
  });

  test('specifies the accusative-reading word and sentence', () => {
    const byId = new Map(sanskritManifest.lessons.map((lesson) => [lesson.id, lesson]));

    expect(byId.get('skt-word-balam')).toMatchObject({
      stage: 'words',
      level: 3,
      text: 'बालम्',
      gloss: 'bālam — the girl (feminine accusative singular)',
      composedOf: ['skt-letter-baa', 'skt-letter-la', 'skt-letter-ma-halanta'],
    });
    expect(byId.get('skt-sentence-ashvah-naram-ca-balam-ca-vrksam-vahati')).toMatchObject({
      stage: 'sentences',
      level: 4,
      text: 'अश्वः नरम् च बालम् च वृक्षम् वहति',
      gloss: 'aśvaḥ naram ca bālam ca vṛkṣam vahati — the horse carries the man and the girl to the tree',
      composedOf: [
        'skt-word-ashvah',
        'skt-word-naram',
        'skt-word-ca',
        'skt-word-balam',
        'skt-word-ca',
        'skt-word-vrksam',
        'skt-word-vahati',
      ],
    });
  });

  test('specifies the ablative-reading word and sentence', () => {
    const byId = new Map(sanskritManifest.lessons.map((lesson) => [lesson.id, lesson]));

    expect(sanskritManifest.lessons).toHaveLength(275);
    expect(sanskritManifest.lessons.filter((lesson) => lesson.stage === 'letters')).toHaveLength(119);
    expect(sanskritManifest.lessons.filter((lesson) => lesson.stage === 'words')).toHaveLength(104);
    expect(sanskritManifest.lessons.filter((lesson) => lesson.stage === 'sentences')).toHaveLength(52);
    expect(byId.get('skt-word-balayah')).toMatchObject({
      stage: 'words', level: 3, text: 'बालायाः',
      gloss: 'bālāyāḥ — from the girl (feminine ablative singular)',
      composedOf: ['skt-letter-baa', 'skt-letter-laa', 'skt-letter-yaa', 'skt-letter-visarga'],
    });
    expect(byId.get('skt-sentence-narasya-ashvah-phalam-balayah-labhate')).toMatchObject({
      stage: 'sentences', level: 4, text: 'नरस्य अश्वः फलम् बालायाः लभते',
      gloss: 'narasya aśvaḥ phalam bālāyāḥ labhate — the man’s horse takes the fruit from the girl',
      composedOf: ['skt-word-narasya', 'skt-word-ashvah', 'skt-word-phalam', 'skt-word-balayah', 'skt-word-labhate'],
    });
  });

  test('a word never depends on a letter not in this same seed', () => {
    const letterIds = new Set(
      sanskritManifest.lessons.filter((l) => l.stage === 'letters').map((l) => l.id)
    );
    for (const word of sanskritManifest.lessons.filter((l) => l.stage === 'words')) {
      for (const dep of word.composedOf) {
        expect(letterIds.has(dep)).toBe(true);
      }
    }
  });
});
