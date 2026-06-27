import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import { render, act } from "@testing-library/react";
import { Sparkles } from "@/components/quiz/Sparkles";

describe("Sparkles", () => {
  beforeEach(() => {
    vi.useFakeTimers();
  });
  afterEach(() => {
    vi.runOnlyPendingTimers();
    vi.useRealTimers();
  });

  it("trigger=0 では何も描画しない", () => {
    const { container } = render(<Sparkles trigger={0} />);
    expect(container.querySelector("span")).toBeNull();
  });

  it("trigger が変わるとキラキラを描画し、一定時間後に消える", () => {
    const { container, rerender } = render(<Sparkles trigger={0} />);

    act(() => {
      rerender(<Sparkles trigger={1} />);
    });
    expect(container.querySelectorAll("span").length).toBeGreaterThan(0);

    // rise アニメ終了後にDOMから片付けられる
    act(() => {
      vi.advanceTimersByTime(1000);
    });
    expect(container.querySelectorAll("span").length).toBe(0);
  });
});
