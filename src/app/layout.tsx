import type { Metadata } from "next";
import "./globals.css";

export const metadata: Metadata = {
  title: "奶蛙博物馆 · Musée du Milk Frog",
  description: "穿越三万年的凝视，奶蛙栖身于人类最伟大的画布之中。",
};

export default function RootLayout({ children }: Readonly<{ children: React.ReactNode }>) {
  return (
    <html lang="zh-CN">
      <body>{children}</body>
    </html>
  );
}
