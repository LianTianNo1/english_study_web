import { describe, expect, it } from 'vitest';
import { GRAMMAR_LESSONS } from './grammar-lessons';

describe('零基础语法课程内容', () => {
  it('保持 25 节连续课程', () => {
    expect(GRAMMAR_LESSONS).toHaveLength(25);
    expect(GRAMMAR_LESSONS.map((lesson) => lesson.index)).toEqual(
      Array.from({ length: 25 }, (_, index) => index + 1),
    );
  });

  it('每节至少提供 5 个例句和 8 道基础题', () => {
    for (const lesson of GRAMMAR_LESSONS) {
      expect(lesson.examples.length, lesson.id).toBeGreaterThanOrEqual(5);
      expect(lesson.exercises.length, lesson.id).toBeGreaterThanOrEqual(8);
    }
  });

  it('第 9 节起都包含识别、填空和纠错训练', () => {
    for (const lesson of GRAMMAR_LESSONS.filter((item) => item.index >= 9)) {
      const types = new Set(lesson.exercises.map((exercise) => exercise.type));
      expect(types.has('choice'), lesson.id).toBe(true);
      expect(types.has('fillblank'), lesson.id).toBe(true);
      expect(types.has('correction'), lesson.id).toBe(true);
    }
  });
});
