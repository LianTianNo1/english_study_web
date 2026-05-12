import { db } from '../schema';
import type { GrammarProgressRecord } from '../types';

export const grammarRepo = {
  async all(): Promise<GrammarProgressRecord[]> {
    return db.grammarProgress.toArray();
  },

  async get(lessonId: string): Promise<GrammarProgressRecord | undefined> {
    return db.grammarProgress.get(lessonId);
  },

  async upsert(rec: GrammarProgressRecord): Promise<void> {
    await db.grammarProgress.put(rec);
  },

  async unlock(lessonId: string): Promise<void> {
    const existing = await this.get(lessonId);
    if (!existing) {
      await db.grammarProgress.put({
        lessonId,
        status: 'unlocked',
        score: 0,
        completedAt: 0,
      });
    } else if (existing.status === 'locked') {
      await db.grammarProgress.put({ ...existing, status: 'unlocked' });
    }
  },

  async complete(lessonId: string, score: number): Promise<void> {
    await db.grammarProgress.put({
      lessonId,
      status: 'completed',
      score,
      completedAt: Date.now(),
    });
  },
};
