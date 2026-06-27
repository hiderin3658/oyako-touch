import { describe, it, expect, vi, beforeEach } from "vitest";
import RootPage from "@/app/page";

// next/navigation の redirect をモックして遷移先を検証する
const { redirectMock } = vi.hoisted(() => ({ redirectMock: vi.fn() }));
vi.mock("next/navigation", () => ({ redirect: redirectMock }));

beforeEach(() => {
  redirectMock.mockClear();
});

describe("トップページ", () => {
  it("ルート（/）は /home へリダイレクトする", () => {
    RootPage();
    expect(redirectMock).toHaveBeenCalledWith("/home");
  });
});
