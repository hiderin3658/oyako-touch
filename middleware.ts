import { auth } from "@/auth";

// ルート保護の本体（セキュリティ境界）。サーバ境界で未認証アクセスを遮断する。
// req.auth（有効な JWT セッション）が無ければ /login へリダイレクトする。
export default auth((req) => {
  if (!req.auth) {
    return Response.redirect(new URL("/login", req.nextUrl.origin));
  }
});

// 保護対象は子ども画面群のみ。/login・/api/auth・静的アセットは対象外にして
// リダイレクトループを防ぐ（matcher に含めない）。
// 素の "/home" も確実に保護するため明示的に列挙する（":path*" だけだと
// 経路によってルート自体がマッチしないことがあるため）。
export const config = {
  matcher: ["/home", "/home/:path*", "/game", "/game/:path*"],
};
