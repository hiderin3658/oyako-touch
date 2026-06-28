import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import { render, screen, fireEvent, act } from "@testing-library/react";
import HomePage from "@/app/(kid)/home/page";
import GamePage from "@/app/(kid)/game/[category]/page";
import { AuthProvider } from "@/components/auth/AuthProvider";
import { loadLesson } from "@/lib/problems";
import { loadProgress } from "@/lib/progress";
import type { Lesson } from "@/lib/types";

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

/** レッスンの全問を正解してごほうび到達まで進める（問題数に依存しない） */
function clearLesson(lesson: Lesson): void {
  for (let index = 0; index < lesson.problems.length; index++) {
    clickCorrectChoice();
    advance(1100);
  }
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
    clearLesson(loadLesson("color"));

    expect(screen.getByTestId("reward")).toBeInTheDocument();
    expect(screen.getByText("よく できました！")).toBeInTheDocument();
    expect(loadProgress().categories.color.cleared).toBe(1);
    expect(loadProgress().stickers.length).toBeGreaterThan(0);
  });

  it("「もういちど」で同種目が最初から再開する", () => {
    paramsRef.current = { category: "color" };
    const lesson = loadLesson("color");

    renderWithAuth(<GamePage />);
    clearLesson(lesson);

    fireEvent.click(screen.getByTestId("reward-again"));

    // 1問目の設問と星0に戻る（QuizEngine 再マウント）
    expect(
      screen.getByText(lesson.problems[0].prompt.text),
    ).toBeInTheDocument();
    expect(screen.getByRole("img", { name: /ほし 0/ })).toBeInTheDocument();
  });

  it("「おうちに もどる」で /home へ遷移する", () => {
    paramsRef.current = { category: "color" };
    renderWithAuth(<GamePage />);
    clearLesson(loadLesson("color"));

    fireEvent.click(screen.getByTestId("reward-home"));
    expect(pushMock).toHaveBeenCalledWith("/home");
  });
});

describe("ゲーム画面（shape）", () => {
  it("全問正解でごほうびが表示され、進捗のクリア数が増える", () => {
    paramsRef.current = { category: "shape" };
    expect(loadProgress().categories.shape.cleared).toBe(0);

    renderWithAuth(<GamePage />);
    clearLesson(loadLesson("shape"));

    expect(screen.getByTestId("reward")).toBeInTheDocument();
    expect(loadProgress().categories.shape.cleared).toBe(1);
  });
});

describe("ゲーム画面（number）", () => {
  it("全問正解でごほうびが表示され、進捗のクリア数が増える", () => {
    paramsRef.current = { category: "number" };
    expect(loadProgress().categories.number.cleared).toBe(0);

    renderWithAuth(<GamePage />);
    clearLesson(loadLesson("number"));

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
