// レッスン（問題セット）のローダーと検証ロジック
import type { Category, Choice, Lesson, LessonOf, Problem } from "@/lib/types";
import colorData from "@/content/problems/color.json";
import shapeData from "@/content/problems/shape.json";
import numberData from "@/content/problems/number.json";
import animalData from "@/content/problems/animal.json";
import sizeData from "@/content/problems/size.json";
import countData from "@/content/problems/count.json";
import katahameData from "@/content/problems/katahame.json";
import nazoriData from "@/content/problems/nazori.json";

/** カテゴリ → ビルド時importの生データ（カテゴリ追加時はここに追記する） */
const lessonSources: Record<Category, unknown> = {
  color: colorData,
  shape: shapeData,
  number: numberData,
  animal: animalData,
  size: sizeData,
  count: countData,
  katahame: katahameData,
  nazori: nazoriData,
};

/** 図形種別の有効値（かたはめの target・shape 検証に使う単一情報源） */
const VALID_SHAPES = ["circle", "square", "triangle", "star", "heart"];

/**
 * 指定カテゴリのレッスンをビルド時importから読み込み、検証して返す。
 * 返り値はカテゴリ C に絞り込んだ問題型（LessonOf<C>）にして、
 * 呼び出し側が種目固有の choices/target を型安全に参照できるようにする。
 * 不正なデータの場合は validateLesson が Error を throw する。
 */
export function loadLesson<C extends Category>(category: C): LessonOf<C> {
  return validateLesson(lessonSources[category]) as unknown as LessonOf<C>;
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

  // カテゴリは "color" | "shape" | "number" | "animal" | "size" | "count" | "katahame" | "nazori" のみ許可
  if (
    lesson.category !== "color" &&
    lesson.category !== "shape" &&
    lesson.category !== "number" &&
    lesson.category !== "animal" &&
    lesson.category !== "size" &&
    lesson.category !== "count" &&
    lesson.category !== "katahame" &&
    lesson.category !== "nazori"
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

    // なぞり（nazori）は選択肢を持たない（誤答の概念が無い）ため、choices 由来の検証は
    // すべて「なぞり以外」に限定する。基底の「choices 2件以上・正解ちょうど1」と、
    // すうじ/どうぶつ/おおきさ/かず/かたはめの choice 検証をこの分岐にまとめる。
    if (category !== "nazori") {
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

      // どうぶつは各 choice に非空の string 型 image（画像パス）が必須
      if (category === "animal") {
        for (const choice of problem.choices) {
          const image = (choice as Record<string, unknown>).image;
          if (typeof image !== "string" || image.length === 0) {
            throw new Error(
              `problem(${problem.id}) の choice には非空の image が必要です`,
            );
          }
        }
      }

      // おおきさは各 choice に size(large|medium|small) が必須
      if (category === "size") {
        for (const choice of problem.choices) {
          const size = (choice as Record<string, unknown>).size;
          if (size !== "large" && size !== "medium" && size !== "small") {
            throw new Error(
              `problem(${problem.id}) の choice には size(large|medium|small) が必要です`,
            );
          }
        }
      }

      // かずは各 choice に非空の image と number 型の count が必須
      if (category === "count") {
        for (const choice of problem.choices) {
          const image = (choice as Record<string, unknown>).image;
          if (typeof image !== "string" || image.length === 0) {
            throw new Error(`problem(${problem.id}) の choice には非空の image が必要です`);
          }
          const count = (choice as Record<string, unknown>).count;
          if (typeof count !== "number") {
            throw new Error(`problem(${problem.id}) の choice には number 型の count が必要です`);
          }
        }
      }

      // かたはめは target(穴の形) と各ピースの shape/color を検証する。
      // ルール: target は有効な形／各ピースは有効 shape＋非空 color／全ピース同色／
      // 正解ピース shape は target と一致／ダミー shape は target と異なる。
      if (category === "katahame") {
        const target = problem.target;
        if (typeof target !== "string" || !VALID_SHAPES.includes(target)) {
          throw new Error(
            `problem(${problem.id}) の target が不正な形です: ${String(target)}`,
          );
        }

        let sharedColor: string | null = null;
        let correctShape: string | null = null;
        for (const choiceRaw of problem.choices) {
          const choice = choiceRaw as Record<string, unknown>;
          const shape = choice.shape;
          const color = choice.color;

          if (typeof shape !== "string" || !VALID_SHAPES.includes(shape)) {
            throw new Error(
              `problem(${problem.id}) の choice には有効な shape が必要です: ${String(shape)}`,
            );
          }
          if (typeof color !== "string" || color.length === 0) {
            throw new Error(
              `problem(${problem.id}) の choice には非空の color が必要です`,
            );
          }
          // 全ピース同色（色ヒントを排除し、形だけで判別させる）
          if (sharedColor === null) {
            sharedColor = color;
          } else if (color !== sharedColor) {
            throw new Error(
              `problem(${problem.id}) の choice は全ピース同色である必要があります`,
            );
          }

          if (choice.correct === true) {
            correctShape = shape;
          } else if (shape === target) {
            // ダミーピースは target と異なる形にする（迷いなく正解を選べるように）
            throw new Error(
              `problem(${problem.id}) のダミーピース shape が target と同じです: ${target}`,
            );
          }
        }

        // 正解ピースの形は必ず target と一致する
        if (correctShape !== target) {
          throw new Error(
            `problem(${problem.id}) の正解ピース shape が target と一致しません: ${String(correctShape)} != ${target}`,
          );
        }
      }
    }

    // なぞり（nazori）は target（なぞる形）のみを検証する。
    // ルール: target は有効な形／choices は持たない（あっても空配列のみ許可）。
    if (category === "nazori") {
      const target = problem.target;
      if (typeof target !== "string" || !VALID_SHAPES.includes(target)) {
        throw new Error(
          `problem(${problem.id}) の target が不正な形です: ${String(target)}`,
        );
      }
      if (
        problem.choices !== undefined &&
        (!Array.isArray(problem.choices) || problem.choices.length !== 0)
      ) {
        throw new Error(
          `problem(${problem.id}) の nazori は choices を持ちません`,
        );
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
 * 位置の多重集合を「隣り合う要素が同じにならない」よう並べる（純粋関数）。
 * 各ステップで「残数が最も多く、直前と異なる位置」を選ぶ貪欲法（同数は乱数で選ぶ）。
 * これで連続同一を避けつつ均等な分布を保つ（最大数 <= ceil(n/2) なら必ず可能）。
 * 制約を満たせない稀なケースでは直前と同じ位置を許容する（安全側・無限ループ防止）。
 */
function arrangeNoAdjacent(
  positions: readonly number[],
  random: () => number,
): number[] {
  const remaining = new Map<number, number>();
  for (const pos of positions) {
    remaining.set(pos, (remaining.get(pos) ?? 0) + 1);
  }

  const result: number[] = [];
  let last = -1;
  for (let step = 0; step < positions.length; step += 1) {
    // 直前と異なる位置の候補（残数>0）。無ければ制約を外す。
    let candidates = [...remaining.entries()].filter(
      ([pos, count]) => count > 0 && pos !== last,
    );
    if (candidates.length === 0) {
      candidates = [...remaining.entries()].filter(([, count]) => count > 0);
    }
    // 残数が最大の位置を選ぶ（同数は乱数で選んで並びに変化を出す）。
    const maxCount = Math.max(...candidates.map(([, count]) => count));
    const top = candidates.filter(([, count]) => count === maxCount);
    const [pos] = top[Math.floor(random() * top.length)];
    result.push(pos);
    remaining.set(pos, (remaining.get(pos) ?? 0) - 1);
    last = pos;
  }
  return result;
}

/**
 * 抽出した各問題の選択肢を並べ替え、正解の位置をセッション内で均等に散らす（純粋関数）。
 * - 位置をラウンドロビンで割り当ててからシャッフルするため、正解が同じ位置に偏らない
 *   （例: 5問・3択なら同一位置は最大2回まで。全部同じ位置は起きない）。
 * - 各問題は割り当て位置に正解が来るよう並べ替え、ダミーは残りにランダム配置する。
 * - 選択肢を持たない種目（なぞり）や正解がちょうど1つでない問題は並べ替えない。
 * - 元の problem / choices は破壊せず、新しい配列・オブジェクトを返す。
 */
function balanceCorrectPositions(
  problems: readonly Problem[],
  random: () => number,
): Problem[] {
  // 選択肢数の最大（現状は全種目3択）。目標位置の巡回周期に使う。
  // なぞりは choices を持たないため、union を跨いで安全にアクセスするキャストで取り出す。
  const maxChoices = problems.reduce((max, problem) => {
    const choices = (problem as { choices?: unknown }).choices;
    return Array.isArray(choices) ? Math.max(max, choices.length) : max;
  }, 1);
  // 0..maxChoices-1 を巡回した均等な多重集合を、隣り合う問題で同じ位置にならないよう並べる。
  const targets = arrangeNoAdjacent(
    problems.map((_, index) => index % maxChoices),
    random,
  );

  return problems.map((problem, index) => {
    const rawChoices = (problem as { choices?: unknown }).choices;
    if (!Array.isArray(rawChoices)) {
      return problem; // なぞり等：選択肢を持たない
    }
    const choices = rawChoices as Choice[];
    const correct = choices.filter((choice) => choice.correct === true);
    if (correct.length !== 1 || choices.length < 2) {
      return problem; // 正解が1つでない/選択肢が1つ以下は触らない（安全側）
    }
    const distractors = shuffle(
      choices.filter((choice) => choice !== correct[0]),
      random,
    );
    const target = Math.min(targets[index], choices.length - 1);
    const reordered = distractors.slice();
    reordered.splice(target, 0, correct[0]);
    return { ...problem, choices: reordered } as Problem;
  });
}

/**
 * レッスンのプールから n 問をランダムに抽出した新しいレッスンを返す（純粋関数）。
 * - 重複なしで抽出し、毎回シャッフルした順序で出題する。
 * - 各問題の選択肢も並べ替え、正解の位置をセッション内で均等に散らす（位置での丸暗記防止）。
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
  // 選択肢の正解位置を均等に散らして並べ替える。
  const balanced = balanceCorrectPositions(picked, random);
  return { ...lesson, problems: balanced };
}
