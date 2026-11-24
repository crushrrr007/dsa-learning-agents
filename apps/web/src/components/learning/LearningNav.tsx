"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";

const items = [
  { href: "/", label: "Today" },
  { href: "/learn", label: "Learn", nested: "/topics/", alias: "/patterns" },
  { href: "/practice", label: "Practice", nested: "/problems/", alias: "/problems", sheet: "/sheets/" },
  { href: "/agents", label: "Agents" },
  { href: "/progress", label: "Progress" },
];

export function LearningNav() {
  const current = usePathname();
  return (
    <nav aria-label="Main navigation" className="learn-nav">
      {items.map(({ href, label, nested, alias, sheet }) => {
        const selected = current === href || current === alias || Boolean(nested && current.startsWith(nested)) || Boolean(sheet && current.startsWith(sheet));
        return <Link key={href} href={href} aria-current={selected ? (current === href ? "page" : "location") : undefined}>{label}</Link>;
      })}
    </nav>
  );
}
