import { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { GRAMMAR_LESSONS } from '@/data/grammar-lessons';
import { grammarRepo } from '@/db/repositories/grammar';
import type { GrammarProgressRecord } from '@/db/types';
import { CheckCircle2, Lock, Play, Sparkles } from 'lucide-react';
import { cn } from '@/lib/utils';

export function Grammar() {
  const [progress, setProgress] = useState<Record<string, GrammarProgressRecord>>({});

  useEffect(() => {
    (async () => {
      const list = await grammarRepo.all();
      const map: Record<string, GrammarProgressRecord> = {};
      for (const p of list) map[p.lessonId] = p;
      // L1 默认解锁
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

  return (
    <div className="space-y-6">
      <div className="card flex items-center gap-4 bg-gradient-to-br from-sky-50 to-cream-50">
        <div className="grid h-14 w-14 place-items-center rounded-2xl bg-sky2-500 text-white shadow-soft">
          <Sparkles size={24} />
        </div>
        <div className="flex-1">
          <h2 className="text-lg font-bold">0 基础语法路线图</h2>
          <p className="text-sm text-ink-500">
            从 be 动词到从句，25 节通关式学习。已完成 <b className="text-warm-600">{completed} / {GRAMMAR_LESSONS.length}</b>
          </p>
        </div>
        <div className="text-2xl font-extrabold tracking-tight text-warm-600">
          {Math.round((completed / GRAMMAR_LESSONS.length) * 100)}%
        </div>
      </div>

      <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-3">
        {GRAMMAR_LESSONS.map((l, i) => {
          const st = statusOf(l.id, i);
          return (
            <Link
              key={l.id}
              to={st === 'locked' ? '#' : `/grammar/${l.id}`}
              onClick={(e) => st === 'locked' && e.preventDefault()}
              className={cn(
                'group relative overflow-hidden rounded-2xl border bg-white p-4 transition-all',
                st === 'locked' && 'cursor-not-allowed opacity-60',
                st !== 'locked' && 'hover:-translate-y-0.5 hover:shadow-soft',
                st === 'completed' && 'border-mint-400/60 bg-emerald-50/40',
                st === 'unlocked' && 'border-warm-300/60'
              )}
            >
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-2">
                  <span className="grid h-7 w-7 place-items-center rounded-lg bg-cream-100 text-xs font-bold text-ink-600">
                    L{l.index}
                  </span>
                  {st === 'completed' && <CheckCircle2 className="text-mint-500" size={18} />}
                  {st === 'locked' && <Lock className="text-ink-400" size={16} />}
                  {st === 'unlocked' && <Play className="text-warm-500" size={16} />}
                </div>
                {progress[l.id]?.status === 'completed' && (
                  <span className="text-xs font-semibold text-mint-500">{progress[l.id].score}/5</span>
                )}
              </div>
              <div className="mt-3">
                <div className="font-semibold text-ink-800">{l.title}</div>
                <div className="mt-0.5 text-xs text-ink-500">{l.subtitle}</div>
              </div>
            </Link>
          );
        })}
      </div>
    </div>
  );
}
