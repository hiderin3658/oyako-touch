import { describe, it, expect, beforeEach, afterEach, vi } from "vitest";
import {
  loadProgress,
  recordLessonClear,
  addSticker,
  resetProgress,
} from "@/lib/progress";

const STORAGE_KEY = "oyako-touch.progress";

describe("progress（localStorage）", () => {
  beforeEach(() => {
    window.localStorage.clear();
  });

  it("保存した内容を loadProgress で取り出せる", () => {
    recordLessonClear("color", 3);
    const progress = loadProgress();
    expect(progress.categories.color.cleared).toBe(1);
    expect(progress.categories.color.lastStars).toBe(3);
    expect(progress.categories.shape.cleared).toBe(0);
  });

  it("recordLessonClear を繰り返すと cleared が加算される", () => {
    recordLessonClear("shape", 2);
    const progress = recordLessonClear("shape", 1);
    expect(progress.categories.shape.cleared).toBe(2);
    expect(progress.categories.shape.lastStars).toBe(1);
  });

  it("number カテゴリでもクラッシュせず cleared が増える", () => {
    expect(() => recordLessonClear("number", 3)).not.toThrow();
    const progress = loadProgress();
    expect(progress.categories.number.cleared).toBe(1);
    expect(progress.categories.number.lastStars).toBe(3);
  });

  it("animal カテゴリでもクラッシュせず cleared が増える", () => {
    expect(() => recordLessonClear("animal", 5)).not.toThrow();
    const progress = loadProgress();
    expect(progress.categories.animal.cleared).toBe(1);
    expect(progress.categories.animal.lastStars).toBe(5);
    // 既存カテゴリに影響しないこと
    expect(progress.categories.color.cleared).toBe(0);
  });

  it("size カテゴリでもクラッシュせず cleared が増え、他カテゴリは不変（U22）", () => {
    expect(() => recordLessonClear("size", 4)).not.toThrow();
    const progress = loadProgress();
    expect(progress.categories.size.cleared).toBe(1);
    expect(progress.categories.size.lastStars).toBe(4);
    // 既存カテゴリに影響しないこと
    expect(progress.categories.color.cleared).toBe(0);
    expect(progress.categories.animal.cleared).toBe(0);
  });

  it("count カテゴリでもクラッシュせず cleared が増え、他カテゴリは不変", () => {
    expect(() => recordLessonClear("count", 4)).not.toThrow();
    const progress = loadProgress();
    expect(progress.categories.count.cleared).toBe(1);
    expect(progress.categories.count.lastStars).toBe(4);
    // 既存カテゴリに影響しないこと
    expect(progress.categories.color.cleared).toBe(0);
    expect(progress.categories.size.cleared).toBe(0);
  });

  it("katahame カテゴリでもクラッシュせず cleared が増え、他カテゴリは不変（U21）", () => {
    expect(() => recordLessonClear("katahame", 5)).not.toThrow();
    const progress = loadProgress();
    expect(progress.categories.katahame.cleared).toBe(1);
    expect(progress.categories.katahame.lastStars).toBe(5);
    // 既存カテゴリに影響しないこと
    expect(progress.categories.color.cleared).toBe(0);
    expect(progress.categories.count.cleared).toBe(0);
  });

  it("nazori カテゴリでもクラッシュせず cleared が増え、他カテゴリは不変（NU26）", () => {
    expect(() => recordLessonClear("nazori", 5)).not.toThrow();
    const progress = loadProgress();
    expect(progress.categories.nazori.cleared).toBe(1);
    expect(progress.categories.nazori.lastStars).toBe(5);
    // 既存カテゴリに影響しないこと
    expect(progress.categories.color.cleared).toBe(0);
    expect(progress.categories.katahame.cleared).toBe(0);
  });

  it("nazori キーが欠けた旧フォーマットでも初期値で補完される（NU27・normalizeProgress）", () => {
    // nazori カテゴリを含まない旧フォーマットの保存データを用意する
    // （normalizeProgress のループ配列に nazori 追記漏れがあると補完されず検知できる）
    window.localStorage.setItem(
      STORAGE_KEY,
      JSON.stringify({
        categories: {
          color: { cleared: 2, lastStars: 3 },
          shape: { cleared: 0, lastStars: 0 },
          number: { cleared: 0, lastStars: 0 },
          animal: { cleared: 1, lastStars: 2 },
          size: { cleared: 0, lastStars: 0 },
          count: { cleared: 0, lastStars: 0 },
          katahame: { cleared: 0, lastStars: 0 },
        },
        stickers: ["sticker-apple"],
      }),
    );
    const progress = loadProgress();
    // 欠けていた nazori が初期値で補完される
    expect(progress.categories.nazori).toEqual({ cleared: 0, lastStars: 0 });
    // 既存値は保持される
    expect(progress.categories.color.cleared).toBe(2);
    expect(progress.categories.animal.cleared).toBe(1);
    expect(progress.stickers).toEqual(["sticker-apple"]);
  });

  it("katahame キーが欠けた旧フォーマットでも初期値で補完される（U22・normalizeProgress）", () => {
    // katahame カテゴリを含まない旧フォーマットの保存データを用意する
    // （normalizeProgress のループ配列に katahame 追記漏れがあると補完されず検知できる）
    window.localStorage.setItem(
      STORAGE_KEY,
      JSON.stringify({
        categories: {
          color: { cleared: 2, lastStars: 3 },
          shape: { cleared: 0, lastStars: 0 },
          number: { cleared: 0, lastStars: 0 },
          animal: { cleared: 1, lastStars: 2 },
          size: { cleared: 0, lastStars: 0 },
          count: { cleared: 0, lastStars: 0 },
        },
        stickers: ["sticker-apple"],
      }),
    );
    const progress = loadProgress();
    // 欠けていた katahame が初期値で補完される
    expect(progress.categories.katahame).toEqual({ cleared: 0, lastStars: 0 });
    // 既存値は保持される
    expect(progress.categories.color.cleared).toBe(2);
    expect(progress.categories.animal.cleared).toBe(1);
    expect(progress.stickers).toEqual(["sticker-apple"]);
  });

  it("count キーが欠けた旧フォーマットでも初期値で補完される（normalizeProgress）", () => {
    // count カテゴリを含まない旧フォーマットの保存データを用意する
    // （normalizeProgress のループ配列に count 追記漏れがあると補完されず検知できる）
    window.localStorage.setItem(
      STORAGE_KEY,
      JSON.stringify({
        categories: {
          color: { cleared: 2, lastStars: 3 },
          shape: { cleared: 0, lastStars: 0 },
          number: { cleared: 0, lastStars: 0 },
          animal: { cleared: 1, lastStars: 2 },
          size: { cleared: 0, lastStars: 0 },
        },
        stickers: ["sticker-apple"],
      }),
    );
    const progress = loadProgress();
    // 欠けていた count が初期値で補完される
    expect(progress.categories.count).toEqual({ cleared: 0, lastStars: 0 });
    // 既存値は保持される
    expect(progress.categories.color.cleared).toBe(2);
    expect(progress.categories.animal.cleared).toBe(1);
    expect(progress.stickers).toEqual(["sticker-apple"]);
  });

  it("size キーが欠けた旧フォーマットでも初期値で補完される（U23・normalizeProgress）", () => {
    // size カテゴリを含まない旧フォーマットの保存データを用意する
    // （normalizeProgress のループ配列に size 追記漏れがあると補完されず検知できる）
    window.localStorage.setItem(
      STORAGE_KEY,
      JSON.stringify({
        categories: {
          color: { cleared: 2, lastStars: 3 },
          shape: { cleared: 0, lastStars: 0 },
          number: { cleared: 0, lastStars: 0 },
          animal: { cleared: 1, lastStars: 2 },
        },
        stickers: ["sticker-apple"],
      }),
    );
    const progress = loadProgress();
    // 欠けていた size が初期値で補完される
    expect(progress.categories.size).toEqual({ cleared: 0, lastStars: 0 });
    // 既存値は保持される
    expect(progress.categories.color.cleared).toBe(2);
    expect(progress.categories.animal.cleared).toBe(1);
    expect(progress.stickers).toEqual(["sticker-apple"]);
  });

  it("animal キーが欠けた保存データでも初期値で補完される（normalizeProgress）", () => {
    // animal カテゴリを含まない旧フォーマットの保存データを用意する
    window.localStorage.setItem(
      STORAGE_KEY,
      JSON.stringify({
        categories: {
          color: { cleared: 2, lastStars: 3 },
          shape: { cleared: 0, lastStars: 0 },
          number: { cleared: 0, lastStars: 0 },
        },
        stickers: ["sticker-apple"],
      }),
    );
    const progress = loadProgress();
    // 欠けていた animal が初期値で補完される
    expect(progress.categories.animal).toEqual({ cleared: 0, lastStars: 0 });
    // 既存値は保持される
    expect(progress.categories.color.cleared).toBe(2);
    expect(progress.stickers).toEqual(["sticker-apple"]);
  });

  it("不正なJSONが保存されていると初期値へ復帰する", () => {
    window.localStorage.setItem(STORAGE_KEY, "{ こわれた JSON");
    // 例外を握りつぶさず console.warn でログするので呼び出しを確認
    const warnSpy = vi.spyOn(console, "warn").mockImplementation(() => {});
    const progress = loadProgress();
    expect(progress.categories.color.cleared).toBe(0);
    expect(progress.stickers).toEqual([]);
    expect(warnSpy).toHaveBeenCalled();
    warnSpy.mockRestore();
  });

  it("addSticker は重複を排除する", () => {
    addSticker("sticker-apple");
    const progress = addSticker("sticker-apple");
    expect(progress.stickers).toEqual(["sticker-apple"]);
    const progress2 = addSticker("sticker-star");
    expect(progress2.stickers).toEqual(["sticker-apple", "sticker-star"]);
  });

  it("resetProgress で保存内容が消える", () => {
    addSticker("sticker-apple");
    resetProgress();
    expect(loadProgress().stickers).toEqual([]);
  });
});

describe("progress（SSR：window未定義）", () => {
  afterEach(() => {
    vi.unstubAllGlobals();
  });

  it("window未定義でも loadProgress はクラッシュせず初期値を返す", () => {
    vi.stubGlobal("window", undefined);
    const progress = loadProgress();
    expect(progress.categories.color.cleared).toBe(0);
    expect(progress.stickers).toEqual([]);
  });

  it("window未定義でも書き込み系はクラッシュしない（no-op）", () => {
    vi.stubGlobal("window", undefined);
    expect(() => {
      recordLessonClear("color", 3);
      addSticker("sticker-apple");
      resetProgress();
    }).not.toThrow();
  });
});
