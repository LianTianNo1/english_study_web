import { NavLink, Outlet, useLocation, useNavigate } from 'react-router-dom';
import { useEffect, useState } from 'react';
import { Menu } from 'lucide-react';
import { isAnyImported } from '@/db/importer';
import { useSettings } from '@/stores/settingsStore';
import { cn } from '@/lib/utils';
import { setSfxEnabled } from '@/lib/sfx';
import { warmUpTTS } from '@/lib/tts';
import { MobileSheet } from './MobileSheet';

const NAV = [
  { to: '/', label: '今日', code: '00', end: true },
  { to: '/learn', label: '新词', code: '01' },
  { to: '/review', label: '复习', code: '02' },
  { to: '/mistakes', label: '错题', code: '2b' },
  { to: '/grammar', label: '语法', code: '03' },
  { to: '/library', label: '词库', code: '04' },
  { to: '/stats', label: '统计', code: '05' },
  { to: '/weekly', label: '周报', code: '07' },
  { to: '/settings', label: '设置', code: '06' },
];

// 移动端底部 Tab 仅保留 4 项高频入口；"更多" 打开抽屉显示剩余项
const MOBILE_TABS = NAV.slice(0, 4);              // 今日 / 新词 / 复习 / 错题
const MOBILE_MORE = NAV.slice(4);                  // 语法 / 词库 / 统计 / 周报 / 设置

export function AppLayout() {
  const navigate = useNavigate();
  const location = useLocation();
  const [ready, setReady] = useState(false);
  const [moreOpen, setMoreOpen] = useState(false);
  const load = useSettings((s) => s.load);
  const sfxEnabled = useSettings((s) => s.sfxEnabled);

  useEffect(() => {
    (async () => {
      const has = await isAnyImported();
      if (!has) navigate('/onboarding', { replace: true });
      await load();
      setReady(true);
    })();
  }, [navigate, load]);

  // 路由切换自动关抽屉
  useEffect(() => { setMoreOpen(false); }, [location.pathname]);

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

  if (!ready) {
    return (
      <div className="flex h-full items-center justify-center font-mono text-xs uppercase tracking-[0.3em] text-ink3">
        loading…
      </div>
    );
  }

  // 当前路径是否归属"更多"
  const moreActive = MOBILE_MORE.some((n) => location.pathname.startsWith(n.to));

  return (
    <div className="min-h-full">
      {/* ============ Header ============ */}
      <header className="sticky top-0 z-30 border-b border-paper3 bg-paper/85 backdrop-blur">
        {/* 桌面 header */}
        <div className="mx-auto hidden max-w-6xl items-center justify-between gap-6 px-6 py-4 md:flex">
          <div className="flex items-baseline gap-3">
            <span className="font-display text-2xl font-black tracking-tight text-ink">English Hub</span>
            <span className="font-mono text-[10px] uppercase tracking-[0.3em] text-ink3">
              — Private Study Journal
            </span>
          </div>
          <nav className="flex items-center">
            {NAV.map((n) => (
              <NavLink
                key={n.to}
                to={n.to}
                end={n.end}
                className={({ isActive }) =>
                  cn(
                    'group relative flex items-baseline gap-1 px-3 py-2 text-sm transition-colors',
                    isActive ? 'text-ink' : 'text-ink3 hover:text-ink'
                  )
                }
              >
                <span className="font-mono text-[9px] tracking-wider opacity-50 group-hover:opacity-100">{n.code}</span>
                <span className="font-medium">{n.label}</span>
                <NavIndicator path={n.to} end={!!n.end} current={location.pathname} />
              </NavLink>
            ))}
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
        <div className="mt-6 border-t border-paper3 pt-4 font-mono text-[10px] uppercase tracking-[0.25em] text-ink3">
          english hub · vol.01<br/>
          local-first · indexeddb
        </div>
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
