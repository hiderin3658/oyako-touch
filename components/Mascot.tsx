"use client";

import styles from "./Mascot.module.css";

export interface MascotProps {
  /** 表示サイズ（px）。デフォルト140 */
  size?: number;
  /** アニメーション種別。デフォルト "bob"（ゆらゆら） */
  animation?: "bob" | "cheer" | "none";
  /** タップ時のハンドラ。指定するとボタンになる（再読み上げ等に利用） */
  onTap?: () => void;
  /** onTap 指定時のアクセシブル名 */
  ariaLabel?: string;
}

// アニメーション種別と CSS Modules クラスの対応
const ANIMATION_CLASS: Record<NonNullable<MascotProps["animation"]>, string> = {
  bob: styles.bob,
  cheer: styles.cheer,
  none: "",
};

/** アプリのマスコット（クマ）。prototype.html の mascot() を移植 */
export function Mascot({
  size = 140,
  animation = "bob",
  onTap,
  ariaLabel,
}: MascotProps) {
  const svgClassName = [styles.mascot, ANIMATION_CLASS[animation]]
    .filter(Boolean)
    .join(" ");

  // 装飾SVG本体（読み上げ・タップは外側の要素が担うため aria-hidden）
  const svg = (
    <svg
      className={svgClassName}
      data-animation={animation}
      viewBox="0 0 120 120"
      width={size}
      height={size}
      aria-hidden="true"
    >
      <ellipse cx="36" cy="34" rx="16" ry="18" fill="#FFC98A" />
      <ellipse cx="84" cy="34" rx="16" ry="18" fill="#FFC98A" />
      <ellipse cx="36" cy="34" rx="8" ry="9" fill="#FFB1C9" />
      <ellipse cx="84" cy="34" rx="8" ry="9" fill="#FFB1C9" />
      <ellipse cx="60" cy="66" rx="44" ry="42" fill="#FFD9A8" />
      <circle cx="42" cy="62" r="8.5" fill="#4A3B33" />
      <circle cx="78" cy="62" r="8.5" fill="#4A3B33" />
      <circle cx="45" cy="59" r="3" fill="#fff" />
      <circle cx="81" cy="59" r="3" fill="#fff" />
      <ellipse cx="34" cy="78" rx="8" ry="5" fill="#FF9EBB" opacity={0.8} />
      <ellipse cx="86" cy="78" rx="8" ry="5" fill="#FF9EBB" opacity={0.8} />
      <path
        d="M50 80 Q60 90 70 80"
        stroke="#4A3B33"
        strokeWidth="4"
        fill="none"
        strokeLinecap="round"
      />
    </svg>
  );

  // タップ可能：ボタンとして公開し、アクセシブル名を付与する
  if (onTap) {
    return (
      <button
        type="button"
        className={styles.tap}
        onClick={onTap}
        aria-label={ariaLabel ?? "マスコット"}
      >
        {svg}
      </button>
    );
  }

  // タップ不可だがラベル指定あり：画像としてラベルを公開する
  if (ariaLabel) {
    return (
      <span className={styles.wrap} role="img" aria-label={ariaLabel}>
        {svg}
      </span>
    );
  }

  // 純粋な装飾
  return svg;
}
