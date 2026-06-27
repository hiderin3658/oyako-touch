import { defineConfig, devices } from "@playwright/test";

/**
 * Playwright E2E スモーク設定。
 * login(モック)→おうち→いろ3問完走→ごほうび がノーフェイルで通ることを保証する。
 * webServer に dev サーバを起動させ、Desktop Chrome 1プロジェクトで検証する。
 */
export default defineConfig({
  testDir: "./e2e",
  // CI では test.only の混入を失敗扱いにする
  forbidOnly: !!process.env.CI,
  // CI のみフレーク対策で1回だけリトライ
  retries: process.env.CI ? 1 : 0,
  // 失敗時の調査用に HTML レポート（.gitignore 済み。自動オープンはしない）
  reporter: [["html", { open: "never" }]],
  use: {
    baseURL: "http://localhost:3000",
    // リトライ時のみトレースを残す
    trace: "on-first-retry",
  },
  projects: [
    {
      name: "chromium",
      use: { ...devices["Desktop Chrome"] },
    },
  ],
  webServer: {
    // スモークなので dev サーバで起動（ビルド不要で高速）
    command: "npm run dev",
    url: "http://localhost:3000",
    // ローカルは既存サーバを再利用、CI は毎回新規起動
    reuseExistingServer: !process.env.CI,
    timeout: 120000,
  },
});
