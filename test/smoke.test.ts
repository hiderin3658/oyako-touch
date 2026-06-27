import { describe, it, expect } from "vitest";
import { render, screen } from "@testing-library/react";
import { createElement } from "react";
import Home from "@/app/page";

describe("トップページ", () => {
  it("ロゴ『おやこタッチ』が表示される", () => {
    render(createElement(Home));
    expect(screen.getByText(/おやこタッチ/)).toBeInTheDocument();
  });

  it("タグラインが表示される", () => {
    render(createElement(Home));
    expect(screen.getByText("3さいの はじめての まなび")).toBeInTheDocument();
  });
});
