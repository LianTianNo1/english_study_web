import { createHashRouter, Navigate } from 'react-router-dom';
import { AppLayout } from './components/AppLayout';
import { Home } from './pages/Home';
import { Onboarding } from './pages/Onboarding';
import { Library } from './pages/Library';
import { Learn } from './pages/Learn';
import { Review } from './pages/Review';
import { Mistakes } from './pages/Mistakes';
import { Grammar } from './pages/Grammar';
import { GrammarLesson } from './pages/GrammarLesson';
import { Stats } from './pages/Stats';
import { Settings } from './pages/Settings';

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
      { path: 'library', element: <Library /> },
      { path: 'learn', element: <Learn /> },
      { path: 'review', element: <Review /> },
      { path: 'mistakes', element: <Mistakes /> },
      { path: 'grammar', element: <Grammar /> },
      { path: 'grammar/:lessonId', element: <GrammarLesson /> },
      { path: 'stats', element: <Stats /> },
      { path: 'settings', element: <Settings /> },
      { path: '*', element: <Navigate to="/" replace /> },
    ],
  },
]);
