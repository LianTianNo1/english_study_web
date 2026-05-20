// HUD —— 深空告警台终端界面
import { LogOut, Volume2 } from 'lucide-react';
import { speak } from '@/lib/tts';
import { Radar } from './Radar';
import type { MeteorState } from './types';
import { BASE_MAX_HP } from './types';

interface Props {
  state: MeteorState;
  onExit: () => void;
}

export function HUD3({ state, onExit }: Props) {
  const locked = state.meteors.find((m) => m.id === state.lockedId) ?? null;
  const remaining = state.totalWords - state.results.length;
  const lowHp = state.baseHp <= 2;
  const showWave = Date.now() < state.waveBannerUntil;

  return (
    <>
      {/* 扫描线 */}
      <div className="mtr-scanlines pointer-events-none absolute inset-0 z-10" />

      {/* 四角刻度框 */}
      <CornerTicks />

      {/* 低血红色边缘脉冲 */}
      {lowHp && (
        <div
          className="mtr-alarm pointer-events-none absolute inset-0 z-10"
          style={{ boxShadow: 'inset 0 0 140px 30px rgba(255,59,48,0.55)' }}
        />
      )}

      {/* 受击全屏红闪 */}
      {state.hitFlashAt > 0 && (
        <div
          key={state.hitFlashAt}
          className="animate-mtr-hit pointer-events-none absolute inset-0 z-20 bg-[#FF3B30]"
        />
      )}

      {/* ===== 顶栏 ===== */}
      <div className="pointer-events-none absolute inset-x-0 top-0 z-30 flex items-start justify-between p-4">
        {/* 左：abort / SCORE / COMBO */}
        <div className="pointer-events-auto flex items-stretch gap-2">
          <button
            onClick={onExit}
            className="mtr-btn flex items-center gap-1.5 px-3 py-2 text-[10px]"
          >
            <LogOut size={12} /> abort
          </button>
          <Panel label="score">
            <span className="font-term text-xl font-bold tabular-nums text-[#EDE8DF]">
              {state.score.toLocaleString()}
            </span>
          </Panel>
          <Panel label="combo">
            <span
              className="font-term text-xl font-bold tabular-nums"
              style={{ color: state.combo >= 5 ? '#39FF6A' : '#FFB020' }}
            >
              ×{state.combo}
            </span>
          </Panel>
        </div>

        {/* 右：WAVE + 基地完整度 */}
        <div className="pointer-events-auto flex items-stretch gap-2">
          <Panel label={`wave ${String(state.wave).padStart(2, '0')}`}>
            <span className="font-term text-xl font-bold tabular-nums text-[#FFB020]">
              {String(remaining).padStart(2, '0')}
              <span className="ml-1 text-[10px] text-[#EDE8DF]/45">left</span>
            </span>
          </Panel>
          <Panel label="base integrity">
            <div className="flex items-center gap-1 pt-0.5">
              {Array.from({ length: BASE_MAX_HP }).map((_, i) => {
                const alive = i < state.baseHp;
                const c = state.baseHp <= 2 ? '#FF3B30' : '#39FF6A';
                return (
                  <div
                    key={i}
                    className="h-3.5 w-3"
                    style={{
                      background: alive ? c : 'transparent',
                      border: `1px solid ${alive ? c : 'rgba(255,176,32,0.3)'}`,
                      boxShadow: alive ? `0 0 8px ${c}` : 'none',
                    }}
                  />
                );
              })}
            </div>
          </Panel>
        </div>
      </div>

      {/* ===== 顶部中央：锁定单词读数（释义 + 拼写进度） ===== */}
      <div className="pointer-events-none absolute left-1/2 top-[76px] z-30 w-[min(640px,94vw)] -translate-x-1/2">
        {locked ? (
          <div className="mtr-panel mtr-corners pointer-events-auto px-5 py-3 text-center">
            {/* 中文释义 —— 大字醒目 */}
            <div className="flex items-center justify-center gap-2.5">
              <button
                onClick={() => speak(locked.word)}
                className="shrink-0 rounded border border-[#FFB020]/50 p-1.5 text-[#FFB020] transition hover:bg-[#FFB020] hover:text-[#07060A]"
                aria-label="play"
              >
                <Volume2 size={15} />
              </button>
              <span className="font-term text-xl font-bold leading-snug text-[#EDE8DF]">
                {locked.meaning}
              </span>
            </div>
            {/* 拼写进度格 */}
            <div className="mt-2.5 flex flex-wrap items-center justify-center gap-1">
              {locked.word.split('').map((ch, i) => {
                const done = i < locked.typedLen;
                return (
                  <div
                    key={i}
                    data-testid="lockcell"
                    className="font-term flex h-9 w-8 items-center justify-center text-lg font-bold uppercase"
                    style={{
                      color: done ? '#07060A' : '#FFB020',
                      background: done ? '#39FF6A' : 'transparent',
                      border: `1.5px solid ${done ? '#39FF6A' : 'rgba(255,176,32,0.55)'}`,
                      boxShadow: done ? '0 0 12px rgba(57,255,106,0.6)' : 'none',
                    }}
                  >
                    {ch}
                  </div>
                );
              })}
            </div>
          </div>
        ) : (
          <div className="font-term text-center text-xs uppercase tracking-[0.4em] text-[#FFB020]/55">
            ▸ type a letter to lock target ◂
          </div>
        )}
      </div>

      {/* ===== 飞字反馈 ===== */}
      <div className="pointer-events-none absolute left-1/2 top-[34%] z-30 flex -translate-x-1/2 flex-col items-center gap-1.5">
        {state.feedbacks.map((f) => (
          <div
            key={f.id}
            className="animate-mtr-float font-term text-lg font-bold uppercase tracking-widest"
            style={{ color: f.color, textShadow: `0 0 12px ${f.color}` }}
          >
            {f.text}
          </div>
        ))}
      </div>

      {/* ===== WAVE 横幅 ===== */}
      {showWave && (
        <div
          key={state.waveBannerUntil}
          className="animate-mtr-wave pointer-events-none absolute left-1/2 top-1/2 z-30 -translate-x-1/2 -translate-y-1/2"
        >
          <div className="mtr-panel mtr-corners px-10 py-4 text-center">
            <div className="font-term text-5xl font-bold uppercase tracking-[0.2em] text-[#FFB020]">
              wave {String(state.wave).padStart(2, '0')}
            </div>
            <div className="font-term mt-1 text-xs uppercase tracking-[0.4em] text-[#FF3B30]">
              ⚠ threats inbound ⚠
            </div>
          </div>
        </div>
      )}

      {/* ===== 底部：雷达 ===== */}
      <div className="pointer-events-none absolute bottom-0 right-0 z-30 p-4">
        <div className="pointer-events-auto">
          <Radar meteors={state.meteors} lockedId={state.lockedId} />
        </div>
      </div>
    </>
  );
}

function Panel({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div className="mtr-panel mtr-corners px-3 py-1.5">
      <div className="font-term mb-0.5 text-[8px] uppercase tracking-[0.3em] text-[#FFB020]/60">
        {label}
      </div>
      {children}
    </div>
  );
}

function CornerTicks() {
  const base = 'pointer-events-none absolute z-10 h-7 w-7 border-[#FFB020]/45';
  return (
    <>
      <div className={`${base} left-2 top-2 border-l-2 border-t-2`} />
      <div className={`${base} right-2 top-2 border-r-2 border-t-2`} />
      <div className={`${base} bottom-2 left-2 border-b-2 border-l-2`} />
      <div className={`${base} bottom-2 right-2 border-b-2 border-r-2`} />
    </>
  );
}
