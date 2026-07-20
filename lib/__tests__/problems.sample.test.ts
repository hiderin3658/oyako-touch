import { describe, it, expect } from "vitest";
import { loadLesson, pickProblems, SESSION_QUESTION_COUNT } from "@/lib/problems";

// pickProblems（プールからのランダム抽出・波F）の単体テスト。
// 実乱数を避けたい検証では seed を固定して決定論的に確認する。
describe("pickProblems", () => {
  // 12問前後のプールを持つ実レッスンを使う
  const lesson = loadLesson("color");

  it("SESSION_QUESTION_COUNT は 5", () => {
    expect(SESSION_QUESTION_COUNT).toBe(5);
  });

  it("seed を固定すると決定論的（同seed・同入力→同結果）", () => {
    const first = pickProblems(lesson, 5, 42);
    const second = pickProblems(lesson, 5, 42);
    expect(first.problems.map((problem) => problem.id)).toEqual(
      second.problems.map((problem) => problem.id),
    );
  });

  it("指定数ぶん、重複なく抽出する", () => {
    const picked = pickProblems(lesson, 5, 7);
    expect(picked.problems.length).toBe(5);
    const ids = picked.problems.map((problem) => problem.id);
    expect(new Set(ids).size).toBe(ids.length);
  });

  it("抽出した問題はすべて元プールに含まれる", () => {
    const poolIds = new Set(lesson.problems.map((problem) => problem.id));
    const picked = pickProblems(lesson, 5, 123);
    for (const problem of picked.problems) {
      expect(poolIds.has(problem.id)).toBe(true);
    }
  });

  it("n がプールより大きいと全件を返す（順序はシャッフル）", () => {
    const picked = pickProblems(lesson, lesson.problems.length + 100, 1);
    expect(picked.problems.length).toBe(lesson.problems.length);
    // 全件の id 集合が一致する（並びは問わない）
    expect(new Set(picked.problems.map((problem) => problem.id))).toEqual(
      new Set(lesson.problems.map((problem) => problem.id)),
    );
  });

  it("n <= 0 のときは問題0件を返す", () => {
    expect(pickProblems(lesson, 0, 1).problems.length).toBe(0);
    expect(pickProblems(lesson, -3, 1).problems.length).toBe(0);
  });

  it("純粋関数：元レッスンを破壊しない", () => {
    const originalLength = lesson.problems.length;
    const originalFirstId = lesson.problems[0].id;
    pickProblems(lesson, 5, 99);
    // 元の problems 長・先頭 id が変わらないこと
    expect(lesson.problems.length).toBe(originalLength);
    expect(lesson.problems[0].id).toBe(originalFirstId);
  });

  it("返り値の problems は元配列とは別インスタンス", () => {
    const picked = pickProblems(lesson, 5, 5);
    expect(picked.problems).not.toBe(lesson.problems);
  });

  it("seed 未指定でも指定数を重複なく抽出する（実乱数）", () => {
    const picked = pickProblems(lesson, SESSION_QUESTION_COUNT);
    expect(picked.problems.length).toBe(SESSION_QUESTION_COUNT);
    const ids = picked.problems.map((problem) => problem.id);
    expect(new Set(ids).size).toBe(ids.length);
  });

  /** 各問の正解の位置（index）を返す。 */
  function correctPositions(picked: ReturnType<typeof pickProblems>): number[] {
    return picked.problems.map((problem) =>
      (problem as { choices: { correct: boolean }[] }).choices.findIndex(
        (choice) => choice.correct,
      ),
    );
  }

  it("正解の位置がセッション内で均等に散る（同一位置は最大2回・全部同じにならない）", () => {
    // 全種目3択なので、5問中の正解位置は同一位置 ceil(5/3)=2 回まで。seed に依存せず成り立つ。
    for (const seed of [1, 42, 100, 2024, 7777]) {
      const positions = correctPositions(pickProblems(lesson, 5, seed));
      const counts = [0, 0, 0];
      for (const pos of positions) counts[pos] += 1;
      expect(Math.max(...counts), `seed=${seed} の偏り`).toBeLessThanOrEqual(2);
      // 少なくとも2種類の位置が使われる（全部同じ位置は起きない）
      expect(new Set(positions).size).toBeGreaterThanOrEqual(2);
    }
  });

  it("隣り合う問題の正解位置は同じにならない（連続同一の回避）", () => {
    for (const seed of [1, 42, 100, 2024, 7777, 3, 8, 15, 21]) {
      const positions = correctPositions(pickProblems(lesson, 5, seed));
      for (let i = 1; i < positions.length; i += 1) {
        expect(
          positions[i],
          `seed=${seed}: ${i}問目と${i + 1}問目が同じ位置`,
        ).not.toBe(positions[i - 1]);
      }
    }
  });

  it("並べ替えても各問の選択肢は保持され、正解はちょうど1つ", () => {
    const pool = loadLesson("shape");
    const picked = pickProblems(pool, 5, 7);
    for (const problem of picked.problems) {
      const choices = (problem as { choices: { id: string; correct: boolean }[] })
        .choices;
      expect(choices.filter((choice) => choice.correct).length).toBe(1);
      const original = pool.problems.find((o) => o.id === problem.id)!;
      const originalIds = (original as { choices: { id: string }[] }).choices
        .map((choice) => choice.id)
        .sort();
      const pickedIds = choices.map((choice) => choice.id).sort();
      expect(pickedIds).toEqual(originalIds); // 欠落・重複なし
    }
  });

  it("seed 固定なら選択肢の並びも決定論的", () => {
    const order = (l: ReturnType<typeof pickProblems>): string[] =>
      l.problems.map((problem) =>
        (problem as { choices: { id: string }[] }).choices
          .map((c) => c.id)
          .join(","),
      );
    expect(order(pickProblems(lesson, 5, 42))).toEqual(
      order(pickProblems(lesson, 5, 42)),
    );
  });

  it("元プールの選択肢並びを破壊しない", () => {
    const pool = loadLesson("size");
    const ids = (choices: unknown): string =>
      (choices as { id: string }[]).map((c) => c.id).join(",");
    const before = ids(pool.problems[0].choices);
    pickProblems(pool, 5, 99);
    expect(ids(pool.problems[0].choices)).toBe(before);
  });
});
