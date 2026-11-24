"use client";

import Link from "next/link";
import { useParams } from "next/navigation";
import { useEffect, useState } from "react";
import { CheckCircle2, Circle } from "lucide-react";
import { fetchSheet, type SheetDetail } from "@/lib/api";

function diffClass(d: string) {
  const x = d.toLowerCase();
  if (x === "easy") return "text-emerald-600";
  if (x === "hard") return "text-rose-600";
  return "text-amber-600";
}

export default function SheetPage() {
  const params = useParams<{ id: string }>();
  const id = params.id;
  const [sheet, setSheet] = useState<SheetDetail | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    fetchSheet(id)
      .then(setSheet)
      .catch((e) => setError(e.message || "Failed to load sheet"))
      .finally(() => setLoading(false));
  }, [id]);

  if (loading) return <div className="p-8 text-[var(--muted)]">Loading sheet…</div>;
  if (error || !sheet) return <div className="p-8 text-rose-700">{error || "Sheet not found"}</div>;

  const pct = sheet.problems_total ? Math.round((sheet.mastered_count / sheet.problems_total) * 100) : 0;
  const next = sheet.problems.find((p) => !p.mastered);

  return (
    <div className="mx-auto max-w-4xl px-4 py-8 sm:px-6 sm:py-10">
      <Link href="/problems" className="text-sm font-semibold text-[var(--accent)] hover:underline">
        ← All problems
      </Link>
      <p className="mt-4 text-[11px] font-bold uppercase tracking-[0.16em] text-teal-700">Curated sheet</p>
      <h1 className="display mt-1 text-4xl font-extrabold">{sheet.title}</h1>
      <p className="mt-2 max-w-2xl text-[var(--muted)]">{sheet.subtitle}</p>
      {sheet.inspired_by?.length > 0 && (
        <p className="mt-2 text-xs text-[var(--muted)]">In the spirit of {sheet.inspired_by.join(" · ")}</p>
      )}

      <div className="mt-6 rounded-2xl border border-[var(--line)] bg-white p-5 shadow-sm">
        <div className="flex flex-wrap items-end justify-between gap-3">
          <div>
            <p className="text-[11px] font-bold uppercase tracking-wider text-[var(--muted)]">Completion</p>
            <p className="display mt-1 text-3xl font-extrabold tabular-nums">
              {sheet.mastered_count}
              <span className="text-lg text-[var(--muted)]">/{sheet.problems_total}</span>
            </p>
          </div>
          {next && (
            <Link
              href={`/problems/${next.id}`}
              className="inline-flex h-11 items-center rounded-xl bg-[var(--accent)] px-5 text-sm font-bold text-white"
            >
              Continue → {next.title}
            </Link>
          )}
        </div>
        <div className="mt-4 h-2 overflow-hidden rounded-full bg-slate-100">
          <div className="h-full rounded-full bg-gradient-to-r from-teal-600 to-teal-400" style={{ width: `${pct}%` }} />
        </div>
      </div>

      <ul className="mt-6 overflow-hidden rounded-2xl border border-[var(--line)] bg-white shadow-sm">
        {sheet.problems.map((p, i) => (
          <li key={p.id} className="border-t border-[var(--line)] first:border-t-0">
            <Link
              href={`/problems/${p.id}`}
              className="flex items-center gap-3 px-4 py-3 text-sm transition hover:bg-teal-50/50"
            >
              <span className="w-6 text-xs font-bold tabular-nums text-[var(--muted)]">{i + 1}</span>
              {p.mastered ? (
                <CheckCircle2 className="h-4 w-4 shrink-0 text-emerald-600" />
              ) : (
                <Circle className="h-4 w-4 shrink-0 text-slate-300" />
              )}
              <span className="min-w-0 flex-1 font-semibold">{p.title}</span>
              <span className="hidden text-xs text-[var(--muted)] sm:inline">{p.pattern}</span>
              <span className={`w-16 text-right text-[11px] font-bold uppercase ${diffClass(p.difficulty)}`}>
                {p.difficulty}
              </span>
            </Link>
          </li>
        ))}
      </ul>
    </div>
  );
}
