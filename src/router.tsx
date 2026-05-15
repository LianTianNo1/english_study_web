import { createHashRouter, Navigate } from 'react-router-dom';
import { lazy, Suspense } from 'react';
import { AppLayout } from './components/AppLayout';

// 关键路径首屏组件（Home / Onboarding）保持同步导入，避免首次进入闪烁；
// 其余页面按需懒加载，首屏 bundle 体积大幅下降。
import { Home } from './pages/Home';
import { Onboarding } from './pages/Onboarding';

const Library = lazy(() => import('./pages/Library').then((m) => ({ default: m.Library })));
const Learn = lazy(() => import('./pages/Learn').then((m) => ({ default: m.Learn })));
const Review = lazy(() => import('./pages/Review').then((m) => ({ default: m.Review })));
const Mistakes = lazy(() => import('./pages/Mistakes').then((m) => ({ default: m.Mistakes })));
const Grammar = lazy(() => import('./pages/Grammar').then((m) => ({ default: m.Grammar })));
const GrammarLesson = lazy(() => import('./pages/GrammarLesson').then((m) => ({ default: m.GrammarLesson })));
const Stats = lazy(() => import('./pages/Stats').then((m) => ({ default: m.Stats })));
const Settings = lazy(() => import('./pages/Settings').then((m) => ({ default: m.Settings })));
const WeeklyReport = lazy(() => import('./pages/WeeklyReport').then((m) => ({ default: m.WeeklyReport })));
const Listening = lazy(() => import('./pages/Listening').then((m) => ({ default: m.Listening })));
const Phonics = lazy(() => import('./pages/Phonics').then((m) => ({ default: m.Phonics })));

function PageFallback() {
  return (
    <div className="flex h-[40vh] items-center justify-center font-mono text-xs uppercase tracking-[0.3em] text-ink3">
      loading…
    </div>
  );
}

function S({ children }: { children: React.ReactNode }) {
  return <Suspense fallback={<PageFallback />}>{children}</Suspense>;
}

// 使用 HashRouter：URL 形如 /#/learn，GitHub Pages 等静态托管刷新不会 404
export const router = createHashRouter([
  {
    path: '/onboarding',
    element: <Onboarding />,
  },
  {
    path: '/',
    element: <AppLayout />,
    children: [
      { index: true, element: <Home /> },
      { path: 'library', element: <S><Library /></S> },
      { path: 'learn', element: <S><Learn /></S> },
      { path: 'review', element: <S><Review /></S> },
      { path: 'listening', element: <S><Listening /></S> },
      { path: 'mistakes', element: <S><Mistakes /></S> },
      { path: 'grammar', element: <S><Grammar /></S> },
      { path: 'grammar/:lessonId', element: <S><GrammarLesson /></S> },
      { path: 'phonics', element: <S><Phonics /></S> },
      { path: 'stats', element: <S><Stats /></S> },
      { path: 'weekly', element: <S><WeeklyReport /></S> },
      { path: 'settings', element: <S><Settings /></S> },
      { path: '*', element: <Navigate to="/" replace /> },
    ],
  },
]);
