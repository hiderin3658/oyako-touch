// 読み上げ（Web Speech API による暫定実装）。
// 将来 ElevenLabs 等の音声に差し替える前提で、呼び出し側はこの薄いラッパだけを使う。

/**
 * 指定テキストを日本語で読み上げる。
 * SSR（window未定義）や speechSynthesis 非対応環境では何もしない（例外を投げない）。
 * 話す前に直前の発話を打ち切る。
 */
export function speak(text: string): void {
  try {
    if (typeof window === "undefined" || !("speechSynthesis" in window)) {
      return;
    }
    const synth = window.speechSynthesis;
    const utterance = new window.SpeechSynthesisUtterance(text);
    utterance.lang = "ja-JP";
    // 3歳児が聞き取りやすいよう、ゆっくり・やや高めの声にする
    utterance.rate = 0.85;
    utterance.pitch = 1.2;
    synth.cancel();
    synth.speak(utterance);
  } catch (error) {
    // 読み上げは補助機能のため、失敗してもアプリ進行は止めずログのみ残す
    console.warn("読み上げに失敗しました。", error);
  }
}

/** 進行中の読み上げを中断する（SSR・非対応環境では no-op） */
export function cancelSpeech(): void {
  try {
    if (typeof window === "undefined" || !("speechSynthesis" in window)) {
      return;
    }
    window.speechSynthesis.cancel();
  } catch (error) {
    console.warn("読み上げの中断に失敗しました。", error);
  }
}
