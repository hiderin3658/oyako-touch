import { describe, it, expect } from "vitest";
import { loadLesson } from "@/lib/problems";
import type { Category } from "@/lib/types";

// すうじ 1〜10 網羅 ＋ 全種目の正解位置バランスの横断検証。
// テスト仕様書 U13（number 1〜10 網羅）を実装対象とする。
// 正解位置は実行時（pickProblems）に均等シャッフルされるため、JSON 上の
// 位置分布は厳密比率（4:4:4）を要求せず「各位置が最低1回使われる」ことのみを担保する。
// 既存の problems.color/animal.test.ts と同型（loadLesson で実データを読み込んで検証）。

// 正解位置の分布を検証する対象カテゴリ。
// 将来カテゴリを追加した際は、この配列に追記すれば自動で対象になる。
const balancedCategories: Category[] = [
  "color",
  "shape",
  "number",
  "animal",
  "size",
  "count",
];

describe("正解位置の分布（実行時シャッフル前提で緩和）", () => {
  for (const category of balancedCategories) {
    describe(`${category} レッスン`, () => {
      const lesson = loadLesson(category);

      it("問題数が 3 の倍数（均等 3 分割できる）", () => {
        expect(lesson.problems.length % 3).toBe(0);
      });

      it("正解位置 index 0/1/2 が全て少なくとも1回使われる", () => {
        // 出題時は pickProblems が選択肢を均等シャッフルするため、JSON 上の
        // 位置の厳密比率は問わない。全問の正解が同じ位置に固まる等の
        // 明らかな偏りだけを検知する（各位置が最低1回使われること）。
        const counts = [0, 0, 0];
        for (const problem of lesson.problems) {
          // なぞりは選択肢を持たず対象外（balancedCategories にも含めない）。
          if (problem.category === "nazori") continue;
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

        expect(counts[0], `${category} index0`).toBeGreaterThan(0);
        expect(counts[1], `${category} index1`).toBeGreaterThan(0);
        expect(counts[2], `${category} index2`).toBeGreaterThan(0);
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

describe("size の設問方向が混在する（U14）", () => {
  const lesson = loadLesson("size");

  it("prompt.text に「おおきい」「ちいさい」が半々で含まれる", () => {
    let bigger = 0;
    let smaller = 0;
    for (const problem of lesson.problems) {
      if (problem.prompt.text.includes("おおきい")) {
        bigger += 1;
      }
      if (problem.prompt.text.includes("ちいさい")) {
        smaller += 1;
      }
    }
    const half = lesson.problems.length / 2;
    expect(bigger, "おおきい 設問数").toBe(half);
    expect(smaller, "ちいさい 設問数").toBe(half);
  });
});

describe("count の設問方向が混在する", () => {
  const lesson = loadLesson("count");

  it("prompt.text に「おおい」「すくない」が半々で含まれる", () => {
    let more = 0;
    let fewer = 0;
    for (const problem of lesson.problems) {
      if (problem.prompt.text.includes("おおい")) {
        more += 1;
      }
      if (problem.prompt.text.includes("すくない")) {
        fewer += 1;
      }
    }
    const half = lesson.problems.length / 2;
    expect(more, "おおい 設問数").toBe(half);
    expect(fewer, "すくない 設問数").toBe(half);
  });
});

// 余力検証: 4:4:4 対象カテゴリ横断で correct はちょうど1つ・id 一意。
// 既存の各カテゴリ個別テストとは重複しない「全対象横断」の観点で軽く担保する。
describe("4:4:4 対象カテゴリの整合（横断）", () => {
  for (const category of balancedCategories) {
    it(`${category}: 各問の correct はちょうど1つ`, () => {
      const lesson = loadLesson(category);
      for (const problem of lesson.problems) {
        // なぞりは選択肢を持たない（balancedCategories には含めないため実データ上は現れない）。
        if (problem.category === "nazori") continue;
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
