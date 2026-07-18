// かたはめ（型はめ）の当たり判定に使う純粋幾何ユーティリティ。
// DOM に依存しないため、SSR/テストでも安全に呼べる。
import type { ShapeKind } from "@/lib/types";

/** 2次元の座標（画面ピクセル） */
export interface Point {
  x: number;
  y: number;
}

/** 2点間のユークリッド距離を返す。 */
export function distance(a: Point, b: Point): number {
  return Math.hypot(a.x - b.x, a.y - b.y);
}

/**
 * ピース中心が穴中心のスナップ圏内かを判定する。
 * 距離が snapRadius 以下なら圏内（境界ちょうどは圏内扱い）。
 */
export function isWithinSnap(
  pieceCenter: Point,
  holeCenter: Point,
  snapRadius: number,
): boolean {
  return distance(pieceCenter, holeCenter) <= snapRadius;
}

/**
 * ドロップ結果。
 * - "fit": 圏内かつ形が一致（正解）
 * - "miss": 圏内だが形が不一致（もういちど）
 * - "return": 圏外（形が一致でも戻すだけ・無反応＝ノーフェイル）
 */
export type DropResult = "fit" | "miss" | "return";

/**
 * ドロップ時の判定を行う（純粋関数）。
 * 圏外なら形に関わらず "return"。圏内なら形一致で "fit"、不一致で "miss"。
 */
export function evaluateDrop(params: {
  pieceShape: ShapeKind;
  targetShape: ShapeKind;
  pieceCenter: Point;
  holeCenter: Point;
  snapRadius: number;
}): DropResult {
  const { pieceShape, targetShape, pieceCenter, holeCenter, snapRadius } = params;
  if (!isWithinSnap(pieceCenter, holeCenter, snapRadius)) {
    return "return";
  }
  return pieceShape === targetShape ? "fit" : "miss";
}
