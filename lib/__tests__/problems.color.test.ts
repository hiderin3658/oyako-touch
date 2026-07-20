import { describe, it, expect } from "vitest";
import { loadLesson } from "@/lib/problems";
import type { ColorChoice } from "@/lib/types";

// color レッスン拡充（波D）の内容を検証する。
// 既存の problems.test.ts とは独立した新規ファイル。
describe("color レッスンの拡充", () => {
  const lesson = loadLesson("color");

  it("24問以上ある", () => {
    expect(lesson.problems.length).toBeGreaterThanOrEqual(24);
  });

  it("全問の correct はちょうど1つ", () => {
    for (const problem of lesson.problems) {
      const correctCount = problem.choices.filter(
        (choice) => choice.correct,
      ).length;
      expect(correctCount, `problem ${problem.id}`).toBe(1);
    }
  });

  it("problem.id はレッスン内で一意", () => {
    const ids = lesson.problems.map((problem) => problem.id);
    expect(new Set(ids).size).toBe(ids.length);
  });

  it("各 choice に color が設定されている", () => {
    for (const problem of lesson.problems) {
      for (const choice of problem.choices as ColorChoice[]) {
        expect(choice.color, `problem ${problem.id} / choice ${choice.id}`).toMatch(
          /^#[0-9A-Fa-f]{6}$/,
        );
      }
    }
  });

  it("既存の color-001..003 が先頭で維持されている", () => {
    expect(lesson.problems.slice(0, 3).map((problem) => problem.id)).toEqual([
      "color-001",
      "color-002",
      "color-003",
    ]);
  });
});
