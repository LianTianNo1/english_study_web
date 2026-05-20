// 取词 —— 复用游戏1的 review/mistakes/new 三分支逻辑（stageBuilder.ts 内部 fetchByMode 未导出，此处复制）
import type { LevelId, WordRecord } from '@/db/types';
import { progressRepo } from '@/db/repositories/progress';
import { wordsRepo } from '@/db/repositories/words';
import type { LearnOrder } from '@/stores/settingsStore';
import type { GameMode } from '@/features/play-3d/stageBuilder';
import type { WordInfo } from './types';

function cleanWord(w: string): string {
  return w.toLowerCase().replace(/[^a-z]/g, '');
}

function meaningOf(w: WordRecord): string {
  return w.translations
    .slice(0, 2)
    .map((t) => `${t.type ? `[${t.type}] ` : ''}${t.translation}`)
    .join('  ');
}

async function fetchByMode(
  level: LevelId,
  count: number,
  order: LearnOrder,
  mode: GameMode
): Promise<WordRecord[]> {
  const out: WordRecord[] = [];
  const seen = new Set<number>();

  if (mode === 'mistakes') {
    const wrong = await progressRepo.wrongWords(count * 2);
    for (const p of wrong) {
      const w = await wordsRepo.getById(p.wordId);
      if (w?.id != null && !seen.has(w.id)) {
        out.push(w);
        seen.add(w.id);
      }
      if (out.length >= count) break;
    }
    return out;
  }

  if (mode === 'new') {
    const learned = await progressRepo.learnedWordIds(level);
    const pool =
      order === 'random'
        ? await wordsRepo.getRandomByLevel(level, count * 4, [])
        : await wordsRepo.byLevel(level, count * 4, 0);
    for (const w of pool) {
      if (w.id != null && !learned.has(w.id) && !seen.has(w.id)) {
        out.push(w);
        seen.add(w.id);
      }
      if (out.length >= count) break;
    }
    return out;
  }

  // review
  const due = await progressRepo.dueForReview(Date.now(), count);
  for (const p of due) {
    const w = await wordsRepo.getById(p.wordId);
    if (w?.id != null && !seen.has(w.id)) {
      out.push(w);
      seen.add(w.id);
    }
    if (out.length >= count) break;
  }
  if (out.length >= count) return out;

  const need = count - out.length;
  const filler =
    order === 'random'
      ? await wordsRepo.getRandomByLevel(level, need * 2, [...seen])
      : await wordsRepo.byLevel(level, need * 3, 0);
  for (const w of filler) {
    if (w.id != null && !seen.has(w.id)) {
      out.push(w);
      seen.add(w.id);
    }
    if (out.length >= count) break;
  }
  return out;
}

/** 取一批适合陨石游戏的单词（2-12 字母） */
export async function fetchMeteorWords(
  level: LevelId,
  count: number,
  order: LearnOrder,
  mode: GameMode
): Promise<WordInfo[]> {
  const records = await fetchByMode(level, count * 2, order, mode);
  const out: WordInfo[] = [];
  for (const r of records) {
    if (r.id == null) continue;
    const word = cleanWord(r.word);
    if (word.length < 2 || word.length > 12) continue;
    out.push({ word, wordId: r.id, meaning: meaningOf(r), raw: r });
    if (out.length >= count) break;
  }
  return out;
}
