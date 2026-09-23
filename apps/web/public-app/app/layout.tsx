import type { Metadata, Viewport } from "next";
import { Geist, Geist_Mono } from "next/font/google";
import Script from "next/script";
import "./globals.css";
import { LanguageDocument } from "@/components/LanguageDocument";

const geistSans = Geist({
  variable: "--font-geist-sans",
  subsets: ["latin"],
});

const geistMono = Geist_Mono({
  variable: "--font-geist-mono",
  subsets: ["latin"],
});

export const viewport: Viewport = {
  width: "device-width",
  initialScale: 1,
  viewportFit: "cover",
  themeColor: "#173f33",
};

export const metadata: Metadata = {
  title: "Bài Chắn",
  description: "Play Bài Chắn with bots or in a private room",
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <LanguageDocument className={`${geistSans.variable} ${geistMono.variable} antialiased`}>
        <Script src="/monitor.js" strategy="beforeInteractive" />
        {children}
      </LanguageDocument>
  );
}
