"use client";

import type { Choice, ShapeKind } from "@/lib/types";
import { ShapeFigure } from "./ShapeChoice";
import styles from "./Choice.module.css";

interface SizeChoiceProps {
  choice: Choice;
  state: "idle" | "right" | "wrong";
  onSelect: () => void;
}

/** choice から図形種別を取り出す（shape を持たない場合は circle にフォールバック） */
function resolveShape(choice: Choice): ShapeKind {
  return "shape" in choice ? choice.shape : "circle";
}

/** choice から塗り色を取り出す（color を持たない場合は transparent にフォールバック） */
function resolveColor(choice: Choice): string {
  return "color" in choice ? choice.color : "transparent";
}

/** choice からサイズを取り出す（size を持たない場合は medium にフォールバック） */
function resolveSize(choice: Choice): "large" | "medium" | "small" {
  return "size" in choice ? choice.size : "medium";
}

/** 演出状態に応じてクラス名を組み立てる */
function buildClassName(state: SizeChoiceProps["state"]): string {
  return [
    styles.choice,
    state === "right" ? styles.right : "",
    state === "wrong" ? styles.wrong : "",
  ]
    .filter(Boolean)
    .join(" ");
}

/** おおきさの選択肢（同一図形をサイズ違いのラッパで拡大縮小して描画） */
export function SizeChoice({ choice, state, onSelect }: SizeChoiceProps) {
  const shape = resolveShape(choice);
  const color = resolveColor(choice);
  const size = resolveSize(choice);
  const scaleClass = {
    large: styles.sizeLarge,
    medium: styles.sizeMedium,
    small: styles.sizeSmall,
  }[size];
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
      <span className={`${styles.sizeWrap} ${scaleClass}`}>
        <ShapeFigure shape={shape} color={color} />
      </span>
    </button>
  );
}
