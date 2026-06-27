"use client";

import type { Choice } from "@/lib/types";
import styles from "./Choice.module.css";

interface ColorChoiceProps {
  choice: Choice;
  state: "idle" | "right" | "wrong";
  onSelect: () => void;
}

/** 演出状態に応じてクラス名を組み立てる */
function buildClassName(state: ColorChoiceProps["state"]): string {
  return [
    styles.choice,
    state === "right" ? styles.right : "",
    state === "wrong" ? styles.wrong : "",
  ]
    .filter(Boolean)
    .join(" ");
}

/** いろあわせの選択肢（色つきの円ディスク） */
export function ColorChoice({ choice, state, onSelect }: ColorChoiceProps) {
  return (
    <button
      type="button"
      className={buildClassName(state)}
      onClick={onSelect}
      aria-label={choice.label}
      data-state={state}
    >
      <span className={styles.disc} style={{ background: choice.color }} />
    </button>
  );
}
