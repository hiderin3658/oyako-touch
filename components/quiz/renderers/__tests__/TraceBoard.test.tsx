import { describe, it, expect, vi } from "vitest";
import { render, screen, fireEvent } from "@testing-library/react";
import { TraceBoard } from "@/components/quiz/renderers/TraceBoard";
import type { Problem, ShapeKind } from "@/lib/types";

// 検証用のなぞり1問（選択肢を持たない）。
function makeProblem(target: ShapeKind = "star"): Problem {
  return {
    id: "nazori-004",
    category: "nazori",
    type: "trace",
    prompt: { text: "ほしを なぞってね", say: "ほしを なぞってね" },
    target,
    reward: `sticker-${target}`,
  };
}

/** getBoundingClientRect を固定矩形でスタブする（座標写像の決定論化）。 */
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

/** clientX/clientY を伴う pointer イベントを発火する（jsdom は座標を落とすため MouseEvent で代替）。 */
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

/** getTotalLength/getPointAtLength を注入して道サンプリング可能な環境を模擬する。
 *  点は横一直線（y=50、x=0..100）に等間隔で並ぶよう返す。 */
function injectGeometry(el: Element | null, total: number): void {
  if (!el) {
    throw new Error("幾何要素が見つかりません");
  }
  const geo = el as unknown as {
    getTotalLength: () => number;
    getPointAtLength: (len: number) => { x: number; y: number };
  };
  geo.getTotalLength = () => total;
  geo.getPointAtLength = (len: number) => ({ x: (len / total) * 100, y: 50 });
}

describe("TraceBoard 描画（NU11）", () => {
  it("NU11: trace-board・道ガイド(outline/fill=none/data-shape=target)・trace-start を描画し、piece/choice は無い", () => {
    render(
      <TraceBoard problem={makeProblem("star")} locked={false} onPlace={() => {}} />,
    );

    const board = screen.getByTestId("trace-board");
    expect(board).toBeInTheDocument();

    // 道ガイドは target 形の outline（fill="none"）で data-shape を持つ
    const guide = board.querySelector('[data-shape="star"]');
    expect(guide).toBeInTheDocument();
    const guideShape = guide?.querySelector("path");
    expect(guideShape).toHaveAttribute("fill", "none");

    // スタート目印が存在する
    expect(screen.getByTestId("trace-start")).toBeInTheDocument();

    // タップ3択・かたはめ盤面の要素は出さない
    expect(screen.queryAllByTestId("piece")).toHaveLength(0);
    expect(screen.queryAllByTestId("choice")).toHaveLength(0);
  });
});

describe("TraceBoard 完成通知・フォールバック（NU12・NU16）", () => {
  it("NU12: jsdom（サンプル不能）では pointerdown→pointerup の1セッションで onPlace('trace', true) が1回", () => {
    const onPlace = vi.fn();
    render(
      <TraceBoard problem={makeProblem()} locked={false} onPlace={onPlace} />,
    );
    const board = screen.getByTestId("trace-board");

    fireEvent.pointerDown(board);
    fireEvent.pointerUp(board);

    expect(onPlace).toHaveBeenCalledTimes(1);
    expect(onPlace).toHaveBeenCalledWith("trace", true);
  });

  it("NU16: 矩形・ポインタキャプチャ・getPointAtLength 不在でも例外を出さずフォールバックで完成する", () => {
    const onPlace = vi.fn();
    render(
      <TraceBoard problem={makeProblem()} locked={false} onPlace={onPlace} />,
    );
    const board = screen.getByTestId("trace-board");
    // 矩形取得が失敗する環境を模擬する
    board.getBoundingClientRect = () => {
      throw new Error("rect 不在");
    };

    expect(() => {
      firePointer(board, "pointerdown", 10, 10);
      firePointer(board, "pointerup", 10, 10);
    }).not.toThrow();
    expect(onPlace).toHaveBeenCalledWith("trace", true);
  });
});

describe("TraceBoard 誤答経路なし・中断（NU13・NU17）", () => {
  it("NU13: 途中で pointercancel されても onPlace は呼ばれない（false は決して発火しない）", () => {
    const onPlace = vi.fn();
    render(
      <TraceBoard problem={makeProblem()} locked={false} onPlace={onPlace} />,
    );
    const board = screen.getByTestId("trace-board");

    fireEvent.pointerDown(board);
    fireEvent(board, new MouseEvent("pointercancel", { bubbles: true }));

    expect(onPlace).not.toHaveBeenCalled();
  });

  it("NU17: 中断後は onPlace を呼ばず、状態がクリアされて再操作で完成が成立する", () => {
    const onPlace = vi.fn();
    render(
      <TraceBoard problem={makeProblem()} locked={false} onPlace={onPlace} />,
    );
    const board = screen.getByTestId("trace-board");

    // 中断（onPlace は呼ばれない）
    fireEvent.pointerDown(board);
    fireEvent(board, new MouseEvent("pointercancel", { bubbles: true }));
    expect(onPlace).not.toHaveBeenCalled();

    // 改めて down→up すると完成が成立する
    fireEvent.pointerDown(board);
    fireEvent.pointerUp(board);
    expect(onPlace).toHaveBeenCalledTimes(1);
    expect(onPlace).toHaveBeenCalledWith("trace", true);
  });
});

describe("TraceBoard 二重発火防止・ロック（NU14・NU15）", () => {
  it("NU14: 完成後に再操作しても onPlace は追加発火しない（completedRef）", () => {
    const onPlace = vi.fn();
    render(
      <TraceBoard problem={makeProblem()} locked={false} onPlace={onPlace} />,
    );
    const board = screen.getByTestId("trace-board");

    fireEvent.pointerDown(board);
    fireEvent.pointerUp(board);
    // 完成後に再操作
    fireEvent.pointerDown(board);
    fireEvent.pointerUp(board);

    expect(onPlace).toHaveBeenCalledTimes(1);
  });

  it("NU15: locked=true では操作しても onPlace が発火しない", () => {
    const onPlace = vi.fn();
    render(
      <TraceBoard problem={makeProblem()} locked={true} onPlace={onPlace} />,
    );
    const board = screen.getByTestId("trace-board");

    fireEvent.pointerDown(board);
    fireEvent.pointerUp(board);

    expect(onPlace).not.toHaveBeenCalled();
  });
});

describe("TraceBoard 進捗描画（NU18）", () => {
  it("NU18: 道サンプルを注入してなぞると stroke-dashoffset が消化率に応じて減少する", () => {
    const onPlace = vi.fn();
    render(
      <TraceBoard problem={makeProblem("circle")} locked={false} onPlace={onPlace} />,
    );
    const board = screen.getByTestId("trace-board");
    // 道ガイド矩形を 100x100 に固定し、client 座標＝ユーザー座標（viewBox 0..100）にする
    const guide = board.querySelector('[data-shape="circle"]') as HTMLElement;
    stubRect(guide, { left: 0, top: 0, width: 100, height: 100 });

    // 道ガイド・なぞり跡の幾何要素に getTotalLength/getPointAtLength を注入する
    const TOTAL = 160;
    const guideGeo = guide.querySelector("circle");
    const overlayGeo = screen
      .getByTestId("trace-overlay")
      .querySelector("circle");
    injectGeometry(guideGeo ?? null, TOTAL);
    injectGeometry(overlayGeo ?? null, TOTAL);

    // なぞり開始（この時点で道が再サンプリングされ、サンプル可能になる）
    firePointer(board, "pointerdown", 0, 50);

    // 途中まで（点 x=20 付近）なぞった時点の dashoffset
    firePointer(board, "pointermove", 13, 50);
    firePointer(board, "pointermove", 20, 50);
    const overlayEl = overlayGeo as unknown as SVGElement;
    const offsetMid = parseFloat(overlayEl.style.strokeDashoffset);

    // さらに先（点 x=50 付近）までなぞる
    firePointer(board, "pointermove", 33, 50);
    firePointer(board, "pointermove", 46, 50);
    firePointer(board, "pointermove", 50, 50);
    const offsetLater = parseFloat(overlayEl.style.strokeDashoffset);

    // 消化が進むほど dashoffset は小さくなる（色づきが伸びる）
    expect(offsetMid).toBeLessThan(TOTAL);
    expect(offsetLater).toBeLessThan(offsetMid);
  });
});
