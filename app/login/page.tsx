"use client";

import { Suspense, useEffect, useState } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { Mascot } from "@/components/Mascot";
import { useAuth } from "@/components/auth/AuthProvider";
import { unlockAudio } from "@/lib/audio";
import styles from "./login.module.css";

// 許可リスト外などでログインが拒否されたときに表示する文言。
// Auth.js は signIn コールバックで false を返すと error=AccessDenied で /login に戻す。
const NOT_ALLOWED_MESSAGE =
  "このメールアドレスはログインを許可されていません。おうちの方のアカウントでログインしてください。";

/**
 * 保護者ログイン画面。
 * Google ボタンで signIn("google") を呼ぶと別ページ（Google）へ遷移するため、
 * 演出は段階表示せず「ログイン中…」の簡易表示＋ボタン無効化に集約する。
 * 許可リスト外メールで戻された場合は error クエリを読み、案内文を表示する。
 *
 * useSearchParams を使うため、Next.js の要件に従い Suspense 境界で包む。
 */
export default function LoginPage() {
  return (
    <Suspense>
      <LoginScreen />
    </Suspense>
  );
}

function LoginScreen() {
  const { status, signIn } = useAuth();
  const router = useRouter();
  const searchParams = useSearchParams();
  // Google へリダイレクト中はボタンを無効化し「ログイン中…」を表示する
  const [isSigningIn, setIsSigningIn] = useState(false);

  // 認証済みならこのページに留まらず /home へ
  useEffect(() => {
    if (status === "authenticated") {
      router.replace("/home");
    }
  }, [status, router]);

  // Auth.js から戻された error（許可リスト外なら AccessDenied）を案内文に変換する
  const errorCode = searchParams.get("error");
  const errorMessage = errorCode ? NOT_ALLOWED_MESSAGE : "";

  const handleLogin = (): void => {
    // 二重起動防止
    if (isSigningIn) {
      return;
    }
    // 最初のユーザー操作で音声を解錠する（自動再生ポリシー対策）
    unlockAudio();
    setIsSigningIn(true);
    // Google の認証ページへ遷移する。成功後は /home へ戻す
    void signIn("google", { redirectTo: "/home" });
  };

  return (
    <main className={styles.screen}>
      <div className={styles.logo}>
        おやこタッチ<span className={styles.dot}>.</span>
      </div>
      <p className={styles.tagline}>3さいの はじめての まなび</p>

      <div className={styles.card}>
        <div className={styles.mascot}>
          <Mascot size={120} />
        </div>
        <h2 className={styles.heading}>保護者の方がログイン</h2>
        <p className={styles.lead}>
          お子さまにわたす前に、おうちの方が認証してください
        </p>

        <button
          type="button"
          className={styles.googleBtn}
          onClick={handleLogin}
          disabled={isSigningIn}
          data-testid="google-login"
        >
          <svg className={styles.gicon} viewBox="0 0 48 48" aria-hidden="true">
            <path
              fill="#EA4335"
              d="M24 9.5c3.5 0 6.6 1.2 9 3.6l6.8-6.8C35.5 2.4 30.1 0 24 0 14.6 0 6.5 5.4 2.6 13.2l7.9 6.1C12.4 13.3 17.7 9.5 24 9.5z"
            />
            <path
              fill="#4285F4"
              d="M46.5 24.5c0-1.6-.1-3.1-.4-4.5H24v9h12.7c-.5 3-2.2 5.5-4.7 7.2l7.3 5.7c4.3-4 6.8-9.8 6.8-17.4z"
            />
            <path
              fill="#FBBC05"
              d="M10.5 28.3c-.5-1.5-.8-3-.8-4.8s.3-3.3.8-4.8l-7.9-6.1C1 16 0 19.9 0 24s1 8 2.6 11.4l7.9-7.1z"
            />
            <path
              fill="#34A853"
              d="M24 48c6.1 0 11.3-2 15.1-5.5l-7.3-5.7c-2 1.4-4.6 2.2-7.8 2.2-6.3 0-11.6-3.8-13.5-9.3l-7.9 7.1C6.5 42.6 14.6 48 24 48z"
            />
          </svg>
          Googleでログイン
        </button>

        <div
          className={styles.status}
          data-tone={errorMessage ? "error" : "progress"}
          role="status"
          aria-live="polite"
        >
          {errorMessage || (isSigningIn ? "ログイン中…" : "")}
        </div>

        <p className={styles.note}>
          ログインできるのは<b>許可リストに登録したメール</b>だけです（DB不使用）。
        </p>
      </div>
    </main>
  );
}
