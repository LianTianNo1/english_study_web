import { useEffect, useState } from 'react';

/** 监听媒体查询，SSR/初次渲染安全 */
export function useMediaQuery(query: string): boolean {
  const [match, setMatch] = useState(() => {
    if (typeof window === 'undefined' || !window.matchMedia) return false;
    return window.matchMedia(query).matches;
  });

  useEffect(() => {
    if (typeof window === 'undefined' || !window.matchMedia) return;
    const mq = window.matchMedia(query);
    const onChange = (e: MediaQueryListEvent) => setMatch(e.matches);
    setMatch(mq.matches);
    mq.addEventListener('change', onChange);
    return () => mq.removeEventListener('change', onChange);
  }, [query]);

  return match;
}

/** 桌面端断点：与 Tailwind md 一致（768px） */
export function useIsDesktop(): boolean {
  return useMediaQuery('(min-width: 768px)');
}
