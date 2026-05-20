// 陨石游戏 → SRS 回写适配器（照搬 play-srs.ts 的 SM-2 逻辑）
import type { LevelId } from '@/db/types';
import { progressRepo } from '@/db/repositories/progress';
import { INITIAL_SRS, scheduleNext, nextReviewAtFor, type Quality } from '@/features/srs';
import { useSettings } from '@/stores/settingsStore';
import type { MeteorWordResult } from '@/features/play-meteor/types';

/**
 * 击毁结果 → SRS quality
 * - 漏失（未击毁）：0
 * - 0 错击毁：5
 * - 1 错击毁：4
 * - ≥2 错击毁：3
 */
function qualityFromResult(r: MeteorWordResult): Quality {
  if (!r.destroyed) return 0;
  if (r.errors === 0) return 5;
  if (r.errors === 1) return 4;
  return 3;
}

/** 立即写入单个单词结果（SRS 推进 + 错题集联动） */
export async function commitMeteorWord(
  result: MeteorWordResult,
  level: LevelId
): Promise<void> {
  if (result.wordId < 0) return;
  const { reviewAlgorithm } = useSettings.getState();
  const now = Date.now();

  const existing = await progressRepo.getByWordId(result.wordId);
  const prev = existing
    ? {
        repetitions: existing.repetitions,
        interval: existing.interval,
        easeFactor: existing.easeFactor,
      }
    : { ...INITIAL_SRS };

  const q = qualityFromResult(result);
  const next = scheduleNext(q, prev, reviewAlgorithm);
  const nextReviewAt = nextReviewAtFor(next, reviewAlgorithm, now);

  // 0 错击毁 → 联动清空错题计数
  const shouldClearWrong = result.destroyed && result.errors === 0;

  await progressRepo.upsert({
    ...(existing ?? {}),
    wordId: result.wordId,
    levelId: existing?.levelId ?? level,
    status: 'review',
    interval: next.interval,
    easeFactor: next.easeFactor,
    repetitions: next.repetitions,
    lastReviewAt: now,
    nextReviewAt,
    wrongCount: shouldClearWrong
      ? 0
      : (existing?.wrongCount ?? 0) + (result.destroyed ? 0 : 1),
    lastWrongAt: shouldClearWrong
      ? undefined
      : result.destroyed
        ? existing?.lastWrongAt
        : now,
  });
}

/** 批量提交（session 结束兜底，幂等） */
export async function commitMeteorSession(
  results: MeteorWordResult[],
  level: LevelId
): Promise<void> {
  for (const r of results) {
    await commitMeteorWord(r, level);
  }
}
