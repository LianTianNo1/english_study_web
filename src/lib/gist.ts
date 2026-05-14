import { buildBackup, parseBackup, type BackupV1, type ExportOptions } from './backup';
import type { GistConfig } from '@/stores/settingsStore';

const GIST_FILENAME = 'english-hub-backup.json';
const GIST_DESCRIPTION = 'English Hub Backup';
const API_BASE = 'https://api.github.com';

function headers(token: string) {
  return {
    // 复制 token 时常带不可见空白（换行/前后空格），导致第二次请求 401。这里统一 trim。
    Authorization: `Bearer ${token.trim()}`,
    'Content-Type': 'application/json',
    Accept: 'application/vnd.github+json',
    'X-GitHub-Api-Version': '2022-11-28',
  };
}

/** 把 GitHub 返回的错误转成对用户有意义的中文 */
function explain(status: number, msg: string, ctx: 'create' | 'update' | 'pull'): string {
  if (status === 401) {
    if (ctx === 'update') {
      return [
        'Token 凭据失效或对当前 Gist 无写权限 (401)。',
        '常见原因：',
        '① Fine-grained PAT 默认不支持 PATCH 已存在的 Gist —— 请改用 Classic PAT（gist scope）',
        '② Token 已过期 / 撤销 —— 重新生成并粘贴',
        '③ 复制 Token 时末尾多了空格或换行 —— 重新清空输入框再粘贴一次',
      ].join('\n');
    }
    return 'Token 无效 (401)：请检查是否带空白、是否过期，并确认 gist scope。';
  }
  if (status === 403) {
    return `权限不足 (403)：${msg}。Fine-grained PAT 可能未授权写入此 Gist，建议改用 Classic PAT。`;
  }
  if (status === 404 && (ctx === 'update' || ctx === 'pull')) {
    return 'Gist 不存在或无权访问 (404)：可能已被删除，或此 Token 不是 Gist owner。点击"断开配置"后重新推送会创建新 Gist。';
  }
  return `GitHub API ${status}: ${msg}`;
}

export async function pushToGist(backup: BackupV1, config: GistConfig): Promise<string> {
  const content = JSON.stringify(backup, null, 2);
  const body = {
    description: GIST_DESCRIPTION,
    public: false,
    files: { [GIST_FILENAME]: { content } },
  };

  const isNew = !config.gistId;
  const url = isNew ? `${API_BASE}/gists` : `${API_BASE}/gists/${config.gistId}`;
  const method = isNew ? 'POST' : 'PATCH';

  const res = await fetch(url, { method, headers: headers(config.token), body: JSON.stringify(body) });
  if (!res.ok) {
    const err = await res.json().catch(() => ({} as Record<string, unknown>));
    const msg = String((err as { message?: string }).message ?? res.statusText);
    throw new Error(explain(res.status, msg, isNew ? 'create' : 'update'));
  }
  const data = await res.json();
  return data.id as string;
}

export async function pullFromGist(config: GistConfig): Promise<BackupV1> {
  const res = await fetch(`${API_BASE}/gists/${config.gistId}`, { headers: headers(config.token) });
  if (!res.ok) {
    const err = await res.json().catch(() => ({} as Record<string, unknown>));
    const msg = String((err as { message?: string }).message ?? res.statusText);
    throw new Error(explain(res.status, msg, 'pull'));
  }
  const data = await res.json();
  const file = data.files?.[GIST_FILENAME];
  if (!file) throw new Error(`Gist 中不存在文件 ${GIST_FILENAME}`);
  // 内容超过 1MB 时 GitHub 不内联，走 raw_url
  const raw: string = file.truncated
    ? await fetch(file.raw_url as string).then((r) => r.text())
    : (file.content as string);
  return parseBackup(raw);
}

export async function getGistMeta(config: GistConfig): Promise<{ updatedAt: string }> {
  const res = await fetch(`${API_BASE}/gists/${config.gistId}`, { headers: headers(config.token) });
  if (!res.ok) throw new Error(`GitHub API ${res.status}`);
  const data = await res.json();
  return { updatedAt: data.updated_at as string };
}

/** 校验 token 是否可用：调用 /user 验证身份与基本权限 */
export async function verifyToken(token: string): Promise<{ ok: boolean; login?: string; tokenType?: 'classic' | 'fine-grained' | 'unknown'; error?: string }> {
  try {
    const res = await fetch(`${API_BASE}/user`, { headers: headers(token) });
    if (!res.ok) {
      const err = await res.json().catch(() => ({} as Record<string, unknown>));
      return { ok: false, error: explain(res.status, String((err as { message?: string }).message ?? res.statusText), 'create') };
    }
    const data = await res.json();
    // 从 OAuth-Scopes 头判断 token 类型：Classic 会返回 gist 等具体 scope，Fine-grained 通常空
    const scopes = res.headers.get('X-OAuth-Scopes') || '';
    const isClassic = scopes.includes('gist');
    const tokenType = scopes.length > 0 ? (isClassic ? 'classic' : 'unknown') : 'fine-grained';
    return { ok: true, login: data.login as string, tokenType };
  } catch (e) {
    return { ok: false, error: (e as Error).message };
  }
}

export async function autoSyncToGist(
  gist: GistConfig,
  setGist: (cfg: Partial<GistConfig>) => Promise<void>,
): Promise<void> {
  if (!gist.autoSync || !gist.token) return;
  try {
    const opts: ExportOptions = {
      includeSettings: true,
      includeSessions: true,
      includeWords: false,
      includeAIConfig: gist.includeAIConfig,
    };
    const backup = await buildBackup(opts);
    const gistId = await pushToGist(backup, gist);
    await setGist({ gistId, lastSyncedAt: new Date().toISOString(), lastSyncStatus: 'ok' });
  } catch {
    await setGist({ lastSyncStatus: 'error' });
  }
}
