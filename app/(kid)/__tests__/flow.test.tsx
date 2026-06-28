import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import { render, screen, fireEvent, act } from "@testing-library/react";
import HomePage from "@/app/(kid)/home/page";
import GamePage from "@/app/(kid)/game/[category]/page";
import { AuthProvider } from "@/components/auth/AuthProvider";
import { loadProgress } from "@/lib/progress";

// next/navigation はテストでモックする（ルーター遷移は副作用呼び出しで検証）
const { pushMock, replaceMock, paramsRef } = vi.hoisted(() => ({
  pushMock: vi.fn(),
  replaceMock: vi.fn(),
  paramsRef: { current: {} as Record<string, string> },
}));

vi.mock("next/navigation", () => ({
  useRouter: () => ({
    push: pushMock,
    replace: replaceMock,
    prefetch: vi.fn(),
    back: vi.fn(),
    forward: vi.fn(),
    refresh: vi.fn(),
  }),
  useParams: () => paramsRef.current,
}));

// next-auth/react をモックし、認証済みセッションとして描画する
// （ParentLock が useAuth＝useSession に依存するため）
vi.mock("next-auth/react", () => ({
  SessionProvider: ({ children }: { children: React.ReactNode }) => (
    <>{children}</>
  ),
  useSession: () => ({
    data: { user: { email: "a@example.com" } },
    status: "authenticated",
  }),
  signIn: vi.fn(),
  signOut: vi.fn(),
}));

// QuizEngine の演出タイマーを決定的に進めるためフェイクタイマーを使う
beforeEach(() => {
  vi.useFakeTimers();
  window.localStorage.clear();
  pushMock.mockClear();
  replaceMock.mockClear();
  paramsRef.current = {};
});
afterEach(() => {
  vi.clearAllTimers();
  vi.useRealTimers();
});

/** 認証コンテキスト配下で描画する（ParentLock が useAuth に依存するため） */
function renderWithAuth(ui: React.ReactElement) {
  return render(<AuthProvider>{ui}</AuthProvider>);
}

/** フェイクタイマーを進めて演出後の状態更新を反映する */
function advance(ms: number): void {
  act(() => {
    vi.advanceTimersByTime(ms);
  });
}

/** 現在の問題の正解選択肢（data-correct="true"）をクリックする */
function clickCorrectChoice(): void {
  const choices = screen.getAllByTestId("choice");
  const correct = choices.find(
    (button) => button.getAttribute("data-correct") === "true",
  );
  if (!correct) {
    throw new Error("正解の選択肢が見つかりません");
  }
  fireEvent.click(correct);
}

/**
 * ごほうび(reward)が出るまで正解を押し続けて完走する（出題数に依存しない）。
 * プールから5問抽出されるため固定回数ループは使わず、e2e と同様に到達で判定する。
 */
function clearLesson(): void {
  // 万一ごほうびに到達しない場合の無限ループ防止（プール最大でも十分な上限）
  for (let guard = 0; guard < 100; guard++) {
    if (screen.queryByTestId("reward")) {
      return;
    }
    clickCorrectChoice();
    advance(1100);
  }
  throw new Error("ごほうびに到達しませんでした");
}

describe("おうち画面", () => {
  it("「いろ」タイルで /game/color へ遷移する", () => {
    renderWithAuth(<HomePage />);
    fireEvent.click(screen.getByTestId("tile-color"));
    expect(pushMock).toHaveBeenCalledWith("/game/color");
  });

  it("「かたち」タイルで /game/shape へ遷移する", () => {
    renderWithAuth(<HomePage />);
    fireEvent.click(screen.getByTestId("tile-shape"));
    expect(pushMock).toHaveBeenCalledWith("/game/shape");
  });

  it("「すうじ」タイルで /game/number へ遷移する", () => {
    renderWithAuth(<HomePage />);
    fireEvent.click(screen.getByTestId("tile-number"));
    expect(pushMock).toHaveBeenCalledWith("/game/number");
  });
});

describe("ゲーム画面（color）", () => {
  it("全問正解でごほうびが表示され、進捗のクリア数が増える", () => {
    paramsRef.current = { category: "color" };
    expect(loadProgress().categories.color.cleared).toBe(0);

    renderWithAuth(<GamePage />);
    clearLesson();

    expect(screen.getByTestId("reward")).toBeInTheDocument();
    expect(screen.getByText("よく できました！")).toBeInTheDocument();
    expect(loadProgress().categories.color.cleared).toBe(1);
    expect(loadProgress().stickers.length).toBeGreaterThan(0);
  });

  it("「もういちど」で同種目が最初から再開する", () => {
    paramsRef.current = { category: "color" };

    renderWithAuth(<GamePage />);
    clearLesson();

    fireEvent.click(screen.getByTestId("reward-again"));

    // QuizEngine が再マウントされ、ごほうびが消えて星0の出題中に戻る。
    // 抽出はランダムなので特定の設問文には依存しない（出題が再開していることを確認）。
    expect(screen.queryByTestId("reward")).not.toBeInTheDocument();
    expect(screen.getByRole("img", { name: /ほし 0/ })).toBeInTheDocument();
    expect(screen.getAllByTestId("choice").length).toBeGreaterThan(0);
  });

  it("「おうちに もどる」で /home へ遷移する", () => {
    paramsRef.current = { category: "color" };
    renderWithAuth(<GamePage />);
    clearLesson();

    fireEvent.click(screen.getByTestId("reward-home"));
    expect(pushMock).toHaveBeenCalledWith("/home");
  });
});

describe("ゲーム画面（shape）", () => {
  it("全問正解でごほうびが表示され、進捗のクリア数が増える", () => {
    paramsRef.current = { category: "shape" };
    expect(loadProgress().categories.shape.cleared).toBe(0);

    renderWithAuth(<GamePage />);
    clearLesson();

    expect(screen.getByTestId("reward")).toBeInTheDocument();
    expect(loadProgress().categories.shape.cleared).toBe(1);
  });
});

describe("ゲーム画面（number）", () => {
  it("全問正解でごほうびが表示され、進捗のクリア数が増える", () => {
    paramsRef.current = { category: "number" };
    expect(loadProgress().categories.number.cleared).toBe(0);

    renderWithAuth(<GamePage />);
    clearLesson();

    expect(screen.getByTestId("reward")).toBeInTheDocument();
    expect(loadProgress().categories.number.cleared).toBe(1);
  });
});

describe("ゲーム画面（不正カテゴリ）", () => {
  it("対応外カテゴリは /home へリダイレクトする", () => {
    paramsRef.current = { category: "unknown" };
    renderWithAuth(<GamePage />);
    expect(replaceMock).toHaveBeenCalledWith("/home");
  });
});
