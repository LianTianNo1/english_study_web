import { useSettings } from '@/stores/settingsStore';

export interface VoiceInfo {
  voiceURI: string;
  name: string;
  lang: string;
  remote: boolean;
  isEdgeNatural: boolean;
}

let cachedVoices: SpeechSynthesisVoice[] = [];

function refreshVoices(): SpeechSynthesisVoice[] {
  if (typeof window === 'undefined' || !window.speechSynthesis) return [];
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
  return /natural|online|neural|wavenet|studio/i.test(v.name);
}

export function whenVoicesReady(cb: () => void) {
  if (typeof window === 'undefined' || !window.speechSynthesis) return;
  const ready = window.speechSynthesis.getVoices();
  if (ready.length > 0) {
    cb();
    return;
  }
  const handler = () => {
    cb();
    window.speechSynthesis.removeEventListener('voiceschanged', handler);
  };
  window.speechSynthesis.addEventListener('voiceschanged', handler);
}

export function speak(text: string) {
  if (typeof window === 'undefined' || !window.speechSynthesis) return;
  const { tts } = useSettings.getState();
  const u = new SpeechSynthesisUtterance(text);
  u.rate = tts.rate;
  u.pitch = tts.pitch;
  u.lang = 'en-US';
  if (tts.voiceURI) {
    const v = refreshVoices().find((x) => x.voiceURI === tts.voiceURI);
    if (v) u.voice = v;
  }
  window.speechSynthesis.cancel();
  window.speechSynthesis.speak(u);
}
