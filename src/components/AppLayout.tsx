import { NavLink, Outlet, useLocation, useNavigate } from 'react-router-dom';
import { useEffect, useState } from 'react';
import { ChevronDown, Keyboard, Menu } from 'lucide-react';
import { isAnyImported } from '@/db/importer';
import { useSettings } from '@/stores/settingsStore';
import { cn } from '@/lib/utils';
import { setSfxEnabled } from '@/lib/sfx';
import { warmUpTTS } from '@/lib/tts';
import { startNotificationLoop, stopNotificationLoop } from '@/lib/notifications';
import { MobileSheet } from './MobileSheet';
import { ShortcutsPanel } from './ShortcutsPanel';
import { useGistUrlParams } from '@/hooks/useGistUrlParams';

const NAV = [
  { to: '/', label: '今日', code: '00', end: true },
  { to: '/learn', label: '新词', code: '01' },
  { to: '/review', label: '复习', code: '02' },
  { to: '/listening', label: '听写', code: '02d' },
  { to: '/mistakes', label: '错题', code: '2b' },
  { to: '/grammar', label: '语法', code: '03' },
  { to: '/library', label: '词库', code: '04' },
  { to: '/stats', label: '统计', code: '05' },
  { to: '/weekly', label: '周报', code: '07' },
  { to: '/settings', label: '设置', code: '06' },
];

// 移动端底部 Tab 仅保留 4 项高频入口；"更多" 打开抽屉显示剩余项
const MOBILE_TABS = NAV.slice(0, 4);              // 今日 / 新词 / 复习 / 听写
const MOBILE_MORE = NAV.slice(4);                  // 错题 / 语法 / 词库 / 统计 / 周报 / 设置

// 桌面端：6 项常驻主导航 + 4 项「更多 ▾」下拉，避免换行
const DESKTOP_PRIMARY = NAV.slice(0, 6);          // 今日 / 新词 / 复习 / 听写 / 错题 / 语法
const DESKTOP_SECONDARY = NAV.slice(6);            // 词库 / 统计 / 周报 / 设置

export function AppLayout() {
  const navigate = useNavigate();
  const location = useLocation();
  const [ready, setReady] = useState(false);
  const [moreOpen, setMoreOpen] = useState(false);
  const [shortcutsOpen, setShortcutsOpen] = useState(false);
  const [desktopMoreOpen, setDesktopMoreOpen] = useState(false);
  const { conflict, resolveConflict } = useGistUrlParams();
  const load = useSettings((s) => s.load);
  const sfxEnabled = useSettings((s) => s.sfxEnabled);
  const enhanced = useSettings((s) => s.enhanced);
  const learningMode = useSettings((s) => s.learningMode);

  useEffect(() => {
    (async () => {
      const has = await isAnyImported();
      if (!has) navigate('/onboarding', { replace: true });
      await load();
      setReady(true);
    })();
  }, [navigate, load]);

  // 路由切换自动关抽屉与桌面下拉
  useEffect(() => { setMoreOpen(false); setDesktopMoreOpen(false); }, [location.pathname]);

  // 点击外部 / Esc 关闭桌面下拉
  useEffect(() => {
    if (!desktopMoreOpen) return;
    function onDoc(e: MouseEvent) {
      const t = e.target as HTMLElement | null;
      if (!t?.closest('[data-more-dropdown]')) setDesktopMoreOpen(false);
    }
    function onEsc(e: KeyboardEvent) { if (e.key === 'Escape') setDesktopMoreOpen(false); }
    document.addEventListener('mousedown', onDoc);
    document.addEventListener('keydown', onEsc);
    return () => {
      document.removeEventListener('mousedown', onDoc);
      document.removeEventListener('keydown', onEsc);
    };
  }, [desktopMoreOpen]);

  // 同步音效开关到底层模块
  useEffect(() => {
    setSfxEnabled(sfxEnabled);
  }, [sfxEnabled]);

  // 移动端 / 桌面端 Chrome 都需要"用户手势"激活 TTS：监听首次任意 pointer/click
  useEffect(() => {
    const onFirstInteract = () => {
      warmUpTTS();
      window.removeEventListener('pointerdown', onFirstInteract);
      window.removeEventListener('keydown', onFirstInteract);
    };
    window.addEventListener('pointerdown', onFirstInteract, { once: true });
    window.addEventListener('keydown', onFirstInteract, { once: true });
    return () => {
      window.removeEventListener('pointerdown', onFirstInteract);
      window.removeEventListener('keydown', onFirstInteract);
    };
  }, []);

  // 每日提醒（依赖 ready 完成 + 用户开启）
  useEffect(() => {
    if (!ready) return;
    if (learningMode === 'enhanced' && enhanced.dailyReminder) {
      startNotificationLoop();
      return () => stopNotificationLoop();
    } else {
      stopNotificationLoop();
    }
  }, [ready, learningMode, enhanced.dailyReminder]);

  // 全局 ? 键打开快捷键面板
  useEffect(() => {
    function onKey(e: KeyboardEvent) {
      const t = e.target as HTMLElement | null;
      if (t && (t.tagName === 'INPUT' || t.tagName === 'TEXTAREA' || t.isContentEditable)) return;
      if (e.key === '?' || (e.shiftKey && e.key === '/')) {
        e.preventDefault();
        setShortcutsOpen((v) => !v);
      }
    }
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, []);

  if (!ready) {
    return (
      <div className="flex h-full items-center justify-center font-mono text-xs uppercase tracking-[0.3em] text-ink3">
        loading…
      </div>
    );
  }

  // 当前路径是否归属"更多"
  const moreActive = MOBILE_MORE.some((n) => location.pathname.startsWith(n.to));
  // 桌面"更多"下拉的激活态：当前路径属于 secondary 项
  const desktopMoreActive = DESKTOP_SECONDARY.some((n) => location.pathname.startsWith(n.to));

  return (
    <div className="min-h-full">
      {/* ============ Header ============ */}
      <header className="sticky top-0 z-30 border-b border-paper3 bg-paper/85 backdrop-blur">
        {/* 桌面 header */}
        <div className="mx-auto hidden max-w-6xl items-center gap-4 px-6 py-4 md:flex">
          {/* Logo —— 副标语仅在 xl 屏显示，给 nav 让出空间 */}
          <div className="flex items-baseline gap-3 shrink-0">
            <span className="font-display text-2xl font-black tracking-tight text-ink">English Hub</span>
            <span className="hidden font-mono text-[10px] uppercase tracking-[0.3em] text-ink3 xl:inline">
              — Private Study Journal
            </span>
          </div>

          {/* 主导航：6 项常驻 + "更多 ▾" 下拉。code prefix 在 lg+ 才显示 */}
          <nav className="ml-auto flex items-center gap-0.5">
            {DESKTOP_PRIMARY.map((n) => (
              <NavLink
                key={n.to}
                to={n.to}
                end={n.end}
                className={({ isActive }) =>
                  cn(
                    'group relative flex items-baseline gap-1 rounded-sm px-2.5 py-1.5 text-sm transition-colors',
                    isActive ? 'text-ink' : 'text-ink3 hover:text-ink'
                  )
                }
              >
                <span className="hidden font-mono text-[9px] tracking-wider opacity-50 group-hover:opacity-100 lg:inline">{n.code}</span>
                <span className="font-medium">{n.label}</span>
                <NavIndicator path={n.to} end={!!n.end} current={location.pathname} />
              </NavLink>
            ))}

            {/* 更多 ▾ */}
            <div className="relative" data-more-dropdown>
              <button
                onClick={() => setDesktopMoreOpen((v) => !v)}
                aria-haspopup="menu"
                aria-expanded={desktopMoreOpen}
                className={cn(
                  'group relative flex items-center gap-1 rounded-sm px-2.5 py-1.5 text-sm transition-colors',
                  desktopMoreActive ? 'text-ink' : 'text-ink3 hover:text-ink'
                )}
              >
                <span className="font-medium">更多</span>
                <ChevronDown size={12} className={cn('transition-transform', desktopMoreOpen && 'rotate-180')} />
                {desktopMoreActive && <span className="absolute -bottom-0.5 left-2 right-5 h-0.5 bg-persimmon" />}
              </button>
              {desktopMoreOpen && (
                <div
                  role="menu"
                  className="absolute right-0 top-full z-40 mt-1.5 w-48 origin-top-right overflow-hidden rounded-md border border-paper3 bg-paper shadow-paper animate-fade-up"
                  style={{ animationDuration: '0.18s' }}
                >
                  <div className="border-b border-paper3 px-3 py-2 font-mono text-[9px] uppercase tracking-[0.25em] text-ink3">
                    more · 工具
                  </div>
                  <ul>
                    {DESKTOP_SECONDARY.map((n) => (
                      <li key={n.to}>
                        <NavLink
                          to={n.to}
                          className={({ isActive }) =>
                            cn(
                              'flex items-baseline gap-2.5 px-3 py-2 text-sm transition-colors',
                              isActive
                                ? 'bg-persimmon-50/60 text-persimmon-700'
                                : 'text-ink2 hover:bg-paper2 hover:text-ink'
                            )
                          }
                        >
                          <span className="font-mono text-[9px] tracking-wider text-ink3 opacity-70">{n.code}</span>
                          <span className="font-medium">{n.label}</span>
                        </NavLink>
                      </li>
                    ))}
                  </ul>
                </div>
              )}
            </div>

            {/* 快捷键 */}
            <button
              onClick={() => setShortcutsOpen(true)}
              title="快捷键 (?)"
              aria-label="keyboard shortcuts"
              className="ml-1.5 inline-grid h-8 w-8 place-items-center rounded-full border border-paper3 bg-paper text-ink3 transition-colors hover:border-ink hover:text-ink"
            >
              <Keyboard size={14} />
            </button>
          </nav>
        </div>

        {/* 移动 header */}
        <div className="mx-auto flex items-center justify-between px-4 py-3 md:hidden">
          <div className="flex items-baseline gap-2">
            <span className="font-display text-lg font-black tracking-tight text-ink">English Hub</span>
            <span className="font-mono text-[9px] uppercase tracking-[0.2em] text-ink3">vol.01</span>
          </div>
          <button
            onClick={() => setMoreOpen(true)}
            aria-label="open menu"
            className={cn(
              'inline-grid h-9 w-9 place-items-center rounded-full border border-paper3 bg-paper text-ink2 transition-colors',
              moreActive && 'border-persimmon text-persimmon'
            )}
          >
            <Menu size={16} />
          </button>
        </div>
      </header>

      {/* ============ Main ============ */}
      <main className="mx-auto max-w-6xl px-4 py-6 pb-24 animate-fade-up sm:px-6 md:py-10 md:pb-10">
        <Outlet />
      </main>

      {/* ============ Footer（桌面端显示） ============ */}
      <footer className="mx-auto mt-16 hidden max-w-6xl px-6 py-8 font-mono text-[10px] uppercase tracking-[0.25em] text-ink3 md:block">
        <div className="border-t border-paper3 pt-6">
          <span>english hub · vol.01</span> · <span>local-first · indexeddb</span> · <span>made for self-learners</span>
        </div>
      </footer>

      {/* ============ 移动底部 Tab Bar ============ */}
      <nav
        className="fixed inset-x-0 bottom-0 z-30 border-t border-paper3 bg-paper/95 backdrop-blur md:hidden"
        style={{ paddingBottom: 'env(safe-area-inset-bottom)' }}
        aria-label="primary"
      >
        <div className="grid grid-cols-5">
          {MOBILE_TABS.map((n) => (
            <NavLink
              key={n.to}
              to={n.to}
              end={n.end}
              className={({ isActive }) =>
                cn(
                  'relative flex flex-col items-center justify-center gap-0.5 py-2 text-[11px] transition-colors',
                  isActive ? 'text-persimmon' : 'text-ink3'
                )
              }
            >
              {({ isActive }) => (
                <>
                  {isActive && <span className="absolute top-0 h-0.5 w-8 rounded-full bg-persimmon" />}
                  <span className="font-mono text-[9px] tracking-wider opacity-60">{n.code}</span>
                  <span className="font-medium">{n.label}</span>
                </>
              )}
            </NavLink>
          ))}
          <button
            onClick={() => setMoreOpen(true)}
            className={cn(
              'relative flex flex-col items-center justify-center gap-0.5 py-2 text-[11px] transition-colors',
              moreActive ? 'text-persimmon' : 'text-ink3'
            )}
          >
            {moreActive && <span className="absolute top-0 h-0.5 w-8 rounded-full bg-persimmon" />}
            <span className="font-mono text-[9px] tracking-wider opacity-60">··</span>
            <span className="font-medium">更多</span>
          </button>
        </div>
      </nav>

      {/* ============ 更多抽屉 ============ */}
      <MobileSheet open={moreOpen} onClose={() => setMoreOpen(false)} side="right" title="more · 更多">
        <nav className="grid gap-1">
          {MOBILE_MORE.map((n) => (
            <NavLink
              key={n.to}
              to={n.to}
              className={({ isActive }) =>
                cn(
                  'flex items-baseline gap-2 rounded-md border px-4 py-3 transition-colors',
                  isActive
                    ? 'border-persimmon bg-persimmon-50/60 text-persimmon-700'
                    : 'border-paper3 text-ink2 hover:border-ink'
                )
              }
              onClick={() => setMoreOpen(false)}
            >
              <span className="font-mono text-[10px] tracking-wider opacity-60">{n.code}</span>
              <span className="font-medium">{n.label}</span>
            </NavLink>
          ))}
        </nav>
        <button
          onClick={() => { setMoreOpen(false); setShortcutsOpen(true); }}
          className="mt-4 inline-flex w-full items-center justify-center gap-2 rounded-md border border-paper3 bg-paper px-3 py-2.5 text-sm text-ink2 transition-colors hover:border-ink"
        >
          <Keyboard size={14} /> 键盘快捷键
        </button>
        <div className="mt-6 border-t border-paper3 pt-4 font-mono text-[10px] uppercase tracking-[0.25em] text-ink3">
          english hub · vol.01<br/>
          local-first · indexeddb
        </div>
      </MobileSheet>

      {/* ============ 快捷键面板（全局 ?） ============ */}
      <ShortcutsPanel open={shortcutsOpen} onClose={() => setShortcutsOpen(false)} />

      {/* ============ Gist 凭据冲突弹窗 ============ */}
      <MobileSheet
        open={!!conflict}
        onClose={() => resolveConflict(false)}
        side="bottom"
        title="cloud sync · 配置冲突"
      >
        {conflict && (
          <div className="space-y-4">
            <p className="text-sm text-ink2 leading-relaxed">
              检测到 URL 中携带新的 Gist 配置，与当前设备已存的配置不一致。
            </p>
            <div className="rounded-md border border-paper3 bg-paper2/50 p-3 font-mono text-[11px] space-y-1">
              <div className="text-ink3 uppercase tracking-wider mb-1">url 中的配置</div>
              <div>Gist ID: <span className="text-ink">{conflict.urlGistId}</span></div>
              <div>Token: <span className="text-ink">{'*'.repeat(8)}{conflict.urlToken.slice(-4)}</span></div>
            </div>
            <div className="flex flex-col gap-2 sm:flex-row">
              <button
                onClick={() => resolveConflict(true)}
                className="flex-1 rounded-sm border border-ink bg-ink px-4 py-2.5 text-sm font-medium text-paper transition hover:opacity-90"
              >
                使用 URL 中的配置（覆盖）
              </button>
              <button
                onClick={() => resolveConflict(false)}
                className="flex-1 rounded-sm border border-paper3 px-4 py-2.5 text-sm font-medium text-ink2 transition hover:border-ink"
              >
                保留现有配置
              </button>
            </div>
          </div>
        )}
      </MobileSheet>
    </div>
  );
}

function NavIndicator({ path, end, current }: { path: string; end: boolean; current: string }) {
  const active = end ? current === path : current.startsWith(path);
  if (!active) return null;
  return (
    <span className="absolute -bottom-0.5 left-2 right-2 h-0.5 bg-persimmon" />
  );
}
