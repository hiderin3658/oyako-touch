"use client";

import type { Choice } from "@/lib/types";
import styles from "./Choice.module.css";

interface NumberChoiceProps {
  choice: Choice;
  state: "idle" | "right" | "wrong";
  onSelect: () => void;
}

/** choice から数字を取り出す（value を持たない場合は 0 にフォールバック） */
function resolveValue(choice: Choice): number {
  return "value" in choice ? choice.value : 0;
}

/** 演出状態に応じてクラス名を組み立てる */
function buildClassName(state: NumberChoiceProps["state"]): string {
  return [
    styles.choice,
    state === "right" ? styles.right : "",
    state === "wrong" ? styles.wrong : "",
  ]
    .filter(Boolean)
    .join(" ");
}

/** すうじの選択肢（数字グリフをカードで大きく表示） */
export function NumberChoice({ choice, state, onSelect }: NumberChoiceProps) {
  const value = resolveValue(choice);
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
      <span className={styles.numberCard}>
        <span className={styles.numberGlyph}>{value}</span>
      </span>
    </button>
  );
}
