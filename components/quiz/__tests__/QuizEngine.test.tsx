import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import { render, screen, fireEvent, act } from "@testing-library/react";
import { QuizEngine } from "@/components/quiz/QuizEngine";
import { loadLesson } from "@/lib/problems";
import type { Choice, Lesson } from "@/lib/types";

// 演出タイマーを決定的に制御するためフェイクタイマーを使う。
// クリックはタイマーに依存しない fireEvent（同期）で行う。
beforeEach(() => {
  vi.useFakeTimers();
});
afterEach(() => {
  // 未消化の演出タイマーは実行せず破棄する（act外での状態更新を防ぐ）
  vi.clearAllTimers();
  vi.useRealTimers();
});

/** 指定問題の正解選択肢のラベルを返す */
function correctLabel(lesson: Lesson, index: number): string {
  const choices = lesson.problems[index].choices as Choice[];
  const correct = choices.find((choice) => choice.correct);
  if (!correct) {
    throw new Error(`正解選択肢が見つかりません: index=${index}`);
  }
  return correct.label;
}

/** 指定ラベルの選択肢ボタンをクリックする */
function clickChoice(name: string): void {
  fireEvent.click(screen.getByRole("button", { name }));
}

/** フェイクタイマーを進めて演出後の状態更新を反映する */
function advance(ms: number): void {
  act(() => {
    vi.advanceTimersByTime(ms);
  });
}

describe("QuizEngine", () => {
  it("正解すると星が増え、演出後に次の問題へ進む（color）", () => {
    const lesson = loadLesson("color");
    const onComplete = vi.fn();
    render(<QuizEngine lesson={lesson} onComplete={onComplete} />);

    // 1問目の設問・星0が表示される
    expect(screen.getByText(lesson.problems[0].prompt.text)).toBeInTheDocument();
    expect(screen.getByRole("img", { name: /ほし 0/ })).toBeInTheDocument();

    clickChoice(correctLabel(lesson, 0));
    // 星が1に増える
    expect(screen.getByRole("img", { name: /ほし 1/ })).toBeInTheDocument();

    // 正解演出後に次の問題へ
    advance(1100);
    expect(screen.getByText(lesson.problems[1].prompt.text)).toBeInTheDocument();
  });

  it("誤答しても × やふせいかいを出さず、同じ問題に留まる（ノーフェイル）", () => {
    const lesson = loadLesson("color");
    const onComplete = vi.fn();
    render(<QuizEngine lesson={lesson} onComplete={onComplete} />);

    const wrong = (lesson.problems[0].choices as Choice[]).find((choice) => !choice.correct);
    clickChoice(wrong!.label);

    // フェイル表現を出さない
    expect(screen.queryByText("×")).toBeNull();
    expect(screen.queryByText(/ふせいかい/)).toBeNull();
    // 星は増えない
    expect(screen.getByRole("img", { name: /ほし 0/ })).toBeInTheDocument();

    // 誤答演出後も同じ問題のまま・完了もしない
    advance(600);
    expect(screen.getByText(lesson.problems[0].prompt.text)).toBeInTheDocument();
    expect(onComplete).not.toHaveBeenCalled();
  });

  it("3問すべて正解すると onComplete(stars) が呼ばれる（color）", () => {
    const lesson = loadLesson("color");
    const onComplete = vi.fn();
    render(<QuizEngine lesson={lesson} onComplete={onComplete} />);

    for (let index = 0; index < lesson.problems.length; index++) {
      clickChoice(correctLabel(lesson, index));
      advance(1100);
    }
    expect(onComplete).toHaveBeenCalledWith(3);
  });

  it("shape の Lesson でも図形を描画して進行できる", () => {
    const lesson = loadLesson("shape");
    const onComplete = vi.fn();
    render(<QuizEngine lesson={lesson} onComplete={onComplete} />);

    // 正解選択肢の図形SVGが描画されている
    const correctButton = screen.getByRole("button", { name: correctLabel(lesson, 0) });
    expect(correctButton.querySelector("svg")).toBeInTheDocument();

    fireEvent.click(correctButton);
    expect(screen.getByRole("img", { name: /ほし 1/ })).toBeInTheDocument();
  });
});
