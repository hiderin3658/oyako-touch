import { describe, it, expect } from "vitest";
import { parseAllowedEmails, isAllowedEmail } from "@/lib/auth/allowlist";

describe("parseAllowedEmails", () => {
  it("カンマ区切りを trim・小文字化して配列にする", () => {
    expect(parseAllowedEmails(" A@Example.com , b@example.COM ")).toEqual([
      "a@example.com",
      "b@example.com",
    ]);
  });

  it("空要素（連続カンマ・末尾カンマ・空白のみ）は除去する", () => {
    expect(parseAllowedEmails("a@example.com,, ,b@example.com,")).toEqual([
      "a@example.com",
      "b@example.com",
    ]);
  });

  it("空文字なら空配列を返す", () => {
    expect(parseAllowedEmails("")).toEqual([]);
  });
});

describe("isAllowedEmail", () => {
  const raw = "parent@example.com, Owner@Example.com";

  it("許可リストに含まれるメールは true", () => {
    expect(isAllowedEmail("parent@example.com", raw)).toBe(true);
  });

  it("大文字・前後空白を無視して比較する", () => {
    expect(isAllowedEmail("  PARENT@EXAMPLE.COM  ", raw)).toBe(true);
    expect(isAllowedEmail("owner@example.com", raw)).toBe(true);
  });

  it("許可リストに無いメールは false", () => {
    expect(isAllowedEmail("stranger@example.com", raw)).toBe(false);
  });

  it("リストが空なら fail-closed で false", () => {
    expect(isAllowedEmail("parent@example.com", "")).toBe(false);
    expect(isAllowedEmail("parent@example.com", "  , ")).toBe(false);
  });

  it("email が null/undefined/空なら false", () => {
    expect(isAllowedEmail(null, raw)).toBe(false);
    expect(isAllowedEmail(undefined, raw)).toBe(false);
    expect(isAllowedEmail("", raw)).toBe(false);
    expect(isAllowedEmail("   ", raw)).toBe(false);
  });
});
