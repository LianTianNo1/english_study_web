import { useEffect, useState } from 'react';
import { LEVELS } from '@/db/types';
import { sessionsRepo } from '@/db/repositories/sessions';
import { progressRepo } from '@/db/repositories/progress';
import { wordsRepo } from '@/db/repositories/words';
import { cn, todayKey, addDays } from '@/lib/utils';

interface LevelStat {
  id: string;
  name: string;
  total: number;
  learned: number;
  mastered: number;
}

export function Stats() {
  const [today, setToday] = useState({ learn: 0, review: 0, grammar: 0 });
  const [heatmap, setHeatmap] = useState<Record<string, number>>({});
  const [levelStats, setLevelStats] = useState<LevelStat[]>([]);
  const [streak, setStreak] = useState(0);

  useEffect(() => {
    (async () => {
      const ts = await sessionsRepo.todayStats();
      setToday({ learn: ts.learn.words, review: ts.review.words, grammar: ts.grammar.words });
      const map = await sessionsRepo.heatmap(180);
      setHeatmap(map);

      // 计算连续打卡
      let s = 0;
      for (let i = 0; i < 365; i++) {
        const k = todayKey(addDays(new Date(), -i));
        if ((map[k] ?? 0) > 0) s++;
        else if (i > 0) break;
      }
      setStreak(s);

      const stats: LevelStat[] = [];
      for (const l of LEVELS) {
        const total = await wordsRepo.countByLevel(l.id);
        if (total === 0) continue;
        const learned =
          (await progressRepo.countByLevelAndStatus(l.id, 'learning')) +
          (await progressRepo.countByLevelAndStatus(l.id, 'review')) +
          (await progressRepo.countByLevelAndStatus(l.id, 'mastered'));
        const mastered = await progressRepo.countByLevelAndStatus(l.id, 'mastered');
        stats.push({ id: l.id, name: l.name, total, learned, mastered });
      }
      setLevelStats(stats);
    })();
  }, []);

  const days: { key: string; count: number }[] = [];
  const start = addDays(new Date(), -180);
  for (let i = 0; i <= 180; i++) {
    const d = addDays(start, i);
    const key = todayKey(d);
    days.push({ key, count: heatmap[key] ?? 0 });
  }

  return (
    <div className="space-y-12">
      <header>
        <div className="font-mono text-[10px] uppercase tracking-[0.3em] text-ink3">chapter 05 · ledger</div>
        <h1 className="mt-2 font-display text-5xl font-black tracking-tight md:text-6xl">
          The <span className="italic text-persimmon">Ledger</span>
        </h1>
      </header>

      <section className="grid gap-px overflow-hidden rounded-md border border-paper3 bg-paper3 md:grid-cols-4">
        <BigCell label="streak" zh="连续打卡" value={streak} unit="days" tone />
        <BigCell label="today new" zh="今日新词" value={today.learn} unit="words" />
        <BigCell label="today review" zh="今日复习" value={today.review} unit="words" />
        <BigCell label="grammar" zh="今日语法" value={today.grammar} unit="lessons" />
      </section>

      <section>
        <div className="divider">heatmap · 180 days</div>
        <div className="paper-card">
          <div className="flex flex-wrap gap-1">
            {days.map((d) => (
              <div
                key={d.key}
                title={`${d.key} · ${d.count} words`}
                className={cn(
                  'h-3.5 w-3.5 rounded-sm',
                  d.count === 0 && 'bg-paper2',
                  d.count > 0 && d.count < 10 && 'bg-persimmon-100',
                  d.count >= 10 && d.count < 30 && 'bg-persimmon-300',
                  d.count >= 30 && d.count < 60 && 'bg-persimmon-500',
                  d.count >= 60 && 'bg-persimmon-700'
                )}
              />
            ))}
          </div>
          <div className="mt-3 flex items-center gap-1.5 font-mono text-[10px] uppercase tracking-wider text-ink3">
            less
            <div className="h-3 w-3 rounded-sm bg-paper2" />
            <div className="h-3 w-3 rounded-sm bg-persimmon-100" />
            <div className="h-3 w-3 rounded-sm bg-persimmon-300" />
            <div className="h-3 w-3 rounded-sm bg-persimmon-500" />
            <div className="h-3 w-3 rounded-sm bg-persimmon-700" />
            more
          </div>
        </div>
      </section>

      <section>
        <div className="divider">mastery · 词库掌握度</div>
        <div className="paper-card">
          {levelStats.length === 0 ? (
            <p className="text-sm text-ink3">还没有学习记录。从首页开始吧 →</p>
          ) : (
            <div className="space-y-4">
              {levelStats.map((s) => {
                const pct = Math.round((s.learned / s.total) * 100);
                const mpct = Math.round((s.mastered / s.total) * 100);
                return (
                  <div key={s.id}>
                    <div className="mb-1 flex items-baseline justify-between text-sm">
                      <span className="font-display text-base font-semibold text-ink">{s.name}</span>
                      <span className="font-mono text-xs text-ink3">
                        {s.learned}/{s.total} · {pct}%  <span className="text-moss">mastered {s.mastered}</span>
                      </span>
                    </div>
                    <div className="relative h-2 w-full overflow-hidden rounded-full bg-paper3">
                      <div className="absolute left-0 top-0 h-full bg-persimmon-300" style={{ width: `${pct}%` }} />
                      <div className="absolute left-0 top-0 h-full bg-moss" style={{ width: `${mpct}%` }} />
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </div>
      </section>
    </div>
  );
}

function BigCell({ label, zh, value, unit, tone }: { label: string; zh: string; value: number; unit: string; tone?: boolean }) {
  return (
    <div className={cn('p-6', tone ? 'bg-ink text-paper' : 'bg-paper text-ink')}>
      <div className={cn('font-mono text-[10px] uppercase tracking-[0.25em]', tone ? 'text-paper/60' : 'text-ink3')}>
        {label} · {zh}
      </div>
      <div className="mt-3 flex items-baseline gap-1.5">
        <span className="font-display text-5xl font-black tracking-tight">{value}</span>
        <span className={cn('font-mono text-xs', tone ? 'text-paper/60' : 'text-ink3')}>{unit}</span>
      </div>
    </div>
  );
}
