import { redirect } from "next/navigation";

/**
 * ルート（/）。子どもの入口である /home へ送る。
 * 未認証の場合は /home を保護する RequireAuth が /login へ再誘導する。
 */
export default function RootPage(): never {
  redirect("/home");
}
