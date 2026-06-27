import { test, expect, type Page } from "@playwright/test";

/**
 * E2E スモーク。
 * login(モック)→おうち→レッスン→ごほうび がノーフェイルで詰まらず通ることを保証する。
 * セレクタは実装済みの data-testid / data 属性中心。タイミングは要素待機で吸収する。
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

test("いろレッスンを3問完走してごほうびに到達する", async ({ page }) => {
  await loginAndReachHome(page);

  // おうち → いろ
  await page.getByTestId("tile-color").click();

  // 3問ループ：各問で正解をタップし、星カウント増加（次状態への移行 signal）を待つ。
  // 選択肢は choice.id を React key に再利用するため、出題中（data-locked="false"）に
  // なってから正解ロケータを解決しないと、遷移中の同一ノードを誤って掴む。
  for (let answered = 1; answered <= 3; answered += 1) {
    // 出題中（ロック解除）になるのを待ってから正解を確定させる
    await expect(page.locator('[data-locked="false"]')).toBeVisible();
    await correctChoice(page).click();
    // 正解が反映され星が answered 個になる。正解演出(約1.1s)はこの待機で吸収する
    await expect(page.locator(`[aria-label="ほし ${answered} / 3"]`)).toBeVisible();
  }

  // ごほうび到達を assert
  await expect(page.getByTestId("reward")).toBeVisible();
  await expect(page.getByText("よく できました！")).toBeVisible();
  await expect(page.getByTestId("reward-again")).toBeVisible();
  await expect(page.getByTestId("reward-home")).toBeVisible();
});

test("誤答してもフェイル表示が出ず同じ問題に留まり、正解で前進する", async ({
  page,
}) => {
  await loginAndReachHome(page);
  await page.getByTestId("tile-color").click();

  // 1問目（あか）が出ていること
  await expect(page.getByText("あかいのは どれかな？")).toBeVisible();
  await expect(correctChoice(page)).toBeVisible();

  // 誤答を1つタップ
  await wrongChoice(page).click();

  // フェイル演出（×・ふせいかい）が画面に存在しないこと
  await expect(page.getByText("×")).toHaveCount(0);
  await expect(page.getByText("ふせいかい")).toHaveCount(0);
  // ごほうびに進んでいないこと
  await expect(page.getByTestId("reward")).toHaveCount(0);
  // 同じ問題に留まっていること（設問そのまま・星は0のまま）
  await expect(page.getByText("あかいのは どれかな？")).toBeVisible();
  await expect(page.locator('[aria-label="ほし 0 / 3"]')).toBeVisible();

  // 続けて正解をタップすると次の問題へ前進すること
  await correctChoice(page).click();
  await expect(page.locator('[aria-label="ほし 1 / 3"]')).toBeVisible();
  await expect(page.getByText("あおいのは どれかな？")).toBeVisible();
});

test("かたちレッスンで1問正解できる", async ({ page }) => {
  await loginAndReachHome(page);

  // おうち → かたち
  await page.getByTestId("tile-shape").click();

  // 1問目（まる）が出ていること
  await expect(page.getByText("まるは どれかな？")).toBeVisible();

  // 正解をタップして星が1個点くこと
  await correctChoice(page).click();
  await expect(page.locator('[aria-label="ほし 1 / 3"]')).toBeVisible();
});
