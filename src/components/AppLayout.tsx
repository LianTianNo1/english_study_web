import { NavLink, Outlet, useLocation, useNavigate } from 'react-router-dom';
import { useEffect, useState } from 'react';
import { isAnyImported } from '@/db/importer';
import { useSettings } from '@/stores/settingsStore';
import { cn } from '@/lib/utils';

const NAV = [
  { to: '/', label: '今日', code: '00', end: true },
  { to: '/learn', label: '新词', code: '01' },
  { to: '/review', label: '复习', code: '02' },
  { to: '/mistakes', label: '错题', code: '2b' },
  { to: '/grammar', label: '语法', code: '03' },
  { to: '/library', label: '词库', code: '04' },
  { to: '/stats', label: '统计', code: '05' },
  { to: '/settings', label: '设置', code: '06' },
];

export function AppLayout() {
  const navigate = useNavigate();
  const location = useLocation();
  const [ready, setReady] = useState(false);
  const load = useSettings((s) => s.load);

  useEffect(() => {
    (async () => {
      const has = await isAnyImported();
      if (!has) navigate('/onboarding', { replace: true });
      await load();
      setReady(true);
    })();
  }, [navigate, load]);

  if (!ready) {
    return (
      <div className="flex h-full items-center justify-center font-mono text-xs uppercase tracking-[0.3em] text-ink3">
        loading…
      </div>
    );
  }

  return (
    <div className="min-h-full">
      <header className="sticky top-0 z-30 border-b border-paper3 bg-paper/85 backdrop-blur">
        <div className="mx-auto flex max-w-6xl items-center justify-between gap-6 px-6 py-4">
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
      </header>
      <main className="mx-auto max-w-6xl px-6 py-10 animate-fade-up">
        <Outlet />
      </main>
      <footer className="mx-auto mt-16 max-w-6xl px-6 py-8 font-mono text-[10px] uppercase tracking-[0.25em] text-ink3">
        <div className="border-t border-paper3 pt-6">
          <span>english hub · vol.01</span> · <span>local-first · indexeddb</span> · <span>made for self-learners</span>
        </div>
      </footer>
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
