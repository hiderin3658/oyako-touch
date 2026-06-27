import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";

// フォールバック検証のため lib/speech の speak をモック化する。
// audio.ts は import 時に speak を束縛するため、vi.mock（巻き上げ）で差し替える。
vi.mock("@/lib/speech", () => ({
  speak: vi.fn(),
  cancelSpeech: vi.fn(),
}));

import { playClip, playSfx, playPhrase, unlockAudio } from "@/lib/audio";
import { speak } from "@/lib/speech";

/**
 * Audio をモックするスタブ。
 * - play() の挙動（resolve / reject）を静的プロパティで切り替えられる。
 * - error イベントをテストから emitError() で発火できる。
 */
class FakeAudio {
  // 生成された全インスタンス（生成検証用）
  static instances: FakeAudio[] = [];
  // play() の挙動。reject 指定時はその Error で reject する。
  static playBehavior: "resolve" | { reject: Error } = "resolve";

  src: string;
  muted = false;
  playCalls = 0;
  private listeners: Record<string, Array<() => void>> = {};

  constructor(src = "") {
    this.src = src;
    FakeAudio.instances.push(this);
  }

  play(): Promise<void> {
    this.playCalls += 1;
    if (FakeAudio.playBehavior === "resolve") {
      return Promise.resolve();
    }
    return Promise.reject(FakeAudio.playBehavior.reject);
  }

  pause(): void {}

  addEventListener(type: string, handler: () => void): void {
    (this.listeners[type] ??= []).push(handler);
  }

  removeEventListener(): void {}

  /** テストから error イベントを発火させる。 */
  emitError(): void {
    (this.listeners.error ?? []).forEach((handler) => handler());
  }
}

/** name 付きの擬似エラーを生成する（NotAllowedError 等の判定検証用）。 */
function namedError(name: string): Error {
  return Object.assign(new Error(name), { name });
}

/** マイクロタスク（play() の reject 後の catch）を流す。 */
async function flushMicrotasks(): Promise<void> {
  await Promise.resolve();
  await Promise.resolve();
}

describe("audio", () => {
  beforeEach(() => {
    FakeAudio.instances = [];
    FakeAudio.playBehavior = "resolve";
    vi.mocked(speak).mockClear();
  });

  afterEach(() => {
    vi.unstubAllGlobals();
  });

  it("playClip は Audio(src) を生成して play() を呼ぶ", () => {
    vi.stubGlobal("Audio", FakeAudio);

    playClip("/audio/q/color-001.mp3", "あかいのは どれかな");

    expect(FakeAudio.instances).toHaveLength(1);
    expect(FakeAudio.instances[0].src).toBe("/audio/q/color-001.mp3");
    expect(FakeAudio.instances[0].playCalls).toBe(1);
    // 正常再生中はフォールバックしない
    expect(speak).not.toHaveBeenCalled();
  });

  it("playClip は読み込み失敗(error イベント)時に speak(fallback) でフォールバックする", () => {
    vi.stubGlobal("Audio", FakeAudio);

    playClip("/audio/q/missing.mp3", "あかいのは どれかな");
    expect(speak).not.toHaveBeenCalled();

    // 404 等の error イベントを発火させるとフォールバックが呼ばれる
    FakeAudio.instances[0].emitError();
    expect(speak).toHaveBeenCalledTimes(1);
    expect(speak).toHaveBeenCalledWith("あかいのは どれかな");
  });

  it("playClip は play() の reject（NotAllowedError 以外）でフォールバックする", async () => {
    vi.stubGlobal("Audio", FakeAudio);
    FakeAudio.playBehavior = { reject: namedError("NotSupportedError") };

    playClip("/audio/q/x.mp3", "だいたいの ことば");
    await flushMicrotasks();

    expect(speak).toHaveBeenCalledWith("だいたいの ことば");
  });

  it("playClip は自動再生ブロック(NotAllowedError)ではフォールバックしない", async () => {
    vi.stubGlobal("Audio", FakeAudio);
    FakeAudio.playBehavior = { reject: namedError("NotAllowedError") };

    playClip("/audio/q/x.mp3", "だいたいの ことば");
    await flushMicrotasks();

    expect(speak).not.toHaveBeenCalled();
  });

  it("playPhrase は /audio/fb/<key>.mp3 を鳴らし phrases.json の文言をフォールバックに使う", () => {
    vi.stubGlobal("Audio", FakeAudio);

    playPhrase("fb-correct");

    expect(FakeAudio.instances).toHaveLength(1);
    expect(FakeAudio.instances[0].src).toBe("/audio/fb/fb-correct.mp3");

    // error 時のフォールバック文言が phrases.json 由来であること
    FakeAudio.instances[0].emitError();
    expect(speak).toHaveBeenCalledWith("せいかい");
  });

  it("playSfx は Audio(src).play() を呼び、フォールバックは行わない", () => {
    vi.stubGlobal("Audio", FakeAudio);

    playSfx("/audio/sfx/correct.mp3");

    expect(FakeAudio.instances).toHaveLength(1);
    expect(FakeAudio.instances[0].src).toBe("/audio/sfx/correct.mp3");
    expect(FakeAudio.instances[0].playCalls).toBe(1);
    expect(speak).not.toHaveBeenCalled();
  });

  it("Audio 未定義環境（SSR/ヘッドレス）では例外を投げず、フォールバックもしない", () => {
    vi.stubGlobal("Audio", undefined);

    expect(() => playClip("/audio/q/x.mp3", "ことば")).not.toThrow();
    expect(() => playPhrase("fb-correct")).not.toThrow();
    expect(() => playSfx("/audio/sfx/correct.mp3")).not.toThrow();
    expect(() => unlockAudio()).not.toThrow();
    // Audio が無い環境ではフォールバック（speak）も呼ばない
    expect(speak).not.toHaveBeenCalled();
  });
});
