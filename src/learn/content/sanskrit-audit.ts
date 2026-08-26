import { sanskritManifest } from './sanskrit.js';

export interface SanskritCurriculumSummary {
  totalLessons: number;
  letters: number;
  words: number;
  sentences: number;
  level4Sentences: number;
}

export function summarizeSanskritCurriculum(): SanskritCurriculumSummary {
  const lessons = sanskritManifest.lessons;
  const count = (predicate: (lesson: (typeof lessons)[number]) => boolean) =>
    lessons.filter(predicate).length;

  return {
    totalLessons: lessons.length,
    letters: count((lesson) => lesson.stage === 'letters'),
    words: count((lesson) => lesson.stage === 'words'),
    sentences: count((lesson) => lesson.stage === 'sentences'),
    level4Sentences: count((lesson) => lesson.stage === 'sentences' && lesson.level === 4),
  };
}
