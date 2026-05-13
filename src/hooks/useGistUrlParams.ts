import { useEffect, useRef, useState } from 'react';
import { useSettings } from '@/stores/settingsStore';
import { getSetting } from '@/db/schema';
import type { GistConfig } from '@/stores/settingsStore';

export type GistConflict = {
  urlGistId: string;
  urlToken: string;
  stored: GistConfig;
};

/** 解析 HashRouter URL 中的 ?gistId=&githubToken= 参数，处理冲突并清除敏感参数。 */
export function useGistUrlParams() {
  const setGist = useSettings((s) => s.setGist);
  const [conflict, setConflict] = useState<GistConflict | null>(null);
  const handled = useRef(false);

  useEffect(() => {
    if (handled.current) return;
    handled.current = true;

    (async () => {
      // HashRouter: window.location.hash = "#/settings?gistId=xxx&githubToken=yyy"
      const hashPart = window.location.hash;
      const qIdx = hashPart.indexOf('?');
      if (qIdx === -1) return;

      const params = new URLSearchParams(hashPart.slice(qIdx + 1));
      const urlGistId = params.get('gistId') ?? '';
      const urlToken = params.get('githubToken') ?? '';
      if (!urlGistId || !urlToken) return;

      // 立即从地址栏清除敏感参数
      const cleanHash = hashPart.slice(0, qIdx);
      history.replaceState(null, '', window.location.pathname + window.location.search + cleanHash);

      const stored = await getSetting<GistConfig>('gist', {
        gistId: '', token: '', autoSync: false, includeAIConfig: false,
      });

      if (stored.gistId === urlGistId && stored.token === urlToken) {
        return; // 完全一致，静默忽略
      }

      if (!stored.gistId) {
        // 未配置过，静默写入
        await setGist({ gistId: urlGistId, token: urlToken });
        window.dispatchEvent(new CustomEvent('gist-url-applied', { detail: { gistId: urlGistId } }));
        return;
      }

      // 已配置且不一致 → 暴露冲突供调用方弹窗处理
      setConflict({ urlGistId, urlToken, stored });
    })();
  }, [setGist]);

  async function resolveConflict(useUrl: boolean) {
    if (!conflict) return;
    if (useUrl) {
      await setGist({ gistId: conflict.urlGistId, token: conflict.urlToken });
    }
    setConflict(null);
  }

  return { conflict, resolveConflict };
}
