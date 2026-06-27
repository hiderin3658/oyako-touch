"use client";

import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useRef,
  useState,
} from "react";
import {
  clearSession,
  loadSession,
  saveSession,
  SIGN_IN_DURATION_MS,
} from "@/lib/auth/mockAuth";

/** 認証状態。loading は初期判定中、authenticating はログイン演出中 */
export type AuthStatus =
  | "loading"
  | "unauthenticated"
  | "authenticating"
  | "authenticated";

interface AuthContextValue {
  status: AuthStatus;
  /** ログイン演出（約2.2s）を経て authenticated にする */
  signIn: () => Promise<void>;
  /** セッションを破棄して unauthenticated にする */
  signOut: () => void;
}

const AuthContext = createContext<AuthContextValue | null>(null);

/**
 * 認証状態を提供する Context Provider（モック実装）。
 * 認証の差し替えはこの Provider と lib/auth/mockAuth に閉じる。
 */
export function AuthProvider({ children }: { children: React.ReactNode }) {
  const [status, setStatus] = useState<AuthStatus>("loading");
  // ログイン演出の setTimeout を保持し、unmount/signOut 時にクリアする
  const timerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  // 初回マウントでセッション有無を見て loading を確定させる
  useEffect(() => {
    setStatus(loadSession() ? "authenticated" : "unauthenticated");
    return () => {
      if (timerRef.current) {
        clearTimeout(timerRef.current);
      }
    };
  }, []);

  const signIn = useCallback((): Promise<void> => {
    return new Promise<void>((resolve) => {
      setStatus("authenticating");
      // プロトタイプ演出の時間を経てからセッション保存＋authenticated へ
      timerRef.current = setTimeout(() => {
        saveSession({ authenticatedAt: Date.now() });
        setStatus("authenticated");
        resolve();
      }, SIGN_IN_DURATION_MS);
    });
  }, []);

  const signOut = useCallback((): void => {
    if (timerRef.current) {
      clearTimeout(timerRef.current);
      timerRef.current = null;
    }
    clearSession();
    setStatus("unauthenticated");
  }, []);

  return (
    <AuthContext.Provider value={{ status, signIn, signOut }}>
      {children}
    </AuthContext.Provider>
  );
}

/** 認証状態とログイン操作を取得する。AuthProvider の内側でのみ使用可 */
export function useAuth(): AuthContextValue {
  const context = useContext(AuthContext);
  if (context === null) {
    throw new Error("useAuth は AuthProvider の内側で使用してください");
  }
  return context;
}
