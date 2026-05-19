// /play 路由入口
import { useEffect, useState, useCallback, useRef } from 'react';
import { useNavigate } from 'react-router-dom';
import { Loader2, AlertCircle } from 'lucide-react';
import { useSettings } from '@/stores/settingsStore';
import { PlayScene } from '@/features/play-3d/PlayScene';
import { HUD } from '@/features/play-3d/HUD';
import { ResultPanel } from '@/features/play-3d/ResultPanel';
import { usePlaySession } from '@/features/play-3d/usePlaySession';
import { buildStages, type GameMode } from '@/features/play-3d/stageBuilder';
import { ModePicker } from '@/features/play-3d/ModePicker';
import { commitPlaySession, commitStageResult } from '@/lib/play-srs';
import { sfxStageClear, sfxThud, sfxCombo } from '@/lib/sfx';
import { progressRepo } from '@/db/repositories/progress';
import { speak, stopSpeaking } from '@/lib/tts';
import { STAGE_TIME_LIMIT_MS } from '@/features/play-3d/types';
import { spawnBurst } from '@/features/play-3d/Particles';
import { StageClearOverlay } from '@/features/play-3d/StageClearOverlay';

const STAGES_PER_SESSION = 10;

function hasWebGL(): boolean {
  try {
    const c = document.createElement('canvas');
    return !!(c.getContext('webgl2') || c.getContext('webgl'));
  } catch {
    return false;
  }
}

export function Play() {
  const navigate = useNavigate();
  const { activeLevel, loaded, learnOrder } = useSettings();
  const [state, dispatch] = usePlaySession();
  const [error, setError] = useState<string>('');
  const [webglOk] = useState(hasWebGL);
  const [mode, setMode] = useState<GameMode | null>(null);

  // 根据已选 mode 拉取关卡
  useEffect(() => {
    if (!loaded || !webglOk || !mode) return;
    let cancelled = false;
    (async () => {
      try {
        const stages = await buildStages(activeLevel, STAGES_PER_SESSION, learnOrder, mode);
        if (cancelled) return;
        if (stages.length === 0) {
          const hint =
            mode === 'mistakes' ? '错题本是空的 — 先去刷一些错题再来。' :
            mode === 'new' ? '本词库已学完，没有新词可学了。' :
            '没有可复习的单词。';
          setError(hint);
          return;
        }
        dispatch({ type: 'START_SESSION', stages });
      } catch (e: any) {
        setError(e?.message ?? '加载失败');
      }
    })();
    return () => { cancelled = true; };
  }, [loaded, webglOk, activeLevel, learnOrder, mode, dispatch]);

  // 关卡开始朗读
  const currentWord = state.stages[state.current]?.word.word;
  useEffect(() => {
    if (state.phase === 'playing' && currentWord) {
      const t = setTimeout(() => speak(currentWord), 250);
      return () => clearTimeout(t);
    }
  }, [state.phase, state.current, currentWord]);

  // 倒计时（冻结期间暂停）
  useEffect(() => {
    if (state.phase !== 'playing') return;
    if (state.freezeUntilAt && state.freezeUntilAt > Date.now()) return; // 冻结中
    const remaining = STAGE_TIME_LIMIT_MS - (Date.now() - state.stageStartedAt);
    if (remaining <= 0) {
      dispatch({ type: 'TIMEOUT_STAGE' });
      return;
    }
    const t = setTimeout(() => dispatch({ type: 'TIMEOUT_STAGE' }), remaining);
    return () => clearTimeout(t);
  }, [state.phase, state.current, state.stageStartedAt, state.freezeUntilAt, dispatch]);

  // 冻结结束：派发 UNFREEZE 给 stageStartedAt 补 +3s
  useEffect(() => {
    if (!state.freezeUntilAt) return;
    const remain = state.freezeUntilAt - Date.now();
    if (remain <= 0) {
      dispatch({ type: 'UNFREEZE_TIME' });
      return;
    }
    const t = setTimeout(() => dispatch({ type: 'UNFREEZE_TIME' }), remain);
    return () => clearTimeout(t);
  }, [state.freezeUntilAt, dispatch]);

  // 键盘快捷键：playing / stage-clear / stage-fail / session-end 各阶段不同绑定
  useEffect(() => {
    function onKey(e: KeyboardEvent) {
      const tag = (e.target as HTMLElement | null)?.tagName;
      if (tag === 'INPUT' || tag === 'TEXTAREA') return;
      const k = e.key.toLowerCase();

      // ====== stage-clear: 任意键 / Enter / N 立即下一关 ======
      if (state.phase === 'stage-clear') {
        if (k === 'enter' || k === 'n' || k === ' ') {
          e.preventDefault();
          dispatch({ type: 'NEXT_STAGE' });
        }
        return;
      }

      // ====== stage-fail: R 重试 / N|Enter 下一关 ======
      if (state.phase === 'stage-fail') {
        if (k === 'r') {
          e.preventDefault();
          dispatch({ type: 'RETRY_STAGE' });
        } else if (k === 'n' || k === 'enter') {
          e.preventDefault();
          dispatch({ type: 'NEXT_STAGE' });
        }
        return;
      }

      // ====== session-end: R 重玩本组 / N 新单词 ======
      if (state.phase === 'session-end') {
        if (k === 'r') {
          e.preventDefault();
          dispatch({ type: 'START_SESSION', stages: state.stages });
        } else if (k === 'n') {
          e.preventDefault();
          (async () => {
            const stages = await buildStages(activeLevel, STAGES_PER_SESSION, learnOrder, mode ?? 'review');
            dispatch({ type: 'START_SESSION', stages });
          })();
        }
        return;
      }

      // ====== playing ======
      if (state.phase !== 'playing') return;

      // Space → time freeze
      if (e.key === ' ' || e.code === 'Space') {
        e.preventDefault();
        dispatch({ type: 'FREEZE_TIME' });
        return;
      }
      // ? (Shift+/) → 查看答案（不与 a-z 冲突）
      if (e.key === '?' || e.key === '/') {
        e.preventDefault();
        dispatch({ type: 'REVEAL_ANSWER' });
        return;
      }
      // Tab → 跳过本关（preventDefault 防止焦点跳走）
      if (e.key === 'Tab') {
        e.preventDefault();
        dispatch({ type: 'SKIP_STAGE' });
        return;
      }
      // A-Z → 匹配字母飞入
      const key = e.key.toUpperCase();
      if (!/^[A-Z]$/.test(key)) return;
      const stage = state.stages[state.current];
      if (!stage) return;
      const match = stage.blocks.find((b) => b.placedSlot === null && b.letter === key);
      if (match) {
        dispatch({ type: 'CLICK_BLOCK', blockId: match.id });
      }
    }
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [state.phase, state.current, state.stages, activeLevel, learnOrder, dispatch]);

  // 错放自动撤回：每个新增的 pending id 单独调度 700ms 撤回（多错并发各自计时，互不覆盖）
  // 同时把当前关单词写入错题集（markWrong）
  const scheduledRetracts = useRef<Set<string>>(new Set());
  useEffect(() => {
    for (const id of state.pendingRetractIds) {
      if (scheduledRetracts.current.has(id)) continue;
      scheduledRetracts.current.add(id);
      // 实时加入错题集
      const wordId = state.stages[state.current]?.word.id;
      if (wordId != null) {
        progressRepo.markWrong(wordId, activeLevel).catch(() => undefined);
      }
      setTimeout(() => {
        scheduledRetracts.current.delete(id);
        dispatch({ type: 'AUTO_RETRACT', blockId: id });
      }, 700);
    }
  }, [state.pendingRetractIds, state.current, state.stages, activeLevel, dispatch]);

  // 命中音效（基于 score 变化）
  const [lastScore, setLastScore] = useState(0);
  useEffect(() => {
    if (state.score > lastScore && state.combo > 0) {
      sfxCombo(state.combo);
    } else if (state.score === 0 && state.combo === 0 && lastScore > 0) {
      // 错位时
      sfxThud();
    }
    setLastScore(state.score);
  }, [state.score, state.combo, lastScore]);

  // 关卡结算
  useEffect(() => {
    if (state.phase === 'stage-clear') {
      sfxStageClear();
      const stage = state.stages[state.current];
      const word = stage?.word.word;
      if (word) setTimeout(() => speak(word), 200);
      // ★ 联动：本关结果立即写入 SRS（推进复习日期）+ 清错题（若 0 错且未用 hint）
      const lastResult = state.history.at(-1);
      if (lastResult) {
        commitStageResult(lastResult, activeLevel).catch((e) =>
          console.warn('[play] stage-clear srs commit failed', e)
        );
      }
      // B: 通关大爆破 — 50 颗金色粒子从槽位中心爆发
      spawnBurst({
        position: [0, 2.5, 0],
        color: '#FFD700',
        count: 50,
        spread: 1.2,
        lifeMs: 1400,
      });
      spawnBurst({
        position: [0, 2.5, 0],
        color: '#FFFFFF',
        count: 30,
        spread: 0.8,
        lifeMs: 1100,
      });
      const t = setTimeout(() => dispatch({ type: 'NEXT_STAGE' }), 1800);
      return () => clearTimeout(t);
    }
    if (state.phase === 'stage-fail') {
      sfxThud();
      // ★ 失败也写 SRS（quality=0，强化复习）+ wrongCount +1
      const lastResult = state.history.at(-1);
      if (lastResult) {
        commitStageResult(lastResult, activeLevel).catch((e) =>
          console.warn('[play] stage-fail srs commit failed', e)
        );
      }
    }
    if (state.phase === 'session-end') {
      sfxStageClear();
      commitPlaySession(state.history, activeLevel).catch((e) =>
        console.warn('[play] srs commit failed', e)
      );
    }
  }, [state.phase, state.current, state.history, state.stages, activeLevel, dispatch]);

  // Esc
  useEffect(() => {
    function onKey(e: KeyboardEvent) {
      if (e.key === 'Escape' && state.phase === 'playing') {
        if (confirm('确认放弃本局？')) {
          stopSpeaking();
          navigate('/');
        }
      }
    }
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [state.phase, navigate]);

  useEffect(() => () => stopSpeaking(), []);

  const onClickBlock = useCallback((blockId: string) => {
    dispatch({ type: 'CLICK_BLOCK', blockId });
  }, [dispatch]);

  // ============ 渲染 ============
  if (!webglOk) {
    return (
      <FallbackCard title="设备不支持 3D">
        当前浏览器/设备未启用 WebGL。请改用"新词"或"复习"模式。
        <button
          onClick={() => navigate('/learn')}
          className="mt-3 inline-flex items-center gap-1.5 rounded-sm border border-ink bg-ink px-4 py-2 text-sm font-medium text-paper"
        >
          去新词模式
        </button>
      </FallbackCard>
    );
  }
  // 未选模式 → 展示 ModePicker
  if (!mode) {
    return <ModePicker level={activeLevel} onPick={setMode} onExit={() => navigate('/')} />;
  }
  // 已选模式但出错 → 显示错误并允许重选
  if (error) {
    return (
      <div className="fixed inset-0 z-50 flex items-center justify-center bg-[#0a0612] p-6">
        <div className="absolute inset-0 play-scanlines" />
        <div className="relative max-w-md rounded-2xl border border-rose-500/40 bg-black/70 p-8 text-center shadow-[0_0_60px_rgba(244,63,94,0.3)] backdrop-blur-xl">
          <AlertCircle size={28} className="mx-auto mb-3 text-rose-400" />
          <div className="mb-2 font-tech text-2xl font-black uppercase tracking-tight text-white">无法开始</div>
          <div className="mb-5 font-tech text-sm text-white/70">{error}</div>
          <div className="flex justify-center gap-3">
            <button
              onClick={() => { setError(''); setMode(null); }}
              className="rounded-md border border-cyan-400 bg-cyan-400/10 px-5 py-2 font-tech text-xs uppercase tracking-[0.2em] text-cyan-200 transition hover:bg-cyan-400/25"
            >
              选择其他模式
            </button>
            <button
              onClick={() => navigate('/')}
              className="rounded-md border border-white/20 bg-white/5 px-5 py-2 font-tech text-xs uppercase tracking-[0.2em] text-white/70 transition hover:border-white/60"
            >
              回首页
            </button>
          </div>
        </div>
      </div>
    );
  }
  if (state.phase === 'loading' || state.stages.length === 0) {
    return (
      <div className="fixed inset-0 z-50 flex flex-col items-center justify-center gap-3 bg-[#0a0612] text-cyan-300">
        <Loader2 size={28} className="animate-spin" />
        <span className="font-tech text-xs uppercase tracking-[0.4em]">booting neon grid…</span>
      </div>
    );
  }

  return (
    <div
      className="fixed inset-0 z-50 overflow-hidden bg-[#0a0612]"
      data-testid="play-root"
    >
      <PlayScene
        stage={state.stages[state.current]}
        onClickBlock={onClickBlock}
        combo={state.combo}
        freezeUntilAt={state.freezeUntilAt}
        stageClearActive={state.phase === 'stage-clear'}
      />
      <StageClearOverlay
        text={state.stages[state.current]?.upperWord.toLowerCase() ?? ''}
        stageIndex={state.current}
        visible={state.phase === 'stage-clear'}
      />
      <HUD
        state={state}
        onExit={() => { stopSpeaking(); dispatch({ type: 'END_SESSION' }); setMode(null); }}
        onReveal={() => dispatch({ type: 'REVEAL_ANSWER' })}
        onSkip={() => dispatch({ type: 'SKIP_STAGE' })}
      />
      <ResultPanel
        state={state}
        onNext={() => dispatch({ type: 'NEXT_STAGE' })}
        onRetry={() => dispatch({ type: 'RETRY_STAGE' })}
        onExit={() => { dispatch({ type: 'END_SESSION' }); setMode(null); }}
        onReplaySame={() => {
          dispatch({ type: 'START_SESSION', stages: state.stages });
        }}
        onReplayNew={async () => {
          const stages = await buildStages(activeLevel, STAGES_PER_SESSION, learnOrder, mode ?? 'review');
          dispatch({ type: 'START_SESSION', stages });
        }}
      />
    </div>
  );
}

function FallbackCard({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <div className="mx-auto mt-12 max-w-md rounded-lg border border-paper3 bg-paper p-6 text-center shadow-paper">
      <AlertCircle size={22} className="mx-auto mb-2 text-persimmon" />
      <div className="mb-2 font-display text-xl font-medium text-ink">{title}</div>
      <div className="text-sm text-ink2">{children}</div>
    </div>
  );
}
