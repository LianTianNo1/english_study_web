import { db } from '@/db/schema';
import type { ProgressRecord, SessionRecord, GrammarProgressRecord, SettingsRecord } from '@/db/types';

/** 备份只包含"用户学习成果" —— 不包含词库（可重新导入）和敏感凭据（API Key） */
export interface BackupV1 {
  version: 1;
  exportedAt: string;
  appVersion: string;
  progress: ProgressRecord[];
  sessions: SessionRecord[];
  grammarProgress: GrammarProgressRecord[];
  settings: SettingsRecord[];
}

const APP_VERSION = '0.2.0';

/* ---------- 敏感字段脱敏 ---------- */
const SENSITIVE_SETTING_KEYS = new Set(['ai']); // ai 配置含 apiKey

function sanitizeSettings(settings: SettingsRecord[]): SettingsRecord[] {
  return settings.map((s) => {
    if (!SENSITIVE_SETTING_KEYS.has(s.key)) return s;
    if (s.key === 'ai' && s.value && typeof s.value === 'object') {
      const v = s.value as Record<string, unknown>;
      return { key: s.key, value: { ...v, apiKey: '' } };
    }
    return s;
  });
}

/* ---------- 导出 ---------- */
export interface ExportOptions {
  includeSettings?: boolean;
  includeSessions?: boolean;
}

export async function buildBackup(opts: ExportOptions = {}): Promise<BackupV1> {
  const { includeSettings = true, includeSessions = true } = opts;
  const [progress, sessions, grammarProgress, settings] = await Promise.all([
    db.progress.toArray(),
    includeSessions ? db.sessions.toArray() : Promise.resolve([]),
    db.grammarProgress.toArray(),
    includeSettings ? db.settings.toArray() : Promise.resolve([]),
  ]);
  return {
    version: 1,
    exportedAt: new Date().toISOString(),
    appVersion: APP_VERSION,
    progress,
    sessions,
    grammarProgress,
    settings: sanitizeSettings(settings),
  };
}

export function downloadBackup(backup: BackupV1, filename?: string) {
  const blob = new Blob([JSON.stringify(backup, null, 2)], { type: 'application/json' });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  const stamp = new Date().toISOString().replace(/[:.]/g, '-').slice(0, 19);
  a.download = filename ?? `english-hub-backup-${stamp}.json`;
  document.body.appendChild(a);
  a.click();
  document.body.removeChild(a);
  setTimeout(() => URL.revokeObjectURL(url), 1000);
}

/* ---------- 导入 ---------- */
export type ImportStrategy = 'merge' | 'replace';

export interface ImportReport {
  progress: number;
  sessions: number;
  grammarProgress: number;
  settings: number;
  skippedSettings: string[];
}

export interface ImportResult {
  ok: boolean;
  report?: ImportReport;
  error?: string;
}

export function parseBackup(text: string): BackupV1 {
  let j: any;
  try {
    j = JSON.parse(text);
  } catch (e) {
    throw new Error('备份文件不是合法的 JSON');
  }
  if (!j || typeof j !== 'object') throw new Error('备份格式错误');
  if (j.version !== 1) throw new Error(`不支持的备份版本: ${j.version}`);
  if (!Array.isArray(j.progress) || !Array.isArray(j.grammarProgress)) {
    throw new Error('备份缺少必要字段');
  }
  return j as BackupV1;
}

export async function applyBackup(backup: BackupV1, strategy: ImportStrategy): Promise<ImportReport> {
  const report: ImportReport = {
    progress: 0,
    sessions: 0,
    grammarProgress: 0,
    settings: 0,
    skippedSettings: [],
  };

  await db.transaction('rw', [db.progress, db.sessions, db.grammarProgress, db.settings], async () => {
    if (strategy === 'replace') {
      await db.progress.clear();
      await db.sessions.clear();
      await db.grammarProgress.clear();
      // settings 不全清——保留 AI/TTS 等本地凭据
    }

    // progress: 按 wordId 唯一
    for (const p of backup.progress) {
      const { id, ...rest } = p;
      const existing = await db.progress.where('wordId').equals(p.wordId).first();
      if (existing?.id) {
        await db.progress.update(existing.id, rest);
      } else {
        await db.progress.add(rest as ProgressRecord);
      }
      report.progress++;
    }

    // sessions: 追加，无去重（保留所有历史会话）
    for (const s of backup.sessions ?? []) {
      const { id, ...rest } = s;
      await db.sessions.add(rest as SessionRecord);
      report.sessions++;
    }

    // grammarProgress: 按 lessonId 主键去重
    for (const g of backup.grammarProgress) {
      await db.grammarProgress.put(g);
      report.grammarProgress++;
    }

    // settings: 不覆盖敏感配置，且 apiKey 为空字符串时跳过（避免清空已有 key）
    for (const s of backup.settings ?? []) {
      if (s.key === 'ai' && s.value && typeof s.value === 'object') {
        const incoming = s.value as Record<string, unknown>;
        if (!incoming.apiKey || incoming.apiKey === '') {
          report.skippedSettings.push('ai (备份中无 apiKey)');
          continue;
        }
      }
      await db.settings.put(s);
      report.settings++;
    }
  });

  return report;
}
