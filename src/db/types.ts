export type LevelId =
  | 'junior'
  | 'senior'
  | 'cet4'
  | 'cet6'
  | 'pge'
  | 'toefl'
  | 'sat';

export interface LevelMeta {
  id: LevelId;
  name: string;
  sourceFile: string;
  totalEstimate: number;
}

export const LEVELS: LevelMeta[] = [
  { id: 'junior', name: '初中',   sourceFile: '/data/1-初中-顺序.json',   totalEstimate: 3223 },
  { id: 'senior', name: '高中',   sourceFile: '/data/2-高中-顺序.json',   totalEstimate: 6008 },
  { id: 'cet4',   name: 'CET4',  sourceFile: '/data/3-CET4-顺序.json',  totalEstimate: 7508 },
  { id: 'cet6',   name: 'CET6',  sourceFile: '/data/4-CET6-顺序.json',  totalEstimate: 5651 },
  { id: 'pge',    name: '考研',   sourceFile: '/data/5-考研-顺序.json',   totalEstimate: 9602 },
  { id: 'toefl',  name: '托福',   sourceFile: '/data/6-托福-顺序.json',   totalEstimate: 13477 },
  { id: 'sat',    name: 'SAT',   sourceFile: '/data/7-SAT-顺序.json',   totalEstimate: 8887 },
];

export interface Translation {
  translation: string;
  type: string;
}

export interface Phrase {
  phrase: string;
  translation: string;
}

export interface WordRecord {
  id?: number;
  levelId: LevelId;
  orderIndex: number;
  word: string;
  translations: Translation[];
  phrases: Phrase[];
}

export type ProgressStatus = 'new' | 'learning' | 'review' | 'mastered';

export interface ProgressRecord {
  id?: number;
  wordId: number;
  levelId: LevelId;
  status: ProgressStatus;
  interval: number;
  easeFactor: number;
  repetitions: number;
  lastReviewAt: number;
  nextReviewAt: number;
}

export type SessionType = 'learn' | 'review' | 'grammar';

export interface SessionRecord {
  id?: number;
  date: string;
  type: SessionType;
  wordsCount: number;
  correctCount: number;
  durationMs: number;
}

export interface GrammarProgressRecord {
  lessonId: string;
  status: 'locked' | 'unlocked' | 'completed';
  score: number;
  completedAt: number;
}

export interface SettingsRecord {
  key: string;
  value: unknown;
}
