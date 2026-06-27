// 認証のモック実装（SSRセーフ）。
// 認証ロジックはこのファイルと AuthProvider の2点に隔離し、
// 将来 Auth.js（NextAuth）へ差し替えても画面側を変えずに済むようにする。

/** モックセッションの localStorage 保存キー（設計§4.2） */
export const SESSION_STORAGE_KEY = "oyako-touch.session";

/** モックセッション。MVPでは認証済みフラグ代わりに発行時刻のみ保持する */
export interface MockSession {
  authenticatedAt: number;
}

/** ログイン演出の1段階。経過ミリ秒・表示メッセージ・トーン（色分け用） */
export interface SignInStep {
  /** signIn 開始からの経過ミリ秒。この時刻に message を表示する */
  atMs: number;
  message: string;
  /** 進行中（muted）か成功（success）か。表示色の出し分けに使う */
  tone: "progress" | "success";
}

/**
 * ログイン演出の段階表現（prototype.html の loginStatus を移植）。
 * 「ログイン中… → 許可リスト確認 → ようこそ」を時間で表現する。
 */
export const SIGN_IN_STEPS: SignInStep[] = [
  { atMs: 0, message: "ログイン中…", tone: "progress" },
  { atMs: 700, message: "許可リストを確認しています…", tone: "progress" },
  { atMs: 1500, message: "✓ ようこそ！", tone: "success" },
];

/** ログイン演出の総時間（ms）。経過後に authenticated へ遷移する */
export const SIGN_IN_DURATION_MS = 2200;

/**
 * セッションを読み込む。
 * SSR（window未定義）・未ログイン・破損時は null を返す。
 */
export function loadSession(): MockSession | null {
  if (typeof window === "undefined") {
    return null;
  }
  try {
    const raw = window.localStorage.getItem(SESSION_STORAGE_KEY);
    if (raw === null) {
      return null;
    }
    const parsed: unknown = JSON.parse(raw);
    if (
      typeof parsed === "object" &&
      parsed !== null &&
      typeof (parsed as Record<string, unknown>).authenticatedAt === "number"
    ) {
      return { authenticatedAt: (parsed as MockSession).authenticatedAt };
    }
    return null;
  } catch (error) {
    // 破損データは握りつぶさずログに残し、未ログイン扱いにフォールバックする
    console.warn("セッションの読み込みに失敗しました。", error);
    return null;
  }
}

/** セッションを保存する（SSR時・失敗時は no-op） */
export function saveSession(session: MockSession): void {
  if (typeof window === "undefined") {
    return;
  }
  try {
    window.localStorage.setItem(SESSION_STORAGE_KEY, JSON.stringify(session));
  } catch (error) {
    console.warn("セッションの保存に失敗しました。", error);
  }
}

/** セッションを破棄する（SSR時・失敗時は no-op） */
export function clearSession(): void {
  if (typeof window === "undefined") {
    return;
  }
  try {
    window.localStorage.removeItem(SESSION_STORAGE_KEY);
  } catch (error) {
    console.warn("セッションの破棄に失敗しました。", error);
  }
}
