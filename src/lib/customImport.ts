/**
 * 自定义词库导入：支持 JSON 数组 或 CSV。
 * 全部写入 levelId='custom' 名下，与官方词库隔离。
 *
 * CSV 列名规范（首行表头，UTF-8，可任意大小写、逗号或制表符分隔）：
 *   word, translation, type?, phrase?, phraseTranslation?
 *
 *   一个 word 多义 / 多词组 可写多行 → 同 word 会被自动合并
 *
 * JSON 格式：
 *   [
 *     { "word":"apple", "translations":[{"translation":"苹果","type":"n"}], "phrases":[] },
 *     ...
 *   ]
 *  或者更宽松：[{ "word":"apple", "translation":"苹果", "type":"n" }, ...]
 */
import { db } from '@/db/schema';
import type { WordRecord, LevelId } from '@/db/types';

export const CUSTOM_LEVEL_ID = 'custom' as LevelId;

export interface CustomImportResult {
  total: number;       // 解析出的单词数
  imported: number;    // 实际写入数（合并后）
  failed: number;
  preview: string[];   // 前几个词预览
}

interface RawRow {
  word: string;
  translation: string;
  type?: string;
  phrase?: string;
  phraseTranslation?: string;
}

function parseCSV(text: string): RawRow[] {
  // 去 BOM、规范换行
  text = text.replace(/^﻿/, '').replace(/\r\n?/g, '\n').trim();
  const lines = text.split('\n').filter((l) => l.trim());
  if (lines.length < 2) return [];
  const sep = lines[0].includes('\t') ? '\t' : ',';
  const head = parseCSVRow(lines[0], sep).map((s) => s.trim().toLowerCase());
  const wordIdx = head.findIndex((h) => /^word$|^单词$|^英文$/.test(h));
  const transIdx = head.findIndex((h) => /^translation$|^释义$|^中文$|^meaning$/.test(h));
  const typeIdx = head.findIndex((h) => /^type$|^词性$|^pos$/.test(h));
  const phraseIdx = head.findIndex((h) => /^phrase$|^词组$/.test(h));
  const phraseTransIdx = head.findIndex((h) => /^phrasetranslation$|^词组释义$/.test(h));
  if (wordIdx < 0 || transIdx < 0) {
    throw new Error('CSV 表头必须包含 word 和 translation 两列');
  }
  const rows: RawRow[] = [];
  for (let i = 1; i < lines.length; i++) {
    const cells = parseCSVRow(lines[i], sep);
    const word = (cells[wordIdx] || '').trim();
    const translation = (cells[transIdx] || '').trim();
    if (!word || !translation) continue;
    rows.push({
      word,
      translation,
      type: typeIdx >= 0 ? (cells[typeIdx] || '').trim() : '',
      phrase: phraseIdx >= 0 ? (cells[phraseIdx] || '').trim() : undefined,
      phraseTranslation: phraseTransIdx >= 0 ? (cells[phraseTransIdx] || '').trim() : undefined,
    });
  }
  return rows;
}

function parseCSVRow(line: string, sep: string): string[] {
  // 支持双引号包围的字段（含分隔符或换行）
  const out: string[] = [];
  let cur = '';
  let inQ = false;
  for (let i = 0; i < line.length; i++) {
    const c = line[i];
    if (inQ) {
      if (c === '"') {
        if (line[i + 1] === '"') { cur += '"'; i++; }
        else inQ = false;
      } else cur += c;
    } else {
      if (c === '"') inQ = true;
      else if (c === sep) { out.push(cur); cur = ''; }
      else cur += c;
    }
  }
  out.push(cur);
  return out;
}

function normalizeJSON(j: unknown): RawRow[] {
  if (!Array.isArray(j)) throw new Error('JSON 顶层必须是数组');
  const out: RawRow[] = [];
  for (const x of j) {
    if (!x || typeof x !== 'object') continue;
    const o = x as any;
    const word = String(o.word ?? '').trim();
    if (!word) continue;
    // 形式 A：WordRecord 标准结构
    if (Array.isArray(o.translations)) {
      for (const t of o.translations) {
        const trans = String(t?.translation ?? '').trim();
        if (!trans) continue;
        out.push({ word, translation: trans, type: t?.type ? String(t.type) : '' });
      }
      if (Array.isArray(o.phrases)) {
        for (const p of o.phrases) {
          out.push({
            word, translation: '',
            phrase: String(p?.phrase ?? ''),
            phraseTranslation: String(p?.translation ?? ''),
          });
        }
      }
      continue;
    }
    // 形式 B：扁平
    const translation = String(o.translation ?? o.meaning ?? '').trim();
    if (!translation) continue;
    out.push({
      word,
      translation,
      type: o.type ? String(o.type) : '',
      phrase: o.phrase ? String(o.phrase) : undefined,
      phraseTranslation: o.phraseTranslation ? String(o.phraseTranslation) : undefined,
    });
  }
  return out;
}

/** 合并同 word 的多行 → 一个 WordRecord */
function aggregate(rows: RawRow[]): WordRecord[] {
  const map = new Map<string, WordRecord>();
  let idx = 0;
  for (const r of rows) {
    if (!r.word) continue;
    let rec = map.get(r.word);
    if (!rec) {
      rec = {
        levelId: CUSTOM_LEVEL_ID,
        orderIndex: idx++,
        word: r.word,
        translations: [],
        phrases: [],
      };
      map.set(r.word, rec);
    }
    if (r.translation) {
      if (!rec.translations.some((t) => t.translation === r.translation && (t.type || '') === (r.type || ''))) {
        rec.translations.push({ translation: r.translation, type: r.type || '' });
      }
    }
    if (r.phrase && r.phraseTranslation) {
      rec.phrases.push({ phrase: r.phrase, translation: r.phraseTranslation });
    }
  }
  return Array.from(map.values()).filter((r) => r.translations.length > 0);
}

export async function importCustomWords(
  file: File,
  opts: { strategy: 'merge' | 'replace' } = { strategy: 'merge' }
): Promise<CustomImportResult> {
  const text = await file.text();
  let rows: RawRow[] = [];
  const lowerName = file.name.toLowerCase();
  if (lowerName.endsWith('.json')) {
    try { rows = normalizeJSON(JSON.parse(text)); }
    catch (e) { throw new Error(`JSON 解析失败：${(e as Error).message}`); }
  } else {
    // 默认按 CSV 处理（包括 .csv / .tsv / .txt）
    rows = parseCSV(text);
  }
  const records = aggregate(rows);
  if (records.length === 0) {
    throw new Error('没有解析出任何有效词条，请检查文件格式');
  }

  let imported = 0;
  await db.transaction('rw', db.words, async () => {
    if (opts.strategy === 'replace') {
      await db.words.where('levelId').equals(CUSTOM_LEVEL_ID).delete();
    }
    // 合并：按 [levelId+word] 去重
    const existing = await db.words.where('levelId').equals(CUSTOM_LEVEL_ID).toArray();
    const existingWords = new Set(existing.map((w) => w.word));
    const startOrder = opts.strategy === 'replace' ? 0 : existing.length;
    const toAdd: WordRecord[] = [];
    let order = startOrder;
    for (const r of records) {
      if (opts.strategy === 'merge' && existingWords.has(r.word)) continue;
      toAdd.push({ ...r, orderIndex: order++ });
    }
    if (toAdd.length > 0) {
      await db.words.bulkAdd(toAdd);
      imported = toAdd.length;
    }
  });

  return {
    total: records.length,
    imported,
    failed: 0,
    preview: records.slice(0, 5).map((r) => r.word),
  };
}

/** 当前 custom level 词条数量 */
export async function customLevelCount(): Promise<number> {
  return db.words.where('levelId').equals(CUSTOM_LEVEL_ID).count();
}
