import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import { render, screen, fireEvent, act } from "@testing-library/react";
import { ParentLock } from "@/components/ParentLock";
import { AuthProvider } from "@/components/auth/AuthProvider";
import { SESSION_STORAGE_KEY } from "@/lib/auth/mockAuth";

const { replaceMock } = vi.hoisted(() => ({ replaceMock: vi.fn() }));

vi.mock("next/navigation", () => ({
  useRouter: () => ({
    push: vi.fn(),
    replace: replaceMock,
    prefetch: vi.fn(),
    back: vi.fn(),
    forward: vi.fn(),
    refresh: vi.fn(),
  }),
}));

beforeEach(() => {
  vi.useFakeTimers();
  window.localStorage.clear();
  replaceMock.mockClear();
});
afterEach(() => {
  vi.clearAllTimers();
  vi.useRealTimers();
});

function advance(ms: number): void {
  act(() => {
    vi.advanceTimersByTime(ms);
  });
}

function renderLock() {
  return render(
    <AuthProvider>
      <ParentLock />
    </AuthProvider>,
  );
}

describe("ParentLock", () => {
  it("長押し（しきい値超過）で保護者メニューが開く", () => {
    renderLock();
    const lock = screen.getByRole("button", { name: "保護者メニュー" });

    fireEvent.pointerDown(lock);
    advance(1400);

    expect(screen.getByRole("dialog")).toBeInTheDocument();
    expect(screen.getByText("ログアウト")).toBeInTheDocument();
  });

  it("短いタップではメニューを開かない", () => {
    renderLock();
    const lock = screen.getByRole("button", { name: "保護者メニュー" });

    fireEvent.pointerDown(lock);
    advance(500);
    fireEvent.pointerUp(lock);
    // しきい値前に離したので、その後時間が進んでも開かない
    advance(2000);

    expect(screen.queryByRole("dialog")).toBeNull();
  });

  it("ログアウトでセッションを破棄し /login へ遷移する", () => {
    window.localStorage.setItem(
      SESSION_STORAGE_KEY,
      JSON.stringify({ authenticatedAt: Date.now() }),
    );
    renderLock();
    const lock = screen.getByRole("button", { name: "保護者メニュー" });

    fireEvent.pointerDown(lock);
    advance(1400);
    fireEvent.click(screen.getByText("ログアウト"));

    expect(window.localStorage.getItem(SESSION_STORAGE_KEY)).toBeNull();
    expect(replaceMock).toHaveBeenCalledWith("/login");
  });
});
