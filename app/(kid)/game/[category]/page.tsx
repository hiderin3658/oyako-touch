"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import { useParams, useRouter } from "next/navigation";
import { QuizEngine } from "@/components/quiz/QuizEngine";
import { Sparkles } from "@/components/quiz/Sparkles";
import { Mascot } from "@/components/Mascot";
import { ParentLock } from "@/components/ParentLock";
import { loadLesson, pickProblems, SESSION_QUESTION_COUNT } from "@/lib/problems";
import { addSticker, recordLessonClear } from "@/lib/progress";
import { playPhrase } from "@/lib/audio";
import type { Category, Lesson } from "@/lib/types";
import styles from "./game.module.css";

const VALID_CATEGORIES: Category[] = [
  "color",
  "shape",
  "number",
  "animal",
  "size",
  "count",
];

/** URLパラメータが対応カテゴリかを判定する型ガード */
function isCategory(value: unknown): value is Category {
  return (
    typeof value === "string" &&
    (VALID_CATEGORIES as string[]).includes(value)
  );
}

/** レッスンクリア時に付与するシールID（最終問題の reward、無ければカテゴリ名） */
function resolveRewardId(lesson: Lesson): string {
  const lastProblem = lesson.problems[lesson.problems.length - 1];
  return lastProblem.reward ?? `sticker-${lesson.category}`;
}

/** 画面内サブ状態。クイズ中／ごほうび */
type GamePhase = "playing" | "reward";

/**
 * ゲーム画面。カテゴリ別レッスンを QuizEngine で出題し、
 * 完走したら進捗を保存してごほうび画面へ切り替える。
 */
export default function GamePage() {
  const params = useParams<{ category: string }>();
  const router = useRouter();
  const rawCategory = params.category;
  const category = Array.isArray(rawCategory) ? rawCategory[0] : rawCategory;

  // 不正カテゴリのときは lesson を作らず /home へ送る
  const lesson = useMemo<Lesson | null>(
    () => (isCategory(category) ? loadLesson(category) : null),
    [category],
  );

  const [phase, setPhase] = useState<GamePhase>("playing");
  // 獲得した星の数（ごほうび表示に使う）
  const [stars, setStars] = useState(0);
  // 「もういちど」で QuizEngine を再マウントするためのキー
  const [playCount, setPlayCount] = useState(0);

  // プールから今回出題する SESSION_QUESTION_COUNT 問を抽出したレッスン。
  // playCount を依存に含めることで「もういちど」のたびに別の5問が再抽選され、
  // 1プレイ中は安定する（毎レンダーで選び直さない）。lesson が null なら null。
  const sessionLesson = useMemo<Lesson | null>(
    () => (lesson ? pickProblems(lesson, SESSION_QUESTION_COUNT) : null),
    // playCount は「再抽選トリガ」で値自体は抽出に使わないため exhaustive-deps を無効化する
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [lesson, playCount],
  );

  useEffect(() => {
    if (!isCategory(category)) {
      router.replace("/home");
    }
  }, [category, router]);

  // ごほうび到達時にお祝いの読み上げ
  useEffect(() => {
    if (phase === "reward") {
      playPhrase("reward-done");
    }
  }, [phase]);

  const handleComplete = useCallback(
    (earnedStars: number): void => {
      if (!sessionLesson) {
        return;
      }
      // 進捗（クリア数・直近星数）とごほうびシールを保存する。
      // ごほうびは実際に出題したレッスン（抽出後）から決定する
      recordLessonClear(sessionLesson.category, earnedStars);
      addSticker(resolveRewardId(sessionLesson));
      setStars(earnedStars);
      setPhase("reward");
    },
    [sessionLesson],
  );

  const handleAgain = useCallback((): void => {
    // QuizEngine は外部リセットを持たないため key を変えて最初から再マウントする
    setStars(0);
    setPlayCount((count) => count + 1);
    setPhase("playing");
  }, []);

  // リダイレクト待ち（不正カテゴリ）の間は何も描画しない
  if (!lesson || !sessionLesson) {
    return null;
  }

  if (phase === "reward") {
    return (
      <main className={styles.reward} data-testid="reward">
        <Sparkles trigger={1} />
        <Mascot size={140} animation="cheer" />
        <h1 className={styles.rewardTitle}>よく できました！</h1>
        <div className={styles.got} role="img" aria-label={`ほし ${stars}`}>
          {"⭐".repeat(stars > 0 ? stars : 3)}
        </div>
        <div className={styles.btnRow}>
          <button
            type="button"
            className={`${styles.bigBtn} ${styles.again}`}
            onClick={handleAgain}
            data-testid="reward-again"
          >
            もういちど
          </button>
          <button
            type="button"
            className={`${styles.bigBtn} ${styles.home}`}
            onClick={() => router.push("/home")}
            data-testid="reward-home"
          >
            おうちに もどる
          </button>
        </div>
        <ParentLock />
      </main>
    );
  }

  return (
    <main className={styles.game}>
      <QuizEngine
        key={playCount}
        lesson={sessionLesson}
        onComplete={handleComplete}
      />
      <ParentLock />
    </main>
  );
}
