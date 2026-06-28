import { describe, it, expect, vi, beforeEach } from "vitest";
import { render, screen, fireEvent } from "@testing-library/react";
import { AuthProvider, useAuth } from "@/components/auth/AuthProvider";
import { RequireAuth } from "@/components/auth/RequireAuth";

// next-auth/react をモックし、セッション状態と signIn/signOut の呼び出しを差し替える。
// SessionProvider は子をそのまま描画するだけのスタブにする。
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
  vi.clearAllMocks();
});

/** useAuth の状態と操作を画面に出す検証用コンポーネント */
function AuthProbe() {
  const { status, signIn, signOut } = useAuth();
  return (
    <div>
      <span data-testid="status">{status}</span>
      <button
        type="button"
        onClick={() => void signIn("google", { redirectTo: "/home" })}
      >
        signin
      </button>
      <button
        type="button"
        onClick={() => void signOut({ redirectTo: "/login" })}
      >
        signout
      </button>
    </div>
  );
}

function renderProbe() {
  return render(
    <AuthProvider>
      <AuthProbe />
    </AuthProvider>,
  );
}

describe("useAuth（next-auth セッションの橋渡し）", () => {
  it("useSession の loading をそのまま公開する", () => {
    useSessionMock.mockReturnValue({ data: null, status: "loading" });
    renderProbe();
    expect(screen.getByTestId("status").textContent).toBe("loading");
  });

  it("useSession の authenticated をそのまま公開する", () => {
    useSessionMock.mockReturnValue({
      data: { user: { email: "a@example.com" } },
      status: "authenticated",
    });
    renderProbe();
    expect(screen.getByTestId("status").textContent).toBe("authenticated");
  });

  it("useSession の unauthenticated をそのまま公開する", () => {
    useSessionMock.mockReturnValue({ data: null, status: "unauthenticated" });
    renderProbe();
    expect(screen.getByTestId("status").textContent).toBe("unauthenticated");
  });

  it("signIn は next-auth/react の signIn へ provider/redirectTo を委譲する", () => {
    useSessionMock.mockReturnValue({ data: null, status: "unauthenticated" });
    renderProbe();
    fireEvent.click(screen.getByText("signin"));
    expect(signInMock).toHaveBeenCalledWith("google", { redirectTo: "/home" });
  });

  it("signOut は next-auth/react の signOut へ redirectTo を委譲する", () => {
    useSessionMock.mockReturnValue({
      data: { user: {} },
      status: "authenticated",
    });
    renderProbe();
    fireEvent.click(screen.getByText("signout"));
    expect(signOutMock).toHaveBeenCalledWith({ redirectTo: "/login" });
  });
});

describe("RequireAuth（UX 用ガード）", () => {
  it("未認証なら /login へ replace し、子を表示しない", () => {
    useSessionMock.mockReturnValue({ data: null, status: "unauthenticated" });
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
    useSessionMock.mockReturnValue({
      data: { user: {} },
      status: "authenticated",
    });
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

  it("loading 中はローディング表示のままで遷移も子表示もしない", () => {
    useSessionMock.mockReturnValue({ data: null, status: "loading" });
    render(
      <AuthProvider>
        <RequireAuth>
          <p>kid-content</p>
        </RequireAuth>
      </AuthProvider>,
    );

    expect(screen.queryByText("kid-content")).toBeNull();
    expect(replaceMock).not.toHaveBeenCalled();
    expect(screen.getByRole("status")).toBeInTheDocument();
  });
});
