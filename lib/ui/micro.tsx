"use client";

import { useState } from "react";

// Micro-label: tiny ALL-CAPS JetBrains Mono label above figures, with an
// info tooltip explaining the metric (house idiom, spec Section 3).
export function MicroLabel({
  label,
  tooltip,
}: {
  label: string;
  tooltip?: string;
}) {
  const [open, setOpen] = useState(false);
  return (
    <span className="micro-label relative inline-flex items-center gap-1">
      {label}
      {tooltip ? (
        <button
          type="button"
          aria-label={`About ${label}`}
          className="text-muted/70 hover:text-primary"
          onMouseEnter={() => setOpen(true)}
          onMouseLeave={() => setOpen(false)}
          onClick={() => setOpen((v) => !v)}
        >
          <svg width="11" height="11" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
            <circle cx="12" cy="12" r="9" />
            <path d="M12 16v-5M12 8h.01" />
          </svg>
          {open ? (
            <span className="absolute left-0 top-full z-30 mt-1 w-56 rounded border border-base-300 bg-base-100 p-2 text-left font-sans text-xs normal-case tracking-normal text-base-content shadow-lg">
              {tooltip}
            </span>
          ) : null}
        </button>
      ) : null}
    </span>
  );
}
