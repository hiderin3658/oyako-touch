import NextAuth from "next-auth";
import Google from "next-auth/providers/google";
import Credentials from "next-auth/providers/credentials";
import type { Provider } from "next-auth/providers";
import { isAllowedEmail } from "@/lib/auth/allowlist";

// E2E 専用のテスト認証を有効化するフラグ。
// 本番では未設定（"true" 以外）のため、テスト用 Credentials provider は登録されない。
// このフラグは本番環境で絶対に立てないこと。
const isE2eTestAuthEnabled = process.env.E2E_TEST_AUTH === "true";

// 認証プロバイダ一覧。基本は Google のみ。
// clientId/clientSecret は v5 の自動推論（AUTH_GOOGLE_*）に頼らず、
// 既存の env 名（GOOGLE_CLIENT_ID / GOOGLE_CLIENT_SECRET）を明示的に渡す。
const providers: Provider[] = [
  Google({
    clientId: process.env.GOOGLE_CLIENT_ID,
    clientSecret: process.env.GOOGLE_CLIENT_SECRET,
  }),
];

if (isE2eTestAuthEnabled) {
  // E2E でのみ有効化。実 OAuth を踏まずに「許可リスト済みメール」で認証済み状態を作る。
  // 許可リスト判定は authorize 側で行い、未許可メールは null（ログイン不可）にする。
  providers.push(
    Credentials({
      id: "e2e",
      name: "E2E Test Login",
      credentials: { email: {} },
      authorize(credentials) {
        const email =
          typeof credentials?.email === "string" ? credentials.email : "";
        if (!isAllowedEmail(email)) {
          return null;
        }
        return { id: email, email };
      },
    }),
  );
}

export const { handlers, auth, signIn, signOut } = NextAuth({
  trustHost: true,
  session: { strategy: "jwt" },
  pages: { signIn: "/login", error: "/login" },
  providers,
  callbacks: {
    // サーバ側で許可リストを強制する最終境界（クライアントを信用しない）。
    signIn({ account, profile }) {
      // E2E テスト用 Credentials は authorize で許可済みのため通す
      if (isE2eTestAuthEnabled && account?.provider === "e2e") {
        return true;
      }
      // 通常は Google 以外を拒否する
      if (account?.provider !== "google") {
        return false;
      }
      // Google 側で検証済みのメールであること
      if (profile?.email_verified !== true) {
        return false;
      }
      // 許可リスト（ALLOWED_EMAILS）に含まれるメールだけ通す
      return isAllowedEmail(profile?.email);
    },
  },
});
