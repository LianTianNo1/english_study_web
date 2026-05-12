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

  async toggleStar(wordId: number): Promise<boolean> {
    const r = await this.getByWordId(wordId);
    if (!r?.id) return false;
    const next = !r.starred;
    await db.progress.update(r.id, { starred: next });
    return next;
  },

  async markWrong(wordId: number, levelId: LevelId): Promise<void> {
    const r = await this.getByWordId(wordId);
    if (r?.id) {
      await db.progress.update(r.id, {
        wrongCount: (r.wrongCount ?? 0) + 1,
        lastWrongAt: Date.now(),
      });
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
