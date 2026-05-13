/** 统一调度入口：根据用户偏好选 SM-2 或艾宾浩斯固定间隔 */
import { ebbinghaus, ebbinghausNextReviewAt } from './ebbinghaus';
import { sm2, nextReviewAt as sm2NextReviewAt, INITIAL_SRS, type Quality, type SrsState } from './sm2';
import type { ReviewAlgorithm } from '@/stores/settingsStore';

export { INITIAL_SRS };
export type { Quality, SrsState };

const MS_DAY = 24 * 60 * 60 * 1000;

export function scheduleNext(quality: Quality, prev: SrsState, algo: ReviewAlgorithm): SrsState {
  return algo === 'ebbinghaus' ? ebbinghaus(quality, prev) : sm2(quality, prev);
}

/**
 * 计算下一次复习时间。
 * 关键修正：间隔 ≥ 1 天的复习，统一对齐到"目标日的 00:00"——
 *   只要日历日到达，无论什么时辰打开都视为到期。
 * 间隔 < 1 天（艾宾浩斯 5 min / 30 min / 12 h）则保留原始毫秒精度。
 */
export function nextReviewAtFor(state: SrsState, algo: ReviewAlgorithm, from: number = Date.now()): number {
  const raw = algo === 'ebbinghaus' ? ebbinghausNextReviewAt(state, from) : sm2NextReviewAt(state, from);
  if (state.interval >= 1) {
    const d = new Date(raw);
    d.setHours(0, 0, 0, 0);
    return d.getTime();
  }
  return raw;
}

/** 测试/调试：把任意时间向下取整到当天 00:00 本地时间 */
export function startOfDay(ts: number = Date.now()): number {
  const d = new Date(ts);
  d.setHours(0, 0, 0, 0);
  return d.getTime();
}

export { MS_DAY };
