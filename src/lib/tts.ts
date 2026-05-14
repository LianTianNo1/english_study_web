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

/** Web Speech 可用性运行时探测：null=未知, true=可用, false=已确认坏（直接走降级） */
let synthUsable: boolean | null = null;

/** Tier 2 当前播放的 Audio 队列控制（用于 stopSpeaking 取消） */
let activeAudio: HTMLAudioElement | null = null;
let activeAudioToken = 0;

function hasSynth() {
  return typeof window !== 'undefined' && 'speechSynthesis' in window && 'SpeechSynthesisUtterance' in window;
}

/** 异步取声音列表：处理 Chrome/Edge 首次返回空、Safari 异步加载 */
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
    // 兜底：1.5s 后即便仍为空也 resolve（移动端若仍空将触发 Tier2 降级）
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

/** Chrome/Edge bug：长时间不发声后 paused 状态错误，需 resume */
function unstickSynth() {
  if (!hasSynth()) return;
  try {
    if (window.speechSynthesis.paused) window.speechSynthesis.resume();
  } catch { /* noop */ }
}

/** 用户手势内调用一次，"解锁"移动端合成器 */
export function warmUpTTS() {
  if (warmedUp) return;
  warmedUp = true;
  if (hasSynth()) {
    try {
      // 关键：空字符串在 Android 上会被吞，用空格保证真正触发引擎
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

// ============== Tier 2: Google Translate TTS（免 key、免 CORS） ==============

/** 按 ~180 字符切分句子，优先在词/标点边界断开（Google TTS 上限 ~200） */
function splitForGoogleTTS(text: string, max = 180): string[] {
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

function googleTTSUrl(chunk: string): string {
  const q = encodeURIComponent(chunk);
  return `https://translate.google.com/translate_tts?ie=UTF-8&q=${q}&tl=en&client=tw-ob`;
}

function speakViaGoogle(text: string, opts: SpeakOptions) {
  const chunks = splitForGoogleTTS(text);
  if (chunks.length === 0) { opts.onEnd?.(); return; }
  stopActiveAudio();
  const token = ++activeAudioToken;
  const { tts } = useSettings.getState();
  const playbackRate = clamp((tts.rate ?? 1) * (opts.rateMultiplier ?? 1), 0.5, 4);

  let i = 0;
  const playNext = () => {
    if (token !== activeAudioToken) return; // 已被 stop 或新一次播放覆盖
    if (i >= chunks.length) {
      activeAudio = null;
      opts.onEnd?.();
      return;
    }
    const a = new Audio(googleTTSUrl(chunks[i++]));
    a.preload = 'auto';
    a.playbackRate = playbackRate;
    a.onended = playNext;
    a.onerror = () => {
      console.warn('[tts] Google TTS audio error, abort chain');
      if (token === activeAudioToken) activeAudio = null;
    };
    activeAudio = a;
    a.play().catch((err) => {
      console.warn('[tts] Google TTS play() rejected:', err);
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
      if (!fired) fallbackToGoogle(text, opts);
    }
  };

  // 关键：同步调用 speak()，保留手势凭证
  window.speechSynthesis.speak(u);

  // 1.5s 内若 onstart 没触发 → 判定 Web Speech 不可用，降级
  watchdog = window.setTimeout(() => {
    if (!fired) {
      synthUsable = false;
      try { window.speechSynthesis.cancel(); } catch { /* noop */ }
      fallbackToGoogle(text, opts);
    }
  }, 1500);

  return true;
}

function fallbackToGoogle(text: string, opts: SpeakOptions) {
  console.info('[tts] fallback → Google Translate TTS');
  speakViaGoogle(text, opts);
}

// ============== 公共入口 ==============

function speakOnce(text: string, opts: SpeakOptions = {}) {
  if (!text) return;

  // 已确认 Web Speech 不可用：直走 Tier 2
  if (synthUsable === false || !hasSynth()) {
    speakViaGoogle(text, opts);
    return;
  }

  // voices 已就绪 → 同步 speak（保留手势链）
  if (refreshVoices().length > 0) {
    speakViaSynth(text, opts);
    return;
  }

  // voices 还没就绪：先尝试同步 speak（部分浏览器允许无 voice 默认朗读），
  // 同时启动 voices 探测；若 1.5s 仍空 → 强制降级
  const ok = speakViaSynth(text, opts);
  if (!ok) { speakViaGoogle(text, opts); return; }

  ensureVoices().then((list) => {
    if (list.length === 0 && synthUsable !== true) {
      // 没声音 + 引擎未确认可用：watchdog 会兜底降级
      synthUsable = false;
    }
  });
}

export function speak(text: string) {
  warmUpTTS();
  speakOnce(text);
}

/** 慢速朗读 (60% 速度) */
export function speakSlow(text: string) {
  warmUpTTS();
  speakOnce(text, { rateMultiplier: 0.6 });
}

/** 自动二连播：先正常速度，再慢速 */
export function speakTwice(text: string) {
  warmUpTTS();
  speakOnce(text, {
    onEnd: () => setTimeout(() => speakOnce(text, { rateMultiplier: 0.6 }), 300),
  });
}

/** 停止当前朗读（同时停 Tier 1 / Tier 2） */
export function stopSpeaking() {
  if (hasSynth()) {
    try { window.speechSynthesis.cancel(); } catch { /* noop */ }
  }
  stopActiveAudio();
}

function clamp(n: number, min: number, max: number) {
  return Math.max(min, Math.min(max, n));
}
