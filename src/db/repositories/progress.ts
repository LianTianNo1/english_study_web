import { db } from '../schema';
import type { LevelId, ProgressRecord, ProgressStatus } from '../types';

export const progressRepo = {
  async getByWordId(wordId: number): Promise<ProgressRecord | undefined> {
    return db.progress.where('wordId').equals(wordId).first();
  },

  async upsert(rec: ProgressRecord): Promise<void> {
    const existing = await this.getByWordId(rec.wordId);
    if (existing?.id) {
      await db.progress.update(existing.id, rec);
    } else {
      await db.progress.add(rec);
    }
  },

  async dueForReview(now: number = Date.now(), limit = 100): Promise<ProgressRecord[]> {
    // 判定到期：把"今天结束"作为门槛——只要预定复习日历日 ≤ 今天，
    // 无论是早晨还是晚上打开都算到期。修复旧版按学习时分秒计算导致的"早上没复习"问题。
    const endOfToday = new Date(now);
    endOfToday.setHours(23, 59, 59, 999);
    const threshold = endOfToday.getTime();
    return db.progress
      .where('nextReviewAt')
      .belowOrEqual(threshold)
      .filter((r) => r.status === 'review' || r.status === 'learning')
      .limit(limit)
      .toArray();
  },

  async countByLevelAndStatus(levelId: LevelId, status: ProgressStatus): Promise<number> {
    return db.progress.where('[levelId+status]').equals([levelId, status]).count();
  },

  async learnedWordIds(levelId: LevelId): Promise<Set<number>> {
    const recs = await db.progress.where('levelId').equals(levelId).toArray();
    return new Set(recs.map((r) => r.wordId));
  },

  async toggleStar(wordId: number): Promise<boolean> {
    const r = await this.getByWordId(wordId);
    if (!r?.id) return false;
    const next = !r.starred;
    await db.progress.update(r.id, { starred: next });
    return next;
  },

  async markWrong(wordId: number, levelId: LevelId): Promise<void> {
    const r = await this.getByWordId(wordId);
    const now = Date.now();
    if (r?.id) {
      await db.progress.update(r.id, {
        wrongCount: (r.wrongCount ?? 0) + 1,
        lastWrongAt: now,
      });
    } else {
      // 记录不存在则创建（防御性）
      await db.progress.add({
        wordId,
        levelId,
        status: 'learning',
        interval: 1,
        easeFactor: 2.5,
        repetitions: 0,
        lastReviewAt: now,
        nextReviewAt: now,
        wrongCount: 1,
        lastWrongAt: now,
      });
    }
  },

  /** 清空错词计数（用于"连续正确"从错题集移除） */
  async clearWrong(wordId: number): Promise<void> {
    const r = await this.getByWordId(wordId);
    if (r?.id) {
      await db.progress.update(r.id, { wrongCount: 0, lastWrongAt: undefined });
    }
  },

  async starredWords(): Promise<ProgressRecord[]> {
    return db.progress.filter((r) => r.starred === true).toArray();
  },

  async wrongWords(limit = 200): Promise<ProgressRecord[]> {
    const all = await db.progress.filter((r) => (r.wrongCount ?? 0) > 0).toArray();
    return all
      .sort((a, b) => (b.lastWrongAt ?? 0) - (a.lastWrongAt ?? 0))
      .slice(0, limit);
  },
};
