// 游戏入口：选择词源（复习 / 错题 / 新学）
import { useEffect, useState } from 'react';
import { BookOpen, AlertTriangle, Sparkles } from 'lucide-react';
import type { GameMode } from './stageBuilder';
import { progressRepo } from '@/db/repositories/progress';
import { wordsRepo } from '@/db/repositories/words';
import type { LevelId } from '@/db/types';

interface Props {
  level: LevelId;
  onPick: (mode: GameMode) => void;
  onExit: () => void;
}

interface ModeStats {
  due: number;
  mistakes: number;
  unlearned: number;
}

export function ModePicker({ level, onPick, onExit }: Props) {
  const [stats, setStats] = useState<ModeStats | null>(null);

  useEffect(() => {
    (async () => {
      const [due, wrong, learned, total] = await Promise.all([
        progressRepo.dueForReview(Date.now(), 999),
        progressRepo.wrongWords(999),
        progressRepo.learnedWordIds(level),
        wordsRepo.countByLevel(level),
      ]);
      setStats({
        due: due.length,
        mistakes: wrong.length,
        unlearned: Math.max(0, total - learned.size),
      });
    })();
  }, [level]);

  return (
    <div className="fixed inset-0 z-50 flex flex-col items-center justify-center bg-[#0a0612] p-6 overflow-hidden">
      {/* 背景装饰：远处霓虹网格 */}
      <div
        className="pointer-events-none absolute inset-0 opacity-40"
        style={{
          backgroundImage:
            'linear-gradient(rgba(168,85,247,0.25) 1px, transparent 1px), linear-gradient(90deg, rgba(168,85,247,0.25) 1px, transparent 1px)',
          backgroundSize: '48px 48px',
          maskImage: 'radial-gradient(ellipse at center, black 30%, transparent 70%)',
          WebkitMaskImage: 'radial-gradient(ellipse at center, black 30%, transparent 70%)',
        }}
      />
      <div className="absolute inset-0 play-scanlines" />

      {/* 顶部 exit */}
      <button
        onClick={onExit}
        className="absolute left-5 top-5 rounded-md border border-cyan-400/40 bg-black/40 px-2.5 py-1 font-tech text-[10px] uppercase tracking-[0.3em] text-cyan-300 backdrop-blur transition hover:border-cyan-300 hover:text-white"
      >
        ← exit
      </button>

      {/* 标题 */}
      <div className="relative z-10 mb-12 flex flex-col items-center text-center">
        <div className="mb-2 font-tech text-[10px] uppercase tracking-[0.5em] text-cyan-300/70">
          ✦ word arena ✦
        </div>
        <h1 className="font-tech text-5xl font-black uppercase tracking-tight text-white drop-shadow-[0_0_20px_rgba(0,229,255,0.5)] sm:text-7xl">
          <span className="bg-gradient-to-b from-cyan-200 via-purple-300 to-amber-300 bg-clip-text text-transparent">
            choose
          </span>{' '}
          <span className="text-white">your</span>{' '}
          <span className="bg-gradient-to-b from-amber-200 to-rose-400 bg-clip-text text-transparent">
            mode
          </span>
        </h1>
        <p className="mt-3 font-tech text-xs uppercase tracking-[0.3em] text-white/40">
          10 stages · 30s each · 3 lives per stage
        </p>
      </div>

      {/* 三模式卡片 */}
      <div className="relative z-10 grid w-full max-w-5xl gap-5 sm:grid-cols-3">
        <ModeCard
          accent="cyan"
          icon={<BookOpen size={28} />}
          title="复习"
          subtitle="REVIEW"
          desc="SRS 到期 + 智能补足"
          count={stats?.due ?? 0}
          countLabel="due"
          onClick={() => onPick('review')}
          recommended
        />
        <ModeCard
          accent="rose"
          icon={<AlertTriangle size={28} />}
          title="错题"
          subtitle="MISTAKES"
          desc="只挑错过的词练 — 满血复活"
          count={stats?.mistakes ?? 0}
          countLabel="wrong"
          onClick={() => onPick('mistakes')}
          disabled={stats !== null && stats.mistakes === 0}
        />
        <ModeCard
          accent="amber"
          icon={<Sparkles size={28} />}
          title="新学"
          subtitle="DISCOVER"
          desc="从未学过的新单词"
          count={stats?.unlearned ?? 0}
          countLabel="new"
          onClick={() => onPick('new')}
        />
      </div>

      {/* 底部 tip */}
      <div className="relative z-10 mt-12 font-tech text-[10px] uppercase tracking-[0.3em] text-white/30">
        tip · 用 a–z 键直接拼词，? 查看 · tab 跳过 · space 冻结
      </div>
    </div>
  );
}

interface CardProps {
  accent: 'cyan' | 'rose' | 'amber';
  icon: React.ReactNode;
  title: string;
  subtitle: string;
  desc: string;
  count: number;
  countLabel: string;
  recommended?: boolean;
  disabled?: boolean;
  onClick: () => void;
}

const ACCENT: Record<string, { border: string; glow: string; text: string; gradient: string }> = {
  cyan: {
    border: 'border-cyan-400/40 hover:border-cyan-300',
    glow: 'hover:shadow-[0_0_50px_rgba(0,229,255,0.35)]',
    text: 'text-cyan-300',
    gradient: 'from-cyan-400 via-cyan-300 to-sky-200',
  },
  rose: {
    border: 'border-rose-500/40 hover:border-rose-400',
    glow: 'hover:shadow-[0_0_50px_rgba(244,63,94,0.35)]',
    text: 'text-rose-300',
    gradient: 'from-rose-400 via-rose-300 to-amber-200',
  },
  amber: {
    border: 'border-amber-400/40 hover:border-amber-300',
    glow: 'hover:shadow-[0_0_50px_rgba(251,191,36,0.35)]',
    text: 'text-amber-300',
    gradient: 'from-amber-300 via-amber-200 to-yellow-100',
  },
};

function ModeCard({
  accent, icon, title, subtitle, desc, count, countLabel, recommended, disabled, onClick,
}: CardProps) {
  const c = ACCENT[accent];
  return (
    <button
      onClick={onClick}
      disabled={disabled}
      className={`group relative flex flex-col items-start gap-4 overflow-hidden rounded-2xl border bg-black/60 px-7 py-7 text-left backdrop-blur-xl transition-all duration-300 play-corners ${c.border} ${c.glow} ${disabled ? 'opacity-40 cursor-not-allowed' : 'hover:-translate-y-1 cursor-pointer'}`}
    >
      {/* recommended pin */}
      {recommended && (
        <div className="absolute right-3 top-3 rounded-full border border-cyan-300/60 bg-cyan-300/10 px-2 py-0.5 font-tech text-[8px] uppercase tracking-[0.3em] text-cyan-200">
          recommended
        </div>
      )}
      {/* hover sweep */}
      <div
        className="pointer-events-none absolute inset-0 -translate-x-full bg-gradient-to-r from-transparent via-white/5 to-transparent transition-transform duration-700 group-hover:translate-x-full"
      />
      <div className={c.text}>{icon}</div>
      <div className="space-y-1">
        <div className={`font-tech text-[10px] uppercase tracking-[0.4em] ${c.text}`}>{subtitle}</div>
        <div className="font-tech text-3xl font-black uppercase tracking-tight text-white">
          <span className={`bg-gradient-to-b ${c.gradient} bg-clip-text text-transparent`}>
            {title}
          </span>
        </div>
        <div className="font-tech text-xs text-white/55">{desc}</div>
      </div>
      <div className="mt-auto flex items-baseline gap-2">
        <span className={`font-tech text-4xl font-black ${c.text} drop-shadow-[0_0_10px_currentColor]`}>
          {count}
        </span>
        <span className="font-tech text-[10px] uppercase tracking-[0.3em] text-white/40">
          {countLabel}
        </span>
      </div>
    </button>
  );
}
