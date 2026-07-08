import { describe, it, expect } from "vitest";
import { loadLesson, validateLesson } from "@/lib/problems";
import type { CountChoice } from "@/lib/types";

// count レッスン（かず種目）の内容と検証ロジックを確認する。
// 既存の problems.size.test.ts と同型の新規ファイル。
describe("count レッスンの読み込み", () => {
  const lesson = loadLesson("count");

  it("category は count で 12問ある", () => {
    expect(lesson.category).toBe("count");
    expect(lesson.problems.length).toBe(12);
  });

  it("全問の category が count", () => {
    for (const problem of lesson.problems) {
      expect(problem.category, `problem ${problem.id}`).toBe("count");
    }
  });
});

// count.json 実データの整合性を全問走査で確認する（size 実装の U5 相当）。
describe("count.json 整合", () => {
  const lesson = loadLesson("count");

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

  it("各 choice に非空の image と number 型の count が設定されている", () => {
    for (const problem of lesson.problems) {
      for (const choice of problem.choices as CountChoice[]) {
        expect(
          typeof choice.image === "string" && choice.image.length > 0,
          `problem ${problem.id} / choice ${choice.id}`,
        ).toBe(true);
        expect(
          typeof choice.count === "number",
          `problem ${problem.id} / choice ${choice.id}`,
        ).toBe(true);
      }
    }
  });

  it("各問の3choiceは果物・個数がすべて相異なる", () => {
    for (const problem of lesson.problems) {
      const choices = problem.choices as CountChoice[];
      const fruits = new Set(choices.map((choice) => choice.fruit));
      const counts = new Set(choices.map((choice) => choice.count));
      expect(fruits.size, `problem ${problem.id} の果物`).toBe(choices.length);
      expect(counts.size, `problem ${problem.id} の個数`).toBe(choices.length);
    }
  });

  it("image 参照集合が想定の18枚と完全一致する", () => {
    const expected = new Set([
      "/images/plates/strawberry-1.png",
      "/images/plates/strawberry-2.png",
      "/images/plates/strawberry-4.png",
      "/images/plates/strawberry-5.png",
      "/images/plates/orange-1.png",
      "/images/plates/orange-3.png",
      "/images/plates/orange-4.png",
      "/images/plates/orange-5.png",
      "/images/plates/apple-1.png",
      "/images/plates/apple-2.png",
      "/images/plates/apple-3.png",
      "/images/plates/grape-3.png",
      "/images/plates/grape-4.png",
      "/images/plates/grape-5.png",
      "/images/plates/banana-1.png",
      "/images/plates/banana-2.png",
      "/images/plates/banana-3.png",
      "/images/plates/banana-5.png",
    ]);

    const actual = new Set<string>();
    for (const problem of lesson.problems) {
      for (const choice of problem.choices as CountChoice[]) {
        actual.add(choice.image);
      }
    }
    expect(actual).toEqual(expected);
  });
});

// 検証用の最小限の正常な count レッスンを生成するヘルパ
function makeValidCountLesson() {
  return {
    category: "count",
    title: "かず",
    problems: [
      {
        id: "count-001",
        category: "count",
        type: "select-one",
        prompt: {
          text: "いちばん おおいのは どれ？",
          say: "いちばん おおいのは どれ",
        },
        choices: [
          {
            id: "k1",
            label: "いちご いつつ",
            image: "/images/plates/strawberry-5.png",
            fruit: "strawberry",
            count: 5,
            correct: true,
          },
          {
            id: "k2",
            label: "りんご ひとつ",
            image: "/images/plates/apple-1.png",
            fruit: "apple",
            count: 1,
            correct: false,
          },
        ],
        reward: "sticker-count",
      },
    ],
  };
}

describe("validateLesson（count）", () => {
  it("正常な count レッスンはそのまま返す（throw しない）", () => {
    expect(() => validateLesson(makeValidCountLesson())).not.toThrow();
  });

  it("choice の image が欠落していたら throw する（メッセージに image を含む）", () => {
    const lesson = makeValidCountLesson();
    delete (lesson.problems[0].choices[0] as { image?: string }).image;
    expect(() => validateLesson(lesson)).toThrow(/image/);
  });

  it("choice の count が number 型でなければ throw する（メッセージに count を含む）", () => {
    const lesson = makeValidCountLesson();
    (lesson.problems[0].choices[0] as { count: unknown }).count = "5";
    expect(() => validateLesson(lesson)).toThrow(/count/);
  });
});
