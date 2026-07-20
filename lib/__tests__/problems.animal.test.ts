import { describe, it, expect } from "vitest";
import { loadLesson, validateLesson } from "@/lib/problems";
import type { AnimalChoice } from "@/lib/types";

// animal レッスン（どうぶつ種目）の内容と検証ロジックを確認する。
// 既存の problems.color.test.ts / problems.test.ts と同型の新規ファイル。
describe("animal レッスンの読み込み", () => {
  const lesson = loadLesson("animal");

  it("category は animal で 24問ある", () => {
    expect(lesson.category).toBe("animal");
    expect(lesson.problems.length).toBe(24);
  });

  it("全問の category が animal", () => {
    for (const problem of lesson.problems) {
      expect(problem.category, `problem ${problem.id}`).toBe("animal");
    }
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

  it("各 choice に非空の image が設定されている", () => {
    for (const problem of lesson.problems) {
      for (const choice of problem.choices as AnimalChoice[]) {
        expect(
          typeof choice.image === "string" && choice.image.length > 0,
          `problem ${problem.id} / choice ${choice.id}`,
        ).toBe(true);
      }
    }
  });
});

// 検証用の最小限の正常な animal レッスンを生成するヘルパ
function makeValidAnimalLesson() {
  return {
    category: "animal",
    title: "どうぶつ",
    problems: [
      {
        id: "animal-001",
        category: "animal",
        type: "select-one",
        prompt: { text: "いぬは どれかな？", say: "いぬは どれかな" },
        choices: [
          {
            id: "a1",
            label: "いぬ",
            image: "/images/animals/dog.png",
            correct: true,
          },
          {
            id: "a2",
            label: "ねこ",
            image: "/images/animals/cat.png",
            correct: false,
          },
        ],
        reward: "sticker-dog",
      },
    ],
  };
}

describe("validateLesson（animal）", () => {
  it("正常な animal レッスンはそのまま返す（throw しない）", () => {
    expect(() => validateLesson(makeValidAnimalLesson())).not.toThrow();
  });

  it("choice の image が欠落していたら throw する（メッセージに image を含む）", () => {
    const lesson = makeValidAnimalLesson();
    // image プロパティを欠落させる
    delete (lesson.problems[0].choices[0] as { image?: string }).image;
    expect(() => validateLesson(lesson)).toThrow(/image/);
  });

  it("choice の image が空文字なら throw する（メッセージに image を含む）", () => {
    const lesson = makeValidAnimalLesson();
    lesson.problems[0].choices[0].image = "";
    expect(() => validateLesson(lesson)).toThrow(/image/);
  });
});
