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

// 正解演出の表示時間（ms）。この後に次の問題へ進む
const CORRECT_FEEDBACK_MS = 1100;
// 誤答演出（wobble＋「もういちど！」フキダシ）の表示時間（ms）。
// フキダシを読めるよう少し長めにし、この後に再挑戦できる状態へ戻す
const WRONG_FEEDBACK_MS = 1100;

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
  useEffect(() => {
    const timers = timersRef.current;
    return () => {
      timers.forEach(clearTimeout);
    };
  }, []);
  const scheduleTimer = (callback: () => void, ms: number): void => {
    const timerId = setTimeout(callback, ms);
    timersRef.current.push(timerId);
  };

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
      playPhrase("fb-correct");
      // 演出を見せてから次の問題へ進む
      scheduleTimer(() => {
        setSelectedId(null);
        setMascotAnimation("bob");
        dispatch({ type: "advance" });
      }, CORRECT_FEEDBACK_MS);
    } else {
      dispatch({ type: "answer", correct: false });
      playPhrase("fb-retry");
      // wobble を見せてから再挑戦可能に戻す（進行はしない）
      scheduleTimer(() => {
        setSelectedId(null);
        dispatch({ type: "retryAck" });
      }, WRONG_FEEDBACK_MS);
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
