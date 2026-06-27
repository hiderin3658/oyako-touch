// 音声クリップ（事前生成 MP3）の再生レイヤー。
// MP3 が無い／読み込みに失敗した場合は Web Speech（lib/speech）にフォールバックする。
// クライアント専用ロジック（"use client" コンポーネントから利用する想定）。
// すべて SSR / Audio 非対応環境（テスト・ヘッドレス）でも例外を投げない設計。

import { speak } from "@/lib/speech";
import phrasesJson from "@/content/audio/phrases.json";

// 固定句のフォールバック文言（phrases.json を唯一の情報源とする）。型は緩く扱う。
const PHRASES = phrasesJson as Record<string, { text: string }>;

// 解錠用の極短（約0.05秒）無音 MP3（data URI）。
// 初回ユーザー操作中にこれを再生して自動再生ポリシーを解錠する。
const SILENT_MP3 =
  "data:audio/mpeg;base64,SUQzBAAAAAAAIlRTU0UAAAAOAAADTGF2ZjYyLjMuMTAwAAAAAAAAAAAAAAD/+0DAAAAAAAAAAAAAAAAAAAAAAABJbmZvAAAADwAAAAMAAAHuAJSUlJSUlJSUlJSUlJSUlJSUlJSUlJSUlJSUlJSUlJSUlMrKysrKysrKysrKysrKysrKysrKysrKysrKysrKysrKyv///////////////////////////////////////////wAAAABMYXZjNjIuMTEAAAAAAAAAAAAAAAAkAqMAAAAAAAAB7idaJQcAAAAAAP/7EMQAA8AAAaQAAAAgAAA0gAAABExBTUUzLjEwMFVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVV//sQxCmDwAABpAAAACAAADSAAAAEVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVX/+xDEUwPAAAGkAAAAIAAANIAAAARVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVQ==";

// 現在再生中のクリップ。新しいクリップを鳴らす前に止めるため保持する。
let currentClip: HTMLAudioElement | null = null;
// グローバルな解錠リスナを二重に張らないためのフラグ。
let isUnlockListenerAttached = false;

/** クライアント（Audio 利用可能）環境かどうかを判定する。 */
function isAudioAvailable(): boolean {
  return typeof window !== "undefined" && typeof Audio !== "undefined";
}

/** 自動再生ブロック（NotAllowedError）かどうかを判定する。DOMException/Error 双方に対応。 */
function isNotAllowedError(error: unknown): boolean {
  return (
    typeof error === "object" &&
    error !== null &&
    "name" in error &&
    (error as { name?: unknown }).name === "NotAllowedError"
  );
}

/** 直前のクリップ再生を止める。 */
function stopCurrentClip(): void {
  if (!currentClip) {
    return;
  }
  try {
    currentClip.pause();
  } catch {
    // すでに破棄済み等で pause に失敗しても問題ない
  }
  currentClip = null;
}

/**
 * 初回ユーザー操作で音声を解錠する（自動再生ポリシー対策）。
 * 一度だけグローバルな pointerdown リスナ（capture, once）を張り、
 * 発火時に無音 MP3 を再生して以降の音声を鳴りやすくする。何度呼んでも安全。
 * SSR / Audio 非対応環境では何もしない。
 */
export function unlockAudio(): void {
  if (!isAudioAvailable() || isUnlockListenerAttached) {
    return;
  }
  isUnlockListenerAttached = true;
  try {
    const handleFirstPointer = (): void => {
      try {
        const silent = new Audio(SILENT_MP3);
        silent.muted = true;
        const played = silent.play();
        if (played && typeof played.then === "function") {
          // 解錠失敗は致命的でない（次のユーザー操作で再度試せる）
          played.catch(() => {});
        }
      } catch {
        // 解錠の試行失敗は無視する
      }
    };
    window.addEventListener("pointerdown", handleFirstPointer, {
      capture: true,
      once: true,
    });
  } catch (error) {
    console.debug("音声解錠リスナの登録に失敗しました。", error);
  }
}

/**
 * 音声クリップ（MP3）を再生する。
 * 直前のクリップを止めてから再生し、読み込み失敗（404 等）や play() の reject
 * （自動再生ブロックを除く）では fallbackText を Web Speech で読み上げる。
 * SSR / Audio 非対応環境では何もしない。
 *
 * @param src 再生する MP3 のパス（例: /audio/q/color-001.mp3）
 * @param fallbackText MP3 が使えないときに読み上げる文言
 */
export function playClip(src: string, fallbackText: string): void {
  if (!isAudioAvailable()) {
    return;
  }
  // 初回利用時に解錠リスナを張っておく（以降のクリップが鳴りやすくなる）
  unlockAudio();
  try {
    stopCurrentClip();

    const clip = new Audio(src);
    currentClip = clip;

    // フォールバックの二重発火を防ぐガード。
    // 新しいクリップに置き換わっている場合（意図的な停止による reject 等）も鳴らさない。
    let hasFallenBack = false;
    const fallback = (): void => {
      if (hasFallenBack || clip !== currentClip) {
        return;
      }
      hasFallenBack = true;
      speak(fallbackText);
    };

    // 読み込み失敗（404 等の error イベント）で Web Speech にフォールバック
    clip.addEventListener("error", fallback, { once: true });

    const played = clip.play();
    if (played && typeof played.then === "function") {
      played.catch((error: unknown) => {
        // 自動再生ブロックはフォールバックしても同様にブロックされるため、無理に鳴らさない
        if (isNotAllowedError(error)) {
          return;
        }
        fallback();
      });
    }
  } catch (error) {
    // new Audio や play() の同期例外時もフォールバックを試みる
    console.debug("クリップ再生の開始に失敗しました。フォールバックします。", error);
    speak(fallbackText);
  }
}

/**
 * 固定句クリップ（/audio/fb/<key>.mp3）を再生する。
 * フォールバック文言は phrases.json の text を用いる。
 *
 * @param key 固定句キー（fb-correct / fb-retry / reward-done / home-prompt）
 */
export function playPhrase(key: string): void {
  const fallbackText = PHRASES[key]?.text ?? "";
  playClip(`/audio/fb/${key}.mp3`, fallbackText);
}

/**
 * 効果音（MP3）を再生する。フォールバックは行わず、失敗時は無音でよい。
 * SSR / Audio 非対応環境では何もしない。
 *
 * @param src 再生する効果音 MP3 のパス（例: /audio/sfx/correct.mp3）
 */
export function playSfx(src: string): void {
  if (!isAudioAvailable()) {
    return;
  }
  try {
    const sfx = new Audio(src);
    const played = sfx.play();
    if (played && typeof played.then === "function") {
      played.catch((error: unknown) => {
        // 効果音は補助のため、失敗してもアプリ進行は止めずログのみ残す
        console.debug("効果音の再生に失敗しました。", error);
      });
    }
  } catch (error) {
    console.debug("効果音の再生に失敗しました。", error);
  }
}
