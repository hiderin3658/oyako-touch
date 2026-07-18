import { describe, it, expect } from "vitest";
import { loadLesson, validateLesson } from "@/lib/problems";
import type { ShapeKind } from "@/lib/types";

// なぞり（nazori）レッスンの内容と検証ロジックを確認する。
// なぞりは選択肢を持たない（誤答の概念が無い）ため、基底の choices 検証は対象外になる。
// テスト仕様書 NU19〜NU24。

describe("nazori レッスンの読み込み（NU19）", () => {
  const lesson = loadLesson("nazori");

  it("category は nazori で 12問ある", () => {
    expect(lesson.category).toBe("nazori");
    expect(lesson.problems.length).toBe(12);
  });

  it("全問の category が nazori・type が trace", () => {
    for (const problem of lesson.problems) {
      expect(problem.category, `problem ${problem.id}`).toBe("nazori");
      expect(problem.type, `problem ${problem.id}`).toBe("trace");
    }
  });
});

describe("nazori.json 整合（NU24）", () => {
  const lesson = loadLesson("nazori");
  const shapes: ShapeKind[] = ["circle", "square", "triangle", "star", "heart"];

  it("problem.id はレッスン内で一意", () => {
    const ids = lesson.problems.map((problem) => problem.id);
    expect(new Set(ids).size).toBe(ids.length);
  });

  it("各問の target は有効な形で、choices を持たない", () => {
    for (const problem of lesson.problems) {
      expect(shapes, `problem ${problem.id} の target`).toContain(problem.target);
      // なぞりは選択肢を持たない
      expect("choices" in problem, `problem ${problem.id} が choices を持つ`).toBe(
        false,
      );
    }
  });

  it("5形すべて（circle/square/triangle/star/heart）が target に最低1回登場する", () => {
    const targets = new Set<ShapeKind>();
    for (const problem of lesson.problems) {
      if (problem.category !== "nazori") continue;
      targets.add(problem.target);
    }
    for (const shape of shapes) {
      expect(targets.has(shape), `${shape} が target に登場しない`).toBe(true);
    }
  });
});

// 検証用の最小限の正常な nazori レッスンを生成するヘルパ（choices を持たない）。
function makeValidNazoriLesson() {
  return {
    category: "nazori",
    title: "なぞり",
    problems: [
      {
        id: "nazori-001",
        category: "nazori",
        type: "trace",
        prompt: { text: "まるを なぞってね", say: "まるを なぞってね" },
        target: "circle",
        reward: "sticker-circle",
      },
    ],
  };
}

describe("validateLesson（nazori）", () => {
  it("NU20: 正常な（choices 無しの）nazori レッスンはそのまま返す（throw しない）", () => {
    expect(() => validateLesson(makeValidNazoriLesson())).not.toThrow();
  });

  it("NU21: target が不正な形だと throw する（メッセージに target を含む）", () => {
    const lesson = makeValidNazoriLesson();
    (lesson.problems[0] as { target: string }).target = "hexagon";
    expect(() => validateLesson(lesson)).toThrow(/target/);
  });

  it("NU22: nazori に非空の choices が混入していると throw する", () => {
    const lesson = makeValidNazoriLesson();
    (lesson.problems[0] as { choices?: unknown[] }).choices = [
      { id: "p1", label: "まる", shape: "circle", color: "#7FB8E8", correct: true },
    ];
    expect(() => validateLesson(lesson)).toThrow(/choices/);
  });

  it("NU23: nazori ガードは非干渉で、他種目の choices 不正は従来どおり throw する", () => {
    // color レッスンの choices を1件に減らす → 基底の「2件以上」チェックが働く
    const badColor = {
      category: "color",
      title: "いろ",
      problems: [
        {
          id: "color-001",
          category: "color",
          type: "select-one",
          prompt: { text: "あかは どれ？", say: "あかは どれ" },
          choices: [
            { id: "c1", label: "あか", color: "#E5453C", correct: true },
          ],
        },
      ],
    };
    expect(() => validateLesson(badColor)).toThrow(/choices/);
  });
});
