import { useEffect, useMemo, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { LEVELS, type LevelId } from '@/db/types';
import { importLevel, isAnyImported } from '@/db/importer';
import { useSettings } from '@/stores/settingsStore';
import { CheckCircle2, Download, Sparkles } from 'lucide-react';
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
          onProgress: (loaded, total) =>
            setProgress((p) => ({ ...p, [lvl.id]: { loaded, total } })),
        });
        setProgress((p) => ({
          ...p,
          [lvl.id]: { ...(p[lvl.id] ?? { loaded: 0, total: 0 }), done: true },
        }));
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
    <div className="mx-auto max-w-3xl px-6 py-12">
      <div className="mb-8 flex items-center gap-3">
        <div className="grid h-12 w-12 place-items-center rounded-2xl bg-warm-500 text-2xl font-extrabold text-white shadow-soft">E</div>
        <div>
          <h1 className="text-2xl font-bold tracking-tight">欢迎使用 English Hub</h1>
          <p className="text-sm text-ink-600">从你的 0 基础开始，逐级征服词汇与语法 ✨</p>
        </div>
      </div>

      <div className="card mb-6">
        <h2 className="mb-1 text-lg font-semibold">第 1 步 · 选择要导入的词库</h2>
        <p className="mb-4 text-sm text-ink-600">
          建议 0 基础先从【初中】开始，其他词库随时可在设置里追加导入。共选 <b className="text-warm-600">{total.toLocaleString()}</b> 个词条。
        </p>
        <div className="grid grid-cols-2 gap-3 sm:grid-cols-3">
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
                  'group relative overflow-hidden rounded-2xl border p-4 text-left transition-all',
                  active
                    ? 'border-warm-400 bg-warm-50 ring-2 ring-warm-300'
                    : 'border-ink-200 bg-white hover:border-warm-300'
                )}
              >
                <div className="flex items-start justify-between">
                  <div>
                    <div className="text-sm font-semibold text-ink-800">{l.name}</div>
                    <div className="mt-0.5 text-xs text-ink-400">{l.totalEstimate.toLocaleString()} 词</div>
                  </div>
                  {p?.done ? (
                    <CheckCircle2 className="text-mint-500" size={20} />
                  ) : active ? (
                    <span className="grid h-5 w-5 place-items-center rounded-full bg-warm-500 text-[10px] font-bold text-white">✓</span>
                  ) : null}
                </div>
                {p && !p.done && (
                  <div className="mt-3">
                    <div className="h-1.5 w-full overflow-hidden rounded-full bg-cream-200">
                      <div
                        className="h-full bg-warm-500 transition-all"
                        style={{ width: `${pct}%` }}
                      />
                    </div>
                    <div className="mt-1 text-[10px] text-ink-400">{pct}%</div>
                  </div>
                )}
                {p?.error && <div className="mt-2 text-[10px] text-red-500">{p.error}</div>}
              </button>
            );
          })}
        </div>
      </div>

      <div className="flex items-center justify-between">
        <p className="text-xs text-ink-400 flex items-center gap-1.5">
          <Sparkles size={14} className="text-warm-400" />
          数据全部保存在本地浏览器（IndexedDB），离线可用
        </p>
        <button
          onClick={startImport}
          disabled={selected.size === 0 || running}
          className="btn-primary"
        >
          <Download size={16} />
          {running ? '正在导入…' : '开始导入'}
        </button>
      </div>
    </div>
  );
}
