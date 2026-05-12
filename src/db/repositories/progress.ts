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
    return db.progress
      .where('nextReviewAt')
      .belowOrEqual(now)
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
};
