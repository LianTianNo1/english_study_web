/** 极简打字机音效 —— 用 Web Audio API 合成，无外部资源。
 *  - tick: 短促的按键咔哒（白噪声 8ms + 低频咚 30ms）
 *  - chime: 答对时上行三连音
 *  - thud: 答错时一声闷响
 */
let ctx: AudioContext | null = null;
let enabledRef = false;

function getCtx(): AudioContext | null {
  if (typeof window === 'undefined') return null;
  if (!ctx) {
    const C = (window.AudioContext || (window as any).webkitAudioContext) as typeof AudioContext | undefined;
    if (!C) return null;
    ctx = new C();
  }
  if (ctx.state === 'suspended') ctx.resume().catch(() => undefined);
  return ctx;
}

export function setSfxEnabled(enabled: boolean) {
  enabledRef = enabled;
}

export function sfxTick() {
  if (!enabledRef) return;
  const ac = getCtx();
  if (!ac) return;
  const now = ac.currentTime;
  // 噪声 click
  const buf = ac.createBuffer(1, 256, ac.sampleRate);
  const d = buf.getChannelData(0);
  for (let i = 0; i < 256; i++) d[i] = (Math.random() * 2 - 1) * (1 - i / 256);
  const src = ac.createBufferSource();
  src.buffer = buf;
  const g = ac.createGain();
  g.gain.setValueAtTime(0.15, now);
  g.gain.exponentialRampToValueAtTime(0.001, now + 0.04);
  src.connect(g).connect(ac.destination);
  src.start(now);
  // 低音"咚"
  const osc = ac.createOscillator();
  osc.frequency.setValueAtTime(180, now);
  osc.frequency.exponentialRampToValueAtTime(80, now + 0.06);
  const og = ac.createGain();
  og.gain.setValueAtTime(0.08, now);
  og.gain.exponentialRampToValueAtTime(0.001, now + 0.06);
  osc.connect(og).connect(ac.destination);
  osc.start(now);
  osc.stop(now + 0.07);
}

export function sfxChime() {
  if (!enabledRef) return;
  const ac = getCtx();
  if (!ac) return;
  const now = ac.currentTime;
  const freqs = [523.25, 659.25, 783.99]; // C5 E5 G5
  freqs.forEach((f, i) => {
    const osc = ac.createOscillator();
    osc.type = 'triangle';
    osc.frequency.value = f;
    const g = ac.createGain();
    const t = now + i * 0.07;
    g.gain.setValueAtTime(0, t);
    g.gain.linearRampToValueAtTime(0.12, t + 0.01);
    g.gain.exponentialRampToValueAtTime(0.001, t + 0.25);
    osc.connect(g).connect(ac.destination);
    osc.start(t);
    osc.stop(t + 0.3);
  });
}

/** 连击音：音高随 combo 数上升（C5 + 半音步进，封顶 1 个八度） */
export function sfxCombo(combo: number) {
  if (!enabledRef) return;
  const ac = getCtx();
  if (!ac) return;
  const now = ac.currentTime;
  const step = Math.min(Math.max(combo - 1, 0), 12);
  const freq = 523.25 * Math.pow(2, step / 12);
  const osc = ac.createOscillator();
  osc.type = 'triangle';
  osc.frequency.value = freq;
  const g = ac.createGain();
  g.gain.setValueAtTime(0, now);
  g.gain.linearRampToValueAtTime(0.14, now + 0.01);
  g.gain.exponentialRampToValueAtTime(0.001, now + 0.18);
  osc.connect(g).connect(ac.destination);
  osc.start(now);
  osc.stop(now + 0.2);
}

/** 通关三和弦展开 */
export function sfxStageClear() {
  if (!enabledRef) return;
  const ac = getCtx();
  if (!ac) return;
  const now = ac.currentTime;
  const freqs = [523.25, 659.25, 783.99, 1046.5]; // C5 E5 G5 C6
  freqs.forEach((f, i) => {
    const osc = ac.createOscillator();
    osc.type = 'sawtooth';
    osc.frequency.value = f;
    const g = ac.createGain();
    const t = now + i * 0.05;
    g.gain.setValueAtTime(0, t);
    g.gain.linearRampToValueAtTime(0.1, t + 0.01);
    g.gain.exponentialRampToValueAtTime(0.001, t + 0.45);
    const filter = ac.createBiquadFilter();
    filter.type = 'lowpass';
    filter.frequency.value = 2000;
    osc.connect(filter).connect(g).connect(ac.destination);
    osc.start(t);
    osc.stop(t + 0.5);
  });
}

export function sfxThud() {
  if (!enabledRef) return;
  const ac = getCtx();
  if (!ac) return;
  const now = ac.currentTime;
  const osc = ac.createOscillator();
  osc.type = 'sine';
  osc.frequency.setValueAtTime(220, now);
  osc.frequency.exponentialRampToValueAtTime(70, now + 0.18);
  const g = ac.createGain();
  g.gain.setValueAtTime(0.18, now);
  g.gain.exponentialRampToValueAtTime(0.001, now + 0.2);
  osc.connect(g).connect(ac.destination);
  osc.start(now);
  osc.stop(now + 0.22);
}
