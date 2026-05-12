import { NavLink, Outlet, useNavigate } from 'react-router-dom';
import { useEffect, useState } from 'react';
import { BookOpen, GraduationCap, Home as HomeIcon, Library as LibIcon, RotateCw, Settings as SettingsIcon, Sparkles, BarChart3 } from 'lucide-react';
import { isAnyImported } from '@/db/importer';
import { cn } from '@/lib/utils';

const NAV = [
  { to: '/', label: '首页', icon: HomeIcon, end: true },
  { to: '/learn', label: '学新词', icon: BookOpen },
  { to: '/review', label: '复习', icon: RotateCw },
  { to: '/grammar', label: '语法', icon: GraduationCap },
  { to: '/library', label: '词库', icon: LibIcon },
  { to: '/stats', label: '统计', icon: BarChart3 },
  { to: '/settings', label: '设置', icon: SettingsIcon },
];

export function AppLayout() {
  const navigate = useNavigate();
  const [ready, setReady] = useState(false);

  useEffect(() => {
    (async () => {
      const has = await isAnyImported();
      if (!has) navigate('/onboarding', { replace: true });
      setReady(true);
    })();
  }, [navigate]);

  if (!ready) {
    return (
      <div className="flex h-full items-center justify-center text-ink-400">
        <Sparkles className="mr-2 animate-pulse" />
        加载中…
      </div>
    );
  }

  return (
    <div className="min-h-full bg-cream-50">
      <header className="sticky top-0 z-30 border-b border-cream-200 bg-cream-50/90 backdrop-blur">
        <div className="mx-auto flex max-w-6xl items-center justify-between px-6 py-3">
          <div className="flex items-center gap-2">
            <div className="grid h-9 w-9 place-items-center rounded-xl bg-warm-500 text-lg font-extrabold text-white shadow-soft">E</div>
            <div className="text-base font-semibold tracking-tight">English Hub</div>
            <span className="tag ml-1">0 基础友好</span>
          </div>
          <nav className="flex items-center gap-1">
            {NAV.map((n) => (
              <NavLink
                key={n.to}
                to={n.to}
                end={n.end}
                className={({ isActive }) =>
                  cn(
                    'inline-flex items-center gap-1.5 rounded-xl px-3 py-1.5 text-sm font-medium transition-colors',
                    isActive
                      ? 'bg-warm-500 text-white shadow-soft'
                      : 'text-ink-600 hover:bg-cream-100'
                  )
                }
              >
                <n.icon size={16} />
                <span className="hidden sm:inline">{n.label}</span>
              </NavLink>
            ))}
          </nav>
        </div>
      </header>
      <main className="mx-auto max-w-6xl px-6 py-8 animate-fade-in">
        <Outlet />
      </main>
    </div>
  );
}
