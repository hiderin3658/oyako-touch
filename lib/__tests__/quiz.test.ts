import { describe, it, expect } from "vitest";
import { initialQuizState, quizReducer } from "@/lib/quiz";

describe("initialQuizState", () => {
  it("index=0, stars=0, status=playing で初期化される", () => {
    expect(initialQuizState()).toEqual({ index: 0, stars: 0, status: "playing" });
  });
});

describe("quizReducer", () => {
  const total = 3;

  it("正解で stars+1 かつ status が correct になる", () => {
    const next = quizReducer(initialQuizState(), { type: "answer", correct: true }, total);
    expect(next.stars).toBe(1);
    expect(next.status).toBe("correct");
    expect(next.index).toBe(0);
  });

  it("誤答を5回繰り返しても index=0・stars=0（ノーフェイル）", () => {
    let state = initialQuizState();
    for (let i = 0; i < 5; i++) {
      // 誤答 → retry、再挑戦できるよう retryAck で playing へ戻す
      state = quizReducer(state, { type: "answer", correct: false }, total);
      expect(state.status).toBe("retry");
      state = quizReducer(state, { type: "retryAck" }, total);
      expect(state.status).toBe("playing");
    }
    expect(state.index).toBe(0);
    expect(state.stars).toBe(0);
  });

  it("playing 以外での answer は無視される（連打対策）", () => {
    // 正解後に status=correct のまま再度 answer しても star は増えない
    const afterCorrect = quizReducer(
      initialQuizState(),
      { type: "answer", correct: true },
      total,
    );
    const ignored = quizReducer(afterCorrect, { type: "answer", correct: true }, total);
    expect(ignored.stars).toBe(1);
    expect(ignored.status).toBe("correct");
  });

  it("retry 状態での answer も無視される（retryAck を経ない限り再回答不可）", () => {
    const afterWrong = quizReducer(
      initialQuizState(),
      { type: "answer", correct: false },
      total,
    );
    const ignored = quizReducer(afterWrong, { type: "answer", correct: true }, total);
    expect(ignored).toEqual(afterWrong);
  });

  it("total=3 で advance を3回呼ぶと3回目に status=done になる", () => {
    let state = initialQuizState();
    state = quizReducer(state, { type: "advance" }, total); // index 1
    expect(state.status).toBe("playing");
    expect(state.index).toBe(1);
    state = quizReducer(state, { type: "advance" }, total); // index 2
    expect(state.status).toBe("playing");
    expect(state.index).toBe(2);
    state = quizReducer(state, { type: "advance" }, total); // index 3 >= total
    expect(state.status).toBe("done");
    expect(state.index).toBe(3);
  });

  it("reset で初期状態に戻る", () => {
    let state = quizReducer(initialQuizState(), { type: "answer", correct: true }, total);
    state = quizReducer(state, { type: "advance" }, total);
    const reset = quizReducer(state, { type: "reset" }, total);
    expect(reset).toEqual(initialQuizState());
  });
});
