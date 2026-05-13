import { db } from '../schema';
import type { UserSentenceRecord } from '../types';

export const userSentencesRepo = {
  async add(rec: Omit<UserSentenceRecord, 'id'>): Promise<number> {
    return db.userSentences.add(rec) as Promise<number>;
  },

  async byWord(wordId: number): Promise<UserSentenceRecord[]> {
    return db.userSentences.where('wordId').equals(wordId).reverse().sortBy('createdAt');
  },

  async recent(limit = 50): Promise<UserSentenceRecord[]> {
    return db.userSentences.orderBy('createdAt').reverse().limit(limit).toArray();
  },

  async count(): Promise<number> {
    return db.userSentences.count();
  },

  async clear(): Promise<void> {
    await db.userSentences.clear();
  },
};
