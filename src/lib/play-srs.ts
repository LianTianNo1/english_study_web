// 游戏关卡 → SRS 回写适配器
import type { LevelId } from '@/db/types';
import { progressRepo } from '@/db/repositories/progress';
import { INITIAL_SRS, scheduleNext, nextReviewAtFor, type Quality } from '@/features/srs';
import { useSettings } from '@/stores/settingsStore';
import type { StageResult } from '@/features/play-3d/types';

/**
 * errors + revealed → SRS quality
 * - 没通过：0（完全忘记）
 * - 用了 HINT：最多 3（即使一次过也只算"模糊"）
 * - 一次过：5（简单）
 * - 错 1 次：4（正确）
 * - 错 ≥2 次：3（模糊）
 */
function qualityFromResult(r: StageResult): Quality {
  if (!r.passed) return 0;
  if (r.revealed) return 3;
  if (r.errors === 0) return 5;
  if (r.errors === 1) return 4;
  return 3;
}

/** 立即写入单关结果到 progress 表（SRS 推进 + 错题集联动） */
export async function commitStageResult(
  result: StageResult,
  level: LevelId
): Promise<void> {
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

  // 0 错 + 未用 hint 通过 → 联动清空错题计数（彻底从错题集移除）
  const shouldClearWrong =
    result.passed && result.errors === 0 && !result.revealed;

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
      : (existing?.wrongCount ?? 0) + (result.passed ? 0 : 1),
    lastWrongAt: shouldClearWrong
      ? undefined
      : result.passed
        ? existing?.lastWrongAt
        : now,
  });
}

/** 批量提交（保留为 session-end 兜底，重复写入幂等） */
export async function commitPlaySession(
  results: StageResult[],
  level: LevelId
): Promise<void> {
  for (const r of results) {
    await commitStageResult(r, level);
  }
}
