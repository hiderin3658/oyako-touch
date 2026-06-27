import type { Metadata, Viewport } from "next";
import { M_PLUS_Rounded_1c, Baloo_2 } from "next/font/google";
import "./globals.css";

// 本文用の丸ゴシック（M PLUS Rounded 1c）。CSS変数として全体に適用する
const mPlusRounded = M_PLUS_Rounded_1c({
  weight: ["500", "700", "800"],
  subsets: ["latin"],
  variable: "--font-rounded",
  display: "swap",
});

// ロゴ用の丸みのある欧文フォント（Baloo 2）
const baloo = Baloo_2({
  weight: ["600", "800"],
  subsets: ["latin"],
  variable: "--font-baloo",
  display: "swap",
});

export const metadata: Metadata = {
  title: "おやこタッチ",
  description: "3さいの はじめての まなび",
};

// 3歳児向けタブレットUXのため、ピンチズーム等を無効化する
export const viewport: Viewport = {
  width: "device-width",
  initialScale: 1,
  maximumScale: 1,
  userScalable: false,
};

export default function RootLayout({
  children,
}: Readonly<{ children: React.ReactNode }>) {
  return (
    <html lang="ja" className={`${mPlusRounded.variable} ${baloo.variable}`}>
      <body>{children}</body>
    </html>
  );
}
