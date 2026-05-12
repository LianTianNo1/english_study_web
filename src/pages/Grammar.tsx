import { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { GRAMMAR_LESSONS } from '@/data/grammar-lessons';
import { grammarRepo } from '@/db/repositories/grammar';
import type { GrammarProgressRecord } from '@/db/types';
import { CheckCircle2, Lock, Play } from 'lucide-react';
import { cn } from '@/lib/utils';

export function Grammar() {
  const [progress, setProgress] = useState<Record<string, GrammarProgressRecord>>({});

  useEffect(() => {
    (async () => {
      const list = await grammarRepo.all();
      const map: Record<string, GrammarProgressRecord> = {};
      for (const p of list) map[p.lessonId] = p;
      if (!map['l01-be-verb']) {
        await grammarRepo.unlock('l01-be-verb');
        map['l01-be-verb'] = { lessonId: 'l01-be-verb', status: 'unlocked', score: 0, completedAt: 0 };
      }
      setProgress(map);
    })();
  }, []);

  function statusOf(lessonId: string, index: number) {
    if (progress[lessonId]?.status === 'completed') return 'completed' as const;
    if (progress[lessonId]?.status === 'unlocked') return 'unlocked' as const;
    if (index === 0) return 'unlocked' as const;
    const prevId = GRAMMAR_LESSONS[index - 1]?.id;
    if (prevId && progress[prevId]?.status === 'completed') return 'unlocked' as const;
    return 'locked' as const;
  }

  const completed = Object.values(progress).filter((p) => p.status === 'completed').length;
  const pct = Math.round((completed / GRAMMAR_LESSONS.length) * 100);

  return (
    <div className="space-y-10">
      <section>
        <div className="font-mono text-[10px] uppercase tracking-[0.3em] text-ink3">chapter 03 · grammar</div>
        <h1 className="mt-2 font-display text-5xl font-black tracking-tight md:text-6xl">
          The <span className="italic text-indigo2-500">Pathway</span>
        </h1>
        <p className="mt-4 max-w-2xl text-pretty text-ink2">
          25 节循序渐进的语法关卡，从 be 动词到从句。<b>不是堆术语，</b>而是让你
          先看例句、再猜规律，最后才点明公式。每节通关 ≥ 4/5 解锁下一节。
        </p>
        <div className="mt-6 flex items-baseline gap-4">
          <div className="flex-1 meter-track !h-2">
            <div className="meter-bar bg-indigo2-500" style={{ width: `${pct}%` }} />
          </div>
          <span className="font-display text-3xl font-black tracking-tight">{pct}<span className="text-base text-ink3">%</span></span>
          <span className="font-mono text-[10px] uppercase tracking-wider text-ink3">{completed}/{GRAMMAR_LESSONS.length}</span>
        </div>
      </section>

      <section className="grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-3">
        {GRAMMAR_LESSONS.map((l, i) => {
          const st = statusOf(l.id, i);
          return (
            <Link
              key={l.id}
              to={st === 'locked' ? '#' : `/grammar/${l.id}`}
              onClick={(e) => st === 'locked' && e.preventDefault()}
              className={cn(
                'group relative flex flex-col gap-3 overflow-hidden rounded-lg border bg-paper p-5 transition-all',
                st === 'locked' && 'cursor-not-allowed opacity-50',
                st !== 'locked' && 'hover:-translate-y-1 hover:border-ink',
                st === 'completed' && 'border-moss bg-moss-50/40',
                st === 'unlocked' && 'border-paper3'
              )}
            >
              <div className="flex items-start justify-between">
                <div className="chapter-num text-5xl">
                  {String(l.index).padStart(2, '0')}
                </div>
                {st === 'completed' && <CheckCircle2 className="text-moss" size={18} />}
                {st === 'locked' && <Lock className="text-ink3" size={16} />}
                {st === 'unlocked' && <Play className="text-persimmon" size={16} />}
              </div>
              <div>
                <div className="font-display text-lg font-bold text-ink">{l.title}</div>
                <div className="mt-0.5 text-xs text-ink3">{l.subtitle}</div>
              </div>
              {progress[l.id]?.status === 'completed' && (
                <div className="font-mono text-[10px] uppercase tracking-wider text-moss-700">
                  score · {progress[l.id].score}/{l.exercises.length}
                </div>
              )}
            </Link>
          );
        })}
      </section>
    </div>
  );
}
