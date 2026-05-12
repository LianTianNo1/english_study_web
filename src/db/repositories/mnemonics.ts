import { db } from '../schema';
import type { MnemonicRecord } from '../types';

export const mnemonicsRepo = {
  async get(wordId: number): Promise<MnemonicRecord | undefined> {
    return db.mnemonics.get(wordId);
  },

  async getMany(wordIds: number[]): Promise<Map<number, MnemonicRecord>> {
    if (wordIds.length === 0) return new Map();
    const list = await db.mnemonics.where('wordId').anyOf(wordIds).toArray();
    return new Map(list.map((m) => [m.wordId, m]));
  },

  async put(rec: MnemonicRecord): Promise<void> {
    await db.mnemonics.put(rec);
  },

  async putMany(recs: MnemonicRecord[]): Promise<void> {
    if (recs.length === 0) return;
    await db.mnemonics.bulkPut(recs);
  },

  async clear(): Promise<void> {
    await db.mnemonics.clear();
  },

  async count(): Promise<number> {
    return db.mnemonics.count();
  },
};
