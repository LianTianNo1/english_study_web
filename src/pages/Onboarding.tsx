import { useEffect, useMemo, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { LEVELS, type LevelId } from '@/db/types';
import { importLevel, isAnyImported } from '@/db/importer';
import { useSettings } from '@/stores/settingsStore';
import { ArrowRight, Check } from 'lucide-react';
import { cn } from '@/lib/utils';

interface ProgressMap {
  [k: string]: { loaded: number; total: number; done?: boolean; error?: string };
}

export function Onboarding() {
  const navigate = useNavigate();
  const [selected, setSelected] = useState<Set<LevelId>>(new Set(['junior']));
  const [progress, setProgress] = useState<ProgressMap>({});
  const [running, setRunning] = useState(false);
  const setActiveLevel = useSettings((s) => s.setActiveLevel);

  useEffect(() => {
    isAnyImported().then((ok) => {
      if (ok) navigate('/', { replace: true });
    });
  }, [navigate]);

  const total = useMemo(
    () => LEVELS.filter((l) => selected.has(l.id)).reduce((a, l) => a + l.totalEstimate, 0),
    [selected]
  );

  function toggle(id: LevelId) {
    const s = new Set(selected);
    if (s.has(id)) s.delete(id);
    else s.add(id);
    setSelected(s);
  }

  async function startImport() {
    if (selected.size === 0 || running) return;
    setRunning(true);
    const first = LEVELS.find((l) => selected.has(l.id))!;
    for (const lvl of LEVELS.filter((l) => selected.has(l.id))) {
      setProgress((p) => ({ ...p, [lvl.id]: { loaded: 0, total: lvl.totalEstimate } }));
      try {
        await importLevel({
          levelId: lvl.id,
          sourceFile: lvl.sourceFile,
          onProgress: (loaded, total) => setProgress((p) => ({ ...p, [lvl.id]: { loaded, total } })),
        });
        setProgress((p) => ({ ...p, [lvl.id]: { ...(p[lvl.id] ?? { loaded: 0, total: 0 }), done: true } }));
      } catch (e) {
        setProgress((p) => ({
          ...p,
          [lvl.id]: { ...(p[lvl.id] ?? { loaded: 0, total: 0 }), error: (e as Error).message },
        }));
      }
    }
    await setActiveLevel(first.id);
    setRunning(false);
    setTimeout(() => navigate('/', { replace: true }), 600);
  }

  return (
    <div className="mx-auto max-w-3xl px-6 py-16">
      <div className="font-mono text-[10px] uppercase tracking-[0.3em] text-ink3">
        chapter zero · welcome
      </div>
      <h1 className="mt-4 font-display text-5xl font-black leading-none tracking-tight md:text-6xl">
        Begin <span className="doodle-underline italic text-persimmon">here</span>.
      </h1>
      <p className="mt-6 max-w-xl text-pretty text-ink2">
        欢迎打开你的私人英语学习手账。选择今天想随身携带的"词典分册"，它们会被保存在你浏览器的
        本地数据库里，永远离线可用。
      </p>

      <div className="divider mt-12">step 01 · choose your books</div>

      <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
        {LEVELS.map((l) => {
          const active = selected.has(l.id);
          const p = progress[l.id];
          const pct = p ? Math.round((p.loaded / Math.max(1, p.total)) * 100) : 0;
          return (
            <button
              key={l.id}
              onClick={() => !running && toggle(l.id)}
              disabled={running}
              className={cn(
                'group relative overflow-hidden rounded-md border bg-paper p-4 text-left transition-all',
                active && !p?.done && 'border-ink shadow-ink',
                p?.done && 'border-moss bg-moss-50',
                !active && !p?.done && 'border-paper3 hover:border-ink'
              )}
            >
              <div className="flex items-start justify-between">
                <div>
                  <div className="font-mono text-[10px] uppercase tracking-wider text-ink3">vol · {l.id}</div>
                  <div className="mt-1 font-display text-2xl font-bold text-ink">{l.name}</div>
                  <div className="mt-0.5 text-xs text-ink3">{l.totalEstimate.toLocaleString()} entries</div>
                </div>
                {p?.done ? (
                  <Check className="text-moss" size={20} />
                ) : active ? (
                  <div className="grid h-6 w-6 place-items-center rounded-full bg-ink text-paper">
                    <Check size={12} />
                  </div>
                ) : null}
              </div>
              {p && !p.done && !p.error && (
                <div className="mt-3">
                  <div className="meter-track">
                    <div className="meter-bar bg-persimmon" style={{ width: `${pct}%` }} />
                  </div>
                  <div className="mt-1 font-mono text-[10px] text-ink3">{pct}%</div>
                </div>
              )}
              {p?.error && <div className="mt-2 font-mono text-[10px] text-crimson">{p.error}</div>}
            </button>
          );
        })}
      </div>

      <div className="mt-10 flex items-center justify-between">
        <p className="font-mono text-[10px] uppercase tracking-[0.2em] text-ink3">
          total · {total.toLocaleString()} words · offline-first
        </p>
        <button onClick={startImport} disabled={selected.size === 0 || running} className="btn-accent">
          {running ? '正在导入…' : '开始导入'} <ArrowRight size={16} />
        </button>
      </div>
    </div>
  );
}
