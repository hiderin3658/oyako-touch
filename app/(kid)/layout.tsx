import { RequireAuth } from "@/components/auth/RequireAuth";

/**
 * 子ども画面群（/home, /game/...）の共通レイアウト。
 * RequireAuth で認証ガードを一括適用する。
 */
export default function KidLayout({
  children,
}: Readonly<{ children: React.ReactNode }>) {
  return <RequireAuth>{children}</RequireAuth>;
}
