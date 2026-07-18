import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import { render, screen, fireEvent, act } from "@testing-library/react";
import { QuizEngine } from "@/components/quiz/QuizEngine";
import { loadLesson } from "@/lib/problems";
import { playClip, playPhrase } from "@/lib/audio";
import type { Choice, Lesson } from "@/lib/types";

// 音声はモックする（演出の進行は「ほめ言葉の再生完了」を待つため、即解決の Promise にして決定的にする）。
vi.mock("@/lib/audio", () => ({
  playClip: vi.fn(() => Promise.resolve()),
  playPhrase: vi.fn(() => Promise.resolve()),
  playSfx: vi.fn(),
  unlockAudio: vi.fn(),
}));

// 演出タイマーを決定的に制御するためフェイクタイマーを使う。
// クリックはタイマーに依存しない fireEvent（同期）で行う。
beforeEach(() => {
  vi.useFakeTimers();
});
afterEach(() => {
  // 未消化の演出タイマーは実行せず破棄する（act外での状態更新を防ぐ）
  vi.clearAllTimers();
  vi.useRealTimers();
});

/** 指定問題の正解選択肢のラベルを返す */
function correctLabel(lesson: Lesson, index: number): string {
  const problem = lesson.problems[index];
  // なぞり（choices を持たない）でも安全に参照する
  const choices = ("choices" in problem ? problem.choices : []) as Choice[];
  const correct = choices.find((choice) => choice.correct);
  if (!correct) {
    throw new Error(`正解選択肢が見つかりません: index=${index}`);
  }
  return correct.label;
}

/** 指定ラベルの選択肢ボタンをクリックする */
function clickChoice(name: string): void {
  fireEvent.click(screen.getByRole("button", { name }));
}

/**
 * フェイクタイマーを進めて演出後の状態更新を反映する。
 * 演出進行は Promise（再生完了待ち）を挟むため、タイマーとマイクロタスクの両方を消化する非同期版にする。
 */
async function advance(ms: number): Promise<void> {
  await act(async () => {
    await vi.advanceTimersByTimeAsync(ms);
  });
}

describe("QuizEngine", () => {
  it("正解すると星が増え、演出後に次の問題へ進む（color）", async () => {
    const lesson = loadLesson("color");
    const onComplete = vi.fn();
    render(<QuizEngine lesson={lesson} onComplete={onComplete} />);

    // 1問目の設問・星0が表示される
    expect(screen.getByText(lesson.problems[0].prompt.text)).toBeInTheDocument();
    expect(screen.getByRole("img", { name: /ほし 0/ })).toBeInTheDocument();

    clickChoice(correctLabel(lesson, 0));
    // 星が1に増える
    expect(screen.getByRole("img", { name: /ほし 1/ })).toBeInTheDocument();
    // 「せいかい！」を言葉で表示する
    expect(screen.getByText("せいかい！")).toBeInTheDocument();

    // 正解演出後に次の問題へ進み、「せいかい！」は消える
    await advance(1100);
    expect(screen.queryByText("せいかい！")).toBeNull();
    expect(screen.getByText(lesson.problems[1].prompt.text)).toBeInTheDocument();
  });

  it("誤答しても × やふせいかいを出さず、同じ問題に留まる（ノーフェイル）", async () => {
    const lesson = loadLesson("color");
    const onComplete = vi.fn();
    render(<QuizEngine lesson={lesson} onComplete={onComplete} />);

    const wrong = (lesson.problems[0].choices as Choice[]).find((choice) => !choice.correct);
    clickChoice(wrong!.label);

    // フェイル表現（×・ふせいかい）は出さない
    expect(screen.queryByText("×")).toBeNull();
    expect(screen.queryByText(/ふせいかい/)).toBeNull();
    // 代わりにやさしい「もういちど！」を表示する
    expect(screen.getByText("もういちど！")).toBeInTheDocument();
    // 星は増えない
    expect(screen.getByRole("img", { name: /ほし 0/ })).toBeInTheDocument();

    // 誤答演出後は「もういちど！」が消え、同じ問題のまま・完了もしない
    await advance(1100);
    expect(screen.queryByText("もういちど！")).toBeNull();
    expect(screen.getByText(lesson.problems[0].prompt.text)).toBeInTheDocument();
    expect(onComplete).not.toHaveBeenCalled();
  });

  it("全問正解すると onComplete(stars=問題数) が呼ばれる（color）", async () => {
    const lesson = loadLesson("color");
    const onComplete = vi.fn();
    render(<QuizEngine lesson={lesson} onComplete={onComplete} />);

    // 問題数に依存せず、全問正解で星＝問題数になることを検証する
    for (let index = 0; index < lesson.problems.length; index++) {
      clickChoice(correctLabel(lesson, index));
      await advance(1100);
    }
    expect(onComplete).toHaveBeenCalledWith(lesson.problems.length);
  });

  it("shape の Lesson でも図形を描画して進行できる", () => {
    const lesson = loadLesson("shape");
    const onComplete = vi.fn();
    render(<QuizEngine lesson={lesson} onComplete={onComplete} />);

    // 正解選択肢の図形SVGが描画されている
    const correctButton = screen.getByRole("button", { name: correctLabel(lesson, 0) });
    expect(correctButton.querySelector("svg")).toBeInTheDocument();

    fireEvent.click(correctButton);
    expect(screen.getByRole("img", { name: /ほし 1/ })).toBeInTheDocument();
  });

  it("animal の Lesson でも画像を描画して正解で星が増える", async () => {
    const lesson = loadLesson("animal");
    const onComplete = vi.fn();
    render(<QuizEngine lesson={lesson} onComplete={onComplete} />);

    // 1問目の設問・星0が表示される
    expect(screen.getByText(lesson.problems[0].prompt.text)).toBeInTheDocument();
    expect(screen.getByRole("img", { name: /ほし 0/ })).toBeInTheDocument();

    // 正解選択肢が動物イラスト画像（img）を描画している
    const correctButton = screen.getByRole("button", { name: correctLabel(lesson, 0) });
    expect(correctButton.querySelector("img")).toBeInTheDocument();

    fireEvent.click(correctButton);
    // 星が1に増え、せいかい！演出が出る
    expect(screen.getByRole("img", { name: /ほし 1/ })).toBeInTheDocument();
    expect(screen.getByText("せいかい！")).toBeInTheDocument();

    // 演出後に次の問題へ進む
    await advance(1100);
    expect(screen.getByText(lesson.problems[1].prompt.text)).toBeInTheDocument();
  });

  it("ほめ言葉が鳴り終わるまで次の問題へ進まない（音声途切れ防止の回帰）", async () => {
    const lesson = loadLesson("color");
    // 「まだ鳴っている」ほめ言葉を手動制御の Promise で表現する
    let resolvePraise: () => void = () => {};
    const praise = new Promise<void>((resolve) => {
      resolvePraise = resolve;
    });
    vi.mocked(playPhrase).mockReturnValueOnce(praise);

    render(<QuizEngine lesson={lesson} onComplete={vi.fn()} />);
    clickChoice(correctLabel(lesson, 0));

    // 最小表示時間(800ms)を超えても、ほめ言葉が鳴り終わっていなければ進まない
    await advance(1500);
    expect(screen.getByText("せいかい！")).toBeInTheDocument();
    expect(screen.getByText(lesson.problems[0].prompt.text)).toBeInTheDocument();

    // ほめ言葉が鳴り終わったら次の問題へ進む
    resolvePraise();
    await advance(0);
    expect(screen.queryByText("せいかい！")).toBeNull();
    expect(screen.getByText(lesson.problems[1].prompt.text)).toBeInTheDocument();
  });

  it("prompt.audio があれば参照先の音声を再利用して読み上げる", () => {
    // size-003 は size-001 の音声を共有する（自身の size-003.mp3 は使わない）。
    const lesson: Lesson = {
      category: "size",
      title: "おおきさ",
      problems: [
        {
          id: "size-003",
          category: "size",
          type: "select-one",
          prompt: {
            text: "いちばん おおきいのは どれ？",
            say: "いちばん おおきいのは どれ",
            audio: "size-001",
          },
          choices: [
            { id: "z1", label: "おおきい", shape: "circle", color: "#7FB8E8", size: "large", correct: true },
            { id: "z2", label: "ちいさい", shape: "circle", color: "#7FB8E8", size: "small", correct: false },
          ],
        },
      ],
    } as unknown as Lesson;

    render(<QuizEngine lesson={lesson} onComplete={vi.fn()} />);
    // 問題IDの size-003.mp3 ではなく、参照先 size-001.mp3 を再生する
    expect(playClip).toHaveBeenCalledWith(
      "/audio/q/size-001.mp3",
      "いちばん おおきいのは どれ",
    );
  });

  it("同じ音声を共有する問題が連続しても各問題で読み上げが発火する（無音バグ回帰）", async () => {
    // 2問とも読み上げ・参照先音声が同一（どちらも size-001 を鳴らす）。
    // 依存配列を currentAudioName だけにすると2問目で再発火せず無音になっていた。
    const lesson: Lesson = {
      category: "size",
      title: "おおきさ",
      problems: [
        {
          id: "size-001",
          category: "size",
          type: "select-one",
          prompt: { text: "いちばん おおきいのは どれ？", say: "いちばん おおきいのは どれ" },
          choices: [
            { id: "z1", label: "おおきい", shape: "circle", color: "#7FB8E8", size: "large", correct: true },
            { id: "z2", label: "ちいさい", shape: "circle", color: "#7FB8E8", size: "small", correct: false },
          ],
        },
        {
          id: "size-005",
          category: "size",
          type: "select-one",
          prompt: { text: "いちばん おおきいのは どれ？", say: "いちばん おおきいのは どれ", audio: "size-001" },
          choices: [
            { id: "z1", label: "おおきい", shape: "triangle", color: "#8FC97F", size: "large", correct: true },
            { id: "z2", label: "ちいさい", shape: "triangle", color: "#8FC97F", size: "small", correct: false },
          ],
        },
      ],
    } as unknown as Lesson;

    // このファイルは mock をテスト間でクリアしないため、カウント検証前にクリアする。
    vi.mocked(playClip).mockClear();
    render(<QuizEngine lesson={lesson} onComplete={vi.fn()} />);
    const callsForSize001 = () =>
      vi.mocked(playClip).mock.calls.filter((c) => c[0] === "/audio/q/size-001.mp3").length;

    // 1問目で size-001.mp3 が1回鳴る
    expect(callsForSize001()).toBe(1);

    // 正解して2問目へ（2問目も size-001 を共有）
    clickChoice(correctLabel(lesson, 0));
    await advance(1100);

    // 2問目でも読み上げが発火し、size-001.mp3 が計2回鳴る（修正前は1回のまま＝無音）
    expect(callsForSize001()).toBe(2);
  });

  it("katahame Lesson で正解ピースをタップ設置すると星+1・せいかい！・演出後に次問（U23）", async () => {
    const lesson = loadLesson("katahame");
    render(<QuizEngine lesson={lesson} onComplete={vi.fn()} />);

    // 盤面（ピース）が描画され、設問文・星0が表示される
    const pieces = screen.getAllByTestId("piece");
    expect(pieces.length).toBeGreaterThan(0);
    expect(screen.getByText(lesson.problems[0].prompt.text)).toBeInTheDocument();
    expect(screen.getByRole("img", { name: /ほし 0/ })).toBeInTheDocument();

    // 正解ピースをタップ設置（無移動＝穴中心で判定＝正解）
    const correct = pieces.find(
      (p) => p.getAttribute("data-correct") === "true",
    );
    fireEvent.pointerDown(correct!);
    fireEvent.pointerUp(correct!);

    // 星が1に増え、せいかい！が出る
    expect(screen.getByRole("img", { name: /ほし 1/ })).toBeInTheDocument();
    expect(screen.getByText("せいかい！")).toBeInTheDocument();

    // 演出後に次の問題へ進む
    await advance(1100);
    expect(screen.queryByText("せいかい！")).toBeNull();
    expect(screen.getByText(lesson.problems[1].prompt.text)).toBeInTheDocument();
  });

  it("katahame で誤ピースをタップしても × やふせいかいを出さず同問に留まる（U24）", async () => {
    const lesson = loadLesson("katahame");
    render(<QuizEngine lesson={lesson} onComplete={vi.fn()} />);

    const wrong = screen
      .getAllByTestId("piece")
      .find((p) => p.getAttribute("data-correct") === "false");
    fireEvent.pointerDown(wrong!);
    fireEvent.pointerUp(wrong!);

    // フェイル表現は出さず、やさしい「もういちど！」を表示する
    expect(screen.queryByText("×")).toBeNull();
    expect(screen.queryByText(/ふせいかい/)).toBeNull();
    expect(screen.getByText("もういちど！")).toBeInTheDocument();
    // 星は増えない
    expect(screen.getByRole("img", { name: /ほし 0/ })).toBeInTheDocument();

    // 演出後は同じ問題のまま
    await advance(1100);
    expect(screen.queryByText("もういちど！")).toBeNull();
    expect(screen.getByText(lesson.problems[0].prompt.text)).toBeInTheDocument();
  });

  it("katahame は prompt.audio があれば参照先の音声を再利用する（U25）", () => {
    // katahame-009 は katahame-004 の音声を共有する（自身の音声は使わない）。
    const lesson: Lesson = {
      category: "katahame",
      title: "かたはめ",
      problems: [
        {
          id: "katahame-009",
          category: "katahame",
          type: "shape-fit",
          prompt: {
            text: "ほしを はめてね",
            say: "ほしを はめてね",
            audio: "katahame-004",
          },
          target: "star",
          choices: [
            { id: "p1", label: "ほし", shape: "star", color: "#7FB8E8", correct: true },
            { id: "p2", label: "さんかく", shape: "triangle", color: "#7FB8E8", correct: false },
          ],
        },
      ],
    } as unknown as Lesson;

    vi.mocked(playClip).mockClear();
    render(<QuizEngine lesson={lesson} onComplete={vi.fn()} />);
    // 問題IDの katahame-009.mp3 ではなく、参照先 katahame-004.mp3 を再生する
    expect(playClip).toHaveBeenCalledWith(
      "/audio/q/katahame-004.mp3",
      "ほしを はめてね",
    );
  });

  it("shape Lesson は従来どおり per-choice 描画で盤面ピースは出さない（U26・既存デグレ）", () => {
    const lesson = loadLesson("shape");
    render(<QuizEngine lesson={lesson} onComplete={vi.fn()} />);
    // 従来の choice が描画され、board のピースは存在しない
    expect(screen.getAllByTestId("choice").length).toBeGreaterThan(0);
    expect(screen.queryAllByTestId("piece").length).toBe(0);
  });

  it("nazori Lesson で board を完成させると星+1・せいかい！・演出後に次問（NU28）", async () => {
    const lesson = loadLesson("nazori");
    render(<QuizEngine lesson={lesson} onComplete={vi.fn()} />);

    // 盤面（道ガイド）が描画され、設問文・星0が表示される
    expect(screen.getByTestId("trace-board")).toBeInTheDocument();
    expect(screen.getByText(lesson.problems[0].prompt.text)).toBeInTheDocument();
    expect(screen.getByRole("img", { name: /ほし 0/ })).toBeInTheDocument();

    // jsdom（サンプル不能）では down→up の1セッションで完成成立する
    const board = screen.getByTestId("trace-board");
    fireEvent.pointerDown(board);
    fireEvent.pointerUp(board);

    // 星が1に増え、せいかい！が出る
    expect(screen.getByRole("img", { name: /ほし 1/ })).toBeInTheDocument();
    expect(screen.getByText("せいかい！")).toBeInTheDocument();

    // 演出後に次の問題へ進む
    await advance(1100);
    expect(screen.queryByText("せいかい！")).toBeNull();
    expect(screen.getByText(lesson.problems[1].prompt.text)).toBeInTheDocument();
  });

  it("nazori は未完成で中断しても × やふせいかい・もういちどを出さず、星も増えず同問に留まる（NU29）", () => {
    const lesson = loadLesson("nazori");
    render(<QuizEngine lesson={lesson} onComplete={vi.fn()} />);
    const firstPrompt = lesson.problems[0].prompt.text;

    // なぞりを中断（pointercancel）しても完成通知は発生しない
    const board = screen.getByTestId("trace-board");
    fireEvent.pointerDown(board);
    fireEvent(board, new MouseEvent("pointercancel", { bubbles: true }));

    // 誤答演出（×・ふせいかい・もういちど）は一切出さない
    expect(screen.queryByText("×")).toBeNull();
    expect(screen.queryByText(/ふせいかい/)).toBeNull();
    expect(screen.queryByText("もういちど！")).toBeNull();
    // 星は増えず、同じ問題に留まる
    expect(screen.getByRole("img", { name: /ほし 0/ })).toBeInTheDocument();
    expect(screen.getByText(firstPrompt)).toBeInTheDocument();
  });

  it("nazori は prompt.audio があれば参照先の音声を再利用する（NU30）", () => {
    // nazori-006 は nazori-001 の音声を共有する（自身の音声は使わない）。
    const lesson: Lesson = {
      category: "nazori",
      title: "なぞり",
      problems: [
        {
          id: "nazori-006",
          category: "nazori",
          type: "trace",
          prompt: {
            text: "まるを なぞってね",
            say: "まるを なぞってね",
            audio: "nazori-001",
          },
          target: "circle",
          reward: "sticker-circle",
        },
      ],
    } as unknown as Lesson;

    vi.mocked(playClip).mockClear();
    render(<QuizEngine lesson={lesson} onComplete={vi.fn()} />);
    // 問題IDの nazori-006.mp3 ではなく、参照先 nazori-001.mp3 を再生する
    expect(playClip).toHaveBeenCalledWith(
      "/audio/q/nazori-001.mp3",
      "まるを なぞってね",
    );
  });

  it("nazori 完成直後の演出中ロックで再操作しても星が二重加算されず同問に留まる（NU32）", () => {
    const lesson = loadLesson("nazori");
    render(<QuizEngine lesson={lesson} onComplete={vi.fn()} />);
    const firstPrompt = lesson.problems[0].prompt.text;

    const board = screen.getByTestId("trace-board");
    fireEvent.pointerDown(board);
    fireEvent.pointerUp(board);
    expect(screen.getByRole("img", { name: /ほし 1/ })).toBeInTheDocument();

    // advance せず演出（ロック）窓の内側で再操作しても、盤面が locked かつ完成済みのため
    // onPlace が発火せず、星は二重加算されない・早送りで次問へ進まない
    fireEvent.pointerDown(board);
    fireEvent.pointerUp(board);
    expect(screen.getByRole("img", { name: /ほし 1/ })).toBeInTheDocument();
    expect(screen.queryByRole("img", { name: /ほし 2/ })).toBeNull();
    expect(screen.getByText(firstPrompt)).toBeInTheDocument();
  });

  it("shape Lesson は従来どおり per-choice 描画で trace-board を出さない（NU31・既存デグレ）", () => {
    const lesson = loadLesson("shape");
    render(<QuizEngine lesson={lesson} onComplete={vi.fn()} />);
    expect(screen.getAllByTestId("choice").length).toBeGreaterThan(0);
    expect(screen.queryByTestId("trace-board")).toBeNull();
  });

  it("katahame は正解設置後の演出中ロックで再設置しても星が二重加算されず同問に留まる（I8）", () => {
    const lesson = loadLesson("katahame");
    render(<QuizEngine lesson={lesson} onComplete={vi.fn()} />);
    const firstPrompt = lesson.problems[0].prompt.text;

    // 正解ピースをタップ設置 → 星が1に増え演出中（盤面 locked）になる
    const correct = screen
      .getAllByTestId("piece")
      .find((p) => p.getAttribute("data-correct") === "true");
    fireEvent.pointerDown(correct!);
    fireEvent.pointerUp(correct!);
    expect(screen.getByRole("img", { name: /ほし 1/ })).toBeInTheDocument();

    // advance せず演出（ロック）窓の内側で再設置しても、盤面が locked のため
    // onPlace が発火せず、星は二重加算されない・早送りで次問へ進まない（afterFeedback/data-locked を board が共有）
    const again = screen
      .getAllByTestId("piece")
      .find((p) => p.getAttribute("data-correct") === "true");
    fireEvent.pointerDown(again!);
    fireEvent.pointerUp(again!);

    expect(screen.getByRole("img", { name: /ほし 1/ })).toBeInTheDocument();
    expect(screen.queryByRole("img", { name: /ほし 2/ })).toBeNull();
    // ほめ言葉完了前（advance 前）は同じ問題に留まる
    expect(screen.getByText(firstPrompt)).toBeInTheDocument();
  });
});
