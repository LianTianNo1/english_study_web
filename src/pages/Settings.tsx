import { useEffect, useState } from 'react';
import { LEVELS, type LevelId } from '@/db/types';
import { useSettings } from '@/stores/settingsStore';
import { db } from '@/db/schema';
import { getLevelCount, importLevel, isLevelImported } from '@/db/importer';
import { Download, RefreshCw, Trash2 } from 'lucide-react';
import { cn } from '@/lib/utils';

export function Settings() {
  const { activeLevel, dailyNewWords, dailyReviewLimit, setActiveLevel, setDailyNewWords, setDailyReviewLimit, load, loaded } = useSettings();
  const [counts, setCounts] = useState<Record<string, number>>({});
  const [importing, setImporting] = useState<LevelId | null>(null);
  const [progress, setProgress] = useState(0);

  useEffect(() => {
    if (!loaded) load();
  }, [loaded, load]);

  useEffect(() => {
    (async () => {
      const m: Record<string, number> = {};
      for (const l of LEVELS) m[l.id] = await getLevelCount(l.id);
      setCounts(m);
    })();
  }, [importing]);

  async function importOne(l: typeof LEVELS[number]) {
    if (importing) return;
    setImporting(l.id);
    setProgress(0);
    await importLevel({
      levelId: l.id,
      sourceFile: l.sourceFile,
      onProgress: (loaded, total) => setProgress(Math.round((loaded / total) * 100)),
    });
    setImporting(null);
  }

  async function exportBackup() {
    const data = {
      words: await db.words.toArray(),
      progress: await db.progress.toArray(),
      sessions: await db.sessions.toArray(),
      grammarProgress: await db.grammarProgress.toArray(),
      settings: await db.settings.toArray(),
      exportedAt: new Date().toISOString(),
    };
    const blob = new Blob([JSON.stringify(data)], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `english-hub-backup-${Date.now()}.json`;
    a.click();
    URL.revokeObjectURL(url);
  }

  async function resetAll() {
    if (!confirm('确认重置？所有词库与学习进度将被清除。')) return;
    await db.delete();
    location.href = '/onboarding';
  }

  if (!loaded) return null;

  return (
    <div className="space-y-6">
      <h1 className="text-2xl font-bold tracking-tight">设置</h1>

      <section className="card">
        <h2 className="mb-3 text-base font-semibold">学习偏好</h2>
        <div className="space-y-4">
          <div>
            <label className="mb-1 block text-sm text-ink-600">当前词库</label>
            <div className="flex flex-wrap gap-2">
              {LEVELS.filter((l) => (counts[l.id] ?? 0) > 0).map((l) => (
                <button
                  key={l.id}
                  onClick={() => setActiveLevel(l.id)}
                  className={cn(
                    'rounded-full px-4 py-1.5 text-sm font-medium transition',
                    activeLevel === l.id ? 'bg-warm-500 text-white shadow-soft' : 'bg-cream-100 text-ink-600 hover:bg-cream-200'
                  )}
                >
                  {l.name}
                </button>
              ))}
            </div>
          </div>
          <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
            <NumField label="每日新词目标" value={dailyNewWords} onChange={setDailyNewWords} min={5} max={100} />
            <NumField label="每日复习上限" value={dailyReviewLimit} onChange={setDailyReviewLimit} min={10} max={500} />
          </div>
        </div>
      </section>

      <section className="card">
        <h2 className="mb-3 text-base font-semibold">词库管理</h2>
        <div className="grid grid-cols-1 gap-2">
          {LEVELS.map((l) => {
            const imported = (counts[l.id] ?? 0) > 0;
            const isImporting = importing === l.id;
            return (
              <div key={l.id} className="flex items-center justify-between rounded-2xl bg-cream-50 px-4 py-3">
                <div>
                  <div className="text-sm font-semibold">{l.name}</div>
                  <div className="text-xs text-ink-400">
                    {imported ? `已导入 ${counts[l.id].toLocaleString()} 词` : `${l.totalEstimate.toLocaleString()} 词 · 未导入`}
                  </div>
                </div>
                {isImporting ? (
                  <div className="text-xs text-warm-600">{progress}%</div>
                ) : (
                  <button onClick={() => importOne(l)} className={cn('btn', imported ? 'btn-secondary' : 'btn-primary')}>
                    {imported ? <><RefreshCw size={14} /> 重新导入</> : <><Download size={14} /> 导入</>}
                  </button>
                )}
              </div>
            );
          })}
        </div>
      </section>

      <section className="card">
        <h2 className="mb-3 text-base font-semibold">数据管理</h2>
        <div className="flex flex-wrap gap-2">
          <button onClick={exportBackup} className="btn-secondary"><Download size={16} /> 导出备份</button>
          <button onClick={resetAll} className="btn bg-red-50 text-red-600 hover:bg-red-100">
            <Trash2 size={16} /> 重置所有数据
          </button>
        </div>
        <p className="mt-3 text-xs text-ink-400">数据保存在浏览器 IndexedDB。换浏览器/清缓存会丢失，建议定期导出备份。</p>
      </section>

      <section className="card">
        <h2 className="mb-2 text-base font-semibold">关于</h2>
        <p className="text-sm text-ink-500">
          English Hub · 0 基础英语学习工具。词库源自本地 JSON，全部离线运行。
        </p>
      </section>
    </div>
  );
}

function NumField(props: { label: string; value: number; onChange: (n: number) => void; min: number; max: number }) {
  return (
    <div>
      <label className="mb-1 block text-sm text-ink-600">{props.label}</label>
      <input
        type="number"
        className="input"
        value={props.value}
        min={props.min}
        max={props.max}
        onChange={(e) => {
          const n = Number(e.target.value);
          if (!Number.isNaN(n)) props.onChange(Math.max(props.min, Math.min(props.max, n)));
        }}
      />
    </div>
  );
}
