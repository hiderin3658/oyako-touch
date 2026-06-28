"use client";

import { createContext, useContext, useMemo } from "react";
import {
  SessionProvider,
  signIn as nextAuthSignIn,
  signOut as nextAuthSignOut,
  useSession,
} from "next-auth/react";

/** 認証状態。loading は初期判定中（セッション取得待ち） */
export type AuthStatus = "loading" | "unauthenticated" | "authenticated";

interface AuthContextValue {
  status: AuthStatus;
  /** Google でのログインを開始する（next-auth/react の signIn へ委譲） */
  signIn: typeof nextAuthSignIn;
  /** ログアウトする（next-auth/react の signOut へ委譲） */
  signOut: typeof nextAuthSignOut;
}

const AuthContext = createContext<AuthContextValue | null>(null);

/**
 * 認証状態を提供する Context Provider。
 * 内部は next-auth の SessionProvider / useSession を裏打ちにし、
 * 画面側は従来どおり useAuth（status/signIn/signOut）だけを参照すればよい。
 */
export function AuthProvider({ children }: { children: React.ReactNode }) {
  return (
    <SessionProvider>
      <AuthStateBridge>{children}</AuthStateBridge>
    </SessionProvider>
  );
}

/**
 * useSession の状態を AuthContext へ橋渡しする内部コンポーネント。
 * useSession は SessionProvider の内側でしか呼べないため層を分けている。
 */
function AuthStateBridge({ children }: { children: React.ReactNode }) {
  // next-auth の status は "loading" | "authenticated" | "unauthenticated" で
  // 本アプリの AuthStatus と一致するため、そのまま受け渡す。
  const { status } = useSession();

  const value = useMemo<AuthContextValue>(
    () => ({
      status,
      signIn: nextAuthSignIn,
      signOut: nextAuthSignOut,
    }),
    [status],
  );

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}

/** 認証状態とログイン操作を取得する。AuthProvider の内側でのみ使用可 */
export function useAuth(): AuthContextValue {
  const context = useContext(AuthContext);
  if (context === null) {
    throw new Error("useAuth は AuthProvider の内側で使用してください");
  }
  return context;
}
