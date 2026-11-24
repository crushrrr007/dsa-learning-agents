import { redirect } from "next/navigation";
import { Today } from "@/components/learning/Today";

export default async function HomePage({ searchParams }: { searchParams: Promise<{ pattern?: string | string[] }> }) {
  const { pattern } = await searchParams;
  if (typeof pattern === "string" && pattern) redirect(`/practice?pattern=${encodeURIComponent(pattern)}`);
  return <Today />;
}
