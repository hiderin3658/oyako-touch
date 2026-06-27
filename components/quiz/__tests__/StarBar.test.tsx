import { describe, it, expect } from "vitest";
import { render, screen } from "@testing-library/react";
import { StarBar } from "@/components/quiz/StarBar";

describe("StarBar", () => {
  it("total 個の星を表示する（デフォルト3）", () => {
    const { container } = render(<StarBar count={0} />);
    expect(container.querySelectorAll("[data-on]")).toHaveLength(3);
  });

  it("count 個だけ点灯する", () => {
    const { container } = render(<StarBar count={2} total={3} />);
    expect(container.querySelectorAll('[data-on="true"]')).toHaveLength(2);
    expect(container.querySelectorAll('[data-on="false"]')).toHaveLength(1);
  });

  it("aria-label に現在の星数を含む", () => {
    render(<StarBar count={1} total={3} />);
    expect(screen.getByRole("img", { name: "ほし 1 / 3" })).toBeInTheDocument();
  });
});
