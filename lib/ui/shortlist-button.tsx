"use client";

import { useShortlist, SHORTLIST_MAX } from "@/lib/shortlist";

// Add or remove one vendor from the buyer's shortlist.
//
// Renders nothing until the stored list has been read, so the button never
// flashes the wrong state on first paint.

export function ShortlistButton({
  vendorId,
  name,
  size = "sm",
}: {
  vendorId: string;
  name: string;
  size?: "sm" | "xs";
}) {
  const { has, toggle, ready, full } = useShortlist();
  if (!ready) {
    // Reserve the space so adding the control does not shift the row.
    return <span className={size === "xs" ? "inline-block w-5" : "inline-block w-6"} aria-hidden />;
  }

  const on = has(vendorId);
  const blocked = !on && full;
  const px = size === "xs" ? "h-5 w-5" : "h-6 w-6";

  return (
    <button
      type="button"
      onClick={() => toggle(vendorId)}
      disabled={blocked}
      aria-pressed={on}
      title={
        blocked
          ? `Shortlist is full (${SHORTLIST_MAX}). Remove one first.`
          : on
            ? `Remove ${name} from your shortlist`
            : `Add ${name} to your shortlist`
      }
      className={`inline-flex ${px} shrink-0 items-center justify-center rounded-md border transition ${
        on
          ? "border-primary bg-primary text-white"
          : blocked
            ? "cursor-not-allowed border-base-300 text-muted opacity-40"
            : "border-base-300 text-muted hover:border-primary hover:text-primary"
      }`}
    >
      <svg
        width="12"
        height="12"
        viewBox="0 0 24 24"
        fill="none"
        stroke="currentColor"
        strokeWidth="2.5"
        aria-hidden
      >
        {on ? <path d="M20 6 9 17l-5-5" /> : <path d="M12 5v14M5 12h14" />}
      </svg>
      <span className="sr-only">
        {on ? `Remove ${name} from shortlist` : `Add ${name} to shortlist`}
      </span>
    </button>
  );
}
