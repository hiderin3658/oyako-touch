// Auth.js（NextAuth v5）の認証エンドポイント。
// /api/auth/* の GET/POST を auth.ts の handlers に委譲する。
import { handlers } from "@/auth";

export const { GET, POST } = handlers;
