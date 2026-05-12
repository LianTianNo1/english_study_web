import Dexie, { type Table } from 'dexie';
import type {
  WordRecord,
  ProgressRecord,
  SessionRecord,
  GrammarProgressRecord,
  SettingsRecord,
} from './types';

export class AppDB extends Dexie {
  words!: Table<WordRecord, number>;
  progress!: Table<ProgressRecord, number>;
  sessions!: Table<SessionRecord, number>;
  grammarProgress!: Table<GrammarProgressRecord, string>;
  settings!: Table<SettingsRecord, string>;

  constructor() {
    super('english-hub');
    this.version(1).stores({
      words: '++id, levelId, word, [levelId+orderIndex]',
      progress: '++id, &wordId, status, nextReviewAt, levelId, [levelId+status]',
      sessions: '++id, date, type, [date+type]',
      grammarProgress: '&lessonId, status',
      settings: '&key',
    });
    // v2: 错题本 & 难词标记 索引
    this.version(2).stores({
      progress: '++id, &wordId, status, nextReviewAt, levelId, [levelId+status], starred, wrongCount',
    });
  }
}

export const db = new AppDB();

export async function getSetting<T = unknown>(key: string, fallback: T): Promise<T> {
  const row = await db.settings.get(key);
  return (row?.value as T) ?? fallback;
}

export async function setSetting<T>(key: string, value: T): Promise<void> {
  await db.settings.put({ key, value });
}
