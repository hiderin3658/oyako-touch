import { describe, it, expect } from "vitest";
import { loadLesson, validateLesson } from "@/lib/problems";

// 検証用の最小限の正常レッスンを生成するヘルパ
function makeValidLesson() {
  return {
    category: "color",
    title: "いろあわせ",
    problems: [
      {
        id: "color-001",
        category: "color",
        type: "select-one",
        prompt: { text: "あかいのは どれかな？", say: "あかいのは どれかな" },
        choices: [
          { id: "c1", label: "あか", color: "#E5453C", correct: true },
          { id: "c2", label: "あお", color: "#3D8BFF", correct: false },
        ],
      },
    ],
  };
}

describe("loadLesson", () => {
  it("color レッスンを3問読み込める", () => {
    const lesson = loadLesson("color");
    expect(lesson.category).toBe("color");
    expect(lesson.problems).toHaveLength(3);
  });

  it("shape レッスンを3問読み込める", () => {
    const lesson = loadLesson("shape");
    expect(lesson.category).toBe("shape");
    expect(lesson.problems).toHaveLength(3);
  });
});

describe("validateLesson", () => {
  it("正常なレッスンはそのまま返す", () => {
    const valid = makeValidLesson();
    expect(() => validateLesson(valid)).not.toThrow();
  });

  it("correct が0個なら throw する", () => {
    const lesson = makeValidLesson();
    lesson.problems[0].choices[0].correct = false;
    expect(() => validateLesson(lesson)).toThrow(/correct はちょうど1つ/);
  });

  it("correct が2個なら throw する", () => {
    const lesson = makeValidLesson();
    lesson.problems[0].choices[1].correct = true;
    expect(() => validateLesson(lesson)).toThrow(/correct はちょうど1つ/);
  });

  it("choices が1件なら throw する", () => {
    const lesson = makeValidLesson();
    lesson.problems[0].choices = [
      { id: "c1", label: "あか", color: "#E5453C", correct: true },
    ];
    expect(() => validateLesson(lesson)).toThrow(/choices は2件以上/);
  });

  it("id が重複していたら throw する", () => {
    const lesson = makeValidLesson();
    lesson.problems.push({
      ...makeValidLesson().problems[0],
      id: "color-001",
    });
    expect(() => validateLesson(lesson)).toThrow(/重複/);
  });

  it("problem.category がレッスンと一致しないと throw する", () => {
    const lesson = makeValidLesson();
    lesson.problems[0].category = "shape";
    expect(() => validateLesson(lesson)).toThrow(/一致しません/);
  });

  it("category が不正な値なら throw する", () => {
    const lesson = makeValidLesson();
    lesson.category = "number";
    expect(() => validateLesson(lesson)).toThrow(/category が不正/);
  });

  it("problems が0件なら throw する", () => {
    const lesson = makeValidLesson();
    lesson.problems = [];
    expect(() => validateLesson(lesson)).toThrow(/problems が1件以上/);
  });
});
