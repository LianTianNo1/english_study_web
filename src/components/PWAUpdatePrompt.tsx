import { useEffect, useState } from 'react';
import { Download, RefreshCw, X } from 'lucide-react';
import { useRegisterSW } from 'virtual:pwa-register/react';

/**
 * PWA 双提示：
 *  - 离线就绪 一次性 toast（首次安装 SW 完成时）
 *  - 新版本可用 toast（autoUpdate 模式，点击立即更新）
 *  - "添加到主屏幕" 安装按钮（仅未安装时显示，Edge/Chrome 支持 beforeinstallprompt）
 */
export function PWAUpdatePrompt() {
  const {
    offlineReady: [offlineReady, setOfflineReady],
    needRefresh: [needRefresh, setNeedRefresh],
    updateServiceWorker,
  } = useRegisterSW({
    onRegisteredSW(swUrl) {
      if (import.meta.env.DEV) console.info('[pwa] SW registered:', swUrl);
    },
    onRegisterError(err) {
      console.warn('[pwa] SW register error:', err);
    },
  });

  // 浏览器原生安装提示拦截
  const [installEvt, setInstallEvt] = useState<BeforeInstallPromptEvent | null>(null);
  const [showInstall, setShowInstall] = useState(false);

  useEffect(() => {
    function onBeforeInstall(e: Event) {
      e.preventDefault();
      setInstallEvt(e as BeforeInstallPromptEvent);
      // 仅在用户未关闭过提示时显示
      const dismissed = localStorage.getItem('pwa-install-dismissed');
      if (!dismissed) setShowInstall(true);
    }
    function onInstalled() {
      setInstallEvt(null);
      setShowInstall(false);
      localStorage.setItem('pwa-install-dismissed', '1');
    }
    window.addEventListener('beforeinstallprompt', onBeforeInstall);
    window.addEventListener('appinstalled', onInstalled);
    return () => {
      window.removeEventListener('beforeinstallprompt', onBeforeInstall);
      window.removeEventListener('appinstalled', onInstalled);
    };
  }, []);

  async function triggerInstall() {
    if (!installEvt) return;
    try {
      await installEvt.prompt();
      const choice = await installEvt.userChoice;
      if (choice.outcome === 'accepted') {
        setShowInstall(false);
      } else {
        localStorage.setItem('pwa-install-dismissed', String(Date.now()));
        setShowInstall(false);
      }
    } catch { /* noop */ }
  }

  function dismissInstall() {
    localStorage.setItem('pwa-install-dismissed', String(Date.now()));
    setShowInstall(false);
  }

  if (!offlineReady && !needRefresh && !showInstall) return null;

  return (
    <div className="fixed bottom-20 right-3 z-40 flex flex-col gap-2 md:bottom-4 md:right-4" role="status">
      {/* 新版本提示 */}
      {needRefresh && (
        <div className="flex w-72 items-start gap-3 rounded-md border border-persimmon bg-paper p-3 shadow-paper animate-fade-up">
          <RefreshCw size={16} className="mt-0.5 shrink-0 text-persimmon" />
          <div className="min-w-0 flex-1">
            <div className="font-display text-sm font-bold text-ink">应用有更新</div>
            <p className="mt-0.5 text-xs text-ink3">点击刷新加载最新版本。</p>
            <div className="mt-2 flex gap-2">
              <button onClick={() => updateServiceWorker(true)} className="btn-accent text-xs">立即更新</button>
              <button onClick={() => setNeedRefresh(false)} className="btn-ghost text-xs">稍后</button>
            </div>
          </div>
          <button onClick={() => setNeedRefresh(false)} className="text-ink3 hover:text-ink" aria-label="关闭">
            <X size={14} />
          </button>
        </div>
      )}

      {/* 安装到桌面 */}
      {showInstall && (
        <div className="flex w-72 items-start gap-3 rounded-md border border-ink bg-paper p-3 shadow-paper animate-fade-up">
          <Download size={16} className="mt-0.5 shrink-0 text-ink" />
          <div className="min-w-0 flex-1">
            <div className="font-display text-sm font-bold text-ink">把它装到桌面？</div>
            <p className="mt-0.5 text-xs text-ink3">独立窗口、离线可用、像 App 一样。</p>
            <div className="mt-2 flex gap-2">
              <button onClick={triggerInstall} className="btn-primary text-xs">安装</button>
              <button onClick={dismissInstall} className="btn-ghost text-xs">不需要</button>
            </div>
          </div>
          <button onClick={dismissInstall} className="text-ink3 hover:text-ink" aria-label="关闭">
            <X size={14} />
          </button>
        </div>
      )}

      {/* 离线就绪一次性提示 */}
      {offlineReady && (
        <div className="flex w-72 items-center gap-2 rounded-md border border-moss/40 bg-moss-50/80 p-2.5 text-xs text-moss-700 shadow-paper animate-fade-up">
          <span className="flex-1">✓ 离线模式就绪，断网也能继续学习</span>
          <button onClick={() => setOfflineReady(false)} className="hover:text-ink" aria-label="关闭">
            <X size={12} />
          </button>
        </div>
      )}
    </div>
  );
}

// BeforeInstallPromptEvent 类型补丁（TS 标准库未含）
interface BeforeInstallPromptEvent extends Event {
  readonly platforms: ReadonlyArray<string>;
  readonly userChoice: Promise<{ outcome: 'accepted' | 'dismissed'; platform: string }>;
  prompt(): Promise<void>;
}
