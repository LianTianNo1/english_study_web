// 3D 拼写游戏 — 数据类型定义
import type { WordRecord } from '@/db/types';

export type Phase =
  | 'loading'
  | 'playing'
  | 'stage-clear'
  | 'stage-fail'
  | 'session-end';

/** 一个字母候选 */
export interface Block {
  id: string;
  letter: string;        // 大写 A-Z
  placedSlot: number | null;
  candidateIndex: number;
  /** 黄金字母：命中分数 ×3（由 stageBuilder 1/3 概率赋予某个目标字母） */
  isGold?: boolean;
}

/** 顶部的一个槽位 */
export interface SlotState {
  index: number;
  expected: string;
  filledBlockId: string | null;
  correct: boolean;
}

/** 一关 */
export interface Stage {
  word: WordRecord;
  upperWord: string;
  blocks: Block[];
  slots: SlotState[];
}

/** 一关结算 */
export interface StageResult {
  wordId: number;
  errors: number;
  durationMs: number;
  passed: boolean;
  /** 本关是否使用过"查看答案"提示 — 影响 SRS 质量 + 是否能从错题集移除 */
  revealed?: boolean;
}

/** 飞字反馈（HUD 右上角） */
export interface FloatingFeedback {
  id: number;
  text: string;
  sub?: string;
  kind: 'good' | 'great' | 'perfect' | 'bad';
  expiresAt: number;
}

export interface PlayState {
  phase: Phase;
  stages: Stage[];
  current: number;
  lives: number;
  errorsThisStage: number;
  history: StageResult[];
  stageStartedAt: number;
  /** 上一次命中字母的时间戳，用于 speedBonus */
  lastHitAt: number;
  // 评分
  score: number;
  combo: number;
  bestCombo: number;
  // 反馈
  feedbacks: FloatingFeedback[];
  /** 待撤回的错放字母列表（按时间顺序）；外层为每个调度独立的 AUTO_RETRACT */
  pendingRetractIds: string[];
  /** Time-Freeze 道具：被冻结时此值为冻结结束的绝对时间戳，否则 null */
  freezeUntilAt: number | null;
  /** 本关是否已用"查看答案"提示 — 用于 HUD 显示完整单词、避免重复扣分 */
  revealed: boolean;
}

export const STAGE_TIME_LIMIT_MS = 30000;
