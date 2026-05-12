/// <reference lib="webworker" />
import type { LevelId, WordRecord } from '@/db/types';

export interface ImportRequest {
  levelId: LevelId;
  sourceFile: string;
}

export interface ImportProgress {
  type: 'progress';
  levelId: LevelId;
  loaded: number;
  total: number;
}

export interface ImportChunk {
  type: 'chunk';
  levelId: LevelId;
  rows: WordRecord[];
}

export interface ImportDone {
  type: 'done';
  levelId: LevelId;
  total: number;
}

export interface ImportError {
  type: 'error';
  levelId: LevelId;
  message: string;
}

export type ImportMessage = ImportProgress | ImportChunk | ImportDone | ImportError;

const CHUNK_SIZE = 1000;

self.onmessage = async (e: MessageEvent<ImportRequest>) => {
  const { levelId, sourceFile } = e.data;
  try {
    const res = await fetch(sourceFile);
    if (!res.ok) throw new Error(`fetch ${sourceFile} → ${res.status}`);
    const raw = (await res.json()) as Array<{
      word: string;
      translations: { translation: string; type: string }[];
      phrases: { phrase: string; translation: string }[];
    }>;

    const total = raw.length;
    let loaded = 0;
    let buffer: WordRecord[] = [];

    for (let i = 0; i < total; i++) {
      const w = raw[i];
      buffer.push({
        levelId,
        orderIndex: i,
        word: w.word,
        translations: w.translations ?? [],
        phrases: w.phrases ?? [],
      });
      if (buffer.length >= CHUNK_SIZE) {
        post({ type: 'chunk', levelId, rows: buffer });
        loaded += buffer.length;
        post({ type: 'progress', levelId, loaded, total });
        buffer = [];
      }
    }
    if (buffer.length) {
      post({ type: 'chunk', levelId, rows: buffer });
      loaded += buffer.length;
      post({ type: 'progress', levelId, loaded, total });
    }
    post({ type: 'done', levelId, total });
  } catch (err) {
    post({ type: 'error', levelId, message: (err as Error).message });
  }
};

function post(msg: ImportMessage) {
  (self as DedicatedWorkerGlobalScope).postMessage(msg);
}

export {};
