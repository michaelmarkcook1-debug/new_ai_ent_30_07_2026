"use client";

import { useState } from "react";
import { createPortal } from "react-dom";
import { scoreBand } from "@/lib/provenance";
import { MicroLabel } from "@/lib/ui/micro";

// Score pill: 0 to 100, coloured green, amber or red by band. Estimated
// values carry a visible "est." suffix; unavailable values render a locked
// state instead of a number (spec Section 3, rule 4 made visible).
export function ScorePill({
  score,
  estimated,
  lockedLabel,
  onClick,
  invert = false,
}: {
  score: number | null;
  estimated?: boolean;
  lockedLabel?: string;
  onClick?: () => void;
  // For lower-is-better values (threat, risk): flips the colour band while
  // displaying the raw value unchanged.
  invert?: boolean;
}) {
  if (score === null || score === undefined) {
    return (
      <span
        className="inline-flex items-center gap-1 rounded-full bg-base-200 px-2 py-0.5 font-mono text-xs text-muted"
        title="No disclosure available; AG does not invent figures"
      >
        <svg width="10" height="10" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
          <rect x="5" y="11" width="14" height="9" rx="2" />
          <path d="M8 11V7a4 4 0 0 1 8 0v4" />
        </svg>
        {lockedLabel ?? "No disclosure"}
      </span>
    );
  }
  const band = scoreBand(invert ? 100 - score : score);
  const styles = {
    good: "bg-good-bg text-good",
    warn: "bg-warn-bg text-warn",
    bad: "bg-bad-bg text-error",
  } as const;
  const Tag = onClick ? "button" : "span";
  // Upstream sometimes returns a raw quotient (53.33333333333333). Printing
  // every digit claims a precision the measurement does not have, so the
  // display rounds to one decimal and drops a trailing zero. The full value
  // stays in the title for anyone who needs it.
  const shown = Number.isInteger(score)
    ? String(score)
    : String(Math.round(score * 10) / 10);
  return (
    <Tag
      {...(onClick ? { onClick, type: "button" as const } : {})}
      title={shown === String(score) ? undefined : `Exact value: ${score}`}
      className={`inline-flex items-center rounded-full px-2 py-0.5 font-mono text-xs font-semibold ${styles[band]} ${onClick ? "cursor-pointer hover:ring-1 hover:ring-primary" : ""}`}
    >
      {shown}
      {estimated ? <span className="ml-0.5 font-normal opacity-75">est.</span> : null}
    </Tag>
  );
}

// KPI gauge card: circular gauge, large figure, delta versus last quarter
// with a direction arrow, one-line plain-English definition underneath.
export function KpiGauge({
  label,
  tooltip,
  score,
  delta,
  definition,
  badge,
  invert = false,
}: {
  label: string;
  tooltip?: string;
  score: number | null;
  delta?: number | null;
  definition: string;
  badge?: React.ReactNode;
  // For lower-is-better metrics (risk scores): flips the band colouring
  // without changing the displayed value.
  invert?: boolean;
}) {
  const band = score === null ? null : scoreBand(invert ? 100 - score : score);
  const colour =
    band === "good"
      ? "var(--ag-green)"
      : band === "warn"
        ? "var(--ag-amber)"
        : band === "bad"
          ? "var(--ag-error)"
          : "var(--ag-base-300)";
  const r = 26;
  const c = 2 * Math.PI * r;
  const filled = score === null ? 0 : (score / 100) * c;
  // The band was drawn on the gauge ring and nowhere else, so a card had to be
  // read before it could be sorted. The border carries it too, which makes a
  // strip of these scannable at a glance. No band and no score means no colour
  // claimed: an absent reading is not a neutral one.
  const BAND_RULE = {
    good: "border-good/55",
    warn: "border-warn/55",
    bad: "border-error/55",
  } as const;
  return (
    <div
      className={`rounded-lg border-2 bg-base-100 p-5 ${
        band ? BAND_RULE[band] : "border-base-300"
      }`}
    >
      <div className="flex flex-wrap items-start justify-between gap-2">
        <MicroLabel label={label} tooltip={tooltip} />
        {badge}
      </div>
      <div className="mt-2 flex items-center gap-3">
        <svg width="64" height="64" viewBox="0 0 64 64" aria-hidden>
          <circle cx="32" cy="32" r={r} fill="none" stroke="var(--ag-base-300)" strokeWidth="6" opacity="0.5" />
          <circle
            cx="32"
            cy="32"
            r={r}
            fill="none"
            stroke={colour}
            strokeWidth="6"
            strokeDasharray={`${filled} ${c - filled}`}
            strokeLinecap="round"
            transform="rotate(-90 32 32)"
          />
        </svg>
        <div>
          <div className="font-mono text-3xl font-bold leading-none">
            {score === null ? <span className="text-lg text-muted">n/a</span> : score}
          </div>
          {typeof delta === "number" ? (
            <div
              className={`mt-1 flex items-center gap-0.5 font-mono text-xs ${
                delta === 0
                  ? "text-muted"
                  : (delta > 0) !== invert
                    ? "text-good"
                    : "text-error"
              }`}
            >
              {delta > 0 ? "▲" : delta < 0 ? "▼" : "▬"} {delta > 0 ? "+" : ""}
              {delta} vs last quarter
            </div>
          ) : null}
        </div>
      </div>
      <p className="measure mt-2 text-xs leading-snug text-muted">{definition}</p>
    </div>
  );
}

// "How this is derived" drawer: every score opens one (spec rule 4).
export function DerivationDrawer({
  title,
  children,
  trigger,
}: {
  title: string;
  children: React.ReactNode;
  trigger?: React.ReactNode;
}) {
  const [open, setOpen] = useState(false);

  // The panel renders into document.body rather than in place. The page's
  // content column is a container query root, and container-type carries
  // `contain: layout`, which makes any ancestor of a fixed element its
  // containing block. Left inline, this drawer would be trapped inside the
  // centred column instead of covering the viewport.
  const panel = (
    <div className="fixed inset-0 z-50 flex justify-end bg-black/40" onClick={() => setOpen(false)}>
      <aside
        className="h-full w-full max-w-md overflow-y-auto border-l border-base-300 bg-base-100 p-6 shadow-2xl"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="flex items-center justify-between">
          <h3 className="text-base font-bold">{title}</h3>
          <button
            type="button"
            aria-label="Close"
            onClick={() => setOpen(false)}
            className="rounded p-1 text-muted hover:bg-base-200"
          >
            <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
              <path d="M18 6 6 18M6 6l12 12" />
            </svg>
          </button>
        </div>
        <div className="mt-3 space-y-3 text-sm leading-relaxed">{children}</div>
      </aside>
    </div>
  );

  return (
    <>
      <button
        type="button"
        onClick={() => setOpen(true)}
        className="inline-flex items-center gap-1 text-xs text-primary hover:underline"
      >
        {trigger ?? "How this is derived"}
      </button>
      {open ? createPortal(panel, document.body) : null}
    </>
  );
}
