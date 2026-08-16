"use client";

import { useState } from "react";

// Micro-label: tiny ALL-CAPS JetBrains Mono label above figures, with an
// info tooltip explaining the metric (house idiom, spec Section 3).
export function MicroLabel({
  label,
  tooltip,
  heading = false,
  size = "default",
}: {
  label: string;
  tooltip?: string;
  /**
   * Size of the micro-label, for one that titles a section rather than
   * captioning a figure.
   *
   * Distinct from `heading`, which drops the mono uppercase idiom entirely for
   * a sans-serif h2. That is right for a panel that is the page's own headline,
   * and wrong for a section sitting among siblings still set as micro-labels:
   * making one of them a sans-serif heading leaves the others looking like its
   * captions. This keeps the family and only changes the size.
   */
  size?: "default" | "large";
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
          : `micro-label${size === "large" ? " micro-label-lg" : ""} relative inline-flex items-center gap-1`
      }
    >
      {label}
      {tooltip ? (
        <button
          type="button"
          aria-label={`About ${label}`}
          // The icon is 11px by design: it sits beside a 0.7rem label and a
          // larger glyph would outweigh the words it annotates. `tap` grows
          // only the hit area, and only on a touch device.
          className="tap text-muted/70 hover:text-primary"
          onMouseEnter={() => setOpen(true)}
          onMouseLeave={() => setOpen(false)}
          onClick={() => setOpen((v) => !v)}
        >
          {/* Scales with the label, or a larger title gets a pinhead icon. */}
          <svg
            width={size === "large" ? 13 : 11}
            height={size === "large" ? 13 : 11}
            viewBox="0 0 24 24"
            fill="none"
            stroke="currentColor"
            strokeWidth="2"
          >
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
