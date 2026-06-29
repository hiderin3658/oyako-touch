import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import { render, screen, fireEvent, act } from "@testing-library/react";
import { QuizEngine } from "@/components/quiz/QuizEngine";
import { loadLesson } from "@/lib/problems";
import { playPhrase } from "@/lib/audio";
import type { Choice, Lesson } from "@/lib/types";

// 音声はモックする（演出の進行は「ほめ言葉の再生完了」を待つため、即解決の Promise にして決定的にする）。
vi.mock("@/lib/audio", () => ({
  playClip: vi.fn(() => Promise.resolve()),
  playPhrase: vi.fn(() => Promise.resolve()),
  playSfx: vi.fn(),
  unlockAudio: vi.fn(),
}));

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

/**
 * フェイクタイマーを進めて演出後の状態更新を反映する。
 * 演出進行は Promise（再生完了待ち）を挟むため、タイマーとマイクロタスクの両方を消化する非同期版にする。
 */
async function advance(ms: number): Promise<void> {
  await act(async () => {
    await vi.advanceTimersByTimeAsync(ms);
  });
}

describe("QuizEngine", () => {
  it("正解すると星が増え、演出後に次の問題へ進む（color）", async () => {
    const lesson = loadLesson("color");
    const onComplete = vi.fn();
    render(<QuizEngine lesson={lesson} onComplete={onComplete} />);

    // 1問目の設問・星0が表示される
    expect(screen.getByText(lesson.problems[0].prompt.text)).toBeInTheDocument();
    expect(screen.getByRole("img", { name: /ほし 0/ })).toBeInTheDocument();

    clickChoice(correctLabel(lesson, 0));
    // 星が1に増える
    expect(screen.getByRole("img", { name: /ほし 1/ })).toBeInTheDocument();
    // 「せいかい！」を言葉で表示する
    expect(screen.getByText("せいかい！")).toBeInTheDocument();

    // 正解演出後に次の問題へ進み、「せいかい！」は消える
    await advance(1100);
    expect(screen.queryByText("せいかい！")).toBeNull();
    expect(screen.getByText(lesson.problems[1].prompt.text)).toBeInTheDocument();
  });

  it("誤答しても × やふせいかいを出さず、同じ問題に留まる（ノーフェイル）", async () => {
    const lesson = loadLesson("color");
    const onComplete = vi.fn();
    render(<QuizEngine lesson={lesson} onComplete={onComplete} />);

    const wrong = (lesson.problems[0].choices as Choice[]).find((choice) => !choice.correct);
    clickChoice(wrong!.label);

    // フェイル表現（×・ふせいかい）は出さない
    expect(screen.queryByText("×")).toBeNull();
    expect(screen.queryByText(/ふせいかい/)).toBeNull();
    // 代わりにやさしい「もういちど！」を表示する
    expect(screen.getByText("もういちど！")).toBeInTheDocument();
    // 星は増えない
    expect(screen.getByRole("img", { name: /ほし 0/ })).toBeInTheDocument();

    // 誤答演出後は「もういちど！」が消え、同じ問題のまま・完了もしない
    await advance(1100);
    expect(screen.queryByText("もういちど！")).toBeNull();
    expect(screen.getByText(lesson.problems[0].prompt.text)).toBeInTheDocument();
    expect(onComplete).not.toHaveBeenCalled();
  });

  it("全問正解すると onComplete(stars=問題数) が呼ばれる（color）", async () => {
    const lesson = loadLesson("color");
    const onComplete = vi.fn();
    render(<QuizEngine lesson={lesson} onComplete={onComplete} />);

    // 問題数に依存せず、全問正解で星＝問題数になることを検証する
    for (let index = 0; index < lesson.problems.length; index++) {
      clickChoice(correctLabel(lesson, index));
      await advance(1100);
    }
    expect(onComplete).toHaveBeenCalledWith(lesson.problems.length);
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

  it("animal の Lesson でも画像を描画して正解で星が増える", async () => {
    const lesson = loadLesson("animal");
    const onComplete = vi.fn();
    render(<QuizEngine lesson={lesson} onComplete={onComplete} />);

    // 1問目の設問・星0が表示される
    expect(screen.getByText(lesson.problems[0].prompt.text)).toBeInTheDocument();
    expect(screen.getByRole("img", { name: /ほし 0/ })).toBeInTheDocument();

    // 正解選択肢が動物イラスト画像（img）を描画している
    const correctButton = screen.getByRole("button", { name: correctLabel(lesson, 0) });
    expect(correctButton.querySelector("img")).toBeInTheDocument();

    fireEvent.click(correctButton);
    // 星が1に増え、せいかい！演出が出る
    expect(screen.getByRole("img", { name: /ほし 1/ })).toBeInTheDocument();
    expect(screen.getByText("せいかい！")).toBeInTheDocument();

    // 演出後に次の問題へ進む
    await advance(1100);
    expect(screen.getByText(lesson.problems[1].prompt.text)).toBeInTheDocument();
  });

  it("ほめ言葉が鳴り終わるまで次の問題へ進まない（音声途切れ防止の回帰）", async () => {
    const lesson = loadLesson("color");
    // 「まだ鳴っている」ほめ言葉を手動制御の Promise で表現する
    let resolvePraise: () => void = () => {};
    const praise = new Promise<void>((resolve) => {
      resolvePraise = resolve;
    });
    vi.mocked(playPhrase).mockReturnValueOnce(praise);

    render(<QuizEngine lesson={lesson} onComplete={vi.fn()} />);
    clickChoice(correctLabel(lesson, 0));

    // 最小表示時間(800ms)を超えても、ほめ言葉が鳴り終わっていなければ進まない
    await advance(1500);
    expect(screen.getByText("せいかい！")).toBeInTheDocument();
    expect(screen.getByText(lesson.problems[0].prompt.text)).toBeInTheDocument();

    // ほめ言葉が鳴り終わったら次の問題へ進む
    resolvePraise();
    await advance(0);
    expect(screen.queryByText("せいかい！")).toBeNull();
    expect(screen.getByText(lesson.problems[1].prompt.text)).toBeInTheDocument();
  });
});
