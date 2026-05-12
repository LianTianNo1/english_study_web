import { create } from 'zustand';
import { getSetting, setSetting } from '@/db/schema';
import type { LevelId } from '@/db/types';

interface SettingsState {
  activeLevel: LevelId;
  dailyNewWords: number;
  dailyReviewLimit: number;
  loaded: boolean;
  load: () => Promise<void>;
  setActiveLevel: (id: LevelId) => Promise<void>;
  setDailyNewWords: (n: number) => Promise<void>;
  setDailyReviewLimit: (n: number) => Promise<void>;
}

export const useSettings = create<SettingsState>((set) => ({
  activeLevel: 'junior',
  dailyNewWords: 20,
  dailyReviewLimit: 100,
  loaded: false,
  async load() {
    const [lvl, dnw, drl] = await Promise.all([
      getSetting<LevelId>('activeLevel', 'junior'),
      getSetting<number>('dailyNewWords', 20),
      getSetting<number>('dailyReviewLimit', 100),
    ]);
    set({ activeLevel: lvl, dailyNewWords: dnw, dailyReviewLimit: drl, loaded: true });
  },
  async setActiveLevel(id) {
    await setSetting('activeLevel', id);
    set({ activeLevel: id });
  },
  async setDailyNewWords(n) {
    await setSetting('dailyNewWords', n);
    set({ dailyNewWords: n });
  },
  async setDailyReviewLimit(n) {
    await setSetting('dailyReviewLimit', n);
    set({ dailyReviewLimit: n });
  },
}));
