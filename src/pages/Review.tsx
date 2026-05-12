import { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { progressRepo } from '@/db/repositories/progress';
import { wordsRepo } from '@/db/repositories/words';
import { sessionsRepo } from '@/db/repositories/sessions';
import type { ProgressRecord, WordRecord } from '@/db/types';
import { INITIAL_SRS, nextReviewAt, sm2, type Quality } from '@/features/srs/sm2';
import { useSettings } from '@/stores/settingsStore';
import { Volume2, Trophy, Eye } from 'lucide-react';
import { speak } from '@/lib/tts';
import { cn } from '@/lib/utils';

type Item = { progress: ProgressRecord; word: WordRecord };

export function Review() {
  const navigate = useNavigate();
  const { dailyReviewLimit, load, loaded } = useSettings();
  const [items, setItems] = useState<Item[]>([]);
  const [idx, setIdx] = useState(0);
  const [showAnswer, setShowAnswer] = useState(false);
  const [stats, setStats] = useState({ correct: 0, total: 0 });
  const [startTime, setStartTime] = useState(0);

  useEffect(() => {
    if (!loaded) load();
  }, [loaded, load]);

  useEffect(() => {
    if (!loaded) return;
    (async () => {
      const due = await progressRepo.dueForReview(Date.now(), dailyReviewLimit);
      const list: Item[] = [];
      for (const p of due) {
        const w = await wordsRepo.getById(p.wordId);
        if (w) list.push({ progress: p, word: w });
      }
      setItems(list);
      setStartTime(Date.now());
    })();
  }, [loaded, dailyReviewLimit]);

  if (!loaded) return null;
  const current = items[idx];

  if (items.length === 0) {
    return (
      <div className="card mx-auto max-w-xl text-center">
        <Trophy size={36} className="mx-auto mb-3 text-mint-500" />
        <h2 className="text-xl font-bold">今日已无待复习 🎉</h2>
        <p className="mt-2 text-sm text-ink-500">明天继续来巩固吧。</p>
        <button onClick={() => navigate('/learn')} className="btn-primary mt-5">去学新词</button>
      </div>
    );
  }

  if (idx >= items.length) {
    return (
      <div className="card mx-auto max-w-xl text-center animate-fade-in">
        <Trophy size={40} className="mx-auto mb-3 text-mint-500" />
        <h2 className="text-2xl font-bold">复习完成</h2>
        <p className="mt-2 text-sm text-ink-500">
          共 <b className="text-mint-500">{stats.total}</b> 词 · 记住 <b>{stats.correct}</b> 个
        </p>
        <button onClick={() => navigate('/')} className="btn-primary mt-5">回首页</button>
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
    const ns = sm2(quality, prev);
    const now = Date.now();
    const isCorrect = quality >= 3;
    await progressRepo.upsert({
      ...c.progress,
      status: ns.repetitions >= 5 && ns.interval >= 30 ? 'mastered' : 'review',
      interval: ns.interval,
      easeFactor: ns.easeFactor,
      repetitions: ns.repetitions,
      lastReviewAt: now,
      nextReviewAt: nextReviewAt(ns, now),
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
    <div className="mx-auto max-w-2xl space-y-4">
      <div className="flex items-center justify-between text-sm text-ink-500">
        <span>复习 {idx + 1} / {items.length}</span>
        <span>记住 {stats.correct} / 已复习 {stats.total}</span>
      </div>

      <div className="card animate-fade-in text-center">
        <div className="flex items-center justify-center gap-2">
          <h3 className="text-4xl font-extrabold tracking-tight text-ink-800">{current.word.word}</h3>
          <button
            onClick={() => speak(current.word.word)}
            className="grid h-9 w-9 place-items-center rounded-full bg-cream-100 text-ink-600 hover:bg-warm-100 hover:text-warm-600"
          >
            <Volume2 size={16} />
          </button>
        </div>

        {!showAnswer ? (
          <button onClick={() => setShowAnswer(true)} className="btn-secondary mt-6 mx-auto">
            <Eye size={16} /> 查看释义
          </button>
        ) : (
          <div className="mt-5 space-y-1.5 text-left animate-fade-in">
            {current.word.translations.map((t, i) => (
              <div key={i} className="text-sm">
                <span className="tag mr-2">{t.type || '—'}</span>
                <span className="text-ink-700">{t.translation}</span>
              </div>
            ))}
          </div>
        )}
      </div>

      {showAnswer && (
        <div className="grid grid-cols-3 gap-3 animate-fade-in">
          <RateBtn label="忘了" sub="～1 天后" tone="red" onClick={() => rate(0)} />
          <RateBtn label="模糊" sub="较短间隔" tone="amber" onClick={() => rate(3)} />
          <RateBtn label="记住" sub="正常间隔" tone="mint" onClick={() => rate(4)} />
        </div>
      )}
    </div>
  );
}

function RateBtn(props: { label: string; sub: string; tone: 'red' | 'amber' | 'mint'; onClick: () => void }) {
  const cls = {
    red: 'bg-red-50 hover:bg-red-100 text-red-600',
    amber: 'bg-amber-50 hover:bg-amber-100 text-amber-600',
    mint: 'bg-emerald-50 hover:bg-emerald-100 text-mint-500',
  }[props.tone];
  return (
    <button onClick={props.onClick} className={cn('rounded-2xl px-4 py-4 text-center transition-colors', cls)}>
      <div className="text-base font-bold">{props.label}</div>
      <div className="mt-0.5 text-[11px] opacity-70">{props.sub}</div>
    </button>
  );
}
