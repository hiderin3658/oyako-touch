import { describe, it, expect } from "vitest";
import { loadLesson } from "@/lib/problems";
import type { Category } from "@/lib/types";

// フェーズ1（すうじ 1〜10 化 ＋ 全種目 正解位置 4:4:4 化）の横断検証。
// テスト仕様書 U12（全種目 4:4:4）・U13（number 1〜10 網羅）を実装対象とする。
// 既存の problems.color/animal.test.ts と同型（loadLesson で実データを読み込んで検証）。

// 正解位置バランス（4:4:4）を検証する対象カテゴリ。
// 問題数のハードコードは避け、length/3 による均等分割で検証する。
// 将来 size/count を追加した際は、この配列に追記すれば自動で対象になる。
const balancedCategories: Category[] = ["color", "shape", "number", "animal"];

describe("正解位置の 4:4:4 バランス（U12）", () => {
  for (const category of balancedCategories) {
    describe(`${category} レッスン`, () => {
      const lesson = loadLesson(category);

      it("問題数が 3 の倍数（均等 3 分割できる）", () => {
        expect(lesson.problems.length % 3).toBe(0);
      });

      it("正解位置 index 0/1/2 がそれぞれ length/3 問ずつ", () => {
        // 選択肢はシャッフルされない前提。正解位置は correct:true を含む
        // choices の並び位置（0=左 / 1=中 / 2=右）で決まる。
        const counts = [0, 0, 0];
        for (const problem of lesson.problems) {
          const correctIndex = problem.choices.findIndex(
            (choice) => choice.correct,
          );
          // 想定外の並び（正解なし・4件目以降）を検知する
          expect(
            correctIndex,
            `problem ${problem.id} の正解が index 0..2 に無い`,
          ).toBeGreaterThanOrEqual(0);
          expect(
            correctIndex,
            `problem ${problem.id} の正解位置が想定外`,
          ).toBeLessThanOrEqual(2);
          counts[correctIndex] += 1;
        }

        const expected = lesson.problems.length / 3;
        expect(counts[0], `${category} index0`).toBe(expected);
        expect(counts[1], `${category} index1`).toBe(expected);
        expect(counts[2], `${category} index2`).toBe(expected);
      });
    });
  }
});

describe("number は 1〜10 を網羅する（U13）", () => {
  const lesson = loadLesson("number");

  it("正解 value の集合が 1〜10 をすべて含む", () => {
    const correctValues = new Set<number>();
    for (const problem of lesson.problems) {
      // category で number バリアントに絞り込み、choice.value（number）を安全に参照する
      if (problem.category !== "number") continue;
      const correct = problem.choices.find((choice) => choice.correct);
      if (correct) {
        correctValues.add(correct.value);
      }
    }
    for (let value = 1; value <= 10; value += 1) {
      expect(correctValues.has(value), `${value} が正解に含まれない`).toBe(true);
    }
  });
});

// 余力検証: 4:4:4 対象カテゴリ横断で correct はちょうど1つ・id 一意。
// 既存の各カテゴリ個別テストとは重複しない「全対象横断」の観点で軽く担保する。
describe("4:4:4 対象カテゴリの整合（横断）", () => {
  for (const category of balancedCategories) {
    it(`${category}: 各問の correct はちょうど1つ`, () => {
      const lesson = loadLesson(category);
      for (const problem of lesson.problems) {
        const correctCount = problem.choices.filter(
          (choice) => choice.correct,
        ).length;
        expect(correctCount, `problem ${problem.id}`).toBe(1);
      }
    });

    it(`${category}: problem.id はレッスン内で一意`, () => {
      const lesson = loadLesson(category);
      const ids = lesson.problems.map((problem) => problem.id);
      expect(new Set(ids).size).toBe(ids.length);
    });
  }
});
