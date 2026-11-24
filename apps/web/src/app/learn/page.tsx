import type { Metadata } from "next";
import { Suspense } from "react";
import { LearnRoadmap } from "@/components/learning/LearnRoadmap";

export const metadata: Metadata = { title: "Learn DSA | Pointer Lab", description: "Follow the DSA foundations roadmap or explore interview patterns with guided practice." };

export default function LearnPage() {
  return <Suspense fallback={<p role="status" className="learn-main">Loading the roadmap…</p>}><LearnRoadmap /></Suspense>;
}
