import { describe, it, expect } from "vitest";
import { loadLesson, validateLesson } from "@/lib/problems";
import type { KatahameChoice, ShapeKind } from "@/lib/types";

// かたはめ（型はめ）レッスンの内容と検証ロジックを確認する。
// 既存の problems.size.test.ts と同型の新規ファイル。テスト仕様書 U14〜U19・U28。

describe("katahame レッスンの読み込み（U14）", () => {
  const lesson = loadLesson("katahame");

  it("category は katahame で 12問ある", () => {
    expect(lesson.category).toBe("katahame");
    expect(lesson.problems.length).toBe(12);
  });

  it("全問の category が katahame", () => {
    for (const problem of lesson.problems) {
      expect(problem.category, `problem ${problem.id}`).toBe("katahame");
    }
  });
});

describe("katahame.json 整合（U19）", () => {
  const lesson = loadLesson("katahame");

  it("全問の correct はちょうど1つ", () => {
    for (const problem of lesson.problems) {
      const correctCount = problem.choices.filter((c) => c.correct).length;
      expect(correctCount, `problem ${problem.id}`).toBe(1);
    }
  });

  it("problem.id はレッスン内で一意", () => {
    const ids = lesson.problems.map((p) => p.id);
    expect(new Set(ids).size).toBe(ids.length);
  });

  it("各問で target＝正解ピースの形・全ピース同色・ダミー shape≠target・ピース2〜3個", () => {
    for (const problem of lesson.problems) {
      if (problem.category !== "katahame") continue;
      const choices = problem.choices as KatahameChoice[];

      // ピース数は 2〜3
      expect(
        choices.length >= 2 && choices.length <= 3,
        `problem ${problem.id} のピース数`,
      ).toBe(true);

      // 全ピース同色
      const colors = new Set(choices.map((c) => c.color));
      expect(colors.size, `problem ${problem.id} の色数`).toBe(1);

      // target＝正解ピースの形
      const correct = choices.find((c) => c.correct);
      expect(correct?.shape, `problem ${problem.id} の正解形`).toBe(
        problem.target,
      );

      // ダミー shape は target と異なる
      for (const choice of choices) {
        if (!choice.correct) {
          expect(
            choice.shape,
            `problem ${problem.id} のダミー ${choice.id}`,
          ).not.toBe(problem.target);
        }
      }
    }
  });

  it("U28: 5形すべて（circle/square/triangle/star/heart）が target に最低1回登場する", () => {
    const targets = new Set<ShapeKind>();
    for (const problem of lesson.problems) {
      if (problem.category !== "katahame") continue;
      targets.add(problem.target);
    }
    for (const shape of [
      "circle",
      "square",
      "triangle",
      "star",
      "heart",
    ] as ShapeKind[]) {
      expect(targets.has(shape), `${shape} が target に登場しない`).toBe(true);
    }
  });
});

// 検証用の最小限の正常な katahame レッスンを生成するヘルパ
function makeValidKatahameLesson() {
  return {
    category: "katahame",
    title: "かたはめ",
    problems: [
      {
        id: "katahame-001",
        category: "katahame",
        type: "shape-fit",
        prompt: { text: "まるを はめてね", say: "まるを はめてね" },
        target: "circle",
        choices: [
          { id: "p1", label: "まる", shape: "circle", color: "#7FB8E8", correct: true },
          { id: "p2", label: "さんかく", shape: "triangle", color: "#7FB8E8", correct: false },
        ],
        reward: "sticker-circle",
      },
    ],
  };
}

describe("validateLesson（katahame）", () => {
  it("U15: 正常な katahame レッスンはそのまま返す（throw しない）", () => {
    expect(() => validateLesson(makeValidKatahameLesson())).not.toThrow();
  });

  it("U16: 正解ピース形が target と一致しないと throw する（メッセージに target を含む）", () => {
    const lesson = makeValidKatahameLesson();
    // 正解ピースの形を target(circle) と違う star にする
    (lesson.problems[0].choices[0] as { shape: string }).shape = "star";
    // ダミー側も circle にならないよう調整（正解形不一致のみを検知させる）
    expect(() => validateLesson(lesson)).toThrow(/target|circle/);
  });

  it("U17: choice の color 欠落で throw する", () => {
    const lesson = makeValidKatahameLesson();
    delete (lesson.problems[0].choices[0] as { color?: string }).color;
    expect(() => validateLesson(lesson)).toThrow(/color/);
  });

  it("U17: choice の shape が不正値だと throw する", () => {
    const lesson = makeValidKatahameLesson();
    (lesson.problems[0].choices[1] as { shape: string }).shape = "hexagon";
    expect(() => validateLesson(lesson)).toThrow(/shape/);
  });

  it("U18: ピース色が混在していると throw する", () => {
    const lesson = makeValidKatahameLesson();
    (lesson.problems[0].choices[1] as { color: string }).color = "#000000";
    expect(() => validateLesson(lesson)).toThrow(/同色/);
  });

  it("ダミーピース shape が target と同じだと throw する", () => {
    const lesson = makeValidKatahameLesson();
    // ダミーを target(circle) と同形にする
    (lesson.problems[0].choices[1] as { shape: string }).shape = "circle";
    expect(() => validateLesson(lesson)).toThrow(/ダミー/);
  });

  it("target が不正な形だと throw する", () => {
    const lesson = makeValidKatahameLesson();
    (lesson.problems[0] as { target: string }).target = "hexagon";
    expect(() => validateLesson(lesson)).toThrow(/target/);
  });
});
