import Dexie, { type Table } from 'dexie';
import type {
  WordRecord,
  ProgressRecord,
  SessionRecord,
  GrammarProgressRecord,
  SettingsRecord,
  MnemonicRecord,
  WordRootRecord,
  UserSentenceRecord,
} from './types';

export class AppDB extends Dexie {
  words!: Table<WordRecord, number>;
  progress!: Table<ProgressRecord, number>;
  sessions!: Table<SessionRecord, number>;
  grammarProgress!: Table<GrammarProgressRecord, string>;
  settings!: Table<SettingsRecord, string>;
  mnemonics!: Table<MnemonicRecord, number>;
  wordRoots!: Table<WordRootRecord, number>;
  userSentences!: Table<UserSentenceRecord, number>;

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
    // v3: AI 巧记缓存
    this.version(3).stores({
      mnemonics: '&wordId, word, createdAt',
    });
    // v4: 词根关联 + 用户造句记录
    this.version(4).stores({
      wordRoots: '&wordId, word, root, createdAt',
      userSentences: '++id, wordId, createdAt',
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
