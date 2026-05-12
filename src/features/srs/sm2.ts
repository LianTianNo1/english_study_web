/**
 * SuperMemo SM-2 简化实现
 * quality:
 *   0 = 完全忘记
 *   3 = 模糊（recall with effort）
 *   4 = 正确（normal）
 *   5 = 简单（easy）
 */
export type Quality = 0 | 3 | 4 | 5;

export interface SrsState {
  repetitions: number;
  interval: number;
  easeFactor: number;
}

export const INITIAL_SRS: SrsState = {
  repetitions: 0,
  interval: 0,
  easeFactor: 2.5,
};

export function sm2(quality: Quality, prev: SrsState): SrsState {
  let { repetitions, interval, easeFactor } = prev;

  if (quality < 3) {
    repetitions = 0;
    interval = 1;
  } else {
    repetitions += 1;
    if (repetitions === 1) interval = 1;
    else if (repetitions === 2) interval = 6;
    else interval = Math.round(interval * easeFactor);
    easeFactor =
      easeFactor + (0.1 - (5 - quality) * (0.08 + (5 - quality) * 0.02));
    if (easeFactor < 1.3) easeFactor = 1.3;
  }

  return { repetitions, interval, easeFactor: round2(easeFactor) };
}

export function nextReviewAt(state: SrsState, from: number = Date.now()): number {
  return from + state.interval * 24 * 60 * 60 * 1000;
}

function round2(n: number) {
  return Math.round(n * 100) / 100;
}
