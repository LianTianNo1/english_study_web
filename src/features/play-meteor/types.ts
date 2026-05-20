// 类型 —— 单词陨石防御战
import type { WordRecord } from '@/db/types';

export const SESSION_WORD_COUNT = 24;
export const BASE_MAX_HP = 5;
export const WORDS_PER_WAVE = 8;

/** 基地在世界坐标的位置 */
export const BASE_POS: [number, number, number] = [0, -3.3, 1];

export type MeteorStatus = 'incoming' | 'destroyed' | 'breached';
export type Phase = 'loading' | 'playing' | 'win' | 'lose';

/** 待生成的单词信息 */
export interface WordInfo {
  word: string;      // 全小写 a-z
  wordId: number;
  meaning: string;   // 中文释义
  raw: WordRecord;
}

export interface Meteor {
  id: string;
  word: string;
  wordId: number;
  meaning: string;
  raw: WordRecord;
  /** 深度进度 0(深空) → 1(基地) */
  z: number;
  /** 横向种子 -1..1 */
  x: number;
  /** 纵向种子 -1..1 */
  y: number;
  /** 已正确输入的字母数 */
  typedLen: number;
  /** 本陨石累计打错次数 */
  errors: number;
  status: MeteorStatus;
  /** z 推进速度（单位/秒） */
  speed: number;
  spawnAt: number;
  lockedAt: number | null;
  /** 销毁/坠毁时间戳，用于清理 */
  endedAt: number | null;
  /** 旋转/外观随机种子 */
  seed: number;
}

export interface FloatFeedback {
  id: number;
  text: string;
  color: string;
  expireAt: number;
}

export interface MeteorWordResult {
  wordId: number;
  word: string;
  destroyed: boolean;
  errors: number;
}

export interface MeteorState {
  phase: Phase;
  /** 尚未生成的单词队列 */
  queue: WordInfo[];
  /** 屏上活动陨石（含短暂的爆炸/坠毁残留） */
  meteors: Meteor[];
  lockedId: string | null;
  baseHp: number;
  score: number;
  combo: number;
  bestCombo: number;
  destroyedCount: number;
  spawnedCount: number;
  totalWords: number;
  lastSpawnAt: number;
  lastTickAt: number;
  feedbacks: FloatFeedback[];
  results: MeteorWordResult[];
  wave: number;
  waveBannerUntil: number;
  /** 最近一次基地受击时间戳（驱动全屏红闪） */
  hitFlashAt: number;
  /** 最近一次激光发射序号（驱动 Laser 组件） */
  laserSeq: number;
  /** 激光目标陨石 id */
  laserTargetId: string | null;
  startedAt: number;
}

export type Action =
  | { type: 'START'; words: WordInfo[]; now: number }
  | { type: 'TICK'; now: number }
  | { type: 'TYPE'; letter: string; now: number }
  | { type: 'TAP'; meteorId: string; now: number }
  | { type: 'EXPIRE_FEEDBACKS'; now: number }
  | { type: 'END' };
