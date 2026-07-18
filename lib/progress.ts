// localStorage を使った進捗・ごほうび管理（SSRセーフ）
import type { Category } from "@/lib/types";

/** localStorage の保存キー */
const STORAGE_KEY = "oyako-touch.progress";

/** 進捗データ。カテゴリ別クリア数・直近の星数と、獲得シール一覧 */
export interface Progress {
  categories: Record<Category, { cleared: number; lastStars: number }>;
  stickers: string[];
}

/** 初期進捗を生成する */
function createInitialProgress(): Progress {
  return {
    categories: {
      color: { cleared: 0, lastStars: 0 },
      shape: { cleared: 0, lastStars: 0 },
      number: { cleared: 0, lastStars: 0 },
      animal: { cleared: 0, lastStars: 0 },
      size: { cleared: 0, lastStars: 0 },
      count: { cleared: 0, lastStars: 0 },
      katahame: { cleared: 0, lastStars: 0 },
    },
    stickers: [],
  };
}

/**
 * 未検証データを安全な Progress に正規化する。
 * 欠損・型不一致のフィールドは初期値で補完する（破損データへの防御）。
 */
function normalizeProgress(parsed: unknown): Progress {
  const base = createInitialProgress();
  if (typeof parsed !== "object" || parsed === null) {
    return base;
  }
  const obj = parsed as Record<string, unknown>;

  const categories = obj.categories as Record<string, unknown> | undefined;
  for (const category of [
    "color",
    "shape",
    "number",
    "animal",
    "size",
    "count",
    "katahame",
  ] as Category[]) {
    const entry = categories?.[category] as Record<string, unknown> | undefined;
    if (entry) {
      base.categories[category] = {
        cleared: typeof entry.cleared === "number" ? entry.cleared : 0,
        lastStars: typeof entry.lastStars === "number" ? entry.lastStars : 0,
      };
    }
  }

  if (Array.isArray(obj.stickers)) {
    base.stickers = obj.stickers.filter(
      (sticker): sticker is string => typeof sticker === "string",
    );
  }

  return base;
}

/** 進捗を localStorage に保存する（SSR時・失敗時は no-op） */
function saveProgress(progress: Progress): void {
  if (typeof window === "undefined") {
    return;
  }
  try {
    window.localStorage.setItem(STORAGE_KEY, JSON.stringify(progress));
  } catch (error) {
    // 保存失敗（容量超過など）は握りつぶさずログに残す
    console.warn("進捗データの保存に失敗しました。", error);
  }
}

/**
 * 進捗を読み込む。
 * SSR（window未定義）や保存なし・破損時は初期値を返す。
 */
export function loadProgress(): Progress {
  if (typeof window === "undefined") {
    return createInitialProgress();
  }
  try {
    const raw = window.localStorage.getItem(STORAGE_KEY);
    if (raw === null) {
      return createInitialProgress();
    }
    const parsed: unknown = JSON.parse(raw);
    return normalizeProgress(parsed);
  } catch (error) {
    // 破損データは握りつぶさずログに残し、初期値へフォールバックする
    console.warn("進捗データの読み込みに失敗しました。初期値に戻します。", error);
    return createInitialProgress();
  }
}

/**
 * レッスンクリアを記録する（クリア数+1、直近の星数を更新して保存）。
 * SSR時は no-op で初期値を返す。
 */
export function recordLessonClear(category: Category, stars: number): Progress {
  if (typeof window === "undefined") {
    return createInitialProgress();
  }
  const progress = loadProgress();
  progress.categories[category] = {
    cleared: progress.categories[category].cleared + 1,
    lastStars: stars,
  };
  saveProgress(progress);
  return progress;
}

/**
 * シールを追加する（重複排除して保存）。
 * SSR時は no-op で初期値を返す。
 */
export function addSticker(id: string): Progress {
  if (typeof window === "undefined") {
    return createInitialProgress();
  }
  const progress = loadProgress();
  if (!progress.stickers.includes(id)) {
    progress.stickers.push(id);
  }
  saveProgress(progress);
  return progress;
}

/** 進捗をリセットする（SSR時・失敗時は no-op） */
export function resetProgress(): void {
  if (typeof window === "undefined") {
    return;
  }
  try {
    window.localStorage.removeItem(STORAGE_KEY);
  } catch (error) {
    console.warn("進捗データのリセットに失敗しました。", error);
  }
}
