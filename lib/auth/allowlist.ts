// 許可リスト（ALLOWED_EMAILS）判定の純関数。
// env の直読みは isAllowedEmail の引数デフォルトに分離し、ロジック単体をテストしやすくする。

/**
 * 環境変数の生文字列を正規化したメール配列に変換する。
 * カンマ区切り → trim → 小文字化 → 空要素の除去、までを行う。
 */
export function parseAllowedEmails(raw: string): string[] {
  return raw
    .split(",")
    .map((email) => email.trim().toLowerCase())
    .filter((email) => email.length > 0);
}

/**
 * email が許可リストに含まれるか判定する。
 * - リストが空なら常に false（fail-closed：未設定時は誰も入れない）
 * - email が null/undefined/空なら false
 * 大文字小文字・前後の空白は無視して比較する。
 */
export function isAllowedEmail(
  email: string | null | undefined,
  raw: string = process.env.ALLOWED_EMAILS ?? "",
): boolean {
  const normalized = email?.trim().toLowerCase() ?? "";
  if (normalized.length === 0) {
    return false;
  }
  const allowed = parseAllowedEmails(raw);
  if (allowed.length === 0) {
    return false;
  }
  return allowed.includes(normalized);
}
