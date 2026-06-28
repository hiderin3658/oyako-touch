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
});
