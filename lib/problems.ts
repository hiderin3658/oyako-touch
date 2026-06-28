// レッスン（問題セット）のローダーと検証ロジック
import type { Category, Lesson } from "@/lib/types";
import colorData from "@/content/problems/color.json";
import shapeData from "@/content/problems/shape.json";
import numberData from "@/content/problems/number.json";

/** カテゴリ → ビルド時importの生データ（カテゴリ追加時はここに追記する） */
const lessonSources: Record<Category, unknown> = {
  color: colorData,
  shape: shapeData,
  number: numberData,
};

/**
 * 指定カテゴリのレッスンをビルド時importから読み込み、検証して返す。
 * 不正なデータの場合は validateLesson が Error を throw する。
 */
export function loadLesson(category: Category): Lesson {
  return validateLesson(lessonSources[category]);
}

/**
 * 未検証データ（JSON等）を検証し、問題なければ Lesson として返す。
 * 検証ルールに違反した場合は分かりやすいメッセージの Error を throw する。
 */
export function validateLesson(raw: unknown): Lesson {
  if (typeof raw !== "object" || raw === null) {
    throw new Error("レッスンデータがオブジェクトではありません");
  }
  const lesson = raw as Record<string, unknown>;

  // カテゴリは "color" | "shape" | "number" のみ許可
  if (
    lesson.category !== "color" &&
    lesson.category !== "shape" &&
    lesson.category !== "number"
  ) {
    throw new Error(`レッスンの category が不正です: ${String(lesson.category)}`);
  }
  const category = lesson.category;

  if (typeof lesson.title !== "string") {
    throw new Error("レッスンの title が文字列ではありません");
  }

  // 問題は1件以上必要
  if (!Array.isArray(lesson.problems) || lesson.problems.length < 1) {
    throw new Error("レッスンには problems が1件以上必要です");
  }

  const seenIds = new Set<string>();
  for (const problemRaw of lesson.problems) {
    if (typeof problemRaw !== "object" || problemRaw === null) {
      throw new Error("problem がオブジェクトではありません");
    }
    const problem = problemRaw as Record<string, unknown>;

    if (typeof problem.id !== "string") {
      throw new Error("problem.id が文字列ではありません");
    }
    // id はレッスン内で一意
    if (seenIds.has(problem.id)) {
      throw new Error(`problem.id が重複しています: ${problem.id}`);
    }
    seenIds.add(problem.id);

    // problem.category はレッスンの category と一致する必要がある
    if (problem.category !== category) {
      throw new Error(
        `problem(${problem.id}) の category がレッスンと一致しません: ${String(problem.category)} != ${category}`,
      );
    }

    // 選択肢は2件以上必要
    if (!Array.isArray(problem.choices) || problem.choices.length < 2) {
      throw new Error(`problem(${problem.id}) の choices は2件以上必要です`);
    }

    // correct はちょうど1つ
    const correctCount = problem.choices.filter(
      (choice) =>
        typeof choice === "object" &&
        choice !== null &&
        (choice as Record<string, unknown>).correct === true,
    ).length;
    if (correctCount !== 1) {
      throw new Error(
        `problem(${problem.id}) の correct はちょうど1つである必要があります（現在: ${correctCount}）`,
      );
    }

    // すうじは各 choice に number 型の value が必須
    if (category === "number") {
      for (const choice of problem.choices) {
        const value = (choice as Record<string, unknown>).value;
        if (typeof value !== "number") {
          throw new Error(
            `problem(${problem.id}) の choice には number 型の value が必要です`,
          );
        }
      }
    }
  }

  return raw as Lesson;
}
