// /play2 路由 —— 单词陨石防御战
import { useCallback, useEffect, useRef, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { AlertCircle, Loader2 } from 'lucide-react';
import { useSettings } from '@/stores/settingsStore';
import { MeteorScene } from '@/features/play-meteor/MeteorScene';
import { HUD3 } from '@/features/play-meteor/HUD3';
import { ResultPanel3 } from '@/features/play-meteor/ResultPanel3';
import { MeteorModePicker } from '@/features/play-meteor/MeteorModePicker';
import { useMeteorSession } from '@/features/play-meteor/useMeteorSession';
import { fetchMeteorWords } from '@/features/play-meteor/wordSource';
import { meteorWorldPos } from '@/features/play-meteor/meteorEngine';
import { BASE_POS, SESSION_WORD_COUNT, type WordInfo } from '@/features/play-meteor/types';
import { fireLaser } from '@/features/play-meteor/Laser';
import { spawnBurst } from '@/features/play-3d/Particles';
import { getShakeApi } from '@/features/play-3d/useShake';
import { sfxTick, sfxStageClear, sfxThud, sfxCombo } from '@/lib/sfx';
import { speak, stopSpeaking } from '@/lib/tts';
import { commitMeteorWord } from '@/lib/play-meteor-srs';
import type { GameMode } from '@/features/play-3d/stageBuilder';

function hasWebGL(): boolean {
  try {
    const c = document.createElement('canvas');
    return !!(c.getContext('webgl2') || c.getContext('webgl'));
  } catch {
    return false;
  }
}

export function Play2() {
  const navigate = useNavigate();
  const { activeLevel, loaded, learnOrder } = useSettings();
  const loadSettings = useSettings((s) => s.load);
  const [state, dispatch] = useMeteorSession();
  const [mode, setMode] = useState<GameMode | null>(null);
  const [error, setError] = useState('');
  const [webglOk] = useState(hasWebGL);
  const wordsRef = useRef<WordInfo[]>([]);

  // /play2 顶层路由不经 AppLayout，直接深链接需自己确保 settings 加载
  useEffect(() => {
    if (!loaded) loadSettings();
  }, [loaded, loadSettings]);

  // 取词 → 启动
  useEffect(() => {
    if (!loaded || !mode || !webglOk) return;
    let cancelled = false;
    (async () => {
      try {
        const words = await fetchMeteorWords(activeLevel, SESSION_WORD_COUNT, learnOrder, mode);
        if (cancelled) return;
        if (words.length === 0) {
          setError(
            mode === 'mistakes'
              ? '错题本是空的 — 先去做错些题再来。'
              : mode === 'new'
                ? '本词库已学完，没有可用的新词了。'
                : '没有可复习的单词。'
          );
          return;
        }
        wordsRef.current = words;
        dispatch({ type: 'START', words, now: Date.now() });
      } catch (e: any) {
        setError(e?.message ?? '加载失败');
      }
    })();
    return () => { cancelled = true; };
  }, [loaded, mode, webglOk, activeLevel, learnOrder, dispatch]);

  // TICK 循环（30fps 逻辑）
  useEffect(() => {
    if (state.phase !== 'playing') return;
    const t = setInterval(() => dispatch({ type: 'TICK', now: Date.now() }), 33);
    return () => clearInterval(t);
  }, [state.phase, dispatch]);

  // 键盘
  useEffect(() => {
    function onKey(e: KeyboardEvent) {
      const tag = (e.target as HTMLElement | null)?.tagName;
      if (tag === 'INPUT' || tag === 'TEXTAREA') return;
      const k = e.key.toLowerCase();

      if (e.key === 'Escape') {
        if (state.phase === 'playing') {
          if (confirm('确认撤离本次防御战？')) {
            stopSpeaking();
            dispatch({ type: 'END' });
            setMode(null);
          }
        }
        return;
      }

      if (state.phase === 'win' || state.phase === 'lose') {
        if (k === 'r') {
          dispatch({ type: 'START', words: wordsRef.current, now: Date.now() });
        } else if (k === 'n') {
          (async () => {
            const words = await fetchMeteorWords(activeLevel, SESSION_WORD_COUNT, learnOrder, mode ?? 'review');
            if (words.length > 0) {
              wordsRef.current = words;
              dispatch({ type: 'START', words, now: Date.now() });
            }
          })();
        }
        return;
      }

      if (state.phase !== 'playing') return;
      if (/^[a-z]$/.test(k)) {
        dispatch({ type: 'TYPE', letter: k, now: Date.now() });
      }
    }
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [state.phase, activeLevel, learnOrder, mode, dispatch]);

  // 锁定 → 朗读单词
  const prevLocked = useRef<string | null>(null);
  useEffect(() => {
    if (state.lockedId && state.lockedId !== prevLocked.current) {
      const m = state.meteors.find((x) => x.id === state.lockedId);
      if (m) speak(m.word);
    }
    prevLocked.current = state.lockedId;
  }, [state.lockedId, state.meteors]);

  // 激光 + 按键音
  const prevLaser = useRef(0);
  useEffect(() => {
    if (state.laserSeq > prevLaser.current && state.laserTargetId) {
      const m = state.meteors.find((x) => x.id === state.laserTargetId);
      if (m) {
        const [mx, my, mz] = meteorWorldPos(m);
        fireLaser([BASE_POS[0], BASE_POS[1] + 1.3, BASE_POS[2]], [mx, my, mz]);
        sfxTick();
      }
    }
    prevLaser.current = state.laserSeq;
  }, [state.laserSeq, state.laserTargetId, state.meteors]);

  // 结果（击毁 / 漏失）→ 爆炸 / 屏震 / SRS 回写
  const prevResults = useRef(0);
  useEffect(() => {
    if (state.results.length <= prevResults.current) {
      prevResults.current = state.results.length;
      return;
    }
    for (let i = prevResults.current; i < state.results.length; i++) {
      const r = state.results[i];
      const m = state.meteors.find((x) => x.wordId === r.wordId && x.status !== 'incoming');
      const pos: [number, number, number] = m ? meteorWorldPos(m) : [BASE_POS[0], BASE_POS[1] + 1, BASE_POS[2]];
      if (r.destroyed) {
        spawnBurst({ position: pos, color: '#39FF6A', count: 26, spread: 1.0, lifeMs: 900 });
        spawnBurst({ position: pos, color: '#FFB020', count: 20, spread: 1.3, lifeMs: 1100 });
        spawnBurst({ position: pos, color: '#FFFFFF', count: 14, spread: 0.7, lifeMs: 700 });
        sfxCombo(state.combo);
        getShakeApi()?.shake(0.09, 170);
      } else {
        spawnBurst({ position: pos, color: '#FF3B30', count: 30, spread: 1.6, lifeMs: 1000 });
        sfxThud();
        getShakeApi()?.shake(0.26, 340);
      }
      commitMeteorWord(r, activeLevel).catch((e) => console.warn('[meteor] srs', e));
    }
    prevResults.current = state.results.length;
  }, [state.results, state.meteors, state.combo, activeLevel]);

  // 胜负音效
  useEffect(() => {
    if (state.phase === 'win') sfxStageClear();
    if (state.phase === 'lose') sfxThud();
  }, [state.phase]);

  useEffect(() => () => stopSpeaking(), []);

  const onTapMeteor = useCallback((id: string) => {
    dispatch({ type: 'TAP', meteorId: id, now: Date.now() });
  }, [dispatch]);

  const onExitToPicker = useCallback(() => {
    stopSpeaking();
    dispatch({ type: 'END' });
    setMode(null);
    setError('');
  }, [dispatch]);

  // ============ 渲染 ============
  if (!webglOk) {
    return (
      <Fallback title="设备不支持 3D">
        当前浏览器/设备未启用 WebGL。请改用「新词」或「复习」模式。
        <button
          onClick={() => navigate('/learn')}
          className="mtr-btn mt-4 px-5 py-2 text-[11px]"
        >
          去新词模式
        </button>
      </Fallback>
    );
  }
  if (!mode) {
    return <MeteorModePicker level={activeLevel} onPick={setMode} onExit={() => navigate('/')} />;
  }
  if (error) {
    return (
      <Fallback title="无法部署防御">
        {error}
        <div className="mt-4 flex justify-center gap-3">
          <button onClick={() => { setError(''); setMode(null); }} className="mtr-btn px-5 py-2 text-[11px]">
            选其他任务
          </button>
          <button onClick={() => navigate('/')} className="mtr-btn px-5 py-2 text-[11px]">
            回首页
          </button>
        </div>
      </Fallback>
    );
  }
  if (state.phase === 'loading') {
    return (
      <div className="mtr-bg fixed inset-0 z-50 flex flex-col items-center justify-center gap-3">
        <Loader2 size={28} className="animate-spin text-[#FFB020]" />
        <span className="font-term text-xs uppercase tracking-[0.4em] text-[#FFB020]/70">
          deploying defense grid…
        </span>
      </div>
    );
  }

  return (
    <div className="mtr-bg fixed inset-0 z-50 overflow-hidden" data-testid="play2-root">
      <MeteorScene
        meteors={state.meteors}
        lockedId={state.lockedId}
        baseHp={state.baseHp}
        combo={state.combo}
        onTapMeteor={onTapMeteor}
      />
      <HUD3 state={state} onExit={onExitToPicker} />
      <ResultPanel3
        state={state}
        onReplaySame={() => dispatch({ type: 'START', words: wordsRef.current, now: Date.now() })}
        onReplayNew={async () => {
          const words = await fetchMeteorWords(activeLevel, SESSION_WORD_COUNT, learnOrder, mode);
          if (words.length > 0) {
            wordsRef.current = words;
            dispatch({ type: 'START', words, now: Date.now() });
          }
        }}
        onExit={onExitToPicker}
      />
    </div>
  );
}

function Fallback({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <div className="mtr-bg fixed inset-0 z-50 flex items-center justify-center p-6">
      <div className="mtr-scanlines absolute inset-0" />
      <div className="mtr-panel mtr-corners relative max-w-md p-8 text-center">
        <AlertCircle size={28} className="mx-auto mb-3 text-[#FF3B30]" />
        <div className="font-term mb-2 text-xl font-bold uppercase tracking-[0.1em] text-[#FFB020]">
          {title}
        </div>
        <div className="font-term text-sm text-[#EDE8DF]/70">{children}</div>
      </div>
    </div>
  );
}
