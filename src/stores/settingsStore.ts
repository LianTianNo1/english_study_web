import { create } from 'zustand';
import { getSetting, setSetting } from '@/db/schema';
import type { LevelId } from '@/db/types';

export type LearnOrder = 'sequential' | 'random';
export type AIProvider = 'openai' | 'gemini';
export type AIEndpoint = 'chat' | 'responses';
export type ReviewAlgorithm = 'sm2' | 'ebbinghaus';
/** 学习模式：classic = 现有流程；enhanced = 启用 5min 微复习/主动回忆/错词加权等 */
export type LearningMode = 'classic' | 'enhanced';

export interface EnhancedConfig {
  /** 学完新词后启动 5 分钟内的快闪复习 */
  microReview: boolean;
  /** 错词加权进 Review：高错频词优先 / 重复出现 */
  wrongWeighted: boolean;
  /** Review 揭晓后弹出"用词造句"步骤 */
  activeRecall: boolean;
  /** 词卡显示后自动慢速朗读两遍 */
  autoSlowTTS: boolean;
  /** 启用录音回放对比 */
  recordingEnabled: boolean;
  /** 词卡显示词根/词缀同源词面板 */
  showWordRoots: boolean;
}

export interface AIConfig {
  enabled: boolean;
  provider: AIProvider;
  endpoint: AIEndpoint;
  baseURL: string;
  apiKey: string;
  model: string;
  temperature: number;
  /** AI 加题默认数量 (1-10) */
  exerciseCount: number;
  /** 批量生成巧记的批次大小 (5-50) */
  mnemonicBatchSize: number;
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
  exerciseCount: 3,
  mnemonicBatchSize: 20,
};

export const DEFAULT_TTS: TTSConfig = {
  voiceURI: '',
  rate: 0.95,
  pitch: 1,
};

export const DEFAULT_ENHANCED: EnhancedConfig = {
  microReview: true,
  wrongWeighted: true,
  activeRecall: true,
  autoSlowTTS: true,
  recordingEnabled: true,
  showWordRoots: true,
};

interface SettingsState {
  activeLevel: LevelId;
  dailyNewWords: number;
  dailyReviewLimit: number;
  learnOrder: LearnOrder;
  reviewAlgorithm: ReviewAlgorithm;
  sfxEnabled: boolean;
  tts: TTSConfig;
  ai: AIConfig;
  learningMode: LearningMode;
  enhanced: EnhancedConfig;
  loaded: boolean;
  load: () => Promise<void>;
  setActiveLevel: (id: LevelId) => Promise<void>;
  setDailyNewWords: (n: number) => Promise<void>;
  setDailyReviewLimit: (n: number) => Promise<void>;
  setLearnOrder: (o: LearnOrder) => Promise<void>;
  setReviewAlgorithm: (a: ReviewAlgorithm) => Promise<void>;
  setSfxEnabled: (b: boolean) => Promise<void>;
  setTTS: (cfg: Partial<TTSConfig>) => Promise<void>;
  setAI: (cfg: Partial<AIConfig>) => Promise<void>;
  setLearningMode: (m: LearningMode) => Promise<void>;
  setEnhanced: (cfg: Partial<EnhancedConfig>) => Promise<void>;
}

export const useSettings = create<SettingsState>((set, get) => ({
  activeLevel: 'junior',
  dailyNewWords: 20,
  dailyReviewLimit: 100,
  learnOrder: 'sequential',
  reviewAlgorithm: 'sm2',
  sfxEnabled: false,
  tts: DEFAULT_TTS,
  ai: DEFAULT_AI,
  learningMode: 'classic',
  enhanced: DEFAULT_ENHANCED,
  loaded: false,
  async load() {
    const [lvl, dnw, drl, order, algo, sfx, tts, ai, mode, enh] = await Promise.all([
      getSetting<LevelId>('activeLevel', 'junior'),
      getSetting<number>('dailyNewWords', 20),
      getSetting<number>('dailyReviewLimit', 100),
      getSetting<LearnOrder>('learnOrder', 'sequential'),
      getSetting<ReviewAlgorithm>('reviewAlgorithm', 'sm2'),
      getSetting<boolean>('sfxEnabled', false),
      getSetting<TTSConfig>('tts', DEFAULT_TTS),
      getSetting<AIConfig>('ai', DEFAULT_AI),
      getSetting<LearningMode>('learningMode', 'classic'),
      getSetting<EnhancedConfig>('enhanced', DEFAULT_ENHANCED),
    ]);
    set({
      activeLevel: lvl,
      dailyNewWords: dnw,
      dailyReviewLimit: drl,
      learnOrder: order,
      reviewAlgorithm: algo,
      sfxEnabled: sfx,
      tts: { ...DEFAULT_TTS, ...tts },
      ai: { ...DEFAULT_AI, ...ai },
      learningMode: mode,
      enhanced: { ...DEFAULT_ENHANCED, ...enh },
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
  async setReviewAlgorithm(a) {
    await setSetting('reviewAlgorithm', a);
    set({ reviewAlgorithm: a });
  },
  async setSfxEnabled(b) {
    await setSetting('sfxEnabled', b);
    set({ sfxEnabled: b });
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
  async setLearningMode(m) {
    await setSetting('learningMode', m);
    set({ learningMode: m });
  },
  async setEnhanced(cfg) {
    const next = { ...get().enhanced, ...cfg };
    await setSetting('enhanced', next);
    set({ enhanced: next });
  },
}));
