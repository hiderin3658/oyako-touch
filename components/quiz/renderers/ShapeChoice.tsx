"use client";

import type { Choice, ShapeKind } from "@/lib/types";
import styles from "./Choice.module.css";

interface ShapeChoiceProps {
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

/** 演出状態に応じてクラス名を組み立てる */
function buildClassName(state: ShapeChoiceProps["state"]): string {
  return [
    styles.choice,
    state === "right" ? styles.right : "",
    state === "wrong" ? styles.wrong : "",
  ]
    .filter(Boolean)
    .join(" ");
}

/** 図形SVG。prototype.html の shapeSVG() を移植（色は choice.color を使用） */
export function ShapeFigure({ shape, color }: { shape: ShapeKind; color: string }) {
  if (shape === "circle") {
    return (
      <svg className={styles.shape} viewBox="0 0 100 100" aria-hidden="true">
        <circle cx="50" cy="50" r="42" fill={color} />
      </svg>
    );
  }
  if (shape === "square") {
    return (
      <svg className={styles.shape} viewBox="0 0 100 100" aria-hidden="true">
        <rect x="12" y="12" width="76" height="76" rx="12" fill={color} />
      </svg>
    );
  }
  if (shape === "star") {
    return (
      <svg className={styles.shape} viewBox="0 0 100 100" aria-hidden="true">
        <path
          d="M50 8 L61 38 L93 38 L67 58 L77 90 L50 70 L23 90 L33 58 L7 38 L39 38 Z"
          fill={color}
          strokeLinejoin="round"
        />
      </svg>
    );
  }
  if (shape === "heart") {
    return (
      <svg className={styles.shape} viewBox="0 0 100 100" aria-hidden="true">
        <path
          d="M50 84 C50 84 12 58 12 34 C12 21 22 13 33 13 C41 13 47 18 50 25 C53 18 59 13 67 13 C78 13 88 21 88 34 C88 58 50 84 50 84 Z"
          fill={color}
          strokeLinejoin="round"
        />
      </svg>
    );
  }
  // triangle（既定）
  return (
    <svg className={styles.shape} viewBox="0 0 100 100" aria-hidden="true">
      <path d="M50 12 L90 86 L10 86 Z" fill={color} strokeLinejoin="round" />
    </svg>
  );
}

/** かたちはめの選択肢（図形SVG） */
export function ShapeChoice({ choice, state, onSelect }: ShapeChoiceProps) {
  const shape = resolveShape(choice);
  const color = resolveColor(choice);
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
      <ShapeFigure shape={shape} color={color} />
    </button>
  );
}
