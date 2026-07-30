"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";

const TABS = [
  { label: "Overview", href: "/company-view" },
  { label: "AI Exposure", href: "/company-view/ai-exposure" },
  { label: "Talent Intelligence", href: "/company-view/talent" },
  { label: "Trust Rank", href: "/company-view/trust-rank" },
  { label: "Assess and Decide", href: "/company-view/assess" },
  { label: "AI Analyst", href: "/company-view/analyst" },
];

export function CompanyTabs() {
  const pathname = usePathname();
  return (
    <nav className="flex flex-wrap gap-1 border-b border-base-300 pb-2">
      {TABS.map((t) => {
        const active =
          t.href === "/company-view"
            ? pathname === t.href
            : pathname.startsWith(t.href);
        return (
          <Link
            key={t.href}
            href={t.href}
            className={`rounded-full px-3 py-1.5 text-[12px] font-semibold transition ${
              active
                ? "bg-primary text-white shadow-sm"
                : "text-muted hover:bg-base-200 hover:text-base-content"
            }`}
          >
            {t.label}
          </Link>
        );
      })}
    </nav>
  );
}
