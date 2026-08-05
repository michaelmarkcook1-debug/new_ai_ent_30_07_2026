"use client";

import { useState } from "react";

// Micro-label: tiny ALL-CAPS JetBrains Mono label above figures, with an
// info tooltip explaining the metric (house idiom, spec Section 3).
export function MicroLabel({
  label,
  tooltip,
  heading = false,
}: {
  label: string;
  tooltip?: string;
  /**
   * Render as a section heading rather than a micro-label.
   *
   * The micro-label is the house idiom for the line above a figure, and it is
   * deliberately quiet. A panel that is the first thing a returning reader
   * meets is not that: it is the page's own headline, and setting it in 0.7rem
   * muted mono made it read as a caption for the list underneath.
   *
   * This also makes it an actual `h2`. The micro-label is a `span`, so a panel
   * titled this way had no heading in the document at all.
   */
  heading?: boolean;
}) {
  const [open, setOpen] = useState(false);
  const Tag = heading ? "h2" : "span";
  return (
    <Tag
      className={
        heading
          ? "relative inline-flex items-center gap-1.5 text-xl font-extrabold tracking-tight"
          : "micro-label relative inline-flex items-center gap-1"
      }
    >
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
    </Tag>
  );
}
