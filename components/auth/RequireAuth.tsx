"use client";

import { useEffect } from "react";
import { useRouter } from "next/navigation";
import { Mascot } from "@/components/Mascot";
import { useAuth } from "@/components/auth/AuthProvider";
import styles from "./RequireAuth.module.css";

/**
 * 子どもの画面群を認証で保護するクライアントガード。
 * authenticated のときだけ children を表示し、未認証なら /login へ送る。
 * （実 middleware.ts＋cookie による保護は次エピックで導入予定）
 */
export function RequireAuth({ children }: { children: React.ReactNode }) {
  const { status } = useAuth();
  const router = useRouter();

  useEffect(() => {
    // 判定確定後に未認証なら /login へ。loading 中は遷移しない（チラつき防止）
    if (status === "unauthenticated") {
      router.replace("/login");
    }
  }, [status, router]);

  if (status === "authenticated") {
    return <>{children}</>;
  }

  // loading / authenticating / unauthenticated（遷移待ち）は簡易ローディング表示
  return (
    <div className={styles.loading} role="status" aria-label="よみこみちゅう">
      <Mascot size={120} />
      <p className={styles.text}>よみこみちゅう…</p>
    </div>
  );
}
