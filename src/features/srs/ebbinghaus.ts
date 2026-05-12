/** 经典艾宾浩斯遗忘曲线复习计划
 *  固定间隔（天）：5min, 30min, 12h, 1d, 2d, 4d, 7d, 15d, 30d, 60d
 *  - 答对 (quality ≥ 3) 推进到下一级
 *  - 答错 (quality < 3) 回退到第 0 级
 *  - 答"简单"(quality 5) 跳一级
 */
import type { Quality, SrsState } from './sm2';
import { INITIAL_SRS } from './sm2';

/** 间隔（小时） */
export const EBBINGHAUS_HOURS = [
  5 / 60,    // 5 分钟
  0.5,       // 30 分钟
  12,        // 12 小时
  24,        // 1 天
  48,        // 2 天
  96,        // 4 天
  168,       // 7 天
  360,       // 15 天
  720,       // 30 天
  1440,      // 60 天
];

export function ebbinghaus(quality: Quality, prev: SrsState): SrsState {
  let level = prev.repetitions; // 复用 repetitions 字段作为阶段索引
  if (quality < 3) {
    level = 0;
  } else if (quality === 5 && level < EBBINGHAUS_HOURS.length - 1) {
    level = Math.min(EBBINGHAUS_HOURS.length - 1, level + 2);
  } else {
    level = Math.min(EBBINGHAUS_HOURS.length - 1, level + 1);
  }
  const hours = EBBINGHAUS_HOURS[level];
  // interval 字段以"天"为单位，保持向上兼容
  return {
    repetitions: level,
    interval: hours / 24,
    easeFactor: prev.easeFactor || INITIAL_SRS.easeFactor,
  };
}

/** 计算下一次复习时间（毫秒时间戳） */
export function ebbinghausNextReviewAt(state: SrsState, from: number = Date.now()): number {
  return from + state.interval * 24 * 60 * 60 * 1000;
}
