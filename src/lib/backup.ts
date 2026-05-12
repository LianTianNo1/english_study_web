import { db } from '@/db/schema';
import type { ProgressRecord, SessionRecord, GrammarProgressRecord, SettingsRecord, MnemonicRecord, WordRecord } from '@/db/types';

/** 备份默认只含"用户学习成果"——可选包含词库本体（用于换设备时跳过 5 分钟导入） */
export interface BackupV1 {
  version: 1;
  exportedAt: string;
  appVersion: string;
  progress: ProgressRecord[];
  sessions: SessionRecord[];
  grammarProgress: GrammarProgressRecord[];
  settings: SettingsRecord[];
  mnemonics?: MnemonicRecord[];
  words?: WordRecord[];        // v0.4+ 可选含词库
}

const APP_VERSION = '0.4.0';

/* ---------- 敏感字段脱敏 ---------- */
function sanitizeSettings(settings: SettingsRecord[], includeAIConfig: boolean): SettingsRecord[] {
  return settings.map((s) => {
    if (s.key !== 'ai') return s;
    if (includeAIConfig) return s; // 用户主动选择含 AI 配置时保留完整 apiKey
    if (s.value && typeof s.value === 'object') {
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
  includeWords?: boolean;   // 默认 false —— 体积可达 30+ MB
  includeAIConfig?: boolean; // 默认 false —— 含 apiKey，需用户主动勾选
}

export async function buildBackup(opts: ExportOptions = {}): Promise<BackupV1> {
  const { includeSettings = true, includeSessions = true, includeWords = false, includeAIConfig = false } = opts;
  const [progress, sessions, grammarProgress, settings, mnemonics, words] = await Promise.all([
    db.progress.toArray(),
    includeSessions ? db.sessions.toArray() : Promise.resolve([]),
    db.grammarProgress.toArray(),
    includeSettings ? db.settings.toArray() : Promise.resolve([]),
    db.mnemonics.toArray(),
    includeWords ? db.words.toArray() : Promise.resolve(undefined),
  ]);
  return {
    version: 1,
    exportedAt: new Date().toISOString(),
    appVersion: APP_VERSION,
    progress,
    sessions,
    grammarProgress,
    settings: sanitizeSettings(settings, includeAIConfig),
    mnemonics,
    ...(words ? { words } : {}),
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

export interface ImportOptions {
  strategy: ImportStrategy;
  /** 是否写入备份中的 AI 配置（含 apiKey），默认 false */
  applyAIConfig?: boolean;
}

export interface ImportReport {
  progress: number;
  sessions: number;
  grammarProgress: number;
  settings: number;
  mnemonics: number;
  words: number;
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

export async function applyBackup(backup: BackupV1, optsOrStrategy: ImportOptions | ImportStrategy): Promise<ImportReport> {
  // 兼容旧调用签名（直接传 strategy 字符串）
  const opts: ImportOptions = typeof optsOrStrategy === 'string'
    ? { strategy: optsOrStrategy }
    : optsOrStrategy;
  const { strategy, applyAIConfig = false } = opts;
  const report: ImportReport = {
    progress: 0,
    sessions: 0,
    grammarProgress: 0,
    settings: 0,
    mnemonics: 0,
    words: 0,
    skippedSettings: [],
  };

  await db.transaction('rw', [db.progress, db.sessions, db.grammarProgress, db.settings, db.mnemonics, db.words], async () => {
    if (strategy === 'replace') {
      await db.progress.clear();
      await db.sessions.clear();
      await db.grammarProgress.clear();
      await db.mnemonics.clear();
      // 词库只在备份包含 words 时才清空+替换（避免误清空已导入的词库）
      if (backup.words && backup.words.length > 0) {
        await db.words.clear();
      }
      // settings 不全清——保留 AI/TTS 等本地凭据
    }

    // words: 备份含才导入；按 [levelId, orderIndex] 去重处理
    if (backup.words && backup.words.length > 0) {
      if (strategy === 'merge') {
        // merge: 仅在词条不存在时插入（按 levelId+orderIndex 唯一）
        const existingPairs = new Set<string>();
        const all = await db.words.toArray();
        all.forEach((w) => existingPairs.add(`${w.levelId}:${w.orderIndex}`));
        const toAdd = backup.words
          .filter((w) => !existingPairs.has(`${w.levelId}:${w.orderIndex}`))
          .map(({ id, ...rest }) => rest as WordRecord);
        if (toAdd.length > 0) await db.words.bulkAdd(toAdd);
        report.words = toAdd.length;
      } else {
        const toAdd = backup.words.map(({ id, ...rest }) => rest as WordRecord);
        await db.words.bulkAdd(toAdd);
        report.words = toAdd.length;
      }
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

    // mnemonics: 按 wordId 覆盖
    for (const m of backup.mnemonics ?? []) {
      await db.mnemonics.put(m);
      report.mnemonics++;
    }

    // settings: ai 配置需用户在导入时主动勾选才写入
    for (const s of backup.settings ?? []) {
      if (s.key === 'ai') {
        if (!applyAIConfig) {
          report.skippedSettings.push('ai (未勾选"导入 AI 配置")');
          continue;
        }
        // 勾选后仍跳过 apiKey 为空的情况（防止覆盖已有 key）
        if (s.value && typeof s.value === 'object') {
          const incoming = s.value as Record<string, unknown>;
          if (!incoming.apiKey || incoming.apiKey === '') {
            report.skippedSettings.push('ai (备份中无 apiKey)');
            continue;
          }
        }
      }
      await db.settings.put(s);
      report.settings++;
    }
  });

  return report;
}
