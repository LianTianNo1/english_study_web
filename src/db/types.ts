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

/** 构造数据文件的完整 URL —— Web Worker 里 fetch 相对路径会以 worker 脚本为基准，所以必须给绝对 URL */
function dataUrl(filename: string): string {
  // BASE_URL 由 Vite 注入：开发态 = '/'，部署到子路径时如 '/english/'
  const base = import.meta.env.BASE_URL || '/';
  const origin = typeof window !== 'undefined' ? window.location.origin : '';
  return `${origin}${base}data/${filename}`;
}

export const LEVELS: LevelMeta[] = [
  { id: 'junior', name: '初中',   sourceFile: dataUrl('1-初中-顺序.json'),   totalEstimate: 3223 },
  { id: 'senior', name: '高中',   sourceFile: dataUrl('2-高中-顺序.json'),   totalEstimate: 6008 },
  { id: 'cet4',   name: 'CET4',  sourceFile: dataUrl('3-CET4-顺序.json'),  totalEstimate: 7508 },
  { id: 'cet6',   name: 'CET6',  sourceFile: dataUrl('4-CET6-顺序.json'),  totalEstimate: 5651 },
  { id: 'pge',    name: '考研',   sourceFile: dataUrl('5-考研-顺序.json'),   totalEstimate: 9602 },
  { id: 'toefl',  name: '托福',   sourceFile: dataUrl('6-托福-顺序.json'),   totalEstimate: 13477 },
  { id: 'sat',    name: 'SAT',   sourceFile: dataUrl('7-SAT-顺序.json'),   totalEstimate: 8887 },
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
  starred?: boolean;       // 难词标记
  wrongCount?: number;     // 累计答错次数（错题本依据）
  lastWrongAt?: number;    // 最近一次答错时间
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

/** AI 生成的巧记 / 助记法 / 音标 / 例句（按 wordId 缓存，避免重复消耗 token） */
export interface MnemonicRecord {
  wordId: number;
  word: string;
  tip: string;          // 巧记口诀（一句话，<= 30 字）
  detail?: string;      // 详细记忆方法（多句话）
  ipa?: string;         // 音标 (国际音标 IPA)
  examples?: { en: string; zh: string }[];  // 2-3 个例句
  createdAt: number;
  model?: string;
}

/** AI 生成的词根/词缀关联（按 wordId 缓存） */
export interface WordRootRecord {
  wordId: number;
  word: string;
  /** 词根/词缀本体，如 dict / pre- / -tion */
  root: string;
  /** 含义注释 */
  meaning: string;
  /** 同根词族：5 ~ 8 个 */
  family: { word: string; gloss: string }[];
  createdAt: number;
  model?: string;
}

/** 用户造句记录（主动回忆，用于复盘） */
export interface UserSentenceRecord {
  id?: number;
  wordId: number;
  word: string;
  sentence: string;
  /** AI 评分 0-5；若未启用 AI 则为 null */
  score?: number;
  feedback?: string;
  createdAt: number;
}
