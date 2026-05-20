// 纯函数引擎 —— 难度曲线 / 坐标映射 / 锁定目标选择
import { BASE_POS, type Meteor } from './types';

/** 难度随击毁数递增 */
export function difficultyAt(destroyed: number): {
  speed: number;        // z/秒
  spawnInterval: number; // ms
  maxOnScreen: number;
} {
  const t = Math.min(1, destroyed / 20); // 20 词内爬满
  return {
    speed: 0.045 + t * 0.07,             // 0.045 → 0.115
    spawnInterval: 3200 - t * 1800,      // 3.2s → 1.4s
    maxOnScreen: Math.round(2 + t * 3),  // 2 → 5
  };
}

/** 陨石 z(0..1) → 世界坐标。远处发散，逼近时向基地汇聚 */
export function meteorWorldPos(m: Meteor): [number, number, number] {
  const t = Math.min(1, Math.max(0, m.z));
  // 深度：从 -44(深空) 推进到基地前方
  const depthZ = -44 + t * (BASE_POS[2] + 44);
  // 汇聚因子：远处 1(发散) → 近处 0.12(收拢到基地)
  const spread = 0.12 + (1 - t) * 0.88;
  const worldX = BASE_POS[0] + m.x * 11 * spread;
  const worldY = BASE_POS[1] + (4.5 + m.y * 5.5) * spread;
  return [worldX, worldY, depthZ];
}

/** 屏幕雷达坐标（-1..1 方框），用于右下角雷达 */
export function meteorRadarPos(m: Meteor): { rx: number; ry: number } {
  // ry: 1=深空(顶) 0=基地(底)；rx: 横向
  return {
    rx: Math.max(-1, Math.min(1, m.x)),
    ry: 1 - Math.min(1, Math.max(0, m.z)),
  };
}

/**
 * 锁定目标选择：候选 = status incoming 且「下一个待打字母 == letter」。
 * 无锁定时下一字母即 word[0]；取 z 最大（最逼近）的。
 */
export function pickLockTarget(
  meteors: Meteor[],
  letter: string,
  lockedId: string | null
): Meteor | null {
  if (lockedId) return null; // 已有锁定，不重选
  let best: Meteor | null = null;
  for (const m of meteors) {
    if (m.status !== 'incoming') continue;
    if (m.typedLen >= m.word.length) continue;
    if (m.word[m.typedLen] !== letter) continue;
    if (!best || m.z > best.z) best = m;
  }
  return best;
}

/** 字母正确得分（每字母） */
export function letterScore(combo: number): number {
  return 10 * (combo + 1);
}

/** 整词击毁得分 */
export function wordScore(wordLen: number, combo: number, lockedMs: number): number {
  const sec = lockedMs / 1000;
  const speedBonus = sec <= 2 ? 1 : sec >= 12 ? 0 : (12 - sec) / 10;
  return Math.round(wordLen * 50 * Math.max(1, combo) * (1 + speedBonus));
}

export type Grade = 'S' | 'A' | 'B' | 'C' | 'D';

export function gradeFor(opts: {
  total: number;
  destroyed: number;
  totalErrors: number;
  baseHp: number;
}): Grade {
  const { total, destroyed, totalErrors, baseHp } = opts;
  const ratio = total > 0 ? destroyed / total : 0;
  if (ratio === 1 && totalErrors === 0) return 'S';
  if (ratio >= 0.9 && totalErrors <= 3 && baseHp >= 3) return 'A';
  if (ratio >= 0.7) return 'B';
  if (ratio >= 0.5) return 'C';
  return 'D';
}
