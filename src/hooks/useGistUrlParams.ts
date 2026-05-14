import { useEffect, useRef, useState } from 'react';
import { useSettings } from '@/stores/settingsStore';
import { getSetting } from '@/db/schema';
import type { GistConfig } from '@/stores/settingsStore';

export type GistConflict = {
  urlGistId: string;
  urlToken: string;
  stored: GistConfig;
};

/** URL 中带来的待处理同步意图（用于触发自动拉取弹窗） */
export type GistPendingPrompt = {
  gistId: string;
  token: string;
};

/** 同步从 URL hash 中解析 gistId+githubToken（用于 useState 初始化，避免异步导致的闪烁/误跳转） */
function readUrlParamsSync(): GistPendingPrompt | null {
  if (typeof window === 'undefined') return null;
  const hashPart = window.location.hash;
  const qIdx = hashPart.indexOf('?');
  if (qIdx === -1) return null;
  const params = new URLSearchParams(hashPart.slice(qIdx + 1));
  const gistId = params.get('gistId') ?? '';
  const token = params.get('githubToken') ?? '';
  if (!gistId || !token) return null;
  return { gistId, token };
}

/**
 * 解析 HashRouter URL 中的 ?gistId=&githubToken= 参数。
 *  - 首屏可同步读取（pendingPrompt 在 useState 初始值时就有），让外层能跳过 Onboarding 重定向
 *  - useEffect 中清除 URL 敏感参数 + 判断是否要弹冲突对话框
 *  - 完全一致 → 直接清空 pendingPrompt（无需 prompt）
 *  - 已配置且不一致 → 转 conflict 走原流程
 *  - 未配置 → 保持 pendingPrompt，由调用方弹"自动同步"对话框
 */
export function useGistUrlParams() {
  const setGist = useSettings((s) => s.setGist);
  const [conflict, setConflict] = useState<GistConflict | null>(null);
  const [pendingPrompt, setPendingPrompt] = useState<GistPendingPrompt | null>(() => readUrlParamsSync());
  const handled = useRef(false);

  useEffect(() => {
    if (handled.current) return;
    handled.current = true;
    if (!pendingPrompt) return;

    (async () => {
      // 立即清除地址栏的敏感参数
      const hashPart = window.location.hash;
      const qIdx = hashPart.indexOf('?');
      if (qIdx !== -1) {
        const cleanHash = hashPart.slice(0, qIdx);
        history.replaceState(null, '', window.location.pathname + window.location.search + cleanHash);
      }

      const stored = await getSetting<GistConfig>('gist', {
        gistId: '', token: '', autoSync: false, includeAIConfig: false,
      });

      // 完全一致 → 无需任何 UI
      if (stored.gistId === pendingPrompt.gistId && stored.token === pendingPrompt.token) {
        setPendingPrompt(null);
        return;
      }

      // 已配置且不一致 → conflict 旧流程
      if (stored.gistId) {
        setConflict({ urlGistId: pendingPrompt.gistId, urlToken: pendingPrompt.token, stored });
        setPendingPrompt(null);
        return;
      }

      // 未配置 → 保持 pendingPrompt，由 UI 触发自动同步对话框
    })();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  async function resolveConflict(useUrl: boolean) {
    if (!conflict) return;
    if (useUrl) await setGist({ gistId: conflict.urlGistId, token: conflict.urlToken });
    setConflict(null);
  }

  /** 调用方完成自动同步对话框后调此清空 pendingPrompt */
  function dismissPrompt() {
    setPendingPrompt(null);
  }

  return { conflict, resolveConflict, pendingPrompt, dismissPrompt };
}
