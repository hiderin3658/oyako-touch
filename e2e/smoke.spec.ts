import { test, expect, type Page } from "@playwright/test";

/**
 * E2E スモーク。
 * login(モック)→おうち→レッスン→ごほうび がノーフェイルで詰まらず通ることを保証する。
 * セレクタは実装済みの data-testid / data 属性中心。タイミングは要素待機で吸収する。
 * 問題数（StarBar の総数）には依存せず、「ごほうび到達」をゴールに完走を判定する。
 */

/**
 * ログイン（モック）→ おうち到達までの共通操作。
 * Googleボタン押下後、ログイン演出（約2.2s）を経て「なにで あそぶ？」が出るのを待つ。
 */
async function loginAndReachHome(page: Page): Promise<void> {
  await page.goto("/login");
  await page.getByTestId("google-login").click();
  // ログイン演出を経ておうちへ。見出しの出現で到達を確認する
  await expect(page.getByText("なにで あそぶ？")).toBeVisible();
}

/** いま表示中の問題の正解選択肢ロケータ（演出中はロックされ自動待機される） */
function correctChoice(page: Page) {
  return page.locator('[data-testid="choice"][data-correct="true"]').first();
}

/** いま表示中の問題の誤答選択肢ロケータ */
function wrongChoice(page: Page) {
  return page.locator('[data-testid="choice"][data-correct="false"]').first();
}

/** 選択肢が出題中（タップ受付可能）になっているコンテナのロケータ */
function unlockedChoices(page: Page) {
  return page.locator('[data-locked="false"]');
}

/** 演出中（タップロック）になっているコンテナのロケータ */
function lockedChoices(page: Page) {
  return page.locator('[data-locked="true"]');
}

test("いろレッスンを完走してごほうびに到達する", async ({ page }) => {
  await loginAndReachHome(page);

  // おうち → いろ
  await page.getByTestId("tile-color").click();

  // ごほうび（reward）が表示されるまで、各問で正解を押し続ける。
  // 問題数や StarBar の総数には依存せず、「ごほうび到達」をゴールに繰り返す。
  // 選択肢は choice.id を React key に再利用するため、出題中（data-locked="false"）に
  // なってから正解ロケータを解決しないと、遷移中の同一ノードを誤って掴む。
  const reward = page.getByTestId("reward");
  const unlocked = unlockedChoices(page);
  const locked = lockedChoices(page);
  while (!(await reward.isVisible())) {
    // 出題中（ロック解除）になるのを待ってから正解を確定させる
    await expect(unlocked).toBeVisible();
    await correctChoice(page).click();
    // クリックが受理されると正解演出に入りロックされる（最終問題ならごほうびへ）。
    // まず状態遷移を確認し、ロック解除のまま誤って次の周回へ進むのを防ぐ
    await expect(locked.or(reward)).toBeVisible();
    // 正解演出（約1.1s）後、次の出題（ロック解除）かごほうびのどちらかになるまで待つ
    await expect(unlocked.or(reward)).toBeVisible();
  }

  // ごほうび到達を assert
  await expect(reward).toBeVisible();
  await expect(page.getByText("よく できました！")).toBeVisible();
  await expect(page.getByTestId("reward-again")).toBeVisible();
  await expect(page.getByTestId("reward-home")).toBeVisible();
});

test("誤答してもフェイル表示が出ず同じ問題に留まり、正解で前進する", async ({
  page,
}) => {
  await loginAndReachHome(page);
  await page.getByTestId("tile-color").click();

  // 1問目（あか）が出ていること。先頭問題の出題順は今後も保持される前提
  await expect(page.getByText("あかいのは どれかな？")).toBeVisible();
  await expect(correctChoice(page)).toBeVisible();

  // 誤答を1つタップ
  await wrongChoice(page).click();

  // フェイル演出（×・ふせいかい）が画面に存在しないこと
  await expect(page.getByText("×")).toHaveCount(0);
  await expect(page.getByText("ふせいかい")).toHaveCount(0);
  // ごほうびに進んでいないこと
  await expect(page.getByTestId("reward")).toHaveCount(0);
  // 同じ問題に留まっていること（設問そのまま・星は1つも点いていない）
  await expect(page.getByText("あかいのは どれかな？")).toBeVisible();
  await expect(page.locator('[data-on="true"]')).toHaveCount(0);

  // 誤答演出が明けて再び出題中（ロック解除）になってから正解をタップする
  await expect(unlockedChoices(page)).toBeVisible();
  await correctChoice(page).click();
  // 正解が反映され星が1つ点く（総数には依存しない）
  await expect(page.locator('[data-on="true"]')).toHaveCount(1);
  // 次の問題へ前進すること。先頭付近の出題順は今後も保持される前提
  await expect(page.getByText("あおいのは どれかな？")).toBeVisible();
});

test("かたちレッスンで1問正解できる", async ({ page }) => {
  await loginAndReachHome(page);

  // おうち → かたち
  await page.getByTestId("tile-shape").click();

  // 1問目（まる）が出ていること。先頭問題の出題順は今後も保持される前提
  await expect(page.getByText("まるは どれかな？")).toBeVisible();

  // 出題中（ロック解除）になってから正解をタップし、星が1つ点くこと（総数には依存しない）
  await expect(unlockedChoices(page)).toBeVisible();
  await correctChoice(page).click();
  await expect(page.locator('[data-on="true"]')).toHaveCount(1);
});

test("すうじレッスンを完走してごほうびに到達する", async ({ page }) => {
  await loginAndReachHome(page);

  // おうち → すうじ
  await page.getByTestId("tile-number").click();

  // ごほうび（reward）が表示されるまで、各問で正解を押し続ける。
  // 問題数や StarBar の総数には依存せず、「ごほうび到達」をゴールに繰り返す。
  const reward = page.getByTestId("reward");
  const unlocked = unlockedChoices(page);
  const locked = lockedChoices(page);
  while (!(await reward.isVisible())) {
    // 出題中（ロック解除）になるのを待ってから正解を確定させる
    await expect(unlocked).toBeVisible();
    await correctChoice(page).click();
    // クリックが受理されると正解演出に入りロックされる（最終問題ならごほうびへ）
    await expect(locked.or(reward)).toBeVisible();
    // 正解演出後、次の出題（ロック解除）かごほうびのどちらかになるまで待つ
    await expect(unlocked.or(reward)).toBeVisible();
  }

  // ごほうび到達を assert
  await expect(reward).toBeVisible();
  await expect(page.getByText("よく できました！")).toBeVisible();
  await expect(page.getByTestId("reward-again")).toBeVisible();
  await expect(page.getByTestId("reward-home")).toBeVisible();
});
