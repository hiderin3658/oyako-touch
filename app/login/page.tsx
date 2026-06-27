"use client";

import { useEffect, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { Mascot } from "@/components/Mascot";
import { useAuth } from "@/components/auth/AuthProvider";
import { unlockAudio } from "@/lib/audio";
import { SIGN_IN_STEPS, type SignInStep } from "@/lib/auth/mockAuth";
import styles from "./login.module.css";

/**
 * 保護者ログイン画面（モック）。
 * Googleボタンで signIn() を呼び、許可リスト確認の演出を段階表示する。
 * authenticated になったら /home へ送る。
 */
export default function LoginPage() {
  const { status, signIn } = useAuth();
  const router = useRouter();
  // 現在表示中のログイン演出ステップ（未開始は null）
  const [currentStep, setCurrentStep] = useState<SignInStep | null>(null);
  // 演出メッセージ用の setTimeout を保持し、unmount 時にクリアする
  const stepTimersRef = useRef<ReturnType<typeof setTimeout>[]>([]);

  // 認証済みならこのページに留まらず /home へ
  useEffect(() => {
    if (status === "authenticated") {
      router.replace("/home");
    }
  }, [status, router]);

  useEffect(() => {
    const timers = stepTimersRef.current;
    return () => {
      timers.forEach(clearTimeout);
    };
  }, []);

  const handleLogin = (): void => {
    // 二重起動防止
    if (status === "authenticating") {
      return;
    }
    // 最初のユーザー操作で音声を解錠する（自動再生ポリシー対策）
    unlockAudio();
    // 「ログイン中… → 許可リスト確認 → ようこそ」を順に表示する
    SIGN_IN_STEPS.forEach((step) => {
      const timerId = setTimeout(() => setCurrentStep(step), step.atMs);
      stepTimersRef.current.push(timerId);
    });
    // 認証完了後の /home 遷移は status を監視する useEffect が担う
    void signIn();
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
          disabled={status === "authenticating"}
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
          data-tone={currentStep?.tone ?? "progress"}
          role="status"
          aria-live="polite"
        >
          {currentStep?.message ?? ""}
        </div>

        <p className={styles.note}>
          ※ プロトタイプのため<b>モック動作</b>です。
          <br />
          本番は <b>許可リストに登録したメールだけ</b>がログイン可（DB不使用）。
        </p>
      </div>
    </main>
  );
}
