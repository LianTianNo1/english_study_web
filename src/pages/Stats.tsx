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

  useEffect(() => {
    (async () => {
      const ts = await sessionsRepo.todayStats();
      setToday({ learn: ts.learn.words, review: ts.review.words, grammar: ts.grammar.words });
      setHeatmap(await sessionsRepo.heatmap(90));

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

  // 生成 91 天热力图
  const days: { key: string; count: number }[] = [];
  const start = addDays(new Date(), -90);
  for (let i = 0; i <= 90; i++) {
    const d = addDays(start, i);
    const key = todayKey(d);
    days.push({ key, count: heatmap[key] ?? 0 });
  }

  return (
    <div className="space-y-6">
      <h1 className="text-2xl font-bold tracking-tight">学习统计</h1>

      <div className="grid gap-4 md:grid-cols-3">
        <Tile label="今日新学" value={today.learn} unit="词" tone="warm" />
        <Tile label="今日复习" value={today.review} unit="词" tone="mint" />
        <Tile label="今日语法" value={today.grammar} unit="节" tone="sky" />
      </div>

      <section className="card">
        <h2 className="mb-3 text-base font-semibold">90 天学习热力图</h2>
        <div className="flex flex-wrap gap-1">
          {days.map((d) => (
            <div
              key={d.key}
              title={`${d.key} · ${d.count} 词`}
              className={cn(
                'h-3.5 w-3.5 rounded-sm',
                d.count === 0 && 'bg-cream-200',
                d.count > 0 && d.count < 10 && 'bg-warm-200',
                d.count >= 10 && d.count < 30 && 'bg-warm-300',
                d.count >= 30 && d.count < 60 && 'bg-warm-400',
                d.count >= 60 && 'bg-warm-500'
              )}
            />
          ))}
        </div>
      </section>

      <section className="card">
        <h2 className="mb-3 text-base font-semibold">词库掌握度</h2>
        {levelStats.length === 0 ? (
          <p className="text-sm text-ink-500">还没有学习记录。去 "学新词" 开始吧 🌱</p>
        ) : (
          <div className="space-y-3">
            {levelStats.map((s) => {
              const pct = Math.round((s.learned / s.total) * 100);
              const mpct = Math.round((s.mastered / s.total) * 100);
              return (
                <div key={s.id}>
                  <div className="mb-1 flex items-center justify-between text-sm">
                    <span className="font-medium">{s.name}</span>
                    <span className="text-ink-500">
                      已学 {s.learned} / {s.total}（已掌握 {s.mastered}）
                    </span>
                  </div>
                  <div className="relative h-2 w-full overflow-hidden rounded-full bg-cream-200">
                    <div className="absolute left-0 top-0 h-full bg-warm-400" style={{ width: `${pct}%` }} />
                    <div className="absolute left-0 top-0 h-full bg-mint-500" style={{ width: `${mpct}%` }} />
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </section>
    </div>
  );
}

function Tile({ label, value, unit, tone }: { label: string; value: number; unit: string; tone: 'warm' | 'mint' | 'sky' }) {
  const cls =
    tone === 'warm' ? 'text-warm-600' : tone === 'mint' ? 'text-mint-500' : 'text-sky2-500';
  return (
    <div className="card">
      <div className="text-xs text-ink-500">{label}</div>
      <div className={cn('mt-1 text-3xl font-extrabold tracking-tight', cls)}>
        {value} <span className="text-base font-normal text-ink-400">{unit}</span>
      </div>
    </div>
  );
}
