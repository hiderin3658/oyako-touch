import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import { render, screen, fireEvent, act } from "@testing-library/react";
import { AuthProvider, useAuth } from "@/components/auth/AuthProvider";
import { RequireAuth } from "@/components/auth/RequireAuth";
import { SESSION_STORAGE_KEY } from "@/lib/auth/mockAuth";

// next/navigation はモックしてリダイレクト呼び出しを検証する
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

/** useAuth の状態と操作を画面に出す検証用コンポーネント */
function AuthProbe() {
  const { status, signIn, signOut } = useAuth();
  return (
    <div>
      <span data-testid="status">{status}</span>
      <button type="button" onClick={() => void signIn()}>
        signin
      </button>
      <button type="button" onClick={signOut}>
        signout
      </button>
    </div>
  );
}

describe("useAuth", () => {
  it("初期マウントでセッション無しなら unauthenticated に確定する", () => {
    render(
      <AuthProvider>
        <AuthProbe />
      </AuthProvider>,
    );
    expect(screen.getByTestId("status").textContent).toBe("unauthenticated");
  });

  it("signIn で authenticating を経て authenticated になる", () => {
    render(
      <AuthProvider>
        <AuthProbe />
      </AuthProvider>,
    );

    fireEvent.click(screen.getByText("signin"));
    // 演出中は authenticating
    expect(screen.getByTestId("status").textContent).toBe("authenticating");

    // 演出時間（2.2s）経過で authenticated＋セッション保存
    advance(2200);
    expect(screen.getByTestId("status").textContent).toBe("authenticated");
    expect(window.localStorage.getItem(SESSION_STORAGE_KEY)).not.toBeNull();
  });

  it("signOut でセッションが破棄され unauthenticated になる", () => {
    render(
      <AuthProvider>
        <AuthProbe />
      </AuthProvider>,
    );

    fireEvent.click(screen.getByText("signin"));
    advance(2200);
    expect(screen.getByTestId("status").textContent).toBe("authenticated");

    fireEvent.click(screen.getByText("signout"));
    expect(screen.getByTestId("status").textContent).toBe("unauthenticated");
    expect(window.localStorage.getItem(SESSION_STORAGE_KEY)).toBeNull();
  });
});

describe("RequireAuth", () => {
  it("未認証なら /login へ replace し、子を表示しない", () => {
    render(
      <AuthProvider>
        <RequireAuth>
          <p>kid-content</p>
        </RequireAuth>
      </AuthProvider>,
    );

    expect(replaceMock).toHaveBeenCalledWith("/login");
    expect(screen.queryByText("kid-content")).toBeNull();
  });

  it("認証済みなら子を表示し、リダイレクトしない", () => {
    // 事前にセッションを保存しておくと初期判定で authenticated になる
    window.localStorage.setItem(
      SESSION_STORAGE_KEY,
      JSON.stringify({ authenticatedAt: Date.now() }),
    );

    render(
      <AuthProvider>
        <RequireAuth>
          <p>kid-content</p>
        </RequireAuth>
      </AuthProvider>,
    );

    expect(screen.getByText("kid-content")).toBeInTheDocument();
    expect(replaceMock).not.toHaveBeenCalled();
  });
});
