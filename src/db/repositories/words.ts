import { db } from '../schema';
import type { LevelId, WordRecord } from '../types';

export const wordsRepo = {
  async byLevel(levelId: LevelId, limit = 50, offset = 0): Promise<WordRecord[]> {
    return db.words
      .where('[levelId+orderIndex]')
      .between([levelId, 0], [levelId, Infinity])
      .offset(offset)
      .limit(limit)
      .toArray();
  },

  async countByLevel(levelId: LevelId): Promise<number> {
    return db.words.where('levelId').equals(levelId).count();
  },

  async search(levelId: LevelId | 'all', query: string, limit = 50): Promise<WordRecord[]> {
    const q = query.trim().toLowerCase();
    if (!q) return [];
    const base = levelId === 'all'
      ? db.words.toCollection()
      : db.words.where('levelId').equals(levelId);
    return base
      .filter((w) => w.word.toLowerCase().includes(q))
      .limit(limit)
      .toArray();
  },

  async getById(id: number): Promise<WordRecord | undefined> {
    return db.words.get(id);
  },

  async getRandomByLevel(levelId: LevelId, n: number, excludeIds: number[] = []): Promise<WordRecord[]> {
    const excludeSet = new Set(excludeIds);
    const total = await this.countByLevel(levelId);
    const result: WordRecord[] = [];
    const seen = new Set<number>();
    const maxTries = Math.min(n * 6, total);
    for (let i = 0; i < maxTries && result.length < n; i++) {
      const idx = Math.floor(Math.random() * total);
      if (seen.has(idx)) continue;
      seen.add(idx);
      const arr = await db.words
        .where('[levelId+orderIndex]')
        .between([levelId, idx], [levelId, idx + 1], true, false)
        .toArray();
      const w = arr[0];
      if (w && w.id && !excludeSet.has(w.id)) result.push(w);
    }
    return result;
  },
};
