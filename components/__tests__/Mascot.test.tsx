import { describe, it, expect, vi } from "vitest";
import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { Mascot } from "@/components/Mascot";

describe("Mascot", () => {
  it("クマSVGがレンダリングされる", () => {
    const { container } = render(<Mascot />);
    expect(container.querySelector("svg")).toBeInTheDocument();
  });

  it("onTap を渡すとボタンになり、タップで発火する", async () => {
    const onTap = vi.fn();
    const user = userEvent.setup();
    render(<Mascot onTap={onTap} ariaLabel="よみあげ" />);

    await user.click(screen.getByRole("button", { name: "よみあげ" }));
    expect(onTap).toHaveBeenCalledTimes(1);
  });

  it("animation prop に応じて SVG の状態（data-animation）が変わる", () => {
    const { container, rerender } = render(<Mascot animation="bob" />);
    expect(container.querySelector("svg")).toHaveAttribute("data-animation", "bob");

    rerender(<Mascot animation="cheer" />);
    expect(container.querySelector("svg")).toHaveAttribute("data-animation", "cheer");

    rerender(<Mascot animation="none" />);
    expect(container.querySelector("svg")).toHaveAttribute("data-animation", "none");
  });
});
