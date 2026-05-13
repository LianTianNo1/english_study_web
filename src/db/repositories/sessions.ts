import { db } from '../schema';
import type { SessionRecord, SessionType } from '../types';
import { todayKey } from '@/lib/utils';

export const sessionsRepo = {
  async log(rec: Omit<SessionRecord, 'id' | 'date'> & { date?: string }): Promise<void> {
    await db.sessions.add({ ...rec, date: rec.date ?? todayKey() });
  },

  async todayStats(): Promise<Record<SessionType, { words: number; correct: number }>> {
    const today = todayKey();
    const rows = await db.sessions.where('date').equals(today).toArray();
    const init = {
      learn: { words: 0, correct: 0 },
      review: { words: 0, correct: 0 },
      grammar: { words: 0, correct: 0 },
    } as Record<SessionType, { words: number; correct: number }>;
    for (const r of rows) {
      init[r.type].words += r.wordsCount;
      init[r.type].correct += r.correctCount;
    }
    return init;
  },

  async heatmap(days = 90): Promise<Record<string, number>> {
    const rows = await db.sessions.toArray();
    const map: Record<string, number> = {};
    for (const r of rows) {
      map[r.date] = (map[r.date] ?? 0) + r.wordsCount;
    }
    return map;
  },

  /** 取最近 N 天的明细记录 */
  async recent(days = 7): Promise<SessionRecord[]> {
    const rows = await db.sessions.toArray();
    const keys = new Set<string>();
    const today = new Date();
    for (let i = 0; i < days; i++) {
      const d = new Date(today);
      d.setDate(d.getDate() - i);
      const y = d.getFullYear();
      const m = String(d.getMonth() + 1).padStart(2, '0');
      const day = String(d.getDate()).padStart(2, '0');
      keys.add(`${y}-${m}-${day}`);
    }
    return rows.filter((r) => keys.has(r.date));
  },
};

export { todayKey };
