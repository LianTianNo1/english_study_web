import { useEffect, useRef, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { progressRepo } from '@/db/repositories/progress';
import { wordsRepo } from '@/db/repositories/words';
import { sessionsRepo } from '@/db/repositories/sessions';
import { getSetting, setSetting } from '@/db/schema';
import type { ProgressRecord, WordRecord } from '@/db/types';
import { INITIAL_SRS, scheduleNext, nextReviewAtFor, type Quality } from '@/features/srs';
import { useSettings } from '@/stores/settingsStore';
import { Volume2, Trophy, Eye, Star } from 'lucide-react';
import { speak, speakTwice } from '@/lib/tts';
import { cn, todayKey } from '@/lib/utils';
import { ActiveRecallSentence } from '@/components/ActiveRecallSentence';

type Item = { progress: ProgressRecord; word: WordRecord };

/** 复习会话状态（当日累计） · 写入 settings 表 */
interface ReviewSessionState {
  date: string;          // todayKey()
  totalPlanned: number;  // 当日最初规划的复习总数
  completed: number;     // 当日已完成数量
  correct: number;       // 当日累计记住数
}
const REVIEW_SESSION_KEY = 'reviewSession';

export function Review() {
  const navigate = useNavigate();
  const { dailyReviewLimit, reviewAlgorithm, loaded, learningMode, enhanced } = useSettings();
  const wrongWeighted = learningMode === 'enhanced' && enhanced.wrongWeighted;
  const [items, setItems] = useState<Item[]>([]);
  const [idx, setIdx] = useState(0);
  const [showAnswer, setShowAnswer] = useState(false);
  const [stats, setStats] = useState({ correct: 0, total: 0 });
  const [startTime, setStartTime] = useState(0);
  /** 当日累计（含上次未完成部分），用于 UI 显示真实进度感 */
  const [dailyAccum, setDailyAccum] = useState({ completed: 0, planned: 0 });
  const inputBlockedRef = useRef(false);

  useEffect(() => {
    if (!loaded) return;
    (async () => {
      const due = await progressRepo.dueForReview(Date.now(), dailyReviewLimit);
      const list: Item[] = [];
      for (const p of due) {
        const w = await wordsRepo.getById(p.wordId);
        if (w) list.push({ progress: p, word: w });
      }
      // 错词加权
      let weighted = list;
      if (wrongWeighted) {
        const extras: Item[] = [];
        list.forEach((it) => {
          const n = it.progress.wrongCount ?? 0;
          const dup = Math.min(3, Math.max(0, n - 1));
          for (let i = 0; i < dup; i++) extras.push(it);
        });
        weighted = list.slice();
        extras.forEach((e, i) => {
          const pos = Math.floor((i / Math.max(1, extras.length)) * weighted.length * 0.6);
          weighted.splice(pos, 0, e);
        });
      }
      setItems(weighted);
      setStartTime(Date.now());

      // 读取当日复习 session 累计进度（用户中途退出，下次进入续上）
      const today = todayKey();
      const stored = await getSetting<ReviewSessionState | null>(REVIEW_SESSION_KEY, null);
      if (stored && stored.date === today) {
        setDailyAccum({ completed: stored.completed, planned: Math.max(stored.totalPlanned, stored.completed + weighted.length) });
      } else {
        // 新的一天：以本次拉到的 weighted.length 作为当日规划基线
        const fresh: ReviewSessionState = { date: today, totalPlanned: weighted.length, completed: 0, correct: 0 };
        await setSetting(REVIEW_SESSION_KEY, fresh);
        setDailyAccum({ completed: 0, planned: weighted.length });
      }
    })();
  }, [loaded, dailyReviewLimit, wrongWeighted]);

  // 自动朗读
  useEffect(() => {
    if (!loaded || items.length === 0 || idx >= items.length) return;
    const autoSlow = learningMode === 'enhanced' && enhanced.autoSlowTTS;
    const t = setTimeout(() => {
      if (autoSlow) speakTwice(items[idx].word.word);
      else speak(items[idx].word.word);
    }, 200);
    return () => clearTimeout(t);
  }, [idx, items, loaded, learningMode, enhanced.autoSlowTTS]);

  const current = items[idx];

  // 全局键盘交互
  useEffect(() => {
    if (!loaded || !current) return;
    function onKey(e: KeyboardEvent) {
      // 输入框、textarea 聚焦时不拦截
      const t = e.target as HTMLElement | null;
      if (t && (t.tagName === 'INPUT' || t.tagName === 'TEXTAREA' || t.isContentEditable)) return;
      if (inputBlockedRef.current) return;

      const k = e.key.toLowerCase();
      if (!showAnswer) {
        // 未揭晓阶段
        if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); setShowAnswer(true); return; }
        if (k === 'f') { e.preventDefault(); speak(current.word.word); return; }
        if (k === 's') {
          e.preventDefault();
          if (current.word.id !== undefined) toggleStar();
        }
      } else {
        // 揭晓后阶段：1/2/3 评分
        if (e.key === '1' || k === 'q') { e.preventDefault(); rate(0); return; }
        if (e.key === '2' || k === 'w') { e.preventDefault(); rate(3); return; }
        if (e.key === '3' || k === 'e' || e.key === 'Enter') { e.preventDefault(); rate(4); return; }
        if (k === 'f') { e.preventDefault(); speak(current.word.word); return; }
      }
    }
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [loaded, current, showAnswer]);

  if (!loaded) return null;

  if (items.length === 0) {
    return (
      <div className="mx-auto max-w-xl">
        <div className="paper-card text-center">
          <Trophy size={36} className="mx-auto mb-3 text-moss" />
          <h2 className="font-display text-3xl font-black">复习池暂时清空。</h2>
          <p className="mt-2 text-sm text-ink2">明天再来巩固，或继续学习新词。</p>
          <button onClick={() => navigate('/learn')} className="btn-accent mt-5">去学新词</button>
        </div>
      </div>
    );
  }

  if (idx >= items.length) {
    return (
      <div className="mx-auto max-w-xl">
        <div className="paper-card text-center">
          <Trophy size={40} className="mx-auto mb-3 text-persimmon" />
          <h2 className="font-display text-3xl font-black">复习完成。</h2>
          <p className="mt-2 text-sm text-ink2">
            本轮 <b className="text-persimmon">{stats.total}</b> 词 · 记住 <b>{stats.correct}</b> 个
          </p>
          <p className="mt-1 font-mono text-[10px] uppercase tracking-wider text-ink3">
            today total · {dailyAccum.completed}/{dailyAccum.planned}
          </p>
          <button onClick={() => navigate('/')} className="btn-accent mt-5">回首页</button>
        </div>
      </div>
    );
  }

  async function toggleStar() {
    if (!current || current.word.id === undefined) return;
    const ok = await progressRepo.toggleStar(current.word.id);
    setItems((arr) => arr.map((it) => it.word.id === current.word.id ? { ...it, progress: { ...it.progress, starred: ok } } : it));
  }

  async function rate(quality: Quality) {
    inputBlockedRef.current = true;
    setTimeout(() => { inputBlockedRef.current = false; }, 220);

    const c = current;
    if (!c) return;
    const prev = {
      repetitions: c.progress.repetitions,
      interval: c.progress.interval,
      easeFactor: c.progress.easeFactor || INITIAL_SRS.easeFactor,
    };
    const ns = scheduleNext(quality, prev, reviewAlgorithm);
    const now = Date.now();
    const isCorrect = quality >= 3;
    if (!isCorrect && c.word.id !== undefined) {
      await progressRepo.markWrong(c.word.id, c.word.levelId);
    }
    await progressRepo.upsert({
      ...c.progress,
      status: ns.repetitions >= 5 && ns.interval >= 30 ? 'mastered' : 'review',
      interval: ns.interval,
      easeFactor: ns.easeFactor,
      repetitions: ns.repetitions,
      lastReviewAt: now,
      nextReviewAt: nextReviewAtFor(ns, reviewAlgorithm, now),
    });
    setStats((s) => ({ correct: s.correct + (isCorrect ? 1 : 0), total: s.total + 1 }));

    // 更新当日累计 + 持久化（用户下次进入页面能续上进度感）
    const today = todayKey();
    const nextAccum = { completed: dailyAccum.completed + 1, planned: dailyAccum.planned };
    setDailyAccum(nextAccum);
    const stored = await getSetting<ReviewSessionState | null>(REVIEW_SESSION_KEY, null);
    const merged: ReviewSessionState = {
      date: today,
      totalPlanned: stored?.date === today ? stored.totalPlanned : nextAccum.planned,
      completed: nextAccum.completed,
      correct: (stored?.date === today ? stored.correct : 0) + (isCorrect ? 1 : 0),
    };
    await setSetting(REVIEW_SESSION_KEY, merged);

    setShowAnswer(false);
    if (idx + 1 >= items.length) {
      await sessionsRepo.log({
        type: 'review',
        wordsCount: items.length,
        correctCount: stats.correct + (isCorrect ? 1 : 0),
        durationMs: Date.now() - startTime,
      });
    }
    setIdx((i) => i + 1);
  }

  // 进度比例（按当日累计）
  const dayPct = dailyAccum.planned > 0 ? Math.round((dailyAccum.completed / dailyAccum.planned) * 100) : 0;

  return (
    <div className="mx-auto max-w-2xl space-y-5">
      <div>
        <div className="font-mono text-[10px] uppercase tracking-[0.3em] text-ink3">chapter 02 · recall</div>
        <h1 className="mt-1 font-display text-3xl font-black tracking-tight md:text-4xl">温习</h1>
      </div>

      <div className="space-y-1.5">
        <div className="flex flex-wrap items-center justify-between gap-2 font-mono text-[10px] uppercase tracking-[0.25em] text-ink3">
          <span>round {idx + 1} / {items.length}</span>
          <span className="text-ink2">today · <b className="text-ink">{dailyAccum.completed}</b> / {dailyAccum.planned}</span>
        </div>
        <div className="meter-track">
          <div className="meter-bar bg-persimmon" style={{ width: `${dayPct}%` }} />
        </div>
        <div className="flex items-center justify-between font-mono text-[9px] uppercase tracking-wider text-ink3">
          <span>kept · {stats.correct} / done · {stats.total} 本轮</span>
          {dailyAccum.completed > 0 && dailyAccum.completed < dailyAccum.planned && (
            <span className="text-persimmon-700">⤴ 续上次进度</span>
          )}
        </div>
      </div>

      <div className="paper-card animate-fade-up text-center">
        <div className="flex items-baseline justify-center gap-2">
          <h3 className="font-display text-4xl font-black tracking-tight text-ink sm:text-5xl md:text-6xl break-words max-w-full">{current.word.word}</h3>
          <button onClick={() => speak(current.word.word)} className="btn-icon" title="朗读 (F)">
            <Volume2 size={14} />
          </button>
          <button
            onClick={toggleStar}
            className={cn('btn-icon', current.progress.starred && 'border-persimmon text-persimmon')}
            title="标记难词 (S)"
          >
            <Star size={14} className={cn(current.progress.starred && 'fill-persimmon')} />
          </button>
        </div>

        {!showAnswer ? (
          <button onClick={() => setShowAnswer(true)} className="btn-ghost mx-auto mt-7" title="查看释义 (Enter / Space)">
            <Eye size={14} /> 查看释义 <span className="ml-1 font-mono text-[10px] opacity-60">↵</span>
          </button>
        ) : (
          <div className="mt-6 space-y-2 border-t border-paper3 pt-4 text-left animate-fade-up">
            {current.word.translations.map((t, i) => (
              <div key={i} className="flex items-baseline gap-2 text-base">
                <span className="tag">{t.type || '—'}</span>
                <span className="text-ink">{t.translation}</span>
              </div>
            ))}
          </div>
        )}
      </div>

      {showAnswer && learningMode === 'enhanced' && enhanced.activeRecall && (
        <ActiveRecallSentence
          key={current.word.id}
          word={current.word.word}
          wordId={current.word.id}
        />
      )}

      {showAnswer && (
        <div className="grid grid-cols-3 gap-2 sm:gap-3 animate-fade-up">
          <RateBtn label="忘了" sub="再来一次" kbd="1" tone="red" onClick={() => rate(0)} />
          <RateBtn label="模糊" sub="较短间隔" kbd="2" tone="amber" onClick={() => rate(3)} />
          <RateBtn label="记住" sub="正常间隔" kbd="3" tone="mint" onClick={() => rate(4)} />
        </div>
      )}

      {/* 键盘提示行（移动端隐藏） */}
      <div className="hidden flex-wrap items-center justify-center gap-3 pt-2 font-mono text-[10px] uppercase tracking-wider text-ink3 md:flex">
        {!showAnswer ? (
          <>
            <KbdHint k="↵ / Space" label="查看释义" />
            <KbdHint k="F" label="朗读" />
            <KbdHint k="S" label="收藏" />
          </>
        ) : (
          <>
            <KbdHint k="1 / Q" label="忘了" />
            <KbdHint k="2 / W" label="模糊" />
            <KbdHint k="3 / E / ↵" label="记住" />
            <KbdHint k="F" label="朗读" />
          </>
        )}
      </div>
    </div>
  );
}

function KbdHint({ k, label }: { k: string; label: string }) {
  return (
    <span className="inline-flex items-center gap-1.5">
      <kbd className="kbd">{k}</kbd> {label}
    </span>
  );
}

function RateBtn(props: { label: string; sub: string; kbd: string; tone: 'red' | 'amber' | 'mint'; onClick: () => void }) {
  const cls = {
    red: 'border-crimson bg-crimson-50 text-crimson hover:bg-crimson-50/80',
    amber: 'border-persimmon-300 bg-persimmon-50 text-persimmon-700 hover:bg-persimmon-100',
    mint: 'border-moss-300 bg-moss-50 text-moss-700 hover:bg-moss-50/80',
  }[props.tone];
  return (
    <button onClick={props.onClick} className={cn('relative rounded-md border px-3 py-4 text-center transition min-h-[72px] sm:px-4', cls)}>
      <span className="absolute right-1.5 top-1.5 hidden font-mono text-[10px] opacity-60 sm:inline">{props.kbd}</span>
      <div className="font-display text-lg sm:text-xl font-bold">{props.label}</div>
      <div className="mt-0.5 font-mono text-[10px] uppercase tracking-wider opacity-70">{props.sub}</div>
    </button>
  );
}
