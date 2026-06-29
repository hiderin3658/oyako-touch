"use client";

import { useEffect, useReducer, useRef, useState } from "react";
import type { Choice, Lesson } from "@/lib/types";
import {
  initialQuizState,
  quizReducer,
  type QuizAction,
  type QuizState,
} from "@/lib/quiz";
import { playClip, playPhrase, playSfx } from "@/lib/audio";
import { Mascot } from "@/components/Mascot";
import { StarBar } from "@/components/quiz/StarBar";
import { choiceRenderers } from "@/components/quiz/renderers";
import styles from "./QuizEngine.module.css";

export interface QuizEngineProps {
  lesson: Lesson;
  onComplete: (stars: number) => void;
}

// 正解/誤答の演出は「ほめ言葉（fb-correct / fb-retry）が鳴り終わってから」次へ進む。
// 音声の長さに依存して途切れないよう、固定待ちではなく再生完了を待つ（lib/audio の Promise）。
// ただし演出が一瞬で消えないよう最小表示時間を、音声が長すぎ/失敗してもハングしないよう上限を設ける。
const MIN_FEEDBACK_MS = 800;
const MAX_FEEDBACK_MS = 4000;

/**
 * 種目に依存しない共通クイズエンジン。
 * 進行は lib/quiz の reducer（ノーフェイル）で駆動し、種目別の見た目は
 * choiceRenderers に委譲する。誤答しても「×」やフェイル表示は出さない。
 */
export function QuizEngine({ lesson, onComplete }: QuizEngineProps) {
  const total = lesson.problems.length;
  // total を束縛した reducer ラッパ
  const reducerWrapper = (state: QuizState, action: QuizAction): QuizState =>
    quizReducer(state, action, total);
  const [state, dispatch] = useReducer(reducerWrapper, initialQuizState());

  // タップされた選択肢の id（演出対象の特定に使用）
  const [selectedId, setSelectedId] = useState<string | null>(null);
  // マスコットのアニメーション（正解時に cheer）
  const [mascotAnimation, setMascotAnimation] = useState<"bob" | "cheer">("bob");

  // 完了後に index が範囲外を指してもクラッシュしないようクランプ
  const currentProblem = lesson.problems[Math.min(state.index, total - 1)];
  const currentSay = state.index < total ? currentProblem.prompt.say : null;
  // 現在の設問読み上げクリップのパス（フォールバックは currentSay）
  const currentProblemId = currentProblem.id;
  const choices: Choice[] = currentProblem.choices;

  // 保留中の setTimeout をまとめて管理し、unmount 時にクリアして状態更新リークを防ぐ
  const timersRef = useRef<ReturnType<typeof setTimeout>[]>([]);
  // unmount 後に非同期コールバックで状態更新しないためのガード。
  const isMountedRef = useRef(true);
  useEffect(() => {
    isMountedRef.current = true;
    const timers = timersRef.current;
    return () => {
      isMountedRef.current = false;
      timers.forEach(clearTimeout);
    };
  }, []);
  // unmount 時にクリアされる setTimeout ベースの遅延 Promise。
  const delay = (ms: number): Promise<void> =>
    new Promise((resolve) => {
      const timerId = setTimeout(resolve, ms);
      timersRef.current.push(timerId);
    });

  // 問題が切り替わるたびに設問を自動で読み上げる（初回含む。完了時は読み上げない）
  useEffect(() => {
    if (currentSay) {
      playClip(`/audio/q/${currentProblemId}.mp3`, currentSay);
    }
  }, [currentSay, currentProblemId]);

  // 完了検知：status==="done" になったら一度だけ onComplete を呼ぶ
  const hasCompletedRef = useRef(false);
  useEffect(() => {
    if (state.status === "done" && !hasCompletedRef.current) {
      hasCompletedRef.current = true;
      onComplete(state.stars);
    }
  }, [state.status, state.stars, onComplete]);

  /**
   * ほめ言葉の再生完了を待ってから次のアクションを実行する。
   * 「音声が鳴り終わる」かつ「最小表示時間が経過」した時点（上限でキャップ）で進める。
   * これにより音声の長さに依存せず、途切れず・止まらずに遷移できる。
   */
  const afterFeedback = (phrase: Promise<void>, onDone: () => void): void => {
    void Promise.race([
      Promise.all([phrase, delay(MIN_FEEDBACK_MS)]),
      delay(MAX_FEEDBACK_MS),
    ]).then(() => {
      if (isMountedRef.current) {
        onDone();
      }
    });
  };

  const handleSelect = (choiceId: string, correct: boolean): void => {
    // 演出中（playing 以外）の再タップは無視して二重発火を防ぐ
    if (state.status !== "playing") {
      return;
    }
    setSelectedId(choiceId);
    if (correct) {
      dispatch({ type: "answer", correct: true });
      setMascotAnimation("cheer");
      // 効果音を先に鳴らし、その直後にほめ言葉を再生する
      playSfx("/audio/sfx/correct.mp3");
      const praise = playPhrase("fb-correct");
      // ほめ言葉が鳴り終わってから次の問題へ進む（途切れ防止）
      afterFeedback(praise, () => {
        setSelectedId(null);
        setMascotAnimation("bob");
        dispatch({ type: "advance" });
      });
    } else {
      dispatch({ type: "answer", correct: false });
      const retry = playPhrase("fb-retry");
      // 「もういちど！」が鳴り終わってから再挑戦可能に戻す（進行はしない）
      afterFeedback(retry, () => {
        setSelectedId(null);
        dispatch({ type: "retryAck" });
      });
    }
  };

  // 各選択肢の演出状態を reducer の status と選択 id から導出する
  const choiceFeedback = (choiceId: string): "idle" | "right" | "wrong" => {
    if (choiceId !== selectedId) {
      return "idle";
    }
    if (state.status === "correct") {
      return "right";
    }
    if (state.status === "retry") {
      return "wrong";
    }
    return "idle";
  };

  const ChoiceComponent = choiceRenderers[lesson.category];
  // 正解時は「せいかい！」、誤答時は「もういちど！」を問題バーの真上に言葉で表示する
  const showCorrectHint = state.status === "correct";
  const showRetryHint = state.status === "retry";

  return (
    <div className={styles.game}>
      <div className={styles.qBar}>
        {showCorrectHint && (
          <div
            className={`${styles.feedbackBubble} ${styles.correct}`}
            role="status"
          >
            せいかい！
          </div>
        )}
        {showRetryHint && (
          <div
            className={`${styles.feedbackBubble} ${styles.retry}`}
            role="status"
          >
            もういちど！
          </div>
        )}
        <Mascot
          size={64}
          animation={mascotAnimation}
          onTap={() => {
            if (currentSay) {
              playClip(`/audio/q/${currentProblemId}.mp3`, currentSay);
            }
          }}
          ariaLabel="もういちど よみあげる"
        />
        <p className={styles.qText}>{currentProblem.prompt.text}</p>
      </div>
      <StarBar count={state.stars} total={total} />
      <div className={styles.choices} data-locked={state.status !== "playing"}>
        {choices.map((choice) => (
          <ChoiceComponent
            key={choice.id}
            choice={choice}
            state={choiceFeedback(choice.id)}
            onSelect={() => handleSelect(choice.id, choice.correct)}
          />
        ))}
      </div>
    </div>
  );
}
