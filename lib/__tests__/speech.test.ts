import { describe, it, expect, vi, afterEach } from "vitest";
import { speak, cancelSpeech } from "@/lib/speech";

describe("speak", () => {
  afterEach(() => {
    vi.unstubAllGlobals();
    vi.restoreAllMocks();
  });

  it("speechSynthesis 対応環境で utterance を生成し speak() を呼ぶ", () => {
    const speakMock = vi.fn();
    const cancelMock = vi.fn();
    const created: Array<{ text: string; lang: string; rate: number; pitch: number }> = [];

    // SpeechSynthesisUtterance を擬似的に差し替える
    class FakeUtterance {
      text: string;
      lang = "";
      rate = 1;
      pitch = 1;
      constructor(text: string) {
        this.text = text;
        created.push(this);
      }
    }

    vi.stubGlobal("speechSynthesis", { speak: speakMock, cancel: cancelMock });
    vi.stubGlobal("SpeechSynthesisUtterance", FakeUtterance);

    speak("こんにちは");

    expect(created).toHaveLength(1);
    expect(created[0].text).toBe("こんにちは");
    expect(created[0].lang).toBe("ja-JP");
    expect(created[0].rate).toBeCloseTo(0.85);
    expect(created[0].pitch).toBeCloseTo(1.2);
    // 話す前に直前の発話をキャンセルしてから speak する
    expect(cancelMock).toHaveBeenCalled();
    expect(speakMock).toHaveBeenCalledTimes(1);
  });

  it("speechSynthesis 未対応環境でも例外を投げない", () => {
    // jsdom には speechSynthesis が無いため、未対応環境として扱われる
    vi.unstubAllGlobals();
    expect("speechSynthesis" in window).toBe(false);
    expect(() => speak("テスト")).not.toThrow();
    expect(() => cancelSpeech()).not.toThrow();
  });
});
