import { describe, it, expect, vi } from "vitest";
import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import {
  ColorChoice,
  ShapeChoice,
  NumberChoice,
  choiceRenderers,
} from "@/components/quiz/renderers";
import type {
  ColorChoice as ColorChoiceData,
  ShapeChoice as ShapeChoiceData,
  NumberChoice as NumberChoiceData,
} from "@/lib/types";

const colorChoice: ColorChoiceData = {
  id: "c1",
  label: "あか",
  color: "#E5453C",
  correct: true,
};

const circleChoice: ShapeChoiceData = {
  id: "s1",
  label: "まる",
  shape: "circle",
  color: "#7FB8E8",
  correct: true,
};

const numberChoice: NumberChoiceData = {
  id: "n1",
  label: "さん",
  value: 3,
  correct: true,
};

describe("ColorChoice", () => {
  it("label を名前に持つボタンと色つきディスクを描画する", () => {
    render(<ColorChoice choice={colorChoice} state="idle" onSelect={() => {}} />);
    const button = screen.getByRole("button", { name: "あか" });
    expect(button).toBeInTheDocument();
    // 円ディスクに背景色が設定されている
    expect(button.querySelector("span")?.getAttribute("style")).toContain("background");
  });

  it("クリックで onSelect が発火する", async () => {
    const onSelect = vi.fn();
    const user = userEvent.setup();
    render(<ColorChoice choice={colorChoice} state="idle" onSelect={onSelect} />);

    await user.click(screen.getByRole("button", { name: "あか" }));
    expect(onSelect).toHaveBeenCalledTimes(1);
  });

  it("state に応じて data-state が変わる", () => {
    const { rerender } = render(
      <ColorChoice choice={colorChoice} state="right" onSelect={() => {}} />,
    );
    expect(screen.getByRole("button")).toHaveAttribute("data-state", "right");

    rerender(<ColorChoice choice={colorChoice} state="wrong" onSelect={() => {}} />);
    expect(screen.getByRole("button")).toHaveAttribute("data-state", "wrong");
  });
});

describe("ShapeChoice", () => {
  it("circle は circle 要素のSVGを描画する", () => {
    render(<ShapeChoice choice={circleChoice} state="idle" onSelect={() => {}} />);
    const button = screen.getByRole("button", { name: "まる" });
    expect(button.querySelector("svg circle")).toBeInTheDocument();
  });

  it("square / triangle もそれぞれのSVG要素を描画する", () => {
    const square: ShapeChoiceData = {
      id: "s2",
      label: "しかく",
      shape: "square",
      color: "#F2A65A",
      correct: false,
    };
    const { rerender } = render(
      <ShapeChoice choice={square} state="idle" onSelect={() => {}} />,
    );
    expect(screen.getByRole("button").querySelector("svg rect")).toBeInTheDocument();

    const triangle: ShapeChoiceData = {
      id: "s3",
      label: "さんかく",
      shape: "triangle",
      color: "#8FC97F",
      correct: false,
    };
    rerender(<ShapeChoice choice={triangle} state="idle" onSelect={() => {}} />);
    expect(screen.getByRole("button").querySelector("svg path")).toBeInTheDocument();
  });
});

describe("NumberChoice", () => {
  it("label を名前に持つボタンと数字グリフを描画する", () => {
    render(<NumberChoice choice={numberChoice} state="idle" onSelect={() => {}} />);
    const button = screen.getByRole("button", { name: "さん" });
    expect(button).toBeInTheDocument();
    // 数字グリフ（value）がテキストとして表示される
    expect(button).toHaveTextContent("3");
  });

  it("クリックで onSelect が発火する", async () => {
    const onSelect = vi.fn();
    const user = userEvent.setup();
    render(<NumberChoice choice={numberChoice} state="idle" onSelect={onSelect} />);

    await user.click(screen.getByRole("button", { name: "さん" }));
    expect(onSelect).toHaveBeenCalledTimes(1);
  });

  it("state に応じて data-state が変わる", () => {
    const { rerender } = render(
      <NumberChoice choice={numberChoice} state="right" onSelect={() => {}} />,
    );
    expect(screen.getByRole("button")).toHaveAttribute("data-state", "right");

    rerender(<NumberChoice choice={numberChoice} state="wrong" onSelect={() => {}} />);
    expect(screen.getByRole("button")).toHaveAttribute("data-state", "wrong");
  });
});

describe("choiceRenderers", () => {
  it("カテゴリごとにレンダラが対応している", () => {
    expect(choiceRenderers.color).toBe(ColorChoice);
    expect(choiceRenderers.shape).toBe(ShapeChoice);
    expect(choiceRenderers.number).toBe(NumberChoice);
  });
});
