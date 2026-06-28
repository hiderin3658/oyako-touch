import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import { render, screen, fireEvent, act } from "@testing-library/react";
import { ParentLock } from "@/components/ParentLock";
import { AuthProvider } from "@/components/auth/AuthProvider";

// next-auth/react をモックする。ParentLock は認証済み前提で開かれるため authenticated を返す。
const { useSessionMock, signInMock, signOutMock } = vi.hoisted(() => ({
  useSessionMock: vi.fn(),
  signInMock: vi.fn(),
  signOutMock: vi.fn(),
}));

vi.mock("next-auth/react", () => ({
  SessionProvider: ({ children }: { children: React.ReactNode }) => (
    <>{children}</>
  ),
  useSession: () => useSessionMock(),
  signIn: signInMock,
  signOut: signOutMock,
}));

beforeEach(() => {
  vi.useFakeTimers();
  window.localStorage.clear();
  vi.clearAllMocks();
  useSessionMock.mockReturnValue({
    data: { user: { email: "a@example.com" } },
    status: "authenticated",
  });
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

  it("ログアウトで signOut({ redirectTo: '/login' }) を呼ぶ", () => {
    renderLock();
    const lock = screen.getByRole("button", { name: "保護者メニュー" });

    fireEvent.pointerDown(lock);
    advance(1400);
    fireEvent.click(screen.getByText("ログアウト"));

    expect(signOutMock).toHaveBeenCalledWith({ redirectTo: "/login" });
  });
});
