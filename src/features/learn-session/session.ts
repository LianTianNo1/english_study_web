import type { WordRecord } from '@/db/types';
import { shuffle, sample } from '@/lib/utils';

export type QuestionType = 'meaning' | 'word' | 'spell' | 'phrase';

export interface Question {
  type: QuestionType;
  word: WordRecord;
  prompt: string;
  options?: string[];
  answer: string;
}

export interface DistractorPool {
  translations: string[];
  words: string[];
}

export function buildPool(words: WordRecord[]): DistractorPool {
  const translations = words.flatMap((w) =>
    w.translations.map((t) => t.translation).filter(Boolean)
  );
  const wordList = words.map((w) => w.word);
  return { translations, words: wordList };
}

export function buildQuestion(
  w: WordRecord,
  pool: DistractorPool,
  forceType?: QuestionType
): Question {
  const types: QuestionType[] = ['meaning', 'word', 'spell'];
  if (w.phrases.length > 0) types.push('phrase');
  const type = forceType ?? types[Math.floor(Math.random() * types.length)];

  switch (type) {
    case 'meaning': {
      const correct = w.translations[0]?.translation ?? '—';
      const distractors = sample(
        pool.translations.filter((t) => t !== correct),
        3
      );
      const options = shuffle([correct, ...distractors]);
      return { type, word: w, prompt: w.word, options, answer: correct };
    }
    case 'word': {
      const correct = w.word;
      const distractors = sample(
        pool.words.filter((x) => x !== correct),
        3
      );
      const options = shuffle([correct, ...distractors]);
      return {
        type,
        word: w,
        prompt: w.translations[0]?.translation ?? '—',
        options,
        answer: correct,
      };
    }
    case 'spell': {
      return {
        type,
        word: w,
        prompt: w.translations[0]?.translation ?? '—',
        answer: w.word,
      };
    }
    case 'phrase': {
      const p = w.phrases[Math.floor(Math.random() * w.phrases.length)];
      const masked = p.phrase.replace(
        new RegExp(`\\b${escapeReg(w.word)}\\b`, 'i'),
        '____'
      );
      return {
        type,
        word: w,
        prompt: `${masked}\n${p.translation}`,
        answer: w.word,
      };
    }
  }
}

function escapeReg(s: string) {
  return s.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
}

export interface SessionState {
  queue: WordRecord[];
  pool: DistractorPool;
  current: Question | null;
  wrongIds: Set<number>;          // 本会话中至少错过一次的词
  skippedIds: Set<number>;        // 用户主动跳过的词
  totalAttempts: number;
  correctAttempts: number;
  passed: WordRecord[];
}

export function initSession(words: WordRecord[]): SessionState {
  const pool = buildPool(words);
  return {
    queue: shuffle(words),
    pool,
    current: null,
    wrongIds: new Set(),
    skippedIds: new Set(),
    totalAttempts: 0,
    correctAttempts: 0,
    passed: [],
  };
}

/** 跳过当前词——放队尾，不计入正误，不入错题 */
export function skipCurrent(state: SessionState): SessionState {
  if (state.queue.length === 0) return state;
  const queue = state.queue.slice();
  const head = queue.shift()!;
  queue.push(head);
  const skippedIds = new Set(state.skippedIds);
  if (head.id !== undefined) skippedIds.add(head.id);
  return { ...state, queue, skippedIds };
}

export function nextQuestion(state: SessionState): Question | null {
  if (state.queue.length === 0) return null;
  const head = state.queue[0];
  return buildQuestion(head, state.pool);
}

export function submitAnswer(state: SessionState, q: Question, userAnswer: string): {
  next: SessionState;
  correct: boolean;
} {
  const correct = normalize(userAnswer) === normalize(q.answer);
  const wrongIds = new Set(state.wrongIds);
  const queue = state.queue.slice();
  const passed = state.passed.slice();
  if (correct) {
    queue.shift();
    passed.push(q.word);
  } else {
    if (q.word.id !== undefined) wrongIds.add(q.word.id);
    const head = queue.shift()!;
    queue.push(head);
  }
  return {
    next: {
      ...state,
      queue,
      wrongIds,
      passed,
      totalAttempts: state.totalAttempts + 1,
      correctAttempts: state.correctAttempts + (correct ? 1 : 0),
    },
    correct,
  };
}

function normalize(s: string) {
  return s.trim().toLowerCase().replace(/\s+/g, ' ');
}
