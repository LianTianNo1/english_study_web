// 任务选择入口 —— 终端风 MISSION SELECT
import { useEffect, useState } from 'react';
import type { GameMode } from '@/features/play-3d/stageBuilder';
import { progressRepo } from '@/db/repositories/progress';
import { wordsRepo } from '@/db/repositories/words';
import type { LevelId } from '@/db/types';

interface Props {
  level: LevelId;
  onPick: (mode: GameMode) => void;
  onExit: () => void;
}

interface Stats {
  due: number;
  mistakes: number;
  unlearned: number;
}

export function MeteorModePicker({ level, onPick, onExit }: Props) {
  const [stats, setStats] = useState<Stats | null>(null);

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
    <div className="mtr-bg fixed inset-0 z-50 flex flex-col items-center justify-center overflow-hidden p-6">
      <div className="mtr-scanlines pointer-events-none absolute inset-0" />

      {/* abort */}
      <button
        onClick={onExit}
        className="mtr-btn absolute left-6 top-6 px-4 py-2 text-[10px]"
      >
        ◂ abort
      </button>

      {/* 标题 */}
      <div className="relative z-10 mb-2 flex flex-col items-center text-center">
        <div className="mtr-hazard mb-4 h-2 w-64" />
        <div className="font-term text-[11px] uppercase tracking-[0.5em] text-[#FF3B30]">
          ⚠ orbital defense command ⚠
        </div>
        <h1 className="font-term mt-2 text-5xl font-bold uppercase tracking-[0.12em] text-[#FFB020] sm:text-6xl"
          style={{ textShadow: '0 0 28px rgba(255,176,32,0.55)' }}
        >
          word meteor
        </h1>
        <div className="font-term mt-2 text-xs uppercase tracking-[0.35em] text-[#EDE8DF]/45">
          type to destroy · defend the base
        </div>
        <div className="mtr-hazard mt-4 h-2 w-64" />
      </div>

      {/* 任务卡 */}
      <div className="relative z-10 mt-8 grid w-full max-w-5xl gap-5 sm:grid-cols-3">
        <MissionCard
          idx="01"
          tone="amber"
          code="review"
          title="复习巡防"
          desc="SRS 到期单词 · 优先拦截"
          count={stats?.due ?? 0}
          unit="due"
          delay={0}
          recommended
          onClick={() => onPick('review')}
        />
        <MissionCard
          idx="02"
          tone="alarm"
          code="mistakes"
          title="错题清剿"
          desc="曾被击穿的单词 · 重点歼灭"
          count={stats?.mistakes ?? 0}
          unit="wrong"
          delay={90}
          disabled={stats != null && stats.mistakes === 0}
          onClick={() => onPick('mistakes')}
        />
        <MissionCard
          idx="03"
          tone="green"
          code="recon"
          title="新词侦察"
          desc="未接触的新单词 · 探索推进"
          count={stats?.unlearned ?? 0}
          unit="new"
          delay={180}
          onClick={() => onPick('new')}
        />
      </div>

      {/* 底部提示 */}
      <div className="font-term relative z-10 mt-10 flex items-center gap-5 text-[10px] uppercase tracking-[0.3em] text-[#EDE8DF]/35">
        <span>[A-Z] 锁定 + 摧毁</span>
        <span className="text-[#FFB020]/40">//</span>
        <span>陨石撞基地 = 扣血</span>
        <span className="text-[#FFB020]/40">//</span>
        <span>[ESC] 撤离</span>
      </div>
    </div>
  );
}

interface CardProps {
  idx: string;
  tone: 'amber' | 'alarm' | 'green';
  code: string;
  title: string;
  desc: string;
  count: number;
  unit: string;
  delay: number;
  recommended?: boolean;
  disabled?: boolean;
  onClick: () => void;
}

const TONE: Record<string, { c: string; rgba: string }> = {
  amber: { c: '#FFB020', rgba: 'rgba(255,176,32,' },
  alarm: { c: '#FF3B30', rgba: 'rgba(255,59,48,' },
  green: { c: '#39FF6A', rgba: 'rgba(57,255,106,' },
};

function MissionCard({
  idx, tone, code, title, desc, count, unit, delay, recommended, disabled, onClick,
}: CardProps) {
  const t = TONE[tone];
  return (
    <button
      onClick={onClick}
      disabled={disabled}
      className="mtr-panel mtr-corners animate-mtr-card group relative flex flex-col items-start gap-4 p-6 text-left transition-all duration-200"
      style={{
        animationDelay: `${delay}ms`,
        borderColor: disabled ? 'rgba(255,176,32,0.15)' : `${t.rgba}0.5)`,
        opacity: disabled ? 0.35 : 1,
        cursor: disabled ? 'not-allowed' : 'pointer',
      }}
      onMouseEnter={(e) => {
        if (disabled) return;
        e.currentTarget.style.boxShadow = `0 0 32px ${t.rgba}0.3), inset 0 0 30px ${t.rgba}0.08)`;
        e.currentTarget.style.transform = 'translateY(-4px)';
      }}
      onMouseLeave={(e) => {
        e.currentTarget.style.boxShadow = '';
        e.currentTarget.style.transform = '';
      }}
    >
      {recommended && (
        <div
          className="font-term absolute right-3 top-3 px-2 py-0.5 text-[8px] uppercase tracking-[0.2em]"
          style={{ color: '#07060A', background: t.c }}
        >
          advised
        </div>
      )}
      <div className="font-term flex items-baseline gap-2">
        <span className="text-3xl font-bold" style={{ color: t.c }}>{idx}</span>
        <span className="text-[10px] uppercase tracking-[0.3em] text-[#EDE8DF]/40">/ mission</span>
      </div>
      <div>
        <div className="font-term text-xl font-bold uppercase tracking-[0.15em]" style={{ color: t.c }}>
          {code}
        </div>
        <div className="font-term mt-1 text-base text-[#EDE8DF]">{title}</div>
        <div className="font-term mt-0.5 text-[11px] text-[#EDE8DF]/45">{desc}</div>
      </div>
      <div className="mt-auto flex items-baseline gap-2 pt-2">
        <span className="font-term text-4xl font-bold tabular-nums" style={{ color: t.c }}>
          {count}
        </span>
        <span className="font-term text-[10px] uppercase tracking-[0.3em] text-[#EDE8DF]/40">
          {unit}
        </span>
      </div>
    </button>
  );
}
