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

/** 1レッスンで出題する問題数（設計書§9「5問/レッスン」）。 */
export const SESSION_QUESTION_COUNT = 5;

/**
 * mulberry32 による小さな決定論PRNG。
 * 同じ seed からは同じ乱数列を返すため、テストで再現性を確保するのに使う。
 * 返り値は [0, 1) の浮動小数を返す関数（Math.random と同じインターフェース）。
 */
function mulberry32(seed: number): () => number {
  let state = seed >>> 0;
  return () => {
    state = (state + 0x6d2b79f5) | 0;
    let t = Math.imul(state ^ (state >>> 15), 1 | state);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

/**
 * Fisher–Yates シャッフル。元配列は変更せず、シャッフル済みの新しい配列を返す。
 * random は [0, 1) を返す乱数関数（Math.random または seed付きPRNG）。
 */
function shuffle<T>(items: readonly T[], random: () => number): T[] {
  const result = items.slice();
  for (let i = result.length - 1; i > 0; i--) {
    const j = Math.floor(random() * (i + 1));
    [result[i], result[j]] = [result[j], result[i]];
  }
  return result;
}

/**
 * レッスンのプールから n 問をランダムに抽出した新しいレッスンを返す（純粋関数）。
 * - 重複なしで抽出し、毎回シャッフルした順序で出題する。
 * - プールが n 以下なら全件を返す（順序はシャッフルされる）。
 * - n <= 0 の場合は問題0件のレッスンを返す。
 * - seed を渡すと決定論的（テスト用）。未指定時は Math.random（実乱数）を使う。
 * 元の lesson は変更しない（problems 配列も複製する）。
 */
export function pickProblems(lesson: Lesson, n: number, seed?: number): Lesson {
  if (n <= 0) {
    return { ...lesson, problems: [] };
  }
  const random = seed === undefined ? Math.random : mulberry32(seed);
  const shuffled = shuffle(lesson.problems, random);
  // プールが n 以下なら全件（slice が上限でクランプする）
  const picked = shuffled.slice(0, Math.min(n, shuffled.length));
  return { ...lesson, problems: picked };
}
