import Link from "next/link";
import { MicroLabel } from "@/lib/ui/micro";
import { DerivationDrawer } from "@/lib/ui/score";
import { MarkSeen } from "./mark-seen";
import type { Change } from "@/lib/changes/snapshot";
import type { SinceView } from "@/lib/changes/watchlist";

// The only surface in this product with a reason to be opened daily.
//
// Everything else here is reference: measured against a re-ingest, one dataset
// moves every day (news) and the rest move occasionally or not at all. A
// reference library does not earn a daily visit. A list of what moved against
// vendors the reader chose to watch might.
//
// Two things make it work, and both are easily lost. It has to be dated
// against the reader's own last visit, or every visit shows the same thing and
// returning is unrewarded. And it has to be filtered to what they said they
// cared about, or it is a feed, and feeds lose to email.

const KIND_LABEL: Record<Change["kind"], string> = {
  vendor_score: "Overall score",
  capability_score: "Capability",
  market_share: "Market share",
  narrative_gap: "Narrative gap",
};

function ChangeRow({ c, vendorName }: { c: Change; vendorName: string }) {
  // Direction is not a verdict. A narrative gap widening is bad for a buyer
  // and a capability score rising is good, and the two share an arrow, so the
  // colour says which way the number went and the sentence says what it means.
  const up = c.direction === "up";
  return (
    <li className="flex flex-wrap items-baseline gap-x-2 gap-y-0.5 border-b border-base-300/60 py-2 last:border-0">
      <Link
        href={`/vendor-view/${c.vendorId}`}
        className="text-sm font-semibold text-primary hover:underline"
      >
        {vendorName}
      </Link>
      <span className="text-sm text-muted">{c.label}</span>
      <span className="ml-auto flex items-baseline gap-2 font-mono text-sm">
        <span className="text-muted">
          {c.from} → {c.to}
        </span>
        <span className={`font-bold ${up ? "text-good" : "text-error"}`}>
          {up ? "+" : ""}
          {c.delta}
        </span>
      </span>
    </li>
  );
}

export function SinceLastLook({
  view,
  vendorNames,
  narrative = null,
}: {
  view: SinceView;
  vendorNames: Record<string, string>;
  /**
   * The analyst model's read of what changed since this reader was last here.
   * Null when the model is unavailable or had nothing to work from, in which
   * case the list below stands on its own exactly as it did before.
   */
  narrative?: { headline: string; body: string } | null;
}) {
  const name = (id: string) => vendorNames[id] ?? id;
  const hasWatchlist = view.watchedCount > 0;
  const rows = hasWatchlist ? view.watched : view.everything;
  const firstVisit = view.lastSeen === null;

  return (
    <section className="finding-strong rounded-xl p-5 sm:p-6">
      <MarkSeen />
      <div className="flex flex-wrap items-center justify-between gap-2">
        <MicroLabel
          label={firstVisit ? "What moved recently" : "Since you last looked"}
          tooltip="Figures that changed between data captures. Everything here is a movement, not a level."
          heading
        />
        <span className="font-mono text-xs text-muted">
          {firstVisit
            ? view.latest
              ? `to ${view.latest}`
              : ""
            : `since ${view.lastSeen}`}
        </span>
        {narrative ? (
          <span className="font-mono text-xs text-muted">analyst written</span>
        ) : null}
      </div>

      {/* The model's read of these changes, above the changes themselves. A
          returning reader wants to know which movement deserves their
          attention before they are handed the list of all of them. */}
      {narrative ? (
        <div className="mt-3">
          <p className="measure text-base font-bold leading-snug">
            {narrative.headline}
          </p>
          <p className="measure mt-1 text-sm leading-relaxed text-base-content/80">
            {narrative.body}
          </p>
        </div>
      ) : null}

      {rows.length === 0 ? (
        <p className="measure mt-3 text-sm text-muted">
          {hasWatchlist
            ? `Nothing has moved against your ${view.watchedCount} watched ${view.watchedCount === 1 ? "vendor" : "vendors"} since you were last here. That is a real answer, not an empty state: most figures on this platform move rarely, and a quiet week is worth knowing about.`
            : "No figures have moved since the last capture."}
        </p>
      ) : (
        <>
          <p className="measure mt-2 text-sm text-muted">
            {hasWatchlist
              ? `${rows.length} ${rows.length === 1 ? "change" : "changes"} against the ${view.watchedCount} ${view.watchedCount === 1 ? "vendor" : "vendors"} on your shortlist.`
              : "You have no shortlist yet, so these are the largest moves across the whole tracked set. Add vendors with the + button anywhere they appear and this becomes your list."}
          </p>
          <ul className="mt-3">
            {rows.map((c) => (
              <ChangeRow key={c.key + c.detectedAt} c={c} vendorName={name(c.vendorId)} />
            ))}
          </ul>
        </>
      )}

      <div className="mt-3 flex flex-wrap items-center gap-4">
        <DerivationDrawer title="How movement is detected" trigger="How this is detected">
          <p>
            Each data capture records the value of every watched figure. The
            next capture is compared against it, and anything that moved by more
            than a rounding margin is logged with the date it was detected.
          </p>
          <p className="measure text-muted">
            The upstream cannot be used for this. Its market-share rows ship a
            previousEstimate and a changePct, and the changePct is zero on every
            row because each prior estimate is a copy of the current one. So the
            history is kept here instead.
          </p>
          <p className="measure text-muted">
            A figure that appears or disappears is not reported as a change. An
            arrival has nothing to move from, and a departure usually means the
            source stopped publishing rather than that anything happened.
          </p>
          <p className="measure text-muted">
            Your shortlist is held on this browser, in a cookie, and is not an
            account. Nothing here knows who you are and nothing can be sent to
            you; clearing your browser data clears the list.
          </p>
        </DerivationDrawer>
        {hasWatchlist ? (
          <Link
            href="/shortlist"
            className="text-xs font-semibold text-primary hover:underline"
          >
            Manage your shortlist →
          </Link>
        ) : null}
      </div>
    </section>
  );
}
