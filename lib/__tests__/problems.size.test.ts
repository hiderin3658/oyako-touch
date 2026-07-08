import { describe, it, expect } from "vitest";
import { loadLesson, validateLesson } from "@/lib/problems";
import type { SizeChoice } from "@/lib/types";

// size レッスン（おおきさ種目）の内容と検証ロジックを確認する。
// 既存の problems.animal.test.ts と同型の新規ファイル。
describe("size レッスンの読み込み（U1）", () => {
  const lesson = loadLesson("size");

  it("category は size で 12問ある", () => {
    expect(lesson.category).toBe("size");
    expect(lesson.problems.length).toBe(12);
  });

  it("全問の category が size", () => {
    for (const problem of lesson.problems) {
      expect(problem.category, `problem ${problem.id}`).toBe("size");
    }
  });
});

// テスト仕様書 U5: size.json 実データの整合性を全問走査で確認する。
describe("size.json 整合（U5）", () => {
  const lesson = loadLesson("size");

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

  it("各 choice の size は large / medium / small のいずれか", () => {
    for (const problem of lesson.problems) {
      for (const choice of problem.choices as SizeChoice[]) {
        expect(
          ["large", "medium", "small"].includes(choice.size),
          `problem ${problem.id} / choice ${choice.id}`,
        ).toBe(true);
      }
    }
  });

  it("各問に large・medium・small が1つずつ含まれる（同一図形色）", () => {
    for (const problem of lesson.problems) {
      const choices = problem.choices as SizeChoice[];
      const sizes = choices.map((choice) => choice.size).sort();
      expect(sizes, `problem ${problem.id} のサイズ構成`).toEqual([
        "large",
        "medium",
        "small",
      ]);
    }
  });
});

// 検証用の最小限の正常な size レッスンを生成するヘルパ
function makeValidSizeLesson() {
  return {
    category: "size",
    title: "おおきさ",
    problems: [
      {
        id: "size-001",
        category: "size",
        type: "select-one",
        prompt: {
          text: "いちばん おおきいのは どれ？",
          say: "いちばん おおきいのは どれ",
        },
        choices: [
          {
            id: "z1",
            label: "おおきい",
            shape: "circle",
            color: "#7FB8E8",
            size: "large",
            correct: true,
          },
          {
            id: "z2",
            label: "ちいさい",
            shape: "circle",
            color: "#7FB8E8",
            size: "small",
            correct: false,
          },
        ],
        reward: "sticker-size",
      },
    ],
  };
}

describe("validateLesson（size）", () => {
  it("正常な size レッスンはそのまま返す（throw しない）（U2）", () => {
    expect(() => validateLesson(makeValidSizeLesson())).not.toThrow();
  });

  it("size を不正値（huge）に改変すると throw する（メッセージに size を含む）（U3）", () => {
    const lesson = makeValidSizeLesson();
    (lesson.problems[0].choices[0] as { size: string }).size = "huge";
    expect(() => validateLesson(lesson)).toThrow(/size/);
  });

  it("size プロパティが欠落していたら throw する（U4）", () => {
    const lesson = makeValidSizeLesson();
    delete (lesson.problems[0].choices[0] as { size?: string }).size;
    expect(() => validateLesson(lesson)).toThrow(/size/);
  });
});
