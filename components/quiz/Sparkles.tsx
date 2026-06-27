"use client";

import { useEffect, useState } from "react";
import styles from "./Sparkles.module.css";

// 飛び散る絵文字の種類と個数
const SPARK_EMOJIS = ["⭐", "✨", "🎉", "💛"];
const SPARK_COUNT = 8;
// rise アニメーションの長さ（ms）。終了後にDOMから片付ける
const SPARK_DURATION_MS = 1000;

interface SparkleItem {
  id: string;
  emoji: string;
  /** 中心からの水平オフセット（px） */
  offsetX: number;
}

export interface SparklesProps {
  /** 値が変わるたびにキラキラを発火する（0以下では発火しない） */
  trigger: number;
}

/**
 * 正解時のキラキラ演出。prototype.html の burst() 相当だが、
 * クリック座標依存をやめ、親要素の中心を基準に上昇させる。
 */
export function Sparkles({ trigger }: SparklesProps) {
  const [items, setItems] = useState<SparkleItem[]>([]);

  useEffect(() => {
    // 初期値（0以下）では発火しない
    if (trigger <= 0) {
      return;
    }
    const next: SparkleItem[] = Array.from({ length: SPARK_COUNT }, (_, index) => ({
      id: `${trigger}-${index}`,
      emoji: SPARK_EMOJIS[index % SPARK_EMOJIS.length],
      offsetX: Math.round(Math.random() * 60 - 30),
    }));
    setItems(next);
    // アニメーション終了後にクリアして要素を残さない
    const timerId = setTimeout(() => setItems([]), SPARK_DURATION_MS);
    return () => clearTimeout(timerId);
  }, [trigger]);

  if (items.length === 0) {
    return null;
  }

  return (
    <div className={styles.layer} aria-hidden="true">
      {items.map((item) => (
        <span
          key={item.id}
          className={styles.anchor}
          style={{ left: `calc(50% + ${item.offsetX}px)` }}
        >
          <span className={styles.spark}>{item.emoji}</span>
        </span>
      ))}
    </div>
  );
}
