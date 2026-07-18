import { describe, it, expect, vi } from "vitest";
import { render, screen, fireEvent } from "@testing-library/react";
import { ShapeFitBoard } from "@/components/quiz/renderers/ShapeFitBoard";
import type { Problem } from "@/lib/types";

// 検証用のかたはめ1問（正解=star、ダミー=circle/square、全ピース同色）。
function makeProblem(): Problem {
  return {
    id: "katahame-004",
    category: "katahame",
    type: "shape-fit",
    prompt: { text: "ほしを はめてね", say: "ほしを はめてね" },
    target: "star",
    choices: [
      { id: "p1", label: "ほし", shape: "star", color: "#FFC92E", correct: true },
      { id: "p2", label: "まる", shape: "circle", color: "#FFC92E", correct: false },
      { id: "p3", label: "しかく", shape: "square", color: "#FFC92E", correct: false },
    ],
    reward: "sticker-star",
  };
}

function correctPiece(): HTMLElement {
  const piece = screen
    .getAllByTestId("piece")
    .find((el) => el.getAttribute("data-correct") === "true");
  if (!piece) {
    throw new Error("正解ピースが見つかりません");
  }
  return piece;
}

function wrongPiece(): HTMLElement {
  const piece = screen
    .getAllByTestId("piece")
    .find((el) => el.getAttribute("data-correct") === "false");
  if (!piece) {
    throw new Error("誤ピースが見つかりません");
  }
  return piece;
}

/** getBoundingClientRect を固定矩形でスタブする（ドラッグ判定の決定論化）。 */
function stubRect(
  el: HTMLElement,
  rect: { left: number; top: number; width: number; height: number },
): void {
  el.getBoundingClientRect = () =>
    ({
      left: rect.left,
      top: rect.top,
      width: rect.width,
      height: rect.height,
      right: rect.left + rect.width,
      bottom: rect.top + rect.height,
      x: rect.left,
      y: rect.top,
      toJSON: () => ({}),
    }) as DOMRect;
}

/** clientX/clientY を伴う pointer イベントを発火する。
 *  jsdom は PointerEvent 非対応で fireEvent.pointer* は座標を落とすため、
 *  座標を保持する MouseEvent を type=pointer* として dispatch する。 */
function firePointer(
  el: HTMLElement,
  type: "pointerdown" | "pointermove" | "pointerup",
  clientX: number,
  clientY: number,
): void {
  fireEvent(
    el,
    new MouseEvent(type, { bubbles: true, cancelable: true, clientX, clientY }),
  );
}

describe("ShapeFitBoard 描画（U5・U13）", () => {
  it("U5: 穴（outline・data-shape=target）と各ピース（data-shape/data-correct・塗り）を描画する", () => {
    render(
      <ShapeFitBoard problem={makeProblem()} locked={false} onPlace={() => {}} />,
    );

    // 穴は target 形の outline（fill="none"）
    const hole = screen.getByTestId("hole");
    expect(hole).toHaveAttribute("data-shape", "star");
    const holeShape = hole.querySelector("path");
    expect(holeShape).toBeInTheDocument();
    expect(holeShape).toHaveAttribute("fill", "none");

    // ピースは3個。data-shape / data-correct を持ち、塗り（fill=色）で描画される
    const pieces = screen.getAllByTestId("piece");
    expect(pieces).toHaveLength(3);
    const star = pieces.find((p) => p.getAttribute("data-shape") === "star");
    expect(star).toHaveAttribute("data-correct", "true");
    expect(star?.querySelector("path")).toHaveAttribute("fill", "#FFC92E");
  });

  it("U13: 全ピースが choice.color で塗られる（同色）", () => {
    render(
      <ShapeFitBoard problem={makeProblem()} locked={false} onPlace={() => {}} />,
    );
    for (const piece of screen.getAllByTestId("piece")) {
      const shapeEl = piece.querySelector("circle, rect, path");
      expect(shapeEl).toHaveAttribute("fill", "#FFC92E");
    }
  });
});

describe("ShapeFitBoard タップ設置（U6・U7）", () => {
  it("U6: 正解ピースをタップ設置すると onPlace(id, true) が1回", () => {
    const onPlace = vi.fn();
    render(
      <ShapeFitBoard problem={makeProblem()} locked={false} onPlace={onPlace} />,
    );
    const piece = correctPiece();
    fireEvent.pointerDown(piece);
    fireEvent.pointerUp(piece);
    expect(onPlace).toHaveBeenCalledTimes(1);
    expect(onPlace).toHaveBeenCalledWith("p1", true);
  });

  it("U7: 誤ピースをタップ設置すると onPlace(id, false) が1回", () => {
    const onPlace = vi.fn();
    render(
      <ShapeFitBoard problem={makeProblem()} locked={false} onPlace={onPlace} />,
    );
    const piece = wrongPiece();
    const pieceId = piece.getAttribute("aria-label");
    fireEvent.pointerDown(piece);
    fireEvent.pointerUp(piece);
    expect(onPlace).toHaveBeenCalledTimes(1);
    // 誤ピースの id はデータに依存しないよう correct=false 側を検証
    expect(onPlace.mock.calls[0][1]).toBe(false);
    expect(pieceId).toBeTruthy();
  });
});

describe("ShapeFitBoard ドラッグ（U8・U9・U10）", () => {
  it("U8: 正解ピースを穴中心へドラッグすると onPlace(id, true)", () => {
    const onPlace = vi.fn();
    render(
      <ShapeFitBoard problem={makeProblem()} locked={false} onPlace={onPlace} />,
    );
    const hole = screen.getByTestId("hole");
    const piece = correctPiece();
    stubRect(hole, { left: 0, top: 0, width: 100, height: 100 }); // 中心(50,50)
    stubRect(piece, { left: 0, top: 200, width: 100, height: 100 }); // 中心(50,250)

    firePointer(piece, "pointerdown", 50, 250);
    firePointer(piece, "pointermove", 50, 50); // 穴中心へ
    firePointer(piece, "pointerup", 50, 50);

    expect(onPlace).toHaveBeenCalledWith("p1", true);
  });

  it("U9: 誤ピースを穴中心へドラッグすると onPlace(id, false)", () => {
    const onPlace = vi.fn();
    render(
      <ShapeFitBoard problem={makeProblem()} locked={false} onPlace={onPlace} />,
    );
    const hole = screen.getByTestId("hole");
    const piece = wrongPiece();
    stubRect(hole, { left: 0, top: 0, width: 100, height: 100 });
    stubRect(piece, { left: 0, top: 200, width: 100, height: 100 });

    firePointer(piece, "pointerdown", 50, 250);
    firePointer(piece, "pointermove", 50, 50);
    firePointer(piece, "pointerup", 50, 50);

    expect(onPlace).toHaveBeenCalledTimes(1);
    expect(onPlace.mock.calls[0][1]).toBe(false);
  });

  it("U10: 正解ピースを穴から離してドロップすると onPlace は呼ばれない（ノーフェイル）", () => {
    const onPlace = vi.fn();
    render(
      <ShapeFitBoard problem={makeProblem()} locked={false} onPlace={onPlace} />,
    );
    const hole = screen.getByTestId("hole");
    const piece = correctPiece();
    stubRect(hole, { left: 0, top: 0, width: 100, height: 100 });
    stubRect(piece, { left: 0, top: 200, width: 100, height: 100 });

    firePointer(piece, "pointerdown", 50, 250);
    firePointer(piece, "pointermove", 50, 600); // 穴から大きく離す
    firePointer(piece, "pointerup", 50, 600);

    expect(onPlace).not.toHaveBeenCalled();
  });
});

describe("ShapeFitBoard ロック・安全性（U11・U12）", () => {
  it("U11: locked=true では操作しても onPlace が発火しない", () => {
    const onPlace = vi.fn();
    render(
      <ShapeFitBoard problem={makeProblem()} locked={true} onPlace={onPlace} />,
    );
    const piece = correctPiece();
    fireEvent.pointerDown(piece);
    fireEvent.pointerUp(piece);
    expect(onPlace).not.toHaveBeenCalled();
  });

  it("U12: 矩形取得・ポインタキャプチャ不在でも例外を出さずタップ設置で成立する", () => {
    const onPlace = vi.fn();
    render(
      <ShapeFitBoard problem={makeProblem()} locked={false} onPlace={onPlace} />,
    );
    const hole = screen.getByTestId("hole");
    const piece = correctPiece();
    // getBoundingClientRect が失敗する環境を模擬する
    hole.getBoundingClientRect = () => {
      throw new Error("rect 不在");
    };
    piece.getBoundingClientRect = () => {
      throw new Error("rect 不在");
    };

    expect(() => {
      fireEvent.pointerDown(piece);
      fireEvent.pointerUp(piece);
    }).not.toThrow();
    // タップ設置フォールバックで正解として成立する
    expect(onPlace).toHaveBeenCalledWith("p1", true);
  });
});
