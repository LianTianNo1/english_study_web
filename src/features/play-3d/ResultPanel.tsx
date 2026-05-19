// 关卡 / 会话结算 — 黑底霓虹 + SS 评级
import { Trophy, RotateCcw, ArrowRight, Home, Sparkles } from 'lucide-react';
import type { PlayState } from './types';
import { gradeFor } from './scoring';
import { cn } from '@/lib/utils';

interface Props {
  state: PlayState;
  onNext: () => void;
  onRetry: () => void;
  onExit: () => void;
  onReplayNew: () => void;       // 新单词
  onReplaySame: () => void;      // 重玩本组
}

const GRADE_COLOR: Record<string, string> = {
  S: 'text-amber-300 border-amber-300/60',
  A: 'text-cyan-300 border-cyan-300/60',
  B: 'text-purple-300 border-purple-400/60',
  C: 'text-emerald-300 border-emerald-400/60',
  D: 'text-rose-400 border-rose-500/60',
};

export function ResultPanel({ state, onNext, onRetry, onExit, onReplayNew, onReplaySame }: Props) {
  const stage = state.stages[state.current];

  if (state.phase === 'stage-clear' && stage) {
    // 让 3D WordReveal 先抢眼 1.4s，再淡入文本小卡
    return (
      <div
        className="pointer-events-none absolute inset-x-0 bottom-10 z-20 flex justify-center px-4 opacity-0"
        style={{
          animation: 'fadeUp 0.4s ease-out 1.2s forwards',
        }}
      >
        <style>{`@keyframes fadeUp { from { opacity: 0; transform: translateY(8px); } to { opacity: 1; transform: translateY(0); } }`}</style>
        <div className="pointer-events-auto flex items-center gap-3 rounded-full border border-cyan-400/40 bg-black/80 px-5 py-2 backdrop-blur-xl shadow-[0_0_24px_rgba(0,229,255,0.3)]">
          <Sparkles size={16} className="text-cyan-300 drop-shadow-[0_0_8px_rgba(0,229,255,0.8)]" />
          <span className="font-tech text-sm font-black uppercase tracking-[0.25em] text-cyan-200">
            combo ×{state.combo}
          </span>
          <span className="font-tech text-xs text-white/60">
            {((state.history.at(-1)?.durationMs ?? 0) / 1000).toFixed(1)}s
          </span>
        </div>
      </div>
    );
  }

  if (state.phase === 'stage-fail' && stage) {
    const isLastStage = state.current >= state.stages.length - 1;
    return (
      <Centered>
        <div className="flex flex-col items-center gap-3 rounded-2xl border border-rose-500/50 bg-black/80 px-8 py-6 shadow-[0_0_40px_rgba(244,63,94,0.25)] backdrop-blur-xl">
          <div className="font-mono text-[10px] uppercase tracking-[0.3em] text-rose-400">stage failed</div>
          <div className="font-display text-xl text-white">
            正确答案：<span className="font-bold text-amber-300 drop-shadow-[0_0_6px_currentColor]">{stage.upperWord.toLowerCase()}</span>
          </div>
          <div className="mt-2 flex gap-2">
            <button
              onClick={onRetry}
              className="inline-flex items-center gap-1.5 rounded-md border border-white/20 bg-white/5 px-5 py-2 text-sm font-medium text-white transition hover:bg-white/15"
            >
              <RotateCcw size={14} /> retry
              <kbd className="ml-1 rounded border border-white/30 px-1 font-tech text-[9px] opacity-70">R</kbd>
            </button>
            <button
              onClick={onNext}
              className="inline-flex items-center gap-1.5 rounded-md border border-cyan-400 bg-cyan-400/10 px-5 py-2 text-sm font-medium text-cyan-200 transition hover:bg-cyan-400/25"
            >
              {isLastStage ? '结束本局' : '下一关'} <ArrowRight size={14} />
              <kbd className="ml-1 rounded border border-cyan-300/40 px-1 font-tech text-[9px] opacity-70">N</kbd>
            </button>
          </div>
        </div>
      </Centered>
    );
  }

  if (state.phase === 'session-end') {
    const total = state.history.length;
    const passed = state.history.filter((r) => r.passed).length;
    const errors = state.history.reduce((s, r) => s + r.errors, 0);
    const ms = state.history.reduce((s, r) => s + r.durationMs, 0);
    const avgMs = total > 0 ? ms / total : 0;
    const grade = gradeFor({
      totalStages: state.stages.length,
      passedStages: passed,
      errors,
      avgStageMs: avgMs,
    });
    return (
      <Centered>
        <div className="flex w-full max-w-sm flex-col items-center gap-4 rounded-2xl border border-purple-500/40 bg-black/85 p-7 shadow-[0_0_50px_rgba(168,85,247,0.3)] backdrop-blur-xl">
          <div className="font-mono text-[10px] uppercase tracking-[0.3em] text-purple-300">session complete</div>
          {/* SS 评级 */}
          <div
            className={cn(
              'flex h-24 w-24 items-center justify-center rounded-full border-4 font-display text-6xl font-black drop-shadow-[0_0_18px_currentColor]',
              GRADE_COLOR[grade]
            )}
          >
            {grade}
          </div>
          <div className="font-display text-3xl font-bold text-white drop-shadow-[0_0_8px_rgba(255,255,255,0.5)]">
            {state.score.toLocaleString()}
          </div>
          <dl className="grid w-full grid-cols-4 gap-2 font-mono text-[10px] text-white/80">
            <Stat label="cleared" value={`${passed}/${total}`} />
            <Stat label="combo" value={`×${state.bestCombo}`} />
            <Stat label="errors" value={String(errors)} />
            <Stat label="time" value={`${(ms / 1000) | 0}s`} />
          </dl>
          <div className="mt-1 flex w-full flex-col gap-2">
            <div className="flex w-full gap-2">
              <button
                onClick={onReplaySame}
                className="flex-1 inline-flex items-center justify-center gap-1.5 rounded-md border border-purple-400 bg-purple-400/15 px-4 py-2 text-sm font-medium text-purple-200 transition hover:bg-purple-400/30"
              >
                <RotateCcw size={14} /> 重玩本组
                <kbd className="ml-0.5 rounded border border-purple-300/40 px-1 font-tech text-[9px] opacity-70">R</kbd>
              </button>
              <button
                onClick={onReplayNew}
                className="flex-1 inline-flex items-center justify-center gap-1.5 rounded-md border border-cyan-400 bg-cyan-400/15 px-4 py-2 text-sm font-medium text-cyan-200 transition hover:bg-cyan-400/30"
              >
                <Trophy size={14} /> 新单词
                <kbd className="ml-0.5 rounded border border-cyan-300/40 px-1 font-tech text-[9px] opacity-70">N</kbd>
              </button>
            </div>
            <button
              onClick={onExit}
              className="inline-flex items-center justify-center gap-1.5 rounded-md border border-white/20 px-4 py-2 text-xs text-white/70 transition hover:border-white/60 hover:text-white"
            >
              <Home size={12} /> 换模式
            </button>
          </div>
        </div>
      </Centered>
    );
  }

  return null;
}

function Centered({ children }: { children: React.ReactNode }) {
  return (
    <div className="pointer-events-auto absolute inset-0 z-20 flex items-center justify-center bg-black/60 p-4 backdrop-blur-sm animate-fade-up">
      {children}
    </div>
  );
}

function Stat({ label, value }: { label: string; value: string }) {
  return (
    <div className="flex flex-col items-center rounded-md border border-white/10 bg-white/5 px-2 py-2">
      <div className="text-[8px] uppercase tracking-[0.2em] text-white/40">{label}</div>
      <div className="font-display text-base font-medium text-white">{value}</div>
    </div>
  );
}
