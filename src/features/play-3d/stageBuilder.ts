// 关卡生成：取词 + 干扰字母（不再计算 3D 布局，由 Scene 决定）
import type { LevelId, WordRecord } from '@/db/types';
import { progressRepo } from '@/db/repositories/progress';
import { wordsRepo } from '@/db/repositories/words';
import type { LearnOrder } from '@/stores/settingsStore';
import type { Block, SlotState, Stage } from './types';

const ALPHABET = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ';

function distractorCount(len: number): number {
  if (len <= 4) return 0;
  if (len <= 6) return 2;
  return 3;
}

function pickDistractors(exclude: Set<string>, n: number): string[] {
  const pool = ALPHABET.split('').filter((c) => !exclude.has(c));
  const out: string[] = [];
  for (let i = 0; i < n && pool.length > 0; i++) {
    const idx = Math.floor(Math.random() * pool.length);
    out.push(pool[idx]);
    pool.splice(idx, 1);
  }
  return out;
}

function shuffle<T>(arr: T[]): T[] {
  const out = arr.slice();
  for (let i = out.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [out[i], out[j]] = [out[j], out[i]];
  }
  return out;
}

export function buildStage(word: WordRecord, stageIndex: number): Stage {
  const upper = word.word.toUpperCase().replace(/[^A-Z]/g, '');
  const letters = upper.split('');
  const dN = distractorCount(letters.length);
  const targetSet = new Set(letters);
  const distractors = pickDistractors(targetSet, dN);
  const all = shuffle([...letters, ...distractors]);

  // 1/3 概率挑一个目标字母为金色（仅 target 字母，不挑干扰）
  const goldEnabled = Math.random() < 0.33 && letters.length > 0;
  const goldLetter = goldEnabled ? letters[Math.floor(Math.random() * letters.length)] : null;
  let goldAssigned = false;

  const blocks: Block[] = all.map((letter, i) => {
    const isGold = goldEnabled && !goldAssigned && letter === goldLetter && letters.includes(letter);
    if (isGold) goldAssigned = true;
    return {
      id: `s${stageIndex}-b${i}`,
      letter,
      placedSlot: null,
      candidateIndex: i,
      isGold,
    };
  });

  const slots: SlotState[] = letters.map((expected, i) => ({
    index: i,
    expected,
    filledBlockId: null,
    correct: false,
  }));

  return { word, upperWord: upper, blocks, slots };
}

export type GameMode = 'review' | 'mistakes' | 'new';

async function fetchByMode(
  level: LevelId,
  count: number,
  order: LearnOrder,
  mode: GameMode
): Promise<WordRecord[]> {
  const out: WordRecord[] = [];
  const seen = new Set<number>();

  // ===== mistakes：wrongCount > 0 的词 =====
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

  // ===== new：未学习的词（不在 progress 表里） =====
  if (mode === 'new') {
    const learned = await progressRepo.learnedWordIds(level);
    // 顺序 or 随机
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

  // ===== review (default)：due 优先 + 补足 =====
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

export async function buildStages(
  level: LevelId,
  count: number,
  order: LearnOrder = 'sequential',
  mode: GameMode = 'review'
): Promise<Stage[]> {
  const words = await fetchByMode(level, count, order, mode);
  const valid = words.filter((w) => /[A-Za-z]/.test(w.word));
  return valid.slice(0, count).map((w, i) => buildStage(w, i));
}
