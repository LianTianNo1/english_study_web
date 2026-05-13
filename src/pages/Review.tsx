import { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { progressRepo } from '@/db/repositories/progress';
import { wordsRepo } from '@/db/repositories/words';
import { sessionsRepo } from '@/db/repositories/sessions';
import type { ProgressRecord, WordRecord } from '@/db/types';
import { INITIAL_SRS, scheduleNext, nextReviewAtFor, type Quality } from '@/features/srs';
import { useSettings } from '@/stores/settingsStore';
import { Volume2, Trophy, Eye, Star } from 'lucide-react';
import { speak, speakTwice } from '@/lib/tts';
import { cn } from '@/lib/utils';
import { ActiveRecallSentence } from '@/components/ActiveRecallSentence';

type Item = { progress: ProgressRecord; word: WordRecord };

export function Review() {
  const navigate = useNavigate();
  const { dailyReviewLimit, reviewAlgorithm, loaded, learningMode, enhanced } = useSettings();
  const wrongWeighted = learningMode === 'enhanced' && enhanced.wrongWeighted;
  const [items, setItems] = useState<Item[]>([]);
  const [idx, setIdx] = useState(0);
  const [showAnswer, setShowAnswer] = useState(false);
  const [stats, setStats] = useState({ correct: 0, total: 0 });
  const [startTime, setStartTime] = useState(0);

  useEffect(() => {
    if (!loaded) return;
    (async () => {
      const due = await progressRepo.dueForReview(Date.now(), dailyReviewLimit);
      const list: Item[] = [];
      for (const p of due) {
        const w = await wordsRepo.getById(p.wordId);
        if (w) list.push({ progress: p, word: w });
      }
      // 错词加权：错过 ≥2 次的词复制一份插入队列前段，错越多权重越高
      let weighted = list;
      if (wrongWeighted) {
        const extras: Item[] = [];
        list.forEach((it) => {
          const n = it.progress.wrongCount ?? 0;
          // wrongCount 2 → +1 次  3 → +2 次  ≥4 → +3 次（上限）
          const dup = Math.min(3, Math.max(0, n - 1));
          for (let i = 0; i < dup; i++) extras.push(it);
        });
        // 把加权副本插入到前 60% 区间，避免开头全是错词
        weighted = list.slice();
        extras.forEach((e, i) => {
          const pos = Math.floor((i / Math.max(1, extras.length)) * weighted.length * 0.6);
          weighted.splice(pos, 0, e);
        });
      }
      setItems(weighted);
      setStartTime(Date.now());
    })();
  }, [loaded, dailyReviewLimit, wrongWeighted]);

  // 自动朗读当前词；增强模式 + autoSlowTTS 时连播慢速版
  useEffect(() => {
    if (!loaded || items.length === 0 || idx >= items.length) return;
    const autoSlow = learningMode === 'enhanced' && enhanced.autoSlowTTS;
    const t = setTimeout(() => {
      if (autoSlow) speakTwice(items[idx].word.word);
      else speak(items[idx].word.word);
    }, 200);
    return () => clearTimeout(t);
  }, [idx, items, loaded, learningMode, enhanced.autoSlowTTS]);

  if (!loaded) return null;
  const current = items[idx];

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
            共 <b className="text-persimmon">{stats.total}</b> 词 · 记住 <b>{stats.correct}</b> 个
          </p>
          <button onClick={() => navigate('/')} className="btn-accent mt-5">回首页</button>
        </div>
      </div>
    );
  }

  async function rate(quality: Quality) {
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

  return (
    <div className="mx-auto max-w-2xl space-y-5">
      <div>
        <div className="font-mono text-[10px] uppercase tracking-[0.3em] text-ink3">chapter 02 · recall</div>
        <h1 className="mt-1 font-display text-3xl font-black tracking-tight md:text-4xl">温习</h1>
      </div>
      <div className="flex items-center justify-between font-mono text-[10px] uppercase tracking-[0.25em] text-ink3">
        <span>{idx + 1} / {items.length}</span>
        <span>kept · {stats.correct} / done · {stats.total}</span>
      </div>

      <div className="paper-card animate-fade-up text-center">
        <div className="flex items-baseline justify-center gap-2">
          <h3 className="font-display text-4xl font-black tracking-tight text-ink sm:text-5xl md:text-6xl break-words max-w-full">{current.word.word}</h3>
          <button onClick={() => speak(current.word.word)} className="btn-icon" title="朗读">
            <Volume2 size={14} />
          </button>
          <button
            onClick={async () => {
              if (current.word.id === undefined) return;
              const ok = await progressRepo.toggleStar(current.word.id);
              setItems((arr) => arr.map((it) => it.word.id === current.word.id ? { ...it, progress: { ...it.progress, starred: ok } } : it));
            }}
            className={cn('btn-icon', current.progress.starred && 'border-persimmon text-persimmon')}
            title="标记难词"
          >
            <Star size={14} className={cn(current.progress.starred && 'fill-persimmon')} />
          </button>
        </div>

        {!showAnswer ? (
          <button onClick={() => setShowAnswer(true)} className="btn-ghost mx-auto mt-7">
            <Eye size={14} /> 查看释义
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
        <div className="grid grid-cols-3 gap-3 animate-fade-up">
          <RateBtn label="忘了" sub="再来一次" tone="red" onClick={() => rate(0)} />
          <RateBtn label="模糊" sub="较短间隔" tone="amber" onClick={() => rate(3)} />
          <RateBtn label="记住" sub="正常间隔" tone="mint" onClick={() => rate(4)} />
        </div>
      )}
    </div>
  );
}

function RateBtn(props: { label: string; sub: string; tone: 'red' | 'amber' | 'mint'; onClick: () => void }) {
  const cls = {
    red: 'border-crimson bg-crimson-50 text-crimson hover:bg-crimson-50/80',
    amber: 'border-persimmon-300 bg-persimmon-50 text-persimmon-700 hover:bg-persimmon-100',
    mint: 'border-moss-300 bg-moss-50 text-moss-700 hover:bg-moss-50/80',
  }[props.tone];
  return (
    <button onClick={props.onClick} className={cn('rounded-md border px-4 py-4 text-center transition', cls)}>
      <div className="font-display text-xl font-bold">{props.label}</div>
      <div className="mt-0.5 font-mono text-[10px] uppercase tracking-wider opacity-70">{props.sub}</div>
    </button>
  );
}
