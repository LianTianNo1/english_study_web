import { useEffect, useMemo, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { LEVELS, type LevelId } from '@/db/types';
import { importLevel, isAnyImported } from '@/db/importer';
import { useSettings } from '@/stores/settingsStore';
import { db } from '@/db/schema';
import { ArrowRight, Check, CheckCircle2, RotateCw } from 'lucide-react';
import { cn } from '@/lib/utils';

interface ProgressMap {
  [k: string]: { loaded: number; total: number; done?: boolean; error?: string };
}

/** 用户来源判定：决定显示「首次欢迎」还是「Gist 同步后选词库」 */
type WelcomeMode =
  | { kind: 'loading' }
  | { kind: 'first' }
  | { kind: 'synced'; progressCount: number; mnemonicCount: number; activeLevel: LevelId };

export function Onboarding() {
  const navigate = useNavigate();
  const [mode, setMode] = useState<WelcomeMode>({ kind: 'loading' });
  const [selected, setSelected] = useState<Set<LevelId>>(new Set(['junior']));
  const [progress, setProgress] = useState<ProgressMap>({});
  const [running, setRunning] = useState(false);
  const setActiveLevel = useSettings((s) => s.setActiveLevel);

  useEffect(() => {
    (async () => {
      // 已有词库 → 直接回首页
      if (await isAnyImported()) {
        navigate('/', { replace: true });
        return;
      }
      // 判断是否"从 Gist 同步过来"——本地有进度但无词库
      const [progressCount, mnemonicCount, settingsRow] = await Promise.all([
        db.progress.count(),
        db.mnemonics.count(),
        db.settings.get('activeLevel'),
      ]);
      const activeLevel = ((settingsRow?.value as LevelId | undefined) ?? 'junior') as LevelId;
      if (progressCount > 0) {
        setMode({ kind: 'synced', progressCount, mnemonicCount, activeLevel });
        setSelected(new Set([activeLevel])); // 预选用户上次的 level
      } else {
        setMode({ kind: 'first' });
      }
    })();
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
      // custom 词库不走 sourceFile 拉取 —— 跳过
      if (lvl.id === 'custom' || !lvl.sourceFile) continue;
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

  if (mode.kind === 'loading') {
    return (
      <div className="flex min-h-screen items-center justify-center font-mono text-xs uppercase tracking-[0.3em] text-ink3">
        loading…
      </div>
    );
  }

  const isSynced = mode.kind === 'synced';
  const visibleLevels = LEVELS.filter((l) => l.id !== 'custom' || isSynced /* 同步过来的用户可能在云端有 custom，先不展示 */);

  return (
    <div className="mx-auto max-w-3xl px-4 py-10 sm:px-6 sm:py-16">
      <div className="font-mono text-[10px] uppercase tracking-[0.3em] text-ink3">
        {isSynced ? 'chapter zero · welcome back' : 'chapter zero · welcome'}
      </div>
      <h1 className="mt-4 font-display text-4xl font-black leading-none tracking-tight sm:text-5xl md:text-6xl">
        {isSynced ? (
          <>Almost <span className="doodle-underline italic text-persimmon">there</span>.</>
        ) : (
          <>Begin <span className="doodle-underline italic text-persimmon">here</span>.</>
        )}
      </h1>

      {isSynced ? (
        <>
          {/* Gist 同步后的引导横幅 */}
          <div className="mt-6 flex items-start gap-3 rounded-md border border-moss/40 bg-moss-50/60 p-4">
            <div className="grid h-10 w-10 shrink-0 place-items-center rounded-md bg-moss text-paper">
              <CheckCircle2 size={18} />
            </div>
            <div className="min-w-0 flex-1">
              <div className="font-display text-base font-bold text-ink">
                配置已从 Gist 同步成功 ✓
              </div>
              <div className="mt-1 text-sm text-ink2 leading-relaxed">
                已还原 <b className="text-moss-700">{mode.progressCount}</b> 条学习进度
                {mode.mnemonicCount > 0 && <> · <b className="text-moss-700">{mode.mnemonicCount}</b> 条 AI 巧记</>}
                。<br/>
                但 Gist 备份默认不含词库本体（体积大），<b>需要在本设备重新下载词库 JSON</b>，词库下载完毕你之前学过的进度会自动接上。
              </div>
              <div className="mt-2 font-mono text-[9px] uppercase tracking-wider text-ink3">
                ↓ 你上次用的是 <b className="text-ink">{LEVELS.find((l) => l.id === mode.activeLevel)?.name ?? mode.activeLevel}</b>，已自动勾选
              </div>
            </div>
          </div>
        </>
      ) : (
        <p className="mt-6 max-w-xl text-pretty text-ink2">
          欢迎打开你的私人英语学习手账。选择今天想随身携带的"词典分册"，它们会被保存在你浏览器的
          本地数据库里，永远离线可用。
        </p>
      )}

      <div className="divider mt-12">
        {isSynced ? 'step 01 · pick a wordbook to download' : 'step 01 · choose your books'}
      </div>

      <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
        {visibleLevels.filter((l) => l.id !== 'custom').map((l) => {
          const active = selected.has(l.id);
          const p = progress[l.id];
          const pct = p ? Math.round((p.loaded / Math.max(1, p.total)) * 100) : 0;
          const isLastUsed = isSynced && mode.activeLevel === l.id;
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
              {isLastUsed && (
                <div className="absolute right-0 top-0 rounded-bl-md bg-persimmon px-2 py-0.5 font-mono text-[9px] uppercase tracking-wider text-paper">
                  last used
                </div>
              )}
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

      <div className="mt-10 flex flex-col items-stretch gap-4 sm:flex-row sm:items-center sm:justify-between">
        <p className="font-mono text-[10px] uppercase tracking-[0.2em] text-ink3">
          total · {total.toLocaleString()} words · offline-first
        </p>
        <button onClick={startImport} disabled={selected.size === 0 || running} className="btn-accent w-full justify-center sm:w-auto">
          {running ? (
            <><RotateCw size={14} className="animate-spin" /> 正在导入…</>
          ) : isSynced ? (
            <>下载词库后接着学 <ArrowRight size={16} /></>
          ) : (
            <>开始导入 <ArrowRight size={16} /></>
          )}
        </button>
      </div>
    </div>
  );
}
