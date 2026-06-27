"use client";

import { useEffect, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { useAuth } from "@/components/auth/AuthProvider";
import { loadProgress, type Progress } from "@/lib/progress";
import styles from "./ParentLock.module.css";

// 長押し判定のしきい値（ms）。子どもの通常タップでは開かない（誤操作防止）
const HOLD_THRESHOLD_MS = 1400;

/**
 * 保護者ロックゲート。🔒ボタンの長押し（約1.4s）でアプリ内メニューを開く。
 * 短いタップでは開かないため、子どもが通常操作で抜けられない。
 * native confirm() は使わず、アプリ内オーバーレイで完結させる。
 */
export function ParentLock() {
  const router = useRouter();
  const { signOut } = useAuth();
  const [isMenuOpen, setIsMenuOpen] = useState(false);
  // メニューを開いた時点の進捗スナップショット
  const [progress, setProgress] = useState<Progress | null>(null);
  const holdTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  // unmount 時に保留中の長押しタイマーを片付ける
  useEffect(() => {
    return () => {
      if (holdTimerRef.current) {
        clearTimeout(holdTimerRef.current);
      }
    };
  }, []);

  const cancelHold = (): void => {
    if (holdTimerRef.current) {
      clearTimeout(holdTimerRef.current);
      holdTimerRef.current = null;
    }
  };

  const startHold = (): void => {
    cancelHold();
    holdTimerRef.current = setTimeout(() => {
      // 開く瞬間に進捗を読み込んでサマリ表示に使う
      setProgress(loadProgress());
      setIsMenuOpen(true);
    }, HOLD_THRESHOLD_MS);
  };

  const handleSignOut = (): void => {
    setIsMenuOpen(false);
    signOut();
    router.replace("/login");
  };

  const clearedTotal = progress
    ? progress.categories.color.cleared + progress.categories.shape.cleared
    : 0;
  const stickerCount = progress ? progress.stickers.length : 0;

  return (
    <>
      <button
        type="button"
        className={styles.lock}
        aria-label="保護者メニュー"
        title="長押しで保護者メニュー"
        onPointerDown={startHold}
        onPointerUp={cancelHold}
        onPointerLeave={cancelHold}
        onPointerCancel={cancelHold}
      >
        🔒
      </button>

      {isMenuOpen && (
        <div
          className={styles.overlay}
          role="dialog"
          aria-modal="true"
          aria-label="保護者メニュー"
        >
          <div className={styles.panel}>
            <h2 className={styles.panelTitle}>保護者メニュー</h2>
            <dl className={styles.summary}>
              <div className={styles.summaryRow}>
                <dt className={styles.summaryLabel}>クリアした かず</dt>
                <dd className={styles.summaryValue}>{clearedTotal}</dd>
              </div>
              <div className={styles.summaryRow}>
                <dt className={styles.summaryLabel}>あつめた シール</dt>
                <dd className={styles.summaryValue}>{stickerCount}</dd>
              </div>
            </dl>
            <div className={styles.btnRow}>
              <button
                type="button"
                className={styles.signOut}
                onClick={handleSignOut}
              >
                ログアウト
              </button>
              <button
                type="button"
                className={styles.close}
                onClick={() => setIsMenuOpen(false)}
              >
                とじる
              </button>
            </div>
          </div>
        </div>
      )}
    </>
  );
}
