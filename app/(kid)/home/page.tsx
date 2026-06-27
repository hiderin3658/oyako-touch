"use client";

import { useEffect } from "react";
import { useRouter } from "next/navigation";
import { Mascot } from "@/components/Mascot";
import { ParentLock } from "@/components/ParentLock";
import { playPhrase } from "@/lib/audio";
import styles from "./home.module.css";

/** おうち画面。種目タイルを選んでゲームへ進む（prototype.html の #screen-home） */
export default function HomePage() {
  const router = useRouter();

  // 画面に来たら問いかけを読み上げる（ログイン直後・ごほうび→おうちの両方を兼ねる）
  useEffect(() => {
    playPhrase("home-prompt");
  }, []);

  return (
    <main className={styles.home}>
      <div className={styles.greet}>
        <Mascot
          size={140}
          onTap={() => playPhrase("home-prompt")}
          ariaLabel="もういちど よみあげる"
        />
        <h1 className={styles.title}>なにで あそぶ？</h1>
      </div>

      <div className={styles.menu}>
        <button
          type="button"
          className={`${styles.tile} ${styles.color}`}
          onClick={() => router.push("/game/color")}
          data-testid="tile-color"
        >
          <span className={styles.emoji}>
            <span className={styles.icon}>🔴</span>
            <span className={styles.icon}>🔵</span>
            <span className={styles.icon}>🟡</span>
          </span>
          <span className={styles.label}>いろ</span>
        </button>

        <button
          type="button"
          className={`${styles.tile} ${styles.shape}`}
          onClick={() => router.push("/game/shape")}
          data-testid="tile-shape"
        >
          <span className={styles.emoji}>
            <span className={styles.icon}>⭐</span>
            <span className={styles.icon}>🔺</span>
            <span className={styles.icon}>⬛</span>
          </span>
          <span className={styles.label}>かたち</span>
        </button>

        <div className={`${styles.tile} ${styles.locked}`} aria-disabled="true">
          <span className={styles.emoji}>
            <span className={styles.icon}>🔢</span>
          </span>
          <span className={styles.label}>すうじ</span>
          <span className={styles.soon}>じゅんびちゅう</span>
        </div>
      </div>

      <ParentLock />
      <p className={styles.hint}>
        マスコットをタップすると もういちど よみあげます
      </p>
    </main>
  );
}
