"use client";

import Link from "next/link";
import { useShortlist } from "@/lib/shortlist";

// Top-bar shortlist counter. Hidden until something is on the list, so an
// empty control never occupies the bar.
export function ShortlistIndicator() {
  const { ids, ready } = useShortlist();
  if (!ready || ids.length === 0) return null;
  return (
    <Link
      href="/shortlist"
      title={`${ids.length} vendor${ids.length === 1 ? "" : "s"} on your shortlist`}
      className="inline-flex items-center gap-1.5 rounded-full border border-primary px-2.5 py-1 text-[11.5px] font-semibold text-primary transition hover:bg-primary hover:text-white"
    >
      <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" aria-hidden>
        <path d="M20 6 9 17l-5-5" />
      </svg>
      <span className="hidden sm:inline">Shortlist</span>
      <span className="rounded-full bg-primary px-1.5 font-mono text-[10px] text-white">
        {ids.length}
      </span>
    </Link>
  );
}
