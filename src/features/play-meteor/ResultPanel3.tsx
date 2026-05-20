// 结算面板 —— 胜利 / 失败
import { RotateCcw, Sparkles, LogOut } from 'lucide-react';
import { gradeFor, type Grade } from './meteorEngine';
import type { MeteorState } from './types';

interface Props {
  state: MeteorState;
  onReplaySame: () => void;
  onReplayNew: () => void;
  onExit: () => void;
}

const GRADE_COLOR: Record<Grade, string> = {
  S: '#39FF6A',
  A: '#FFB020',
  B: '#FFB020',
  C: '#FF8800',
  D: '#FF3B30',
};

export function ResultPanel3({ state, onReplaySame, onReplayNew, onExit }: Props) {
  if (state.phase !== 'win' && state.phase !== 'lose') return null;

  const win = state.phase === 'win';
  const totalErrors = state.results.reduce((s, r) => s + r.errors, 0);
  const grade = gradeFor({
    total: state.totalWords,
    destroyed: state.destroyedCount,
    totalErrors,
    baseHp: state.baseHp,
  });

  return (
    <div className="absolute inset-0 z-40 flex items-center justify-center bg-[rgba(7,6,10,0.82)] p-4 backdrop-blur-sm">
      <div className="mtr-panel mtr-corners w-[min(540px,94vw)] p-8 text-center">
        {/* 顶部斜纹 */}
        <div className="mtr-hazard mx-auto mb-5 h-2 w-44" />

        <div
          className="font-term text-sm uppercase tracking-[0.5em]"
          style={{ color: win ? '#39FF6A' : '#FF3B30' }}
        >
          {win ? '✦ sector cleared ✦' : '✗ base destroyed ✗'}
        </div>

        {/* 评级 */}
        <div
          className="font-term my-3 text-[7rem] font-bold leading-none"
          style={{ color: GRADE_COLOR[grade], textShadow: `0 0 40px ${GRADE_COLOR[grade]}` }}
        >
          {grade}
        </div>

        {/* 数据栅格 */}
        <div className="grid grid-cols-2 gap-px overflow-hidden border border-[#FFB020]/25 bg-[#FFB020]/10">
          <Stat label="destroyed" value={`${state.destroyedCount} / ${state.totalWords}`} />
          <Stat label="score" value={state.score.toLocaleString()} />
          <Stat label="best combo" value={`×${state.bestCombo}`} />
          <Stat label="base integrity" value={`${state.baseHp} / 5`} />
        </div>

        <div className="font-term mt-5 text-xs text-[#EDE8DF]/55">
          {grade === 'S' && '完美防御 —— 一颗陨石都没漏，零失误。'}
          {grade === 'A' && '出色的拦截手，基地几乎毫发无伤。'}
          {grade === 'B' && '防线稳住了，再快一点会更好。'}
          {grade === 'C' && '险胜 —— 多练手速，下次更稳。'}
          {grade === 'D' && (win ? '勉强守住，但漏太多了。' : '基地失守 —— 漏掉的词会进错题本。')}
        </div>

        {/* 操作 */}
        <div className="mt-6 flex flex-wrap justify-center gap-2.5">
          <button onClick={onReplaySame} className="mtr-btn flex items-center gap-1.5 px-5 py-2.5 text-[11px]">
            <RotateCcw size={13} /> retry [r]
          </button>
          <button onClick={onReplayNew} className="mtr-btn-go mtr-btn flex items-center gap-1.5 px-5 py-2.5 text-[11px]">
            <Sparkles size={13} /> new wave [n]
          </button>
          <button onClick={onExit} className="mtr-btn flex items-center gap-1.5 px-5 py-2.5 text-[11px]">
            <LogOut size={13} /> exit
          </button>
        </div>
      </div>
    </div>
  );
}

function Stat({ label, value }: { label: string; value: string }) {
  return (
    <div className="bg-[#0E0A12] px-4 py-3">
      <div className="font-term text-[9px] uppercase tracking-[0.3em] text-[#FFB020]/55">{label}</div>
      <div className="font-term mt-0.5 text-xl font-bold tabular-nums text-[#EDE8DF]">{value}</div>
    </div>
  );
}
