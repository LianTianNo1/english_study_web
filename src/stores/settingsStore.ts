import { create } from 'zustand';
import { getSetting, setSetting } from '@/db/schema';
import type { LevelId } from '@/db/types';

export type LearnOrder = 'sequential' | 'random';
export type AIProvider = 'openai' | 'gemini';
export type AIEndpoint = 'chat' | 'responses';

export interface AIConfig {
  enabled: boolean;
  provider: AIProvider;
  endpoint: AIEndpoint;
  baseURL: string;
  apiKey: string;
  model: string;
  temperature: number;
}

export interface TTSConfig {
  voiceURI: string;
  rate: number;
  pitch: number;
}

export const DEFAULT_AI: AIConfig = {
  enabled: false,
  provider: 'openai',
  endpoint: 'chat',
  baseURL: 'https://api.openai.com/v1',
  apiKey: '',
  model: 'gpt-4o-mini',
  temperature: 0.7,
};

export const DEFAULT_TTS: TTSConfig = {
  voiceURI: '',
  rate: 0.95,
  pitch: 1,
};

interface SettingsState {
  activeLevel: LevelId;
  dailyNewWords: number;
  dailyReviewLimit: number;
  learnOrder: LearnOrder;
  tts: TTSConfig;
  ai: AIConfig;
  loaded: boolean;
  load: () => Promise<void>;
  setActiveLevel: (id: LevelId) => Promise<void>;
  setDailyNewWords: (n: number) => Promise<void>;
  setDailyReviewLimit: (n: number) => Promise<void>;
  setLearnOrder: (o: LearnOrder) => Promise<void>;
  setTTS: (cfg: Partial<TTSConfig>) => Promise<void>;
  setAI: (cfg: Partial<AIConfig>) => Promise<void>;
}

export const useSettings = create<SettingsState>((set, get) => ({
  activeLevel: 'junior',
  dailyNewWords: 20,
  dailyReviewLimit: 100,
  learnOrder: 'sequential',
  tts: DEFAULT_TTS,
  ai: DEFAULT_AI,
  loaded: false,
  async load() {
    const [lvl, dnw, drl, order, tts, ai] = await Promise.all([
      getSetting<LevelId>('activeLevel', 'junior'),
      getSetting<number>('dailyNewWords', 20),
      getSetting<number>('dailyReviewLimit', 100),
      getSetting<LearnOrder>('learnOrder', 'sequential'),
      getSetting<TTSConfig>('tts', DEFAULT_TTS),
      getSetting<AIConfig>('ai', DEFAULT_AI),
    ]);
    set({
      activeLevel: lvl,
      dailyNewWords: dnw,
      dailyReviewLimit: drl,
      learnOrder: order,
      tts: { ...DEFAULT_TTS, ...tts },
      ai: { ...DEFAULT_AI, ...ai },
      loaded: true,
    });
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
  async setLearnOrder(o) {
    await setSetting('learnOrder', o);
    set({ learnOrder: o });
  },
  async setTTS(cfg) {
    const next = { ...get().tts, ...cfg };
    await setSetting('tts', next);
    set({ tts: next });
  },
  async setAI(cfg) {
    const next = { ...get().ai, ...cfg };
    await setSetting('ai', next);
    set({ ai: next });
  },
}));
