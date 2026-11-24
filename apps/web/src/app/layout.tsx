import type { Metadata, Viewport } from "next";
import { Fraunces, Manrope } from "next/font/google";
import Link from "next/link";
import { Terminal } from "lucide-react";
import { LearningNav } from "@/components/learning/LearningNav";
import "./globals.css";

const manrope = Manrope({ subsets: ["latin"], variable: "--font-manrope", display: "swap" });
const fraunces = Fraunces({ subsets: ["latin"], variable: "--font-fraunces", display: "swap" });

export const metadata: Metadata = {
  title: "Pointer Lab — Multi-Agent DSA Practice",
  description: "Learn data structures and algorithms with interactive Python traces, staged practice, and specialized coaching agents that give hints instead of complete solutions.",
};

export const viewport: Viewport = { themeColor: "#eef3f1" };

export default function RootLayout({ children }: Readonly<{ children: React.ReactNode }>) {
  return (
    <html lang="en" className={`bg-[var(--bg)] ${manrope.variable} ${fraunces.variable}`}>
      <body className="font-sans antialiased">
        <div className="relative min-h-screen">
          <a href="#main-content" className="learn-skip">Skip to content</a>
          <header className="learn-topbar">
            <div className="learn-topbar-inner">
              <Link href="/" className="learn-brand"><span className="learn-brand-mark brand-mark"><Terminal size={19} aria-hidden="true" /></span><span className="font-serif">Pointer Lab</span></Link>
              <LearningNav />
              <span className="learn-guest">Guest lab</span>
            </div>
          </header>
          <main id="main-content" className="relative">{children}</main>
        </div>
      </body>
    </html>
  );
}
