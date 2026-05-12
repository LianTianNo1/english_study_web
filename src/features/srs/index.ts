/** 统一调度入口：根据用户偏好选 SM-2 或艾宾浩斯固定间隔 */
import { ebbinghaus, ebbinghausNextReviewAt } from './ebbinghaus';
import { sm2, nextReviewAt as sm2NextReviewAt, INITIAL_SRS, type Quality, type SrsState } from './sm2';
import type { ReviewAlgorithm } from '@/stores/settingsStore';

export { INITIAL_SRS };
export type { Quality, SrsState };

export function scheduleNext(quality: Quality, prev: SrsState, algo: ReviewAlgorithm): SrsState {
  return algo === 'ebbinghaus' ? ebbinghaus(quality, prev) : sm2(quality, prev);
}

export function nextReviewAtFor(state: SrsState, algo: ReviewAlgorithm, from: number = Date.now()): number {
  return algo === 'ebbinghaus' ? ebbinghausNextReviewAt(state, from) : sm2NextReviewAt(state, from);
}
