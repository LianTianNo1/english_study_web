import { useSettings } from '@/stores/settingsStore';

export interface VoiceInfo {
  voiceURI: string;
  name: string;
  lang: string;
  remote: boolean;
  isEdgeNatural: boolean;
}

let cachedVoices: SpeechSynthesisVoice[] = [];
let warmedUp = false;
let voicesReadyPromise: Promise<SpeechSynthesisVoice[]> | null = null;

/** Tier 1 (Web Speech) 可用性运行时探测：null=未知, true=可用, false=已确认坏 */
let synthUsable: boolean | null = null;

/** Tier 2 当前播放控制（用于 stopSpeaking 取消） */
let activeAudio: HTMLAudioElement | null = null;
let activeAudioToken = 0;

function hasSynth() {
  return typeof window !== 'undefined' && 'speechSynthesis' in window && 'SpeechSynthesisUtterance' in window;
}

// ============== voices 异步加载 ==============

function ensureVoices(): Promise<SpeechSynthesisVoice[]> {
  if (!hasSynth()) return Promise.resolve([]);
  if (voicesReadyPromise) return voicesReadyPromise;
  voicesReadyPromise = new Promise((resolve) => {
    const tryGet = () => {
      const list = window.speechSynthesis.getVoices();
      if (list.length > 0) {
        cachedVoices = list;
        resolve(list);
        return true;
      }
      return false;
    };
    if (tryGet()) return;
    const onChange = () => {
      if (tryGet()) {
        window.speechSynthesis.removeEventListener('voiceschanged', onChange);
        clearInterval(timer);
      }
    };
    window.speechSynthesis.addEventListener('voiceschanged', onChange);
    const timer = setInterval(() => {
      if (tryGet()) {
        window.speechSynthesis.removeEventListener('voiceschanged', onChange);
        clearInterval(timer);
      }
    }, 250);
    setTimeout(() => {
      clearInterval(timer);
      window.speechSynthesis.removeEventListener('voiceschanged', onChange);
      resolve(cachedVoices);
    }, 1500);
  });
  return voicesReadyPromise;
}

function refreshVoices(): SpeechSynthesisVoice[] {
  if (!hasSynth()) return [];
  const list = window.speechSynthesis.getVoices();
  if (list.length > 0) cachedVoices = list;
  return cachedVoices;
}

export function listVoices(): VoiceInfo[] {
  const voices = refreshVoices()
    .filter((v) => /^en/i.test(v.lang))
    .sort((a, b) => Number(isNatural(b)) - Number(isNatural(a)));
  return voices.map((v) => ({
    voiceURI: v.voiceURI,
    name: v.name,
    lang: v.lang,
    remote: !v.localService,
    isEdgeNatural: isNatural(v),
  }));
}

function isNatural(v: SpeechSynthesisVoice) {
  return /natural|online|neural|wavenet|studio|enhanced|premium/i.test(v.name);
}

export function whenVoicesReady(cb: () => void) {
  ensureVoices().then(() => cb());
}

function unstickSynth() {
  if (!hasSynth()) return;
  try {
    if (window.speechSynthesis.paused) window.speechSynthesis.resume();
  } catch { /* noop */ }
}

export function warmUpTTS() {
  if (warmedUp) return;
  warmedUp = true;
  if (hasSynth()) {
    try {
      const u = new SpeechSynthesisUtterance(' ');
      u.volume = 0;
      window.speechSynthesis.speak(u);
    } catch { /* noop */ }
  }
}

function pickVoice(targetURI?: string): SpeechSynthesisVoice | undefined {
  const voices = refreshVoices();
  if (voices.length === 0) return undefined;
  if (targetURI) {
    const v = voices.find((x) => x.voiceURI === targetURI);
    if (v) return v;
  }
  const en = voices.filter((v) => /^en/i.test(v.lang));
  if (en.length === 0) return voices[0];
  const natural = en.find(isNatural);
  return natural ?? en[0];
}

interface SpeakOptions {
  rateMultiplier?: number;
  onEnd?: () => void;
}

// ============== Tier 2: 多镜像云端 TTS（国内优先） ==============
// 顺序按 navigator.language 推断：中文 → 有道优先；其他 → Google 优先
// 单个 provider 加载失败即标记 dead，自动切下一个；全部 dead → Tier 3

interface CloudProvider {
  name: string;
  maxChars: number;
  urlOf: (chunk: string) => string;
  dead: boolean;
}

function buildProviders(): CloudProvider[] {
  const youdao: CloudProvider = {
    name: 'youdao',
    maxChars: 600,
    urlOf: (t) => `https://dict.youdao.com/dictvoice?audio=${encodeURIComponent(t)}&type=1`,
    dead: false,
  };
  const google: CloudProvider = {
    name: 'google',
    maxChars: 180,
    urlOf: (t) => `https://translate.google.com/translate_tts?ie=UTF-8&q=${encodeURIComponent(t)}&tl=en&client=tw-ob`,
    dead: false,
  };
  const googleApi: CloudProvider = {
    name: 'googleapis',
    maxChars: 180,
    urlOf: (t) => `https://translate.googleapis.com/translate_tts?ie=UTF-8&q=${encodeURIComponent(t)}&tl=en&client=gtx`,
    dead: false,
  };
  const lang = typeof navigator !== 'undefined' ? navigator.language || '' : '';
  return /^zh/i.test(lang) ? [youdao, google, googleApi] : [google, googleApi, youdao];
}

let providers: CloudProvider[] = buildProviders();

function pickProvider(): CloudProvider | null {
  return providers.find((p) => !p.dead) ?? null;
}

function splitForProvider(text: string, max: number): string[] {
  const t = text.trim();
  if (t.length <= max) return [t];
  const out: string[] = [];
  let rest = t;
  while (rest.length > max) {
    let cut = rest.lastIndexOf(' ', max);
    const punct = Math.max(
      rest.lastIndexOf('. ', max),
      rest.lastIndexOf(', ', max),
      rest.lastIndexOf('; ', max),
      rest.lastIndexOf('? ', max),
      rest.lastIndexOf('! ', max),
    );
    if (punct > max * 0.5) cut = punct + 1;
    if (cut <= 0) cut = max;
    out.push(rest.slice(0, cut).trim());
    rest = rest.slice(cut).trim();
  }
  if (rest) out.push(rest);
  return out;
}

function speakViaCloud(text: string, opts: SpeakOptions) {
  const provider = pickProvider();
  if (!provider) { fallbackToEspeak(text, opts); return; }
  const chunks = splitForProvider(text, provider.maxChars);
  if (chunks.length === 0) { opts.onEnd?.(); return; }
  stopActiveAudio();
  const token = ++activeAudioToken;
  const { tts } = useSettings.getState();
  const playbackRate = clamp((tts.rate ?? 1) * (opts.rateMultiplier ?? 1), 0.5, 4);

  let i = 0;
  const playNext = () => {
    if (token !== activeAudioToken) return;
    if (i >= chunks.length) { activeAudio = null; opts.onEnd?.(); return; }
    const a = new Audio(provider.urlOf(chunks[i++]));
    a.preload = 'auto';
    a.playbackRate = playbackRate;
    a.onended = playNext;
    a.onerror = () => {
      if (token !== activeAudioToken) return;
      console.warn(`[tts] provider "${provider.name}" failed, marking dead`);
      provider.dead = true;
      activeAudio = null;
      // 切换到下一个 provider 重播整段
      speakViaCloud(text, opts);
    };
    activeAudio = a;
    a.play().catch((err) => {
      console.warn(`[tts] provider "${provider.name}" play rejected:`, err);
      provider.dead = true;
      speakViaCloud(text, opts);
    });
  };
  playNext();
}

function stopActiveAudio() {
  activeAudioToken++;
  if (activeAudio) {
    try { activeAudio.pause(); activeAudio.src = ''; } catch { /* noop */ }
    activeAudio = null;
  }
}

// ============== Tier 3: meSpeak WASM 离线兜底（~1.7MB lazy load） ==============
// 需 npm i mespeak。运行时 dynamic import，未安装则优雅放弃并日志提示。

let espeakReady: boolean | null = null; // null=未尝试, true=就绪, false=加载失败
let espeakModule: any = null;

async function ensureEspeak(): Promise<boolean> {
  if (espeakReady !== null) return espeakReady;
  try {
    // @ts-expect-error — mespeak 无 .d.ts，运行期 Tier 3 兜底才会触发，按 lazy chunk 加载
    const m: any = await import('mespeak');
    const mespeak = m.default ?? m;
    const cfg = (await import('mespeak/src/mespeak_config.json')).default;
    const voice = (await import('mespeak/voices/en/en-us.json')).default;
    mespeak.loadConfig(cfg);
    mespeak.loadVoice(voice);
    espeakModule = mespeak;
    espeakReady = true;
    console.info('[tts] meSpeak (Tier 3 offline) ready');
    return true;
  } catch (e) {
    espeakReady = false;
    console.warn('[tts] meSpeak unavailable, install with: npm i mespeak', e);
    return false;
  }
}

function speakViaEspeak(text: string, opts: SpeakOptions) {
  ensureEspeak().then((ok) => {
    if (!ok) { opts.onEnd?.(); return; }
    const { tts } = useSettings.getState();
    const rate = clamp((tts.rate ?? 1) * (opts.rateMultiplier ?? 1), 0.5, 2);
    try {
      espeakModule.speak(text, {
        amplitude: 100,
        pitch: clamp((tts.pitch ?? 1) * 50, 0, 99),
        speed: Math.round(175 * rate), // meSpeak 默认 175 wpm
        callback: () => opts.onEnd?.(),
      });
    } catch (e) {
      console.warn('[tts] meSpeak speak error:', e);
      opts.onEnd?.();
    }
  });
}

function fallbackToEspeak(text: string, opts: SpeakOptions) {
  console.info('[tts] all cloud providers dead → Tier 3 (meSpeak offline)');
  speakViaEspeak(text, opts);
}

// ============== Tier 1: Web Speech API（含探测 + 自动降级） ==============

function speakViaSynth(text: string, opts: SpeakOptions): boolean {
  if (!hasSynth()) return false;
  const { tts } = useSettings.getState();
  unstickSynth();
  try { window.speechSynthesis.cancel(); } catch { /* noop */ }

  const u = new SpeechSynthesisUtterance(text);
  const mult = opts.rateMultiplier ?? 1;
  u.rate = clamp(tts.rate * mult, 0.3, 2);
  u.pitch = clamp(tts.pitch, 0, 2);
  u.lang = 'en-US';
  const v = pickVoice(tts.voiceURI);
  if (v) { u.voice = v; u.lang = v.lang || 'en-US'; }

  let fired = false;
  let watchdog: number | undefined;

  u.onstart = () => {
    fired = true;
    synthUsable = true;
    if (watchdog) clearTimeout(watchdog);
  };
  u.onend = () => { if (fired) opts.onEnd?.(); };
  u.onerror = (e) => {
    const err = (e as SpeechSynthesisErrorEvent).error;
    if (err && err !== 'interrupted' && err !== 'canceled') {
      console.warn('[tts] synth error:', err);
      if (!fired) fallbackToCloud(text, opts);
    }
  };

  window.speechSynthesis.speak(u);

  watchdog = window.setTimeout(() => {
    if (!fired) {
      synthUsable = false;
      try { window.speechSynthesis.cancel(); } catch { /* noop */ }
      fallbackToCloud(text, opts);
    }
  }, 1500);

  return true;
}

function fallbackToCloud(text: string, opts: SpeakOptions) {
  console.info('[tts] fallback → Tier 2 cloud TTS');
  speakViaCloud(text, opts);
}

// ============== 公共入口 ==============

function speakOnce(text: string, opts: SpeakOptions = {}) {
  if (!text) return;

  if (synthUsable === false || !hasSynth()) {
    speakViaCloud(text, opts);
    return;
  }

  if (refreshVoices().length > 0) {
    speakViaSynth(text, opts);
    return;
  }

  const ok = speakViaSynth(text, opts);
  if (!ok) { speakViaCloud(text, opts); return; }

  ensureVoices().then((list) => {
    if (list.length === 0 && synthUsable !== true) synthUsable = false;
  });
}

export function speak(text: string) {
  warmUpTTS();
  speakOnce(text);
}

export function speakSlow(text: string) {
  warmUpTTS();
  speakOnce(text, { rateMultiplier: 0.6 });
}

export function speakTwice(text: string) {
  warmUpTTS();
  speakOnce(text, {
    onEnd: () => setTimeout(() => speakOnce(text, { rateMultiplier: 0.6 }), 300),
  });
}

export function stopSpeaking() {
  if (hasSynth()) {
    try { window.speechSynthesis.cancel(); } catch { /* noop */ }
  }
  stopActiveAudio();
  if (espeakModule) {
    try { espeakModule.stop?.(); } catch { /* noop */ }
  }
}

function clamp(n: number, min: number, max: number) {
  return Math.max(min, Math.min(max, n));
}
