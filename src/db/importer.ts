import { db } from './schema';
import type { LevelId, WordRecord } from './types';
import ImportWorker from '@/workers/import.worker?worker';
import type { ImportMessage } from '@/workers/import.worker';

export interface ImportOptions {
  levelId: LevelId;
  sourceFile: string;
  onProgress?: (loaded: number, total: number) => void;
}

export async function importLevel(opts: ImportOptions): Promise<number> {
  const { levelId, sourceFile, onProgress } = opts;

  await db.words.where('levelId').equals(levelId).delete();

  return new Promise<number>((resolve, reject) => {
    const worker = new ImportWorker();
    let totalWritten = 0;
    let pendingWrites: Promise<unknown>[] = [];

    worker.onmessage = async (e: MessageEvent<ImportMessage>) => {
      const msg = e.data;
      if (msg.type === 'chunk') {
        const writePromise = db.words.bulkAdd(msg.rows as WordRecord[]);
        pendingWrites.push(writePromise);
      } else if (msg.type === 'progress') {
        onProgress?.(msg.loaded, msg.total);
      } else if (msg.type === 'done') {
        try {
          await Promise.all(pendingWrites);
          totalWritten = msg.total;
          worker.terminate();
          resolve(totalWritten);
        } catch (e) {
          worker.terminate();
          reject(e as Error);
        }
      } else if (msg.type === 'error') {
        worker.terminate();
        reject(new Error(msg.message));
      }
    };

    worker.onerror = (e: ErrorEvent) => {
      worker.terminate();
      reject(new Error(e.message));
    };

    worker.postMessage({ levelId, sourceFile });
  });
}

export async function isLevelImported(levelId: LevelId): Promise<boolean> {
  const count = await db.words.where('levelId').equals(levelId).count();
  return count > 0;
}

export async function isAnyImported(): Promise<boolean> {
  const count = await db.words.limit(1).count();
  return count > 0;
}

export async function getLevelCount(levelId: LevelId): Promise<number> {
  return db.words.where('levelId').equals(levelId).count();
}
