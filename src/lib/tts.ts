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
    // voiceschanged 事件 + 轮询双保险（部分浏览器不触发事件）
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
    // 兜底：3 秒后即便仍为空也 resolve，避免永久挂起
    setTimeout(() => {
      clearInterval(timer);
      window.speechSynthesis.removeEventListener('voiceschanged', onChange);
      resolve(cachedVoices);
    }, 3000);
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

/** Chrome/Edge bug：长时间不发声后 paused 状态错误，需 resume；移动端首次需用户手势 */
function unstickSynth() {
  if (!hasSynth()) return;
  try {
    if (window.speechSynthesis.paused) window.speechSynthesis.resume();
  } catch { /* noop */ }
}

/** 用户手势内调用一次，"解锁"移动端 / 某些桌面浏览器的合成器 */
export function warmUpTTS() {
  if (warmedUp || !hasSynth()) return;
  try {
    const u = new SpeechSynthesisUtterance('');
    u.volume = 0;
    window.speechSynthesis.speak(u);
    warmedUp = true;
  } catch { /* noop */ }
}

function pickVoice(targetURI?: string): SpeechSynthesisVoice | undefined {
  const voices = refreshVoices();
  if (voices.length === 0) return undefined;
  if (targetURI) {
    const v = voices.find((x) => x.voiceURI === targetURI);
    if (v) return v;
  }
  // 首选英文 Natural / Online，其次任意 en
  const en = voices.filter((v) => /^en/i.test(v.lang));
  if (en.length === 0) return voices[0];
  const natural = en.find(isNatural);
  return natural ?? en[0];
}

interface SpeakOptions {
  /** 倍率覆盖（相对 user-pref rate 的乘数），默认 1 */
  rateMultiplier?: number;
  /** 朗读完成回调（用于二连播） */
  onEnd?: () => void;
}

function speakOnce(text: string, opts: SpeakOptions = {}) {
  if (!hasSynth() || !text) return;
  const { tts } = useSettings.getState();
  const fire = () => {
    unstickSynth();
    try { window.speechSynthesis.cancel(); } catch { /* noop */ }
    const u = new SpeechSynthesisUtterance(text);
    const mult = opts.rateMultiplier ?? 1;
    u.rate = clamp(tts.rate * mult, 0.3, 2);
    u.pitch = clamp(tts.pitch, 0, 2);
    u.lang = 'en-US';
    const v = pickVoice(tts.voiceURI);
    if (v) { u.voice = v; u.lang = v.lang || 'en-US'; }
    u.onerror = (e) => {
      const err = (e as SpeechSynthesisErrorEvent).error;
      if (err && err !== 'interrupted' && err !== 'canceled') {
        console.warn('[tts] speak error:', err);
      }
    };
    if (opts.onEnd) u.onend = () => opts.onEnd?.();
    setTimeout(() => { unstickSynth(); window.speechSynthesis.speak(u); }, 0);
  };
  if (refreshVoices().length === 0) ensureVoices().then(fire);
  else fire();
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

/** 停止当前朗读 */
export function stopSpeaking() {
  if (!hasSynth()) return;
  try { window.speechSynthesis.cancel(); } catch { /* noop */ }
}

function clamp(n: number, min: number, max: number) {
  return Math.max(min, Math.min(max, n));
}
