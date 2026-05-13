import { buildBackup, parseBackup, type BackupV1, type ExportOptions } from './backup';
import type { GistConfig } from '@/stores/settingsStore';

const GIST_FILENAME = 'english-hub-backup.json';
const GIST_DESCRIPTION = 'English Hub Backup';
const API_BASE = 'https://api.github.com';

function headers(token: string) {
  return {
    Authorization: `Bearer ${token}`,
    'Content-Type': 'application/json',
    Accept: 'application/vnd.github+json',
    'X-GitHub-Api-Version': '2022-11-28',
  };
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
    const err = await res.json().catch(() => ({}));
    throw new Error(`GitHub API ${res.status}: ${(err as any).message ?? res.statusText}`);
  }
  const data = await res.json();
  return data.id as string;
}

export async function pullFromGist(config: GistConfig): Promise<BackupV1> {
  const res = await fetch(`${API_BASE}/gists/${config.gistId}`, {
    headers: headers(config.token),
  });
  if (!res.ok) {
    const err = await res.json().catch(() => ({}));
    throw new Error(`GitHub API ${res.status}: ${(err as any).message ?? res.statusText}`);
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
  const res = await fetch(`${API_BASE}/gists/${config.gistId}`, {
    headers: headers(config.token),
  });
  if (!res.ok) throw new Error(`GitHub API ${res.status}`);
  const data = await res.json();
  return { updatedAt: data.updated_at as string };
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
