"use client";

import type { Choice } from "@/lib/types";
import styles from "./Choice.module.css";

interface CountChoiceProps {
  choice: Choice;
  state: "idle" | "right" | "wrong";
  onSelect: () => void;
}

/** choice から画像パスを取り出す（image を持たない場合は空文字にフォールバック） */
function resolveImage(choice: Choice): string {
  return "image" in choice ? choice.image : "";
}

/** 演出状態に応じてクラス名を組み立てる */
function buildClassName(state: CountChoiceProps["state"]): string {
  return [
    styles.choice,
    state === "right" ? styles.right : "",
    state === "wrong" ? styles.wrong : "",
  ]
    .filter(Boolean)
    .join(" ");
}

/** かずの選択肢（お皿＋果物n個の完成画像）。ラベルは button の aria-label に集約 */
export function CountChoice({ choice, state, onSelect }: CountChoiceProps) {
  return (
    <button
      type="button"
      className={buildClassName(state)}
      onClick={onSelect}
      aria-label={choice.label}
      data-state={state}
      data-testid="choice"
      data-correct={choice.correct ? "true" : "false"}
    >
      {/* 画像は装飾。読み上げ／aria は button に集約するため alt は空にする。
          ローカル静的の小さなイラスト（384px）で最適化不要のため素の img を使う */}
      {/* eslint-disable-next-line @next/next/no-img-element */}
      <img src={resolveImage(choice)} alt="" className={styles.animalImage} />
    </button>
  );
}
