import type { Metadata } from "next";
import Link from "next/link";
import "./globals.css";

export const metadata: Metadata = {
  title: "Pointer Lab — Multi-Agent DSA Learning",
  description:
    "Learn arrays, two pointers, sliding window, and linked lists with real code tracing and teaching agents.",
};

export default function RootLayout({ children }: Readonly<{ children: React.ReactNode }>) {
  return (
    <html lang="en">
      <head>
        <link rel="preconnect" href="https://fonts.googleapis.com" />
        <link rel="preconnect" href="https://fonts.gstatic.com" crossOrigin="anonymous" />
        <link
          href="https://fonts.googleapis.com/css2?family=Fraunces:opsz,wght@9..144,500;9..144,600;9..144,700&family=Manrope:wght@400;500;600;700&display=swap"
          rel="stylesheet"
        />
      </head>
      <body className="antialiased">
        <div className="relative min-h-screen">
          <div className="pointer-events-none absolute inset-0 grid-fade opacity-70" />
          <header className="relative z-10 border-b border-[var(--line)]/80 bg-white/40 backdrop-blur-md">
            <div className="mx-auto flex max-w-7xl items-center justify-between px-4 py-3 sm:px-6">
              <Link href="/" className="group flex items-baseline gap-2">
                <span className="display text-xl font-semibold tracking-tight text-[var(--ink)] sm:text-2xl">
                  Pointer Lab
                </span>
                <span className="hidden text-xs font-medium uppercase tracking-[0.18em] text-[var(--muted)] sm:inline">
                  DSA Phase I
                </span>
              </Link>
              <nav className="flex items-center gap-4 text-sm font-medium text-[var(--muted)]">
                <Link href="/" className="transition hover:text-[var(--accent)]">
                  Roadmap
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
