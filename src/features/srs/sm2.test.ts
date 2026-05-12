import { describe, it, expect } from 'vitest';
import { sm2, INITIAL_SRS } from './sm2';

describe('sm2 algorithm', () => {
  it('first correct answer sets interval=1', () => {
    const r = sm2(4, INITIAL_SRS);
    expect(r.repetitions).toBe(1);
    expect(r.interval).toBe(1);
  });

  it('second correct answer sets interval=6', () => {
    const r1 = sm2(4, INITIAL_SRS);
    const r2 = sm2(4, r1);
    expect(r2.repetitions).toBe(2);
    expect(r2.interval).toBe(6);
  });

  it('third correct answer uses easeFactor', () => {
    const r1 = sm2(4, INITIAL_SRS);
    const r2 = sm2(4, r1);
    const r3 = sm2(4, r2);
    expect(r3.repetitions).toBe(3);
    expect(r3.interval).toBeGreaterThan(6);
  });

  it('forgetting resets repetitions and interval', () => {
    const after3 = sm2(4, sm2(4, sm2(4, INITIAL_SRS)));
    const reset = sm2(0, after3);
    expect(reset.repetitions).toBe(0);
    expect(reset.interval).toBe(1);
  });

  it('easeFactor never drops below 1.3', () => {
    let s = INITIAL_SRS;
    for (let i = 0; i < 30; i++) s = sm2(3, s);
    expect(s.easeFactor).toBeGreaterThanOrEqual(1.3);
  });
});
