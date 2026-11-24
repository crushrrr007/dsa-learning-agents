import type { Metadata } from "next";
import Link from "next/link";
import "./globals.css";

export const metadata: Metadata = {
  title: "Pointer Lab — Multi-Agent DSA",
  description:
    "Pattern practice with a NeetCode-style workspace and teaching agents that hint instead of dumping solutions.",
};

export default function RootLayout({ children }: Readonly<{ children: React.ReactNode }>) {
  return (
    <html lang="en">
      <head>
        <link rel="preconnect" href="https://fonts.googleapis.com" />
        <link rel="preconnect" href="https://fonts.gstatic.com" crossOrigin="anonymous" />
        <link
          href="https://fonts.googleapis.com/css2?family=IBM+Plex+Mono:wght@400;500&family=Plus+Jakarta+Sans:wght@400;500;600;700;800&family=Syne:wght@600;700;800&display=swap"
          rel="stylesheet"
        />
      </head>
      <body className="antialiased">
        <div className="relative min-h-screen">
          <div className="pointer-events-none absolute inset-0 grid-fade opacity-60" />
          <header className="relative z-20 border-b border-[var(--line)] bg-white/75 backdrop-blur-xl">
            <div className="mx-auto flex max-w-[1600px] items-center justify-between gap-4 px-4 py-3 sm:px-6">
              <Link href="/" className="group flex items-center gap-2.5">
                <span className="brand-mark flex h-8 w-8 items-center justify-center rounded-lg text-xs font-black text-white transition group-hover:scale-105">
                  P
                </span>
                <span className="display text-lg font-bold tracking-tight text-[var(--ink)] sm:text-xl">
                  Pointer Lab
                </span>
              </Link>
              <nav className="flex items-center gap-1 text-sm font-semibold text-[var(--muted)] sm:gap-2">
                <Link
                  href="/"
                  className="rounded-lg px-3 py-1.5 transition hover:bg-black/[0.04] hover:text-[var(--ink)]"
                >
                  Sheet
                </Link>
                <Link
                  href="/topics/two-pointers"
                  className="rounded-lg bg-[var(--accent)] px-3 py-1.5 text-white shadow-sm transition hover:brightness-110"
                >
                  Demo
                </Link>
                <Link
                  href="/progress"
                  className="rounded-lg px-3 py-1.5 transition hover:bg-black/[0.04] hover:text-[var(--ink)]"
                >
                  Progress
                </Link>
              </nav>
            </div>
          </header>
          <main className="relative z-10">{children}</main>
        </div>
      </body>
    </html>
  );
}
