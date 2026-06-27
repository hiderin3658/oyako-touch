import styles from "./page.module.css";

// 仮のトップページ。後続Issueで保護者ログイン（/login）へ差し替える前提のプレースホルダ
export default function Home() {
  return (
    <main className={styles.main}>
      <h1 className={styles.logo}>
        おやこタッチ<span className={styles.dot}>.</span>
      </h1>
      <p className={styles.tagline}>3さいの はじめての まなび</p>
    </main>
  );
}
