import { describe, it, expect } from "vitest";
import {
  advanceTrace,
  initialTraceState,
  isTraceComplete,
  traceRatio,
  type TraceConfig,
} from "@/components/quiz/renderers/traceProgress";
import type { Point } from "@/components/quiz/renderers/shapeFit";

// なぞり完成判定の純粋関数（DOM 非依存）を合成点列で検証する。テスト仕様書 NU1〜NU10。

// 検証用の基準設定。tolerance=10・lookahead=2・completeRatio=0.85。
const CONFIG: TraceConfig = { tolerance: 10, lookahead: 2, completeRatio: 0.85 };

/** x 軸に等間隔で並ぶ直線点列を作る（y=0）。 */
function line(count: number, step = 10): Point[] {
  return Array.from({ length: count }, (_, i) => ({ x: i * step, y: 0 }));
}

describe("advanceTrace（順消化・飛ばし許容・逆行不可・圏外）", () => {
  it("NU1: 直線点列を先頭から順になぞると nextIndex/consumed が1つずつ前進する", () => {
    // 点間隔を tolerance より広く（15>10）取り、1点ずつ厳密に消化されるようにする。
    const points = line(5, 15);
    let state = initialTraceState();

    state = advanceTrace(state, points, points[0], CONFIG);
    expect(state).toEqual({ nextIndex: 1, consumed: 1 });

    state = advanceTrace(state, points, points[1], CONFIG);
    expect(state).toEqual({ nextIndex: 2, consumed: 2 });

    state = advanceTrace(state, points, points[2], CONFIG);
    expect(state).toEqual({ nextIndex: 3, consumed: 3 });
  });

  it("NU2: lookahead 先の点だけ通しても frontier がその点+1まで前進する（飛ばし許容）", () => {
    // 点間隔を tolerance より広く（30>10）取り、index 2 だけに触れる状況を作る。
    const points = line(6, 30);
    const state = initialTraceState();
    // nextIndex=0 の窓 [0..2] のうち、2つ先（index 2）だけ許容半径内に触れる
    const next = advanceTrace(state, points, points[2], CONFIG);
    expect(next.nextIndex).toBe(3);
  });

  it("NU3: 前進後に手前へ戻しても nextIndex は減らない（逆行不可）", () => {
    const points = line(6);
    let state = advanceTrace(initialTraceState(), points, points[2], CONFIG);
    const advanced = state.nextIndex;
    // 手前（index 0）へ戻す
    state = advanceTrace(state, points, points[0], CONFIG);
    expect(state.nextIndex).toBe(advanced);
  });

  it("NU4: 先読み窓のどの点も許容半径を超えていれば状態は不変（圏外）", () => {
    const points = line(6);
    const state = initialTraceState();
    // どの点からも遠い座標
    const next = advanceTrace(state, points, { x: 999, y: 999 }, CONFIG);
    expect(next).toBe(state);
  });
});

describe("isTraceComplete / traceRatio", () => {
  it("NU5: 消化率>=0.85 かつ 残り<=lookahead なら完成", () => {
    const points = line(16);
    // nextIndex=15 → ratio=0.9375、残り=1（<=2）
    const state = { nextIndex: 15, consumed: 15 };
    expect(isTraceComplete(state, points, CONFIG)).toBe(true);
  });

  it("NU6: 消化率が不足していれば未完成", () => {
    const points = line(16);
    // nextIndex=8 → ratio=0.5（<0.85）
    const state = { nextIndex: 8, consumed: 8 };
    expect(isTraceComplete(state, points, CONFIG)).toBe(false);
  });

  it("NU7: 率は満たしても終点未到達（残り>lookahead）なら未完成", () => {
    const points = line(100);
    // nextIndex=90 → ratio=0.9（>=0.85）だが残り=10（>lookahead=2）
    const state = { nextIndex: 90, consumed: 90 };
    expect(isTraceComplete(state, points, CONFIG)).toBe(false);
  });

  it("NU8: traceRatio は nextIndex/length に一致する（途中/全消化）", () => {
    const points = line(10);
    expect(traceRatio({ nextIndex: 4, consumed: 4 }, points)).toBeCloseTo(0.4);
    expect(traceRatio({ nextIndex: 10, consumed: 10 }, points)).toBe(1);
  });

  it("NU9: initialTraceState は nextIndex=0・consumed=0", () => {
    expect(initialTraceState()).toEqual({ nextIndex: 0, consumed: 0 });
  });
});

describe("境界（許容半径ちょうど）", () => {
  it("NU10: distance=tolerance ちょうどは消化、tolerance+ε は非消化", () => {
    const points: Point[] = [
      { x: 0, y: 0 },
      { x: 100, y: 0 },
    ];
    // 先頭点からちょうど tolerance だけ離れた指 → 消化される（<=）
    const onEdge = advanceTrace(
      initialTraceState(),
      points,
      { x: CONFIG.tolerance, y: 0 },
      CONFIG,
    );
    expect(onEdge.nextIndex).toBe(1);

    // tolerance を少し超える指 → 消化されない
    const beyond = advanceTrace(
      initialTraceState(),
      points,
      { x: CONFIG.tolerance + 0.01, y: 0 },
      CONFIG,
    );
    expect(beyond.nextIndex).toBe(0);
  });
});
