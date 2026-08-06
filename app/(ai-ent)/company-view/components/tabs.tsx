"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";

const TABS = [
  { label: "Overview", href: "/company-view" },
  // AI Exposure and Talent Intelligence folded into Overview on 6 August
  // 2026: both re-searched the same company to print fewer conclusions than
  // the overview now draws. Their addresses still redirect here.
  // Renamed from "Trust Rank": a vendor-facing tab of that name already
  // exists under Vendor Assessment, and the two answer different questions.
  // This one is what binds YOUR organisation, not how a vendor scores.
  { label: "Governance & Obligations", href: "/company-view/trust-rank" },
  { label: "AI Analyst", href: "/company-view/analyst" },
  // The decision itself lives on the Decision Desk; this entry jumps there.
  { label: "Decision Desk", href: "/decision-desk" },
];

// The selected company travels with the tab links, so switching tabs keeps
// the company you are looking at. It arrives as a prop from the server rather
// than through useSearchParams, so the links are correct on first paint.
export function CompanyTabs({ company }: { company?: string | null }) {
  const pathname = usePathname();
  const qs = company ? `?company=${encodeURIComponent(company)}` : "";
  return (
    <nav className="flex flex-wrap gap-1 border-b border-base-300 pb-2">
      {TABS.map((t) => {
        const active =
          t.href === "/company-view"
            ? pathname === t.href
            : pathname.startsWith(t.href);
        // Assess and Decide sits outside this module and takes no company.
        const href = t.href.startsWith("/company-view") ? `${t.href}${qs}` : t.href;
        return (
          <Link
            key={t.href}
            href={href}
            className={`rounded-full px-3 py-1.5 text-sm font-semibold transition ${
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
