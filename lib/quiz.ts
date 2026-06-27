// クイズ進行の reducer（ノーフェイル進行の核）。DOM非依存の純粋ロジック

/** クイズの進行状態 */
export interface QuizState {
  index: number;
  stars: number;
  status: "playing" | "correct" | "retry" | "done";
}

/**
 * 進行アクション。
 * - answer: 選択肢に回答した（correct=正誤）
 * - advance: 正解演出後に次の問題へ進む
 * - retryAck: 誤答演出を確認し、同じ問題に再挑戦できる状態へ戻す
 * - reset: 最初からやり直す
 */
export type QuizAction =
  | { type: "answer"; correct: boolean }
  | { type: "advance" }
  | { type: "retryAck" }
  | { type: "reset" };

/** 初期状態を生成する */
export function initialQuizState(): QuizState {
  return { index: 0, stars: 0, status: "playing" };
}

/**
 * 進行状態を更新する純粋関数。
 * total は対象レッスンの総問題数（advance 時の完了判定に使用）。
 */
export function quizReducer(
  state: QuizState,
  action: QuizAction,
  total: number,
): QuizState {
  switch (action.type) {
    case "answer": {
      // 回答受付は "playing" のときのみ。それ以外は連打・誤操作として無視する
      if (state.status !== "playing") {
        return state;
      }
      if (action.correct) {
        // 正解：星を1つ加算して正解演出へ
        return { ...state, status: "correct", stars: state.stars + 1 };
      }
      // 誤答：ノーフェイルのため index も stars も変えず、再挑戦待ちにするだけ
      return { ...state, status: "retry" };
    }
    case "retryAck": {
      // 誤答演出を確認したら、同じ問題に再挑戦できるよう playing へ戻す
      if (state.status !== "retry") {
        return state;
      }
      return { ...state, status: "playing" };
    }
    case "advance": {
      const nextIndex = state.index + 1;
      if (nextIndex >= total) {
        // 最終問題を超えたらレッスン完了
        return { ...state, index: nextIndex, status: "done" };
      }
      return { ...state, index: nextIndex, status: "playing" };
    }
    case "reset":
      return initialQuizState();
    default:
      return state;
  }
}
