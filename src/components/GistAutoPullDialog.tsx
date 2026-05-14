import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { Cloud, CloudDownload, Loader2, X, AlertCircle, Check } from 'lucide-react';
import { useSettings } from '@/stores/settingsStore';
import { pullFromGist } from '@/lib/gist';
import { applyBackup, type ImportReport, type ImportStrategy } from '@/lib/backup';
import { isAnyImported } from '@/db/importer';
import { cn } from '@/lib/utils';

interface Props {
  gistId: string;
  token: string;
  onClose: () => void;
}

/**
 * 通过 URL 分享链接 (?gistId=&githubToken=) 打开后弹出的"自动同步"对话框。
 * 关键路径：
 *  1) 写入 gist 配置到本地（即使用户跳过同步也会留下配置）
 *  2) 用户选择拉取策略 (合并 / 替换) + 含 AI Key
 *  3) 调用 pullFromGist + applyBackup
 *  4) 完成后：若仍无词库则跳 onboarding，否则跳 Home
 */
export function GistAutoPullDialog({ gistId, token, onClose }: Props) {
  const navigate = useNavigate();
  const setGist = useSettings((s) => s.setGist);
  const loadSettings = useSettings((s) => s.load);
  const [strategy, setStrategy] = useState<ImportStrategy>('merge');
  const [applyAIConfig, setApplyAIConfig] = useState(false);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');
  const [report, setReport] = useState<ImportReport | null>(null);

  async function doPull() {
    if (busy) return;
    setBusy(true); setError('');
    try {
      // 1) 先把 gist 配置写入本地（保证 push 时也能用）
      await setGist({ gistId, token });
      // 2) 拉取
      const backup = await pullFromGist({ gistId, token, autoSync: false, includeAIConfig: false });
      // 3) replace 二次确认
      if (strategy === 'replace' && !confirm('替换模式将清空当前进度、会话与语法进度。确认继续？')) {
        setBusy(false);
        return;
      }
      const r = await applyBackup(backup, { strategy, applyAIConfig });
      // 4) 重载设置 store
      await loadSettings();
      await setGist({ gistId, token, lastSyncedAt: new Date().toISOString(), lastSyncStatus: 'ok' });
      setReport(r);
    } catch (e) {
      setError((e as Error).message);
    } finally {
      setBusy(false);
    }
  }

  async function finishAndExit() {
    // 拉取完成后：若仍无词库 → onboarding；否则关闭对话框停在当前页（用户已可学习）
    onClose();
    const has = await isAnyImported();
    if (!has) navigate('/onboarding', { replace: true });
  }

  function skipSync() {
    // 用户选择"仅保存配置稍后再说"：写入 gist 配置后让外层走原流程（onboarding）
    (async () => {
      await setGist({ gistId, token });
      onClose();
      const has = await isAnyImported();
      if (!has) navigate('/onboarding', { replace: true });
    })();
  }

  // ============ 拉取成功页 ============
  if (report) {
    return (
      <Backdrop>
        <Sheet>
          <div className="text-center">
            <div className="mx-auto grid h-14 w-14 place-items-center rounded-full bg-moss-50">
              <Check size={26} className="text-moss" />
            </div>
            <h2 className="mt-4 font-display text-2xl font-black tracking-tight">同步完成</h2>
            <p className="mt-2 text-sm text-ink2">
              从 Gist 还原了你的学习数据，可以直接接着学。
            </p>
          </div>

          <ul className="mt-5 grid grid-cols-2 gap-2 text-xs">
            <Stat label="学习进度" v={report.progress} />
            <Stat label="错题/星标" v={report.progress} hide />
            <Stat label="语法关卡" v={report.grammarProgress} />
            <Stat label="AI 巧记" v={report.mnemonics} />
            {report.wordRoots > 0 && <Stat label="词根关联" v={report.wordRoots} />}
            {report.userSentences > 0 && <Stat label="主动造句" v={report.userSentences} />}
            <Stat label="会话记录" v={report.sessions} />
            <Stat label="设置偏好" v={report.settings} />
          </ul>

          {report.skippedSettings.length > 0 && (
            <p className="mt-3 rounded-md border border-paper3 bg-paper2/40 p-2 text-[11px] text-ink3">
              跳过：{report.skippedSettings.join('、')}
            </p>
          )}

          <button onClick={finishAndExit} className="btn-accent mt-6 w-full justify-center">
            开始学习 →
          </button>
        </Sheet>
      </Backdrop>
    );
  }

  // ============ 询问 / 拉取页 ============
  return (
    <Backdrop>
      <Sheet>
        <button onClick={skipSync} aria-label="close" className="absolute right-3 top-3 text-ink3 hover:text-ink">
          <X size={16} />
        </button>

        <div className="flex items-center gap-3">
          <div className="grid h-12 w-12 shrink-0 place-items-center rounded-md bg-persimmon-50 text-persimmon-700">
            <Cloud size={22} />
          </div>
          <div className="min-w-0 flex-1">
            <div className="font-mono text-[10px] uppercase tracking-[0.25em] text-persimmon-700">cloud sync · auto detected</div>
            <h2 className="mt-1 font-display text-xl font-black tracking-tight text-ink">检测到 Gist 同步配置</h2>
          </div>
        </div>

        <p className="mt-3 text-sm leading-relaxed text-ink2">
          来自分享链接的同步配置，是否立即拉取云端学习数据？拉到本地后可以直接继续学习，无需重新导入词库。
        </p>

        <div className="mt-4 rounded-md border border-paper3 bg-paper2/40 p-3">
          <div className="flex items-baseline justify-between gap-2 text-xs">
            <span className="font-mono text-[10px] uppercase tracking-wider text-ink3">gist id</span>
            <code className="truncate font-mono text-ink2">{gistId}</code>
          </div>
        </div>

        {/* 拉取策略 */}
        <div className="mt-4 space-y-2">
          <div className="font-mono text-[10px] uppercase tracking-[0.25em] text-ink3">拉取策略</div>
          <label className={cn(
            'flex cursor-pointer items-start gap-2.5 rounded-md border p-2.5 transition',
            strategy === 'merge' ? 'border-ink bg-paper' : 'border-paper3 bg-paper2/40 hover:border-ink'
          )}>
            <input type="radio" className="mt-0.5" checked={strategy === 'merge'} onChange={() => setStrategy('merge')} />
            <div className="min-w-0 flex-1">
              <div className="font-display text-sm font-bold text-ink">合并（推荐）</div>
              <div className="text-xs text-ink3">保留本设备已有进度，按 wordId / lessonId 去重更新。本机的造句、错题会保留。</div>
            </div>
          </label>
          <label className={cn(
            'flex cursor-pointer items-start gap-2.5 rounded-md border p-2.5 transition',
            strategy === 'replace' ? 'border-crimson bg-crimson-50/40' : 'border-paper3 bg-paper2/40 hover:border-ink'
          )}>
            <input type="radio" className="mt-0.5" checked={strategy === 'replace'} onChange={() => setStrategy('replace')} />
            <div className="min-w-0 flex-1">
              <div className="font-display text-sm font-bold text-ink">替换 <span className="text-crimson">（危险）</span></div>
              <div className="text-xs text-ink3">清空本设备的进度/错题/会话/造句后再导入，常用于"全新设备一比一还原"。</div>
            </div>
          </label>
        </div>

        <label className="mt-3 flex cursor-pointer items-start gap-2 text-xs text-ink2">
          <input
            type="checkbox"
            className="mt-0.5"
            checked={applyAIConfig}
            onChange={(e) => setApplyAIConfig(e.target.checked)}
          />
          <span>
            含 AI 配置（API Key）—— <span className="text-ink3">仅当备份中显式包含且你信任这个分享链接来源时勾选</span>
          </span>
        </label>

        {error && (
          <div className="mt-3 flex items-start gap-2 rounded-md border border-crimson bg-crimson-50 p-2.5 text-xs text-crimson">
            <AlertCircle size={12} className="mt-0.5 shrink-0" />
            <span className="whitespace-pre-line">{error}</span>
          </div>
        )}

        <div className="mt-5 flex flex-col gap-2 sm:flex-row">
          <button onClick={skipSync} disabled={busy} className="btn-ghost w-full justify-center sm:w-auto">
            稍后再说
          </button>
          <button onClick={doPull} disabled={busy} className="btn-accent flex-1 justify-center">
            {busy
              ? <><Loader2 size={14} className="animate-spin" /> 正在拉取…</>
              : <><CloudDownload size={14} /> 立即拉取并{strategy === 'merge' ? '合并' : '替换'}</>}
          </button>
        </div>
      </Sheet>
    </Backdrop>
  );
}

function Backdrop({ children }: { children: React.ReactNode }) {
  return (
    <div className="fixed inset-0 z-50 flex items-end justify-center p-0 sm:items-center sm:p-4" role="dialog" aria-modal="true">
      <div className="absolute inset-0 bg-ink/40 backdrop-blur-[2px]" />
      {children}
    </div>
  );
}

function Sheet({ children }: { children: React.ReactNode }) {
  return (
    <div
      className="relative w-full max-w-md overflow-y-auto rounded-t-2xl border border-paper3 bg-paper p-5 shadow-paper animate-fade-up sm:rounded-lg"
      style={{ maxHeight: 'calc(100vh - 1rem)', paddingBottom: 'max(1.25rem, env(safe-area-inset-bottom))' }}
    >
      {children}
    </div>
  );
}

function Stat({ label, v, hide }: { label: string; v: number; hide?: boolean }) {
  if (hide) return null;
  return (
    <div className="flex items-baseline justify-between rounded-sm border border-paper3 bg-paper2/40 px-2 py-1.5">
      <span className="font-mono text-[10px] uppercase tracking-wider text-ink3">{label}</span>
      <span className="font-display text-base font-bold text-ink">{v}</span>
    </div>
  );
}
