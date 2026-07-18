// なぞり（trace）の完成判定に使う純粋関数群。
// DOM に依存しないため、SSR/テストでも安全に呼べる。
// 座標系は道ガイド SVG の viewBox 0..100 のユーザー座標に統一する（解像度非依存）。
import { distance, type Point } from "./shapeFit";

/**
 * なぞりの進行状態（frontier モデル）。
 * - nextIndex: 次に消化すべき通過点の index（= 消化済み contiguous prefix の長さ）。
 * - consumed: 指が実際に許容半径内をなぞって前進した回数（診断・進捗の粒度用）。
 */
export interface TraceState {
  nextIndex: number;
  consumed: number;
}

/**
 * なぞり判定の調整パラメータ（実機 NM2 で微調整前提）。
 * - tolerance: 通過点を消化とみなす許容半径（ユーザー座標）。
 * - lookahead: frontier から先読みして消化を許す点数（少し飛ばしてよい量）。
 * - completeRatio: 完成に必要な最小消化率（0..1）。
 */
export interface TraceConfig {
  tolerance: number;
  lookahead: number;
  completeRatio: number;
}

/** 初期状態（未消化）を返す。 */
export function initialTraceState(): TraceState {
  return { nextIndex: 0, consumed: 0 };
}

/**
 * 指の現在位置で frontier を前進させる（純粋関数）。
 * points[nextIndex..nextIndex+lookahead] の窓のうち、許容半径内にある「最も先」の点まで
 * frontier を進める（順消化・少し飛ばし許容・逆行しない）。窓内が全て圏外なら状態不変。
 */
export function advanceTrace(
  state: TraceState,
  points: readonly Point[],
  finger: Point,
  config: TraceConfig,
): TraceState {
  // 既に全点消化済みなら前進しない
  if (state.nextIndex >= points.length) {
    return state;
  }
  // frontier から lookahead 先までの窓で、許容半径内にある最も先の点を探す
  const windowEnd = Math.min(state.nextIndex + config.lookahead, points.length - 1);
  let reached = -1;
  for (let i = state.nextIndex; i <= windowEnd; i += 1) {
    if (distance(finger, points[i]) <= config.tolerance) {
      // より先の点を優先する（最も先まで一気に前進＝飛ばし許容）
      reached = i;
    }
  }
  if (reached < 0) {
    // 窓内のどの点も圏外＝前進しない（逆行もしない＝ノーフェイル）
    return state;
  }
  return {
    nextIndex: reached + 1,
    consumed: state.consumed + 1,
  };
}

/** 消化率（nextIndex / 点数）を返す。点が無ければ 0。 */
export function traceRatio(state: TraceState, points: readonly Point[]): number {
  if (points.length === 0) {
    return 0;
  }
  return state.nextIndex / points.length;
}

/**
 * 完成判定：消化率 >= completeRatio かつ 終点付近（残り点数 <= lookahead）。
 * 中盤だけ消化した状態や、率不足の状態では完成しない。
 */
export function isTraceComplete(
  state: TraceState,
  points: readonly Point[],
  config: TraceConfig,
): boolean {
  if (points.length === 0) {
    return false;
  }
  const remaining = points.length - state.nextIndex;
  return (
    traceRatio(state, points) >= config.completeRatio &&
    remaining <= config.lookahead
  );
}
