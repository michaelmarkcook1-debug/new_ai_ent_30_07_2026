"use client";

import { useState } from "react";
import type { TokenPrice } from "@/lib/aie";
import { PricingSection } from "./pricing-live";

// The token pricing table now sits behind a disclosure so the cost versus
// capability chart leads the page. It opens on request and keeps every
// badge, date stamp and per-row attribution it had when it was inline.
export function PricingDisclosure({
  recheckedAt,
  recheckedVendors,
  fallbackRows,
  fallbackCapturedAt,
}: {
  fallbackRows: TokenPrice[];
  fallbackCapturedAt: string;
  recheckedAt: string;
  recheckedVendors: string[];
}) {
  const [open, setOpen] = useState(false);

  if (!open) {
    return (
      <section className="rounded-lg border border-base-300 bg-base-100">
        <button
          type="button"
          onClick={() => setOpen(true)}
          className="flex w-full items-center justify-between gap-3 px-4 py-3 text-left"
        >
          <span>
            <span className="text-sm font-bold">
              Token list pricing table
            </span>
            <span className="mt-0.5 block text-xs text-muted">
              Every tracked model row: input, output and cached input per 1M
              tokens, each with its own source link and capture date.
            </span>
          </span>
          <span className="flex shrink-0 items-center gap-1.5 rounded-full border border-base-300 px-3 py-1.5 text-xs font-semibold text-primary">
            Show table
            <svg
              width="12"
              height="12"
              viewBox="0 0 24 24"
              fill="none"
              stroke="currentColor"
              strokeWidth="2"
              aria-hidden
            >
              <path d="m6 9 6 6 6-6" />
            </svg>
          </span>
        </button>
      </section>
    );
  }

  return (
    <div>
      <div className="mb-2 flex justify-end">
        <button
          type="button"
          onClick={() => setOpen(false)}
          className="inline-flex items-center gap-1.5 rounded-full border border-base-300 px-3 py-1.5 text-xs font-semibold text-muted transition hover:border-primary hover:text-primary"
        >
          Hide table
          <svg
            width="12"
            height="12"
            viewBox="0 0 24 24"
            fill="none"
            stroke="currentColor"
            strokeWidth="2"
            aria-hidden
          >
            <path d="m18 15-6-6-6 6" />
          </svg>
        </button>
      </div>
      <PricingSection
        fallbackRows={fallbackRows}
        fallbackCapturedAt={fallbackCapturedAt}
        recheckedAt={recheckedAt}
        recheckedVendors={recheckedVendors}
      />
    </div>
  );
}
