import styles from "./StarBar.module.css";

export interface StarBarProps {
  /** 点灯している星の数 */
  count: number;
  /** 星の総数。デフォルト3 */
  total?: number;
}

/** 獲得した星を並べて表示するバー。prototype.html の .stars を移植 */
export function StarBar({ count, total = 3 }: StarBarProps) {
  return (
    <div
      className={styles.stars}
      role="img"
      aria-label={`ほし ${count} / ${total}`}
    >
      {Array.from({ length: total }, (_, index) => {
        const isOn = index < count;
        return (
          <span
            key={index}
            className={isOn ? `${styles.star} ${styles.on}` : styles.star}
            data-on={isOn ? "true" : "false"}
            aria-hidden="true"
          >
            ⭐
          </span>
        );
      })}
    </div>
  );
}
