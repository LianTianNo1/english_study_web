import { useEffect, useMemo, useState } from 'react';
import { Link } from 'react-router-dom';
import { Calendar, Trophy, TrendingUp, AlertTriangle, Star } from 'lucide-react';
import { sessionsRepo } from '@/db/repositories/sessions';
import { progressRepo } from '@/db/repositories/progress';
import { wordsRepo } from '@/db/repositories/words';
import { userSentencesRepo } from '@/db/repositories/userSentences';
import { todayKey, addDays, cn } from '@/lib/utils';
import type { SessionRecord, WordRecord, ProgressRecord } from '@/db/types';

interface DayCell { date: string; learn: number; review: number; grammar: number; }

export function WeeklyReport() {
  const [week, setWeek] = useState<DayCell[]>([]);
  const [totals, setTotals] = useState({ learn: 0, review: 0, grammar: 0, accuracy: 0 });
  const [topWrong, setTopWrong] = useState<{ word: WordRecord; progress: ProgressRecord }[]>([]);
  const [sentenceCount, setSentenceCount] = useState(0);
  const [streakDays, setStreakDays] = useState(0);

  useEffect(() => {
    (async () => {
      const rows: SessionRecord[] = await sessionsRepo.recent(7);
      const map: Record<string, DayCell> = {};
      const today = new Date();
      for (let i = 6; i >= 0; i--) {
        const k = todayKey(addDays(today, -i));
        map[k] = { date: k, learn: 0, review: 0, grammar: 0 };
      }
      let learnTotal = 0, reviewTotal = 0, grammarTotal = 0;
      let correct = 0, attempts = 0;
      for (const r of rows) {
        if (!map[r.date]) continue;
        map[r.date][r.type] += r.wordsCount;
        if (r.type === 'learn') learnTotal += r.wordsCount;
        if (r.type === 'review') reviewTotal += r.wordsCount;
        if (r.type === 'grammar') grammarTotal += r.wordsCount;
        correct += r.correctCount;
        attempts += r.wordsCount;
      }
      const days = Object.values(map).sort((a, b) => a.date.localeCompare(b.date));
      setWeek(days);
      setTotals({
        learn: learnTotal,
        review: reviewTotal,
        grammar: grammarTotal,
        accuracy: attempts > 0 ? Math.round((correct / attempts) * 100) : 0,
      });
      // 连续学习天数（本周内）
      let s = 0;
      for (let i = days.length - 1; i >= 0; i--) {
        const d = days[i];
        if (d.learn + d.review + d.grammar > 0) s++;
        else if (i < days.length - 1) break;
      }
      setStreakDays(s);

      // 错频 TOP 5
      const wrongs = await progressRepo.wrongWords(50);
      const top = wrongs
        .filter((p) => (p.wrongCount ?? 0) >= 2)
        .sort((a, b) => (b.wrongCount ?? 0) - (a.wrongCount ?? 0))
        .slice(0, 5);
      const items: { word: WordRecord; progress: ProgressRecord }[] = [];
      for (const p of top) {
        const w = await wordsRepo.getById(p.wordId);
        if (w) items.push({ word: w, progress: p });
      }
      setTopWrong(items);

      setSentenceCount(await userSentencesRepo.count());
    })();
  }, []);

  const maxDay = useMemo(() => Math.max(1, ...week.map((d) => d.learn + d.review + d.grammar)), [week]);
  const today = useMemo(() => new Date().toLocaleDateString('zh-CN', { month: 'long', day: 'numeric' }), []);

  return (
    <div className="space-y-10">
      <header className="border-b border-paper3 pb-8">
        <div className="flex items-center justify-between font-mono text-[10px] uppercase tracking-[0.25em] text-ink3">
          <span>weekly report · 周回顾</span>
          <span>{today}</span>
        </div>
        <h1 className="mt-4 font-display text-4xl font-black tracking-tight sm:text-5xl md:text-6xl">
          The <span className="italic text-persimmon">Week</span> in Review
        </h1>
        <p className="mt-3 max-w-2xl text-pretty text-ink2">
          每周一次的复盘——看清自己学了什么、漏了什么、下周该聚焦什么。
        </p>
      </header>

      {/* 主要 KPI */}
      <section className="grid grid-cols-2 gap-px overflow-hidden rounded-md border border-paper3 bg-paper3 md:grid-cols-4">
        <Kpi label="streak" zh="连续打卡" value={streakDays} unit="days" tone />
        <Kpi label="new" zh="新学" value={totals.learn} unit="words" />
        <Kpi label="review" zh="复习" value={totals.review} unit="words" />
        <Kpi label="accuracy" zh="准确率" value={totals.accuracy} unit="%" />
      </section>

      {/* 7 天柱形 */}
      <section>
        <div className="divider">7 days · 每日强度</div>
        <div className="paper-card">
          <div className="flex h-40 items-end gap-1.5 sm:gap-3">
            {week.map((d) => {
              const sum = d.learn + d.review + d.grammar;
              const h = Math.max(2, (sum / maxDay) * 100);
              return (
                <div key={d.date} className="flex flex-1 flex-col items-center gap-1.5">
                  <div className="relative flex w-full flex-1 items-end overflow-hidden rounded-sm bg-paper2">
                    <div
                      className="w-full bg-gradient-to-t from-persimmon to-persimmon-300 transition-all"
                      style={{ height: `${h}%` }}
                      title={`${d.date} · 新${d.learn}/复${d.review}/法${d.grammar}`}
                    />
                  </div>
                  <span className="font-mono text-[9px] text-ink3">{d.date.slice(5)}</span>
                </div>
              );
            })}
          </div>
        </div>
      </section>

      {/* 错频 TOP 5 */}
      {topWrong.length > 0 && (
        <section>
          <div className="divider">focus next week · 下周聚焦</div>
          <div className="paper-card">
            <div className="flex items-center gap-2 font-mono text-[10px] uppercase tracking-[0.25em] text-crimson">
              <AlertTriangle size={11} /> 反复出错的词 — 下周应该重点关照
            </div>
            <ul className="mt-4 space-y-2">
              {topWrong.map(({ word, progress }, i) => (
                <li key={word.id} className="flex items-baseline gap-3 border-b border-paper3 pb-2 last:border-0">
                  <span className="font-mono text-xs text-ink3 w-6">{String(i + 1).padStart(2, '0')}</span>
                  <span className="font-display text-lg font-bold text-ink">{word.word}</span>
                  <span className="text-xs text-ink3 flex-1 truncate">{word.translations[0]?.translation}</span>
                  <span className="font-mono text-xs text-crimson">×{progress.wrongCount}</span>
                </li>
              ))}
            </ul>
            <Link to="/mistakes" className="btn-accent mt-5 w-full justify-center sm:w-auto">
              <Star size={14} /> 去错题本专攻
            </Link>
          </div>
        </section>
      )}

      {/* 主动产出 */}
      <section>
        <div className="divider">active output · 主动产出</div>
        <div className="paper-card flex flex-wrap items-baseline gap-3">
          <TrendingUp size={20} className="text-moss" />
          <div className="flex-1 min-w-0">
            <div className="font-display text-2xl font-bold text-ink">{sentenceCount} 句</div>
            <p className="text-xs text-ink3">累计用学过的词造句，每一句都是一次主动回忆。坚持下去，输出能力会和词汇量同步成长。</p>
          </div>
        </div>
      </section>

      {/* 下周建议 */}
      <section>
        <div className="divider">recommendation · 给下周</div>
        <div className="paper-card-dark space-y-3 text-paper">
          <p className="font-display text-base leading-relaxed">
            {totals.review < totals.learn && '本周复习量低于新词量 —— 下周建议把复习量提到新词的 3 倍以上，"学一遍不如复 3 遍"。'}
            {totals.accuracy < 70 && totals.accuracy > 0 && ' 准确率偏低，可以降低每日新词量，让记忆有时间沉淀。'}
            {topWrong.length > 0 && ` 优先解决 ${topWrong.slice(0, 3).map((x) => x.word.word).join(' / ')} 这几个反复出错的词。`}
            {streakDays >= 7 && ' 连续学满 7 天，节奏稳定，继续保持。'}
            {streakDays === 0 && ' 本周没有学习记录，从一个小目标开始：每天 5 个新词。'}
          </p>
        </div>
      </section>
    </div>
  );
}

function Kpi({ label, zh, value, unit, tone }: { label: string; zh: string; value: number; unit: string; tone?: boolean }) {
  return (
    <div className={cn('p-4 sm:p-6', tone ? 'bg-ink text-paper' : 'bg-paper text-ink')}>
      <div className={cn('font-mono text-[10px] uppercase tracking-[0.25em]', tone ? 'text-paper/60' : 'text-ink3')}>
        {label} · {zh}
      </div>
      <div className="mt-3 flex items-baseline gap-1.5">
        <span className="font-display text-3xl sm:text-5xl font-black tracking-tight">{value}</span>
        <span className={cn('font-mono text-xs', tone ? 'text-paper/60' : 'text-ink3')}>{unit}</span>
      </div>
    </div>
  );
}
