// jest-dom のカスタムマッチャ（toBeInTheDocument など）を有効化する
import "@testing-library/jest-dom";

// jsdom は HTMLMediaElement.play を実装しないため、テスト用の最小 Audio スタブを用意する。
// 実際の再生は行わず play() は解決済み Promise を返し、「Not implemented」エラーや
// 不要なフォールバック発火を防ぐ。音声挙動を個別に検証するテストは vi.stubGlobal で上書きする。
class StubAudio {
  src: string;
  muted = false;
  constructor(src = "") {
    this.src = src;
  }
  play(): Promise<void> {
    return Promise.resolve();
  }
  pause(): void {}
  addEventListener(): void {}
  removeEventListener(): void {}
}

// 直接代入することで、個別テストの vi.unstubAllGlobals() でも消えないようにする
globalThis.Audio = StubAudio as unknown as typeof Audio;
