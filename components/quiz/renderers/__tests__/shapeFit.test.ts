import { describe, it, expect } from "vitest";
import {
  distance,
  isWithinSnap,
  evaluateDrop,
} from "@/components/quiz/renderers/shapeFit";

// かたはめの当たり判定（純粋幾何）を検証する。テスト仕様書 U1〜U4。
describe("shapeFit 幾何ユーティリティ", () => {
  it("distance は2点間のユークリッド距離を返す", () => {
    expect(distance({ x: 0, y: 0 }, { x: 3, y: 4 })).toBe(5);
    expect(distance({ x: 1, y: 1 }, { x: 1, y: 1 })).toBe(0);
  });

  it("U4: isWithinSnap は距離＝半径ちょうどで true・半径超過で false", () => {
    const hole = { x: 0, y: 0 };
    // 距離ちょうど 10（=半径）は圏内
    expect(isWithinSnap({ x: 10, y: 0 }, hole, 10)).toBe(true);
    // 半径 + ε は圏外
    expect(isWithinSnap({ x: 10.0001, y: 0 }, hole, 10)).toBe(false);
  });

  it("U1: 形一致・圏内は fit", () => {
    expect(
      evaluateDrop({
        pieceShape: "star",
        targetShape: "star",
        pieceCenter: { x: 0, y: 0 },
        holeCenter: { x: 0, y: 0 },
        snapRadius: 20,
      }),
    ).toBe("fit");
  });

  it("U2: 形不一致・圏内は miss", () => {
    expect(
      evaluateDrop({
        pieceShape: "circle",
        targetShape: "star",
        pieceCenter: { x: 5, y: 5 },
        holeCenter: { x: 0, y: 0 },
        snapRadius: 20,
      }),
    ).toBe("miss");
  });

  it("U3: 圏外は形一致でも return", () => {
    expect(
      evaluateDrop({
        pieceShape: "star",
        targetShape: "star",
        pieceCenter: { x: 100, y: 100 },
        holeCenter: { x: 0, y: 0 },
        snapRadius: 20,
      }),
    ).toBe("return");
  });
});
