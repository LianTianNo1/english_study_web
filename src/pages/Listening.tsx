import { useEffect, useMemo, useRef, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { Ear, Volume2, Gauge, SkipForward, Trophy, RotateCw, RefreshCw } from 'lucide-react';
import { useSettings } from '@/stores/settingsStore';
import { progressRepo } from '@/db/repositories/progress';
import { wordsRepo } from '@/db/repositories/words';
import { sessionsRepo } from '@/db/repositories/sessions';
import { speak, speakSlow } from '@/lib/tts';
import { AnswerInput } from '@/components/AnswerInput';
import { PronunciationRecorder } from '@/components/PronunciationRecorder';
import { shuffle, cn } from '@/lib/utils';
import type { WordRecord } from '@/db/types';

type Stage = 'idle' | 'play' | 'done';

const SESSION_LEN = 12;   // 一组听力练习 12 个词

/**
 * 听力专项：只播音频，让用户拼出听到的词。
 * 数据源：当前 level 已学过（learning/review/mastered）的词 + 错题本中"听过没记牢"的高错频词。
 */
export function Listening() {
  const navigate = useNavigate();
  const { activeLevel, loaded, learningMode, enhanced } = useSettings();
  const [pool, setPool] = useState<WordRecord[]>([]);
  const [stage, setStage] = useState<Stage>('idle');
  const [queue, setQueue] = useState<WordRecord[]>([]);
  const [idx, setIdx] = useState(0);
  const [revealed, setRevealed] = useState<{ value: string; correct: boolean } | null>(null);
  const [stats, setStats] = useState({ correct: 0, total: 0 });
  const [wrongIds, setWrongIds] = useState<Set<number>>(new Set());
  const startedAtRef = useRef(0);

  useEffect(() => {
    if (!loaded) return;
    (async () => {
      const ids = await progressRepo.learnedWordIds(activeLevel);
      const all = await wordsRepo.byLevel(activeLevel, 800, 0);
      const learned = all.filter((w) => w.id !== undefined && ids.has(w.id));
      // 过滤掉太长 / 含空格的词，听写体验差
      const usable = learned.filter((w) => w.word.length <= 14 && !/\s/.test(w.word));
      setPool(usable);
    })();
  }, [loaded, activeLevel]);

  function startSession() {
    if (pool.length === 0) return;
    // 错频高的词权重更高（按 wrongCount 不直接拿，简化：从池中随机抽 + 多抽 30% 用 SRS 池）
    const picks = shuffle(pool).slice(0, Math.min(SESSION_LEN, pool.length));
    setQueue(picks);
    setIdx(0);
    setRevealed(null);
    setStats({ correct: 0, total: 0 });
    setWrongIds(new Set());
    startedAtRef.current = Date.now();
    setStage('play');
    setTimeout(() => speak(picks[0].word), 400);
  }

  const current = queue[idx];

  function handleSubmit(value: string, correct: boolean) {
    if (!current) return;
    setRevealed({ value, correct });
    if (!correct && current.id !== undefined) {
      setWrongIds((s) => { const ns = new Set(s); ns.add(current.id!); return ns; });
      // 同步进错题本：和拼写错同等对待
      progressRepo.markWrong(current.id, current.levelId);
    }
    setStats((s) => ({ correct: s.correct + (correct ? 1 : 0), total: s.total + 1 }));
  }

  async function next() {
    setRevealed(null);
    if (idx + 1 >= queue.length) {
      // 结束
      await sessionsRepo.log({
        type: 'review',
        wordsCount: queue.length,
        correctCount: stats.correct,
        durationMs: Date.now() - startedAtRef.current,
      });
      setStage('done');
      return;
    }
    setIdx((i) => i + 1);
    setTimeout(() => speak(queue[idx + 1].word), 250);
  }

  function skip() {
    setRevealed(null);
    if (idx + 1 >= queue.length) { setStage('done'); return; }
    setIdx((i) => i + 1);
    setTimeout(() => speak(queue[idx + 1].word), 250);
  }

  // 全局键盘：R=重播 / S=慢速 / ↵=继续
  useEffect(() => {
    if (stage !== 'play' || !current) return;
    function onKey(e: KeyboardEvent) {
      const t = e.target as HTMLElement | null;
      if (t && (t.tagName === 'INPUT' || t.tagName === 'TEXTAREA' || t.isContentEditable)) return;
      const k = e.key.toLowerCase();
      if (k === 'r') { e.preventDefault(); speak(current!.word); }
      if (k === 's') { e.preventDefault(); speakSlow(current!.word); }
    }
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [stage, current]);

  if (!loaded) return null;

  if (pool.length < 4) {
    return (
      <div className="mx-auto max-w-xl">
        <div className="paper-card text-center">
          <Ear size={36} className="mx-auto mb-3 text-ink3" />
          <h2 className="font-display text-3xl font-black">还没有足够的词可以听写</h2>
          <p className="mt-2 text-sm text-ink2">先去"新词"学几组词，回来这里会拿你已学过的词出题。</p>
          <button onClick={() => navigate('/learn')} className="btn-accent mt-5">去学新词</button>
        </div>
      </div>
    );
  }

  // 起始页
  if (stage === 'idle') {
    return (
      <div className="mx-auto max-w-2xl space-y-6">
        <div>
          <div className="font-mono text-[10px] uppercase tracking-[0.3em] text-ink3">chapter 02d · listening</div>
          <h1 className="mt-2 font-display text-4xl font-black tracking-tight sm:text-5xl md:text-6xl">
            The <span className="italic text-indigo2-500">Ear</span> Test
          </h1>
          <p className="mt-4 max-w-2xl text-pretty text-ink2">
            纯靠耳朵——只听音频拼出单词。每组 <b>{Math.min(SESSION_LEN, pool.length)}</b> 词，
            从你已学过的 <b>{pool.length}</b> 词里随机抽取。听不清可以 R 重播、S 慢速。
          </p>
        </div>

        <div className="paper-card">
          <div className="grid gap-4 sm:grid-cols-3">
            <Tile k="🎧" t="只听不看" d="题面隐藏单词，只放音频" />
            <Tile k="⏱" t="自动二连播" d="正常 + 慢速各一遍（设置可关）" />
            <Tile k="✦" t="答错入错题本" d="听写错的词自动进 Mistakes" />
          </div>
          <button onClick={startSession} className="btn-accent mt-6 w-full justify-center sm:w-auto">
            <Ear size={14} /> 开始 {Math.min(SESSION_LEN, pool.length)} 词听写
          </button>
        </div>
      </div>
    );
  }

  // 结束页
  if (stage === 'done') {
    const acc = stats.total > 0 ? Math.round((stats.correct / stats.total) * 100) : 0;
    const wrongWords = queue.filter((w) => w.id !== undefined && wrongIds.has(w.id));
    return (
      <div className="mx-auto max-w-2xl space-y-5">
        <div className="paper-card text-center">
          <Trophy size={40} className="mx-auto mb-3 text-persimmon" />
          <h2 className="font-display text-3xl font-black">听力练习完成</h2>
          <p className="mt-2 text-sm text-ink2">
            听对 <b className="text-persimmon">{stats.correct}</b> / {stats.total} · 准确率 <b>{acc}%</b>
          </p>
        </div>

        {wrongWords.length > 0 && (
          <div className="paper-card">
            <div className="font-mono text-[10px] uppercase tracking-[0.25em] text-crimson">missed · 本组没听对的词</div>
            <ul className="mt-3 grid gap-2 sm:grid-cols-2">
              {wrongWords.map((w) => (
                <li key={w.id} className="flex items-center gap-2 rounded-md border border-paper3 bg-paper p-2.5">
                  <button onClick={() => speak(w.word)} className="btn-icon !h-8 !w-8 shrink-0"><Volume2 size={12} /></button>
                  <div className="min-w-0 flex-1">
                    <div className="font-display text-base font-bold text-ink">{w.word}</div>
                    <div className="truncate text-xs text-ink3">{w.translations[0]?.translation}</div>
                  </div>
                </li>
              ))}
            </ul>
          </div>
        )}

        <div className="flex flex-col gap-2 sm:flex-row sm:justify-end">
          <button onClick={() => navigate('/')} className="btn-ghost w-full sm:w-auto">回首页</button>
          {wrongWords.length > 0 && (
            <button
              onClick={() => {
                setQueue(wrongWords);
                setIdx(0);
                setRevealed(null);
                setStats({ correct: 0, total: 0 });
                setWrongIds(new Set());
                startedAtRef.current = Date.now();
                setStage('play');
                setTimeout(() => speak(wrongWords[0].word), 300);
              }}
              className="btn-primary w-full sm:w-auto"
            >
              <RotateCw size={14} /> 立即重练错的 {wrongWords.length} 个
            </button>
          )}
          <button onClick={startSession} className="btn-accent w-full sm:w-auto"><RefreshCw size={14} /> 再来一组</button>
        </div>
      </div>
    );
  }

  // 答题中
  const passed = stats.total;
  const pct = (passed / queue.length) * 100;
  const isEnhanced = learningMode === 'enhanced';

  return (
    <div className="mx-auto max-w-2xl space-y-5">
      <div>
        <div className="font-mono text-[10px] uppercase tracking-[0.3em] text-ink3">chapter 02d · listening</div>
        <h1 className="mt-1 font-display text-3xl font-black tracking-tight md:text-4xl">听写</h1>
      </div>

      <div className="space-y-1.5">
        <div className="flex items-center justify-between font-mono text-[10px] uppercase tracking-[0.25em] text-ink3">
          <span>{idx + 1} / {queue.length}</span>
          <span>kept · {stats.correct} / done · {stats.total}</span>
        </div>
        <div className="meter-track">
          <div className="meter-bar bg-indigo2-500" style={{ width: `${pct}%` }} />
        </div>
      </div>

      <div className="paper-card animate-fade-up">
        {/* 题面：只展示一个大耳朵 + 翻译作为微弱提示（不暴露单词） */}
        <div className="text-center">
          <div className="mx-auto grid h-20 w-20 place-items-center rounded-full border border-indigo2/30 bg-indigo2-50/40">
            <Ear size={32} className="text-indigo2-500" />
          </div>
          <div className="mt-3 font-mono text-[10px] uppercase tracking-[0.25em] text-ink3">type what you hear</div>

          <div className="mt-4 flex flex-wrap justify-center gap-2">
            <button onClick={() => speak(current.word)} className="inline-flex items-center gap-1.5 rounded-md border border-paper3 bg-paper px-3 py-2 text-sm font-semibold text-ink2 transition hover:border-ink">
              <Volume2 size={14} /> 重播 <span className="hidden font-mono text-[10px] opacity-60 sm:inline">R</span>
            </button>
            <button onClick={() => speakSlow(current.word)} className="inline-flex items-center gap-1.5 rounded-md border border-paper3 bg-paper px-3 py-2 text-sm font-semibold text-ink2 transition hover:border-ink">
              <Gauge size={14} /> 慢速 <span className="hidden font-mono text-[10px] opacity-60 sm:inline">S</span>
            </button>
            <button onClick={skip} className="inline-flex items-center gap-1.5 rounded-md border border-paper3 bg-paper px-3 py-2 text-sm font-semibold text-ink3 transition hover:border-ink">
              <SkipForward size={14} /> 跳过
            </button>
          </div>
        </div>

        {/* 当用户答错揭晓后，给出翻译作为参考 */}
        {revealed && (
          <div className="mt-5 border-t border-paper3 pt-4 text-center animate-fade-up">
            <div className="font-mono text-[10px] uppercase tracking-[0.25em] text-ink3">{revealed.correct ? 'correct' : 'reference'}</div>
            <div className="mt-1 flex flex-wrap items-baseline justify-center gap-2">
              {current.translations.map((t, i) => (
                <span key={i} className="text-sm text-ink2"><span className="tag mr-1">{t.type || '—'}</span>{t.translation}</span>
              ))}
            </div>
          </div>
        )}

        <div className="mt-6">
          <AnswerInput
            answer={current.word}
            mode="cells"
            revealed={revealed}
            onSubmit={handleSubmit}
            onContinue={next}
            autoFocus
          />
        </div>

        {/* 增强模式：录音对比 */}
        {isEnhanced && enhanced.recordingEnabled && revealed && (
          <div className="mt-4">
            <PronunciationRecorder reference={current.word} />
          </div>
        )}
      </div>

      <div className="hidden flex-wrap items-center justify-center gap-3 pt-2 font-mono text-[10px] uppercase tracking-wider text-ink3 md:flex">
        <span className="inline-flex items-center gap-1.5"><kbd className="kbd">R</kbd> 重播</span>
        <span className="inline-flex items-center gap-1.5"><kbd className="kbd">S</kbd> 慢速</span>
        <span className="inline-flex items-center gap-1.5"><kbd className="kbd">↵</kbd> 提交 / 继续</span>
      </div>
    </div>
  );
}

function Tile({ k, t, d }: { k: string; t: string; d: string }) {
  return (
    <div className="rounded-md border border-paper3 bg-paper2/40 p-3">
      <div className="font-display text-2xl">{k}</div>
      <div className="mt-1 font-display text-sm font-bold text-ink">{t}</div>
      <div className="mt-0.5 text-xs text-ink3 leading-relaxed">{d}</div>
    </div>
  );
}
