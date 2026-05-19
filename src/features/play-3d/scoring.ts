// 分数 / 连击 / 评级 算法
export const BASE_HIT = 100;

/** 速度奖励：≤5s = 1.0；≥25s = 0 线性 */
export function speedBonus(elapsedMs: number): number {
  const s = elapsedMs / 1000;
  if (s <= 5) return 1.0;
  if (s >= 25) return 0;
  return (25 - s) / 20;
}

/** 命中后计分 */
export function scoreForHit(combo: number, elapsedMs: number): number {
  const bonus = 1 + speedBonus(elapsedMs);
  return Math.round(BASE_HIT * combo * bonus);
}

export type Grade = 'S' | 'A' | 'B' | 'C' | 'D';

export function gradeFor(opts: {
  totalStages: number;
  passedStages: number;
  errors: number;
  avgStageMs: number;
}): Grade {
  const { totalStages, passedStages, errors, avgStageMs } = opts;
  if (passedStages === totalStages && errors === 0 && avgStageMs <= 8000) return 'S';
  if (passedStages >= 9 && errors <= 2) return 'A';
  if (passedStages >= 7) return 'B';
  if (passedStages >= 5) return 'C';
  return 'D';
}
