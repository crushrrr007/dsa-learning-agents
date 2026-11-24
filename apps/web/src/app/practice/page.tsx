import type { Metadata } from "next";
import { Suspense } from "react";
import { PracticeLibrary } from "@/components/learning/PracticeLibrary";

export const metadata: Metadata = { title: "Practice DSA | Pointer Lab", description: "Find a guided Python practice problem by topic, pattern, difficulty, or your progress." };

export default function PracticePage() {
  return <Suspense fallback={<p role="status" className="learn-main">Loading the library…</p>}><PracticeLibrary /></Suspense>;
}
