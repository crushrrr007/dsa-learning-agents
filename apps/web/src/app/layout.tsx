import type { Metadata } from "next";
import Link from "next/link";
import "./globals.css";

export const metadata: Metadata = {
  title: "Pointer Lab — Multi-Agent DSA",
  description:
    "NeetCode-style DSA practice with LeetCode-like coding and built-in teaching agents.",
};

export default function RootLayout({ children }: Readonly<{ children: React.ReactNode }>) {
  return (
    <html lang="en">
      <head>
        <link rel="preconnect" href="https://fonts.googleapis.com" />
        <link rel="preconnect" href="https://fonts.gstatic.com" crossOrigin="anonymous" />
        <link
          href="https://fonts.googleapis.com/css2?family=Fraunces:opsz,wght@9..144,500;9..144,600;9..144,700&family=IBM+Plex+Mono:wght@400;500&family=Manrope:wght@400;500;600;700&display=swap"
          rel="stylesheet"
        />
      </head>
      <body className="antialiased">
        <div className="relative min-h-screen">
          <div className="pointer-events-none absolute inset-0 grid-fade opacity-50" />
          <header className="relative z-10 border-b border-[var(--line)]/80 bg-white/70 backdrop-blur-md">
            <div className="mx-auto flex max-w-[1600px] items-center justify-between px-3 py-2.5 sm:px-5">
              <Link href="/" className="flex items-baseline gap-2">
                <span className="display text-xl font-semibold tracking-tight text-[var(--ink)]">Pointer Lab</span>
                <span className="hidden text-[10px] font-semibold uppercase tracking-[0.16em] text-[var(--muted)] sm:inline">
                  Multi-agent DSA
                </span>
              </Link>
              <nav className="flex items-center gap-4 text-sm font-semibold text-[var(--muted)]">
                <Link href="/" className="transition hover:text-[var(--accent)]">
                  Problems
                </Link>
                <Link href="/progress" className="transition hover:text-[var(--accent)]">
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
