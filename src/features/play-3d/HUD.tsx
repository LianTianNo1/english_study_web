// 完整 HUD：顶部栏（exit/stage/lives/timer）+ 释义浮窗 + 已拼进度 + 分数面板 + 飞字反馈
import { useEffect, useState } from 'react';
import { Heart, Volume2, Clock, Eye, SkipForward } from 'lucide-react';
import type { PlayState } from './types';
import { STAGE_TIME_LIMIT_MS } from './types';
import { speak } from '@/lib/tts';
import { cn } from '@/lib/utils';

interface Props {
  state: PlayState;
  onExit: () => void;
  onReveal: () => void;
  onSkip: () => void;
}

export function HUD({ state, onExit, onReveal, onSkip }: Props) {
  const stage = state.stages[state.current];
  const [now, setNow] = useState(Date.now());

  useEffect(() => {
    if (state.phase !== 'playing') return;
    const id = setInterval(() => setNow(Date.now()), 100);
    return () => clearInterval(id);
  }, [state.phase, state.current]);

  if (!stage) return null;

  const translation = stage.word.translations[0];
  const meaning = translation
    ? `${translation.type ? translation.type + '. ' : ''}${translation.translation}`
    : '';
  const frozen = state.freezeUntilAt !== null && state.freezeUntilAt > now;
  // 冻结时显示固定的剩余时间（不再流逝）
  const elapsed = state.phase === 'playing'
    ? frozen
      ? state.freezeUntilAt! - 3000 - state.stageStartedAt
      : now - state.stageStartedAt
    : 0;
  const timerPct = Math.max(0, 1 - elapsed / STAGE_TIME_LIMIT_MS);
  const timeLeft = Math.max(0, Math.ceil((STAGE_TIME_LIMIT_MS - elapsed) / 1000));
  const freezeReady = state.combo >= 10 && !frozen;

  // 已拼进度：reveal 后未拼字母也露出（amber 提示）
  const progress = stage.slots.map((s) => {
    if (s.filledBlockId) return { ch: s.correct ? s.expected.toLowerCase() : '·', kind: s.correct ? 'ok' as const : 'wrong' as const };
    if (state.revealed) return { ch: s.expected.toLowerCase(), kind: 'hint' as const };
    return { ch: '_', kind: 'blank' as const };
  });

  // combo 边框颜色阶梯
  const edgeColor =
    state.combo >= 15 ? '#FFFFFF'
    : state.combo >= 10 ? '#FFD700'
    : state.combo >= 5 ? '#FF6B35'
    : null;

  return (
    <div className="pointer-events-none absolute inset-0 z-10 select-none">
      {/* 全屏扫描线叠加 — 沉浸式 CRT 质感 */}
      <div className="absolute inset-0 play-scanlines" />

      {/* combo ≥5 屏幕边缘霓虹脉冲条 */}
      {edgeColor && (
        <div
          className="pointer-events-none absolute inset-0"
          style={{
            boxShadow: `inset 0 0 0 2px ${edgeColor}, inset 0 0 40px ${edgeColor}90`,
            animation: 'playEdgePulse 1.2s ease-in-out infinite',
          }}
        />
      )}
      {/* ========== TOP BAR ========== */}
      <div className="pointer-events-auto absolute inset-x-0 top-0 flex items-center justify-between px-3 py-3 sm:px-5">
        <button
          onClick={onExit}
          className="rounded-md border border-cyan-400/40 bg-black/40 px-2.5 py-1 font-mono text-[10px] uppercase tracking-[0.2em] text-cyan-300 backdrop-blur transition hover:border-cyan-300 hover:text-white"
        >
          ← exit
        </button>
        <div className="flex flex-col items-center gap-1">
          <div className="relative rounded-md border border-purple-500/40 bg-black/40 px-4 py-1 font-tech text-[11px] uppercase tracking-[0.35em] text-purple-200 backdrop-blur play-corners">
            STAGE {String(state.current + 1).padStart(2, '0')} / {state.stages.length}
          </div>
          <div className="relative h-1 w-32 overflow-hidden rounded-full bg-white/10">
            <div
              className={cn(
                'absolute inset-y-0 left-0 transition-[width] duration-100',
                frozen
                  ? 'bg-sky-300'
                  : timerPct > 0.4 ? 'bg-cyan-400' : timerPct > 0.2 ? 'bg-amber-400' : 'bg-rose-500'
              )}
              style={{
                width: `${timerPct * 100}%`,
                boxShadow: '0 0 8px currentColor',
              }}
            />
            {frozen && (
              <div className="absolute inset-0 animate-pulse bg-sky-200/40" />
            )}
          </div>
        </div>
        <div className="flex items-center gap-1 rounded-md border border-rose-500/40 bg-black/40 px-2.5 py-1 backdrop-blur">
          {Array.from({ length: 3 }).map((_, i) => (
            <Heart
              key={i}
              size={14}
              className={cn(
                'transition-all',
                i < state.lives ? 'fill-rose-500 text-rose-400 drop-shadow-[0_0_6px_rgba(244,63,94,0.7)]' : 'text-white/20'
              )}
            />
          ))}
        </div>
      </div>

      {/* ========== STAGE INFO (释义 + 已拼进度) — 顶部居中放大 ========== */}
      <div className="absolute inset-x-0 top-24 flex flex-col items-center gap-3 px-4">
        <div className="relative max-w-[min(900px,80vw)] rounded-2xl border border-cyan-400/30 bg-black/55 px-7 py-4 backdrop-blur-xl play-corners shadow-[0_0_30px_rgba(0,229,255,0.15)]">
          <div className="font-tech text-[10px] uppercase tracking-[0.45em] text-cyan-300/70 text-center">
            ✦ spell the word ✦
          </div>
          <div className="mt-2 flex items-center justify-center gap-3 flex-wrap">
            <span className="font-display text-2xl font-medium text-white sm:text-3xl">{meaning}</span>
            <button
              onClick={() => speak(stage.word.word)}
              className="pointer-events-auto inline-grid h-9 w-9 place-items-center rounded-full border border-cyan-400/50 bg-black/70 text-cyan-300 transition hover:bg-cyan-400/25 hover:text-white"
              aria-label="play"
            >
              <Volume2 size={14} />
            </button>
            <span className={cn(
              "inline-flex items-center gap-1 font-tech text-xs uppercase tracking-[0.3em]",
              timeLeft > 10 ? "text-white/60" : timeLeft > 5 ? "text-amber-300" : "text-rose-400 animate-pulse"
            )}>
              <Clock size={13} /> {timeLeft}s
            </span>
          </div>
        </div>
        {/* 已拼进度 — 单独大字 */}
        <div className="flex items-center justify-center gap-2 sm:gap-3 px-4">
          {progress.map((p, i) => (
            <span
              key={i}
              className={cn(
                'inline-flex h-10 w-7 sm:h-14 sm:w-10 items-center justify-center rounded-md border font-tech text-2xl sm:text-4xl font-black uppercase tracking-tight',
                p.kind === 'blank' && 'border-white/15 bg-black/30 text-white/20',
                p.kind === 'ok' && 'border-cyan-400/60 bg-cyan-400/10 text-cyan-300 drop-shadow-[0_0_8px_rgba(0,229,255,0.7)]',
                p.kind === 'wrong' && 'border-rose-500/60 bg-rose-500/10 text-rose-400',
                p.kind === 'hint' && 'border-amber-400/60 bg-amber-400/10 text-amber-300/85 drop-shadow-[0_0_6px_rgba(255,191,0,0.6)]'
              )}
            >
              {p.ch === '_' ? '' : p.ch}
            </span>
          ))}
        </div>
      </div>

      {/* ========== LEFT SCORE PANEL — 大字宽屏 ========== */}
      <div className="absolute left-4 top-32 flex flex-col gap-2 sm:left-8 sm:top-36">
        <Stat label="SCORE" value={state.score.toLocaleString()} color="text-cyan-300" />
        <Stat label="COMBO" value={`×${state.combo}`} color={state.combo >= 5 ? 'text-purple-300' : 'text-white'} glow={state.combo >= 5} />
        <Stat label="BEST" value={`×${state.bestCombo}`} color="text-amber-300" />
      </div>

      {/* ========== RIGHT FEEDBACK — 宽屏右侧大字 ========== */}
      <div className="absolute right-4 top-32 flex flex-col items-end gap-2 sm:right-8 sm:top-36">
        {state.feedbacks.map((fb) => (
          <FeedbackChip key={fb.id} feedback={fb} />
        ))}
      </div>

      {/* ========== BOTTOM: 操作按钮 + 快捷键提示 ========== */}
      <div className="absolute inset-x-0 bottom-3 flex flex-col items-center gap-2 sm:bottom-5">
        {/* 操作按钮 */}
        <div className="pointer-events-auto flex gap-2">
          <button
            onClick={onReveal}
            disabled={state.revealed}
            className={cn(
              'inline-flex items-center gap-1.5 rounded-md border px-3 py-1.5 font-tech text-[10px] uppercase tracking-[0.25em] backdrop-blur transition',
              state.revealed
                ? 'border-white/10 bg-black/30 text-white/30 cursor-not-allowed'
                : 'border-amber-400/50 bg-amber-400/10 text-amber-200 hover:bg-amber-400/25 hover:border-amber-300'
            )}
          >
            <Eye size={12} /> 查看 <kbd className="rounded border border-current/40 px-1 text-[8px] opacity-70">?</kbd>
          </button>
          <button
            onClick={onSkip}
            className="inline-flex items-center gap-1.5 rounded-md border border-rose-400/40 bg-rose-400/10 px-3 py-1.5 font-tech text-[10px] uppercase tracking-[0.25em] text-rose-200 backdrop-blur transition hover:bg-rose-400/25 hover:border-rose-300"
          >
            <SkipForward size={12} /> 跳过 <kbd className="rounded border border-current/40 px-1 text-[8px] opacity-70">Tab</kbd>
          </button>
        </div>
        {/* 快捷键提示 */}
        <div className="rounded-md border border-white/10 bg-black/40 px-3 py-1 font-tech text-[9px] uppercase tracking-[0.3em] text-white/45 backdrop-blur">
          a–z 拼词 · ? 查看 · tab 跳过 · space 冻结 · esc 退出
        </div>
        {freezeReady && (
          <div className="rounded-md border border-sky-300/50 bg-sky-300/10 px-3 py-1 font-tech text-[10px] uppercase tracking-[0.3em] text-sky-200 backdrop-blur animate-pulse">
            ❄ space — time freeze ready
          </div>
        )}
        {frozen && (
          <div className="rounded-md border border-sky-200 bg-sky-300/30 px-4 py-1.5 font-tech text-sm font-bold uppercase tracking-[0.3em] text-sky-100 backdrop-blur drop-shadow-[0_0_10px_#7DD3FC]">
            ❄ FROZEN
          </div>
        )}
      </div>
    </div>
  );
}

function Stat({ label, value, color, glow }: { label: string; value: string; color: string; glow?: boolean }) {
  return (
    <div className="relative min-w-[110px] rounded-lg border border-white/10 bg-black/50 px-3.5 py-2 backdrop-blur play-corners">
      <div className="font-tech text-[10px] uppercase tracking-[0.4em] text-white/45">{label}</div>
      <div
        className={cn(
          'font-tech text-2xl sm:text-3xl font-black leading-none mt-1',
          color,
          glow && 'drop-shadow-[0_0_14px_currentColor]'
        )}
      >
        {value}
      </div>
    </div>
  );
}

function FeedbackChip({ feedback: fb }: { feedback: import('./types').FloatingFeedback }) {
  const color =
    fb.kind === 'perfect' ? 'text-amber-300 border-amber-300/40'
    : fb.kind === 'great' ? 'text-cyan-300 border-cyan-400/40'
    : fb.kind === 'good' ? 'text-emerald-300 border-emerald-400/40'
    : 'text-rose-400 border-rose-500/40';
  return (
    <div
      className={cn(
        'relative rounded-md border bg-black/40 px-3 py-1.5 text-right backdrop-blur animate-fade-up play-corners',
        color
      )}
      style={{ animationDuration: '0.25s' }}
    >
      <div className="font-tech text-2xl font-black leading-none drop-shadow-[0_0_8px_currentColor]">
        {fb.text}
      </div>
      {fb.sub && (
        <div className="mt-0.5 font-tech text-[9px] uppercase tracking-[0.35em] opacity-80">{fb.sub}</div>
      )}
    </div>
  );
}
