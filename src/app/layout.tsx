import type { Metadata } from "next";
import "./globals.css";

export const metadata: Metadata = {
  title: "RankMind — SEO Platform",
  description: "AI-powered SEO platform with GSC, GA4, keyword research and more.",
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en">
      <body>{children}</body>
    </html>
  );
}
