// 关卡状态机：useReducer
import { useReducer } from 'react';
import type { FloatingFeedback, PlayState, Stage, StageResult } from './types';
import { scoreForHit, speedBonus } from './scoring';

const INITIAL_LIVES = 3;

export type Action =
  | { type: 'START_SESSION'; stages: Stage[] }
  | { type: 'CLICK_BLOCK'; blockId: string }
  | { type: 'AUTO_RETRACT'; blockId: string }
  | { type: 'TIMEOUT_STAGE' }
  | { type: 'NEXT_STAGE' }
  | { type: 'RETRY_STAGE' }
  | { type: 'FREEZE_TIME' }
  | { type: 'UNFREEZE_TIME' }
  | { type: 'REVEAL_ANSWER' }
  | { type: 'SKIP_STAGE' }
  | { type: 'DISMISS_FEEDBACK'; id: number }
  | { type: 'END_SESSION' };

const EMPTY: PlayState = {
  phase: 'loading',
  stages: [],
  current: 0,
  lives: INITIAL_LIVES,
  errorsThisStage: 0,
  history: [],
  stageStartedAt: 0,
  lastHitAt: 0,
  score: 0,
  combo: 0,
  bestCombo: 0,
  feedbacks: [],
  pendingRetractIds: [],
  revealed: false,
  freezeUntilAt: null,
};

let feedbackId = 0;

function pushFeedback(state: PlayState, fb: Omit<FloatingFeedback, 'id'>): PlayState {
  const id = ++feedbackId;
  const next = { ...fb, id } as FloatingFeedback;
  // 仅保留最近 3 条
  const list = [...state.feedbacks.filter((f) => f.expiresAt > Date.now()), next].slice(-3);
  return { ...state, feedbacks: list };
}

function reducer(state: PlayState, action: Action): PlayState {
  switch (action.type) {
    case 'START_SESSION': {
      const now = Date.now();
      // 重置传入 stages 内 blocks/slots 状态（支持"重玩本组"复用 stages）
      const cleanStages = action.stages.map((st) => ({
        ...st,
        slots: st.slots.map((s) => ({ ...s, filledBlockId: null, correct: false })),
        blocks: st.blocks.map((b) => ({ ...b, placedSlot: null })),
      }));
      return {
        ...EMPTY,
        phase: 'playing',
        stages: cleanStages,
        stageStartedAt: now,
        lastHitAt: now,
        lives: INITIAL_LIVES,
      };
    }

    case 'CLICK_BLOCK': {
      if (state.phase !== 'playing') return state;
      const stages = state.stages.slice();
      const stage = { ...stages[state.current] };
      stage.blocks = stage.blocks.slice();
      stage.slots = stage.slots.slice();

      const block = stage.blocks.find((b) => b.id === action.blockId);
      if (!block || block.placedSlot !== null) return state;

      // 找下一个空槽
      const slotIdx = stage.slots.findIndex((s) => s.filledBlockId === null);
      if (slotIdx < 0) return state;
      const slot = stage.slots[slotIdx];
      const matches = block.letter === slot.expected;

      stage.slots[slotIdx] = {
        ...slot,
        filledBlockId: block.id,
        correct: matches,
      };
      stage.blocks = stage.blocks.map((b) =>
        b.id === block.id ? { ...b, placedSlot: slotIdx } : b
      );
      stages[state.current] = stage;

      const now = Date.now();
      const dt = now - state.lastHitAt;

      let next: PlayState = { ...state, stages, lastHitAt: now };

      if (matches) {
        const newCombo = state.combo + 1;
        const rawDelta = scoreForHit(newCombo, dt);
        const delta = block.isGold ? rawDelta * 3 : rawDelta;
        const bonus = speedBonus(dt);
        next = {
          ...next,
          combo: newCombo,
          bestCombo: Math.max(state.bestCombo, newCombo),
          score: state.score + delta,
        };
        next = pushFeedback(next, {
          text: `+${delta}`,
          sub: block.isGold
            ? 'GOLD ×3!'
            : bonus >= 0.9 ? 'PERFECT!' : bonus >= 0.5 ? 'GREAT' : 'GOOD',
          kind: block.isGold ? 'perfect' : bonus >= 0.9 ? 'perfect' : bonus >= 0.5 ? 'great' : 'good',
          expiresAt: now + 900,
        });
      } else {
        next = {
          ...next,
          combo: 0,
          lives: state.lives - 1,
          errorsThisStage: state.errorsThisStage + 1,
          // 标记错放（多个并存按顺序排队）
          pendingRetractIds: [...state.pendingRetractIds, block.id],
        };
        next = pushFeedback(next, {
          text: 'MISS',
          sub: 'combo lost',
          kind: 'bad',
          expiresAt: now + 900,
        });
      }

      // 全对 / 失血结算（错放不会触发 stage-fail，会自动撤回继续玩）
      const allFilled = stage.slots.every((s) => s.filledBlockId !== null);
      const allCorrect = allFilled && stage.slots.every((s) => s.correct);

      if (next.lives <= 0) {
        const result: StageResult = {
          wordId: stage.word.id!,
          errors: next.errorsThisStage,
          durationMs: now - state.stageStartedAt,
          passed: false,
          revealed: state.revealed,
        };
        // 每关独立 3 命，耗尽 → 本关失败（不终结整局）
        return { ...next, lives: 0, history: [...state.history, result], phase: 'stage-fail' };
      }

      if (allCorrect) {
        const result: StageResult = {
          wordId: stage.word.id!,
          errors: next.errorsThisStage,
          durationMs: now - state.stageStartedAt,
          passed: true,
          revealed: state.revealed,
        };
        // 完美关：0 错 + ≤8s → 额外 +500 + perfect 反馈
        const stageMs = now - state.stageStartedAt;
        let bonusState = next;
        if (next.errorsThisStage === 0 && stageMs <= 8000) {
          bonusState = {
            ...next,
            score: next.score + 500,
          };
          bonusState = pushFeedback(bonusState, {
            text: '+500',
            sub: 'PERFECT STAGE',
            kind: 'perfect',
            expiresAt: now + 1400,
          });
        }
        return { ...bonusState, history: [...state.history, result], phase: 'stage-clear' };
      }

      return next;
    }

    case 'AUTO_RETRACT': {
      if (state.phase !== 'playing') return state;
      const remaining = state.pendingRetractIds.filter((id) => id !== action.blockId);
      const stages = state.stages.slice();
      const stage = { ...stages[state.current] };
      stage.blocks = stage.blocks.slice();
      stage.slots = stage.slots.slice();
      const block = stage.blocks.find((b) => b.id === action.blockId);
      if (!block || block.placedSlot === null) {
        return { ...state, pendingRetractIds: remaining };
      }
      const slotIdx = block.placedSlot;
      stage.slots[slotIdx] = {
        ...stage.slots[slotIdx],
        filledBlockId: null,
        correct: false,
      };
      stage.blocks = stage.blocks.map((b) =>
        b.id === action.blockId ? { ...b, placedSlot: null } : b
      );
      stages[state.current] = stage;
      return { ...state, stages, pendingRetractIds: remaining };
    }

    case 'TIMEOUT_STAGE': {
      if (state.phase !== 'playing') return state;
      const stage = state.stages[state.current];
      const result: StageResult = {
        wordId: stage.word.id!,
        errors: state.errorsThisStage,
        durationMs: Date.now() - state.stageStartedAt,
        passed: false,
        revealed: state.revealed,
      };
      // 关卡超时一律 stage-fail；不影响整局生命
      return {
        ...state,
        combo: 0,
        history: [...state.history, result],
        phase: 'stage-fail',
      };
    }

    case 'NEXT_STAGE': {
      const next = state.current + 1;
      if (next >= state.stages.length) {
        return { ...state, phase: 'session-end', pendingRetractIds: [], freezeUntilAt: null };
      }
      return {
        ...state,
        current: next,
        phase: 'playing',
        lives: INITIAL_LIVES,        // J: 每关独立生命
        errorsThisStage: 0,
        stageStartedAt: Date.now(),
        lastHitAt: Date.now(),
        feedbacks: [],
        pendingRetractIds: [],
  revealed: false,
        freezeUntilAt: null,
      };
    }

    case 'RETRY_STAGE': {
      const stages = state.stages.slice();
      const stage = stages[state.current];
      stages[state.current] = {
        ...stage,
        slots: stage.slots.map((s) => ({ ...s, filledBlockId: null, correct: false })),
        blocks: stage.blocks.map((b) => ({ ...b, placedSlot: null })),
      };
      return {
        ...state,
        stages,
        phase: 'playing',
        lives: INITIAL_LIVES,        // J: retry 也重置生命
        errorsThisStage: 0,
        stageStartedAt: Date.now(),
        lastHitAt: Date.now(),
        feedbacks: [],
        pendingRetractIds: [],
  revealed: false,
        freezeUntilAt: null,
      };
    }

    case 'FREEZE_TIME': {
      if (state.phase !== 'playing') return state;
      const now = Date.now();
      // 已在冻结中或 combo 不够 → 不响应
      if (state.freezeUntilAt && state.freezeUntilAt > now) return state;
      if (state.combo < 10) return state;
      const next = pushFeedback(state, {
        text: '+3.0s',
        sub: 'TIME FREEZE',
        kind: 'perfect',
        expiresAt: now + 1400,
      });
      return { ...next, freezeUntilAt: now + 3000 };
    }

    case 'UNFREEZE_TIME': {
      if (!state.freezeUntilAt) return state;
      // 冻结结束后，将 stageStartedAt 前移 3000ms 等价于"赠送 3 秒"
      return { ...state, stageStartedAt: state.stageStartedAt + 3000, freezeUntilAt: null };
    }

    case 'REVEAL_ANSWER': {
      if (state.phase !== 'playing' || state.revealed) return state;
      const now = Date.now();
      let next = {
        ...state,
        revealed: true,
        combo: 0,
        score: Math.max(0, state.score - 300),
      };
      next = pushFeedback(next, {
        text: '-300',
        sub: 'HINT REVEALED',
        kind: 'bad',
        expiresAt: now + 1200,
      });
      return next;
    }

    case 'SKIP_STAGE': {
      if (state.phase !== 'playing') return state;
      const stage = state.stages[state.current];
      const result: StageResult = {
        wordId: stage.word.id!,
        errors: state.errorsThisStage,
        durationMs: Date.now() - state.stageStartedAt,
        passed: false,
        revealed: state.revealed,
      };
      return {
        ...state,
        combo: 0,
        history: [...state.history, result],
        phase: 'stage-fail',
      };
    }

    case 'DISMISS_FEEDBACK':
      return { ...state, feedbacks: state.feedbacks.filter((f) => f.id !== action.id) };

    case 'END_SESSION':
      return { ...state, phase: 'session-end' };

    default:
      return state;
  }
}

export function usePlaySession() {
  return useReducer(reducer, EMPTY);
}

export { reducer as _playReducer };
