// 状态机 —— 单词陨石防御战
import { useReducer } from 'react';
import {
  BASE_MAX_HP,
  WORDS_PER_WAVE,
  type Action,
  type FloatFeedback,
  type Meteor,
  type MeteorState,
  type WordInfo,
} from './types';
import { difficultyAt, letterScore, pickLockTarget, wordScore } from './meteorEngine';

let fbSeq = 0;
let mtSeq = 0;

const INIT: MeteorState = {
  phase: 'loading',
  queue: [],
  meteors: [],
  lockedId: null,
  baseHp: BASE_MAX_HP,
  score: 0,
  combo: 0,
  bestCombo: 0,
  destroyedCount: 0,
  spawnedCount: 0,
  totalWords: 0,
  lastSpawnAt: 0,
  lastTickAt: 0,
  feedbacks: [],
  results: [],
  wave: 1,
  waveBannerUntil: 0,
  hitFlashAt: 0,
  laserSeq: 0,
  laserTargetId: null,
  startedAt: 0,
};

function addFeedback(list: FloatFeedback[], text: string, color: string, now: number): FloatFeedback[] {
  const fb: FloatFeedback = { id: ++fbSeq, text, color, expireAt: now + 1400 };
  return [...list.slice(-5), fb];
}

function makeMeteor(info: WordInfo, speed: number, now: number): Meteor {
  return {
    id: `mt-${++mtSeq}`,
    word: info.word,
    wordId: info.wordId,
    meaning: info.meaning,
    raw: info.raw,
    z: 0,
    x: Math.random() * 2 - 1,
    y: Math.random() * 2 - 1,
    typedLen: 0,
    errors: 0,
    status: 'incoming',
    speed,
    spawnAt: now,
    lockedAt: null,
    endedAt: null,
    seed: Math.random(),
  };
}

function reducer(state: MeteorState, action: Action): MeteorState {
  switch (action.type) {
    case 'START': {
      const { words, now } = action;
      if (words.length === 0) {
        return { ...INIT, phase: 'lose', totalWords: 0 };
      }
      return {
        ...INIT,
        phase: 'playing',
        queue: words,
        totalWords: words.length,
        lastSpawnAt: 0, // 让首个 TICK 立即生成
        lastTickAt: now,
        startedAt: now,
        wave: 1,
        waveBannerUntil: now + 1900,
      };
    }

    case 'TICK': {
      if (state.phase !== 'playing') return state;
      const { now } = action;
      const dt = Math.min(0.1, (now - state.lastTickAt) / 1000);
      const diff = difficultyAt(state.destroyedCount);

      let meteors = state.meteors;
      let baseHp = state.baseHp;
      let combo = state.combo;
      let lockedId = state.lockedId;
      let feedbacks = state.feedbacks;
      let results = state.results;
      let hitFlashAt = state.hitFlashAt;

      // 1) 推进 + 坠毁判定
      meteors = meteors.map((m) => {
        if (m.status !== 'incoming') return m;
        const z = m.z + m.speed * dt;
        if (z >= 1) {
          // 撞基地
          baseHp -= 1;
          hitFlashAt = now;
          combo = 0;
          if (lockedId === m.id) lockedId = null;
          results = [...results, { wordId: m.wordId, word: m.word, destroyed: false, errors: m.errors }];
          feedbacks = addFeedback(feedbacks, `BREACH // -1`, '#FF3B30', now);
          return { ...m, z: 1, status: 'breached' as const, endedAt: now };
        }
        return { ...m, z };
      });

      // 2) 清理过期残骸
      meteors = meteors.filter((m) => {
        if (m.status === 'incoming') return true;
        if (m.endedAt == null) return true;
        const ttl = m.status === 'destroyed' ? 700 : 500;
        return now - m.endedAt < ttl;
      });

      // 3) 生成新陨石
      let queue = state.queue;
      let lastSpawnAt = state.lastSpawnAt;
      let spawnedCount = state.spawnedCount;
      const incomingCount = meteors.filter((m) => m.status === 'incoming').length;
      if (
        queue.length > 0 &&
        incomingCount < diff.maxOnScreen &&
        now - lastSpawnAt >= diff.spawnInterval
      ) {
        const [head, ...rest] = queue;
        meteors = [...meteors, makeMeteor(head, diff.speed, now)];
        queue = rest;
        lastSpawnAt = now;
        spawnedCount += 1;
      }

      // 4) 波次推进
      let wave = state.wave;
      let waveBannerUntil = state.waveBannerUntil;
      const newWave = Math.floor(state.destroyedCount / WORDS_PER_WAVE) + 1;
      if (newWave > wave) {
        wave = newWave;
        waveBannerUntil = now + 1900;
      }

      // 5) 胜负判定
      let phase: MeteorState['phase'] = state.phase;
      if (baseHp <= 0) {
        phase = 'lose';
      } else if (queue.length === 0 && meteors.every((m) => m.status !== 'incoming')) {
        phase = 'win';
      }

      return {
        ...state,
        meteors,
        queue,
        baseHp,
        combo,
        lockedId,
        feedbacks,
        results,
        hitFlashAt,
        lastSpawnAt,
        spawnedCount,
        wave,
        waveBannerUntil,
        lastTickAt: now,
        phase,
      };
    }

    case 'TYPE': {
      if (state.phase !== 'playing') return state;
      const letter = action.letter.toLowerCase();
      if (!/^[a-z]$/.test(letter)) return state;
      const { now } = action;

      // 已锁定 → 对锁定陨石判定
      if (state.lockedId) {
        const m = state.meteors.find((x) => x.id === state.lockedId);
        if (!m || m.status !== 'incoming') {
          return { ...state, lockedId: null };
        }
        const expected = m.word[m.typedLen];
        if (letter === expected) {
          return applyCorrectLetter(state, m, now);
        }
        // 打错
        const meteors = state.meteors.map((x) =>
          x.id === m.id ? { ...x, errors: x.errors + 1 } : x
        );
        return {
          ...state,
          meteors,
          combo: 0,
          feedbacks: addFeedback(state.feedbacks, 'MISS', '#FF3B30', now),
        };
      }

      // 未锁定 → 寻找以该字母开头的陨石
      const target = pickLockTarget(state.meteors, letter, null);
      if (!target) return state;
      const locked: MeteorState = {
        ...state,
        lockedId: target.id,
        meteors: state.meteors.map((x) =>
          x.id === target.id ? { ...x, lockedAt: now } : x
        ),
      };
      const m = locked.meteors.find((x) => x.id === target.id)!;
      return applyCorrectLetter(locked, m, now);
    }

    case 'TAP': {
      if (state.phase !== 'playing') return state;
      const { now } = action;
      const target = state.meteors.find((x) => x.id === action.meteorId);
      if (!target || target.status !== 'incoming') return state;
      // 已锁定别的陨石 → 忽略
      if (state.lockedId && state.lockedId !== target.id) return state;
      let s = state;
      let m = target;
      if (!s.lockedId) {
        s = {
          ...s,
          lockedId: target.id,
          meteors: s.meteors.map((x) =>
            x.id === target.id ? { ...x, lockedAt: now } : x
          ),
        };
        m = s.meteors.find((x) => x.id === target.id)!;
      }
      return applyCorrectLetter(s, m, now);
    }

    case 'EXPIRE_FEEDBACKS': {
      const live = state.feedbacks.filter((f) => f.expireAt > action.now);
      if (live.length === state.feedbacks.length) return state;
      return { ...state, feedbacks: live };
    }

    case 'END':
      return { ...state, phase: state.phase === 'playing' ? 'lose' : state.phase };

    default:
      return state;
  }
}

/** 处理一个正确字母（含可能的击毁） */
function applyCorrectLetter(state: MeteorState, m: Meteor, now: number): MeteorState {
  const typedLen = m.typedLen + 1;
  const gained = letterScore(state.combo);
  const laserSeq = state.laserSeq + 1;

  // 击毁
  if (typedLen >= m.word.length) {
    const combo = state.combo + 1;
    const lockedMs = now - (m.lockedAt ?? now);
    const bonus = wordScore(m.word.length, combo, lockedMs);
    const meteors = state.meteors.map((x) =>
      x.id === m.id
        ? { ...x, typedLen, status: 'destroyed' as const, endedAt: now }
        : x
    );
    return {
      ...state,
      meteors,
      lockedId: null,
      combo,
      bestCombo: Math.max(state.bestCombo, combo),
      score: state.score + gained + bonus,
      destroyedCount: state.destroyedCount + 1,
      laserSeq,
      laserTargetId: m.id,
      results: [...state.results, { wordId: m.wordId, word: m.word, destroyed: true, errors: m.errors }],
      feedbacks: addFeedback(
        state.feedbacks,
        `${m.word.toUpperCase()} +${gained + bonus}`,
        '#39FF6A',
        now
      ),
    };
  }

  // 普通命中
  const meteors = state.meteors.map((x) =>
    x.id === m.id ? { ...x, typedLen } : x
  );
  return {
    ...state,
    meteors,
    score: state.score + gained,
    laserSeq,
    laserTargetId: m.id,
  };
}

export function useMeteorSession() {
  return useReducer(reducer, INIT);
}
