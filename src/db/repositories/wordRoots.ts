import { db } from '../schema';
import type { WordRootRecord } from '../types';

export const wordRootsRepo = {
  async get(wordId: number): Promise<WordRootRecord | undefined> {
    return db.wordRoots.get(wordId);
  },

  async byRoot(root: string): Promise<WordRootRecord[]> {
    return db.wordRoots.where('root').equals(root).toArray();
  },

  async put(rec: WordRootRecord): Promise<void> {
    await db.wordRoots.put(rec);
  },

  async clear(): Promise<void> {
    await db.wordRoots.clear();
  },

  async count(): Promise<number> {
    return db.wordRoots.count();
  },
};
