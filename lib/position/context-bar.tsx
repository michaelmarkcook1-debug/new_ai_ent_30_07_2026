"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { useShortlist } from "@/lib/shortlist";
import { vendorName } from "@/lib/aie/vendor-directory";
import { latestPosition, type SavedPosition } from "./store";

// What the reader has established, carried across the section.
//
// The "What should we do about it?" group is five tabs in a deliberate order:
// where do we stand,
// what call do we make, what does it cost for a role, what binds us, and who
// would deliver it. Each one was answering its question in isolation, so a
// reader who had named their company on the first tab had to remember it
// themselves on the other four.
//
// Two things travel, and they are stored separately because they are set at
// different moments by different acts.
//
//   The COMPANY, from Your AI Position, in localStorage. Set once, when the
//   reader saves a researched company.
//
//   The VENDORS, from the Decision Desk, in the shortlist that already existed
//   and that ModelEngine, Trust Rank and Integrators already read. Nothing new
//   was needed for those three: the Decision Desk simply had no way to put
//   anything on it, which is why model-fit.tsx was already captioned "vendors
//   approved on the Decision Desk" while nothing there could approve one.
//
// It renders nothing when nothing is carried. A strip that says "no company
// selected" on every page is a permanent apology for a feature the reader has
// not used yet.

// CARRYING SOMETHING THROUGH HAS TO BE REVERSIBLE FROM WHERE IT IS ANNOUNCED.
//
// This bar told the reader what was being applied on their behalf and gave them
// no way to stop it. On three of the five tabs that was survivable, because the
// tab offered its own way out: ModelEngine answers twice, unconstrained and
// constrained, so the shortlist never hides an answer; Integrators only narrows
// when you ask it to and has "Show all nodes"; the Decision Desk lets you clear
// the offered company off the box it prefilled.
//
// On Trust Rank it was not. The overnight brief silently becomes a verdict on
// your shortlisted vendors instead of the market, the tab invites you to
// shortlist in order to get that, and nothing on the page turns it back off.
//
// So the control belongs here rather than on Trust Rank: it is the one
// component that appears on all five, and it is the thing making the claim.
export function CompanyContextBar({
  /** The tab this is rendered on, so it does not offer to send you where you are. */
  here,
}: {
  here: "position" | "desk" | "engine" | "trust" | "integrators";
}) {
  const { ids, ready, clear } = useShortlist();
  const [position, setPosition] = useState<SavedPosition | null>(null);
  // localStorage does not exist during the server render, so the company is
  // resolved after mount. Until then this renders nothing rather than a
  // placeholder that would shift the page when it resolves.
  const [mounted, setMounted] = useState(false);

  useEffect(() => {
    setPosition(latestPosition());
    setMounted(true);
  }, []);

  if (!mounted || !ready) return null;
  if (!position && ids.length === 0) return null;

  const names = ids.slice(0, 3).map((id) => vendorName(id));
  const more = ids.length - names.length;

  return (
    <section className="mb-4 flex flex-wrap items-center gap-x-3 gap-y-2 rounded-lg border border-insight/30 bg-insight/[0.05] px-4 py-2.5">
      <span className="micro-label text-insight">Carried through</span>

      {position ? (
        <span className="text-sm">
          <span className="font-semibold">{position.name}</span>
          {position.industry ? (
            <span className="text-muted">, {position.industry}</span>
          ) : null}
        </span>
      ) : null}

      {position && ids.length > 0 ? (
        <span className="text-muted" aria-hidden>
          ·
        </span>
      ) : null}

      {ids.length > 0 ? (
        <span className="text-sm">
          <span className="font-semibold">
            {ids.length} vendor{ids.length === 1 ? "" : "s"}
          </span>
          <span className="text-muted">
            {" "}
            taken forward: {names.join(", ")}
            {more > 0 ? ` and ${more} more` : ""}
          </span>
        </span>
      ) : null}

      {/* The way out. Clears the list itself rather than muting it, because a
          muted list is a third state a reader cannot see and would have to
          remember. The vendors are three clicks to rebuild on the Decision
          Desk, and the button says what it does to every tab rather than only
          to this one. */}
      {ids.length > 0 ? (
        <button
          type="button"
          onClick={clear}
          title={
            "Stops these vendors narrowing any tab in this section. Trust Rank goes " +
            "back to a market read rather than a verdict on your list, ModelEngine " +
            "stops answering a second time inside it, and Integrators releases the " +
            "drill. It does not delete anything researched, and you can take them " +
            "forward again from the Decision Desk."
          }
          className="tap rounded-full border border-insight/40 px-2.5 py-0.5 text-xs font-semibold text-insight transition hover:bg-insight/10"
        >
          Stop carrying
        </button>
      ) : null}

      {/* The gap, named, and only where filling it is the obvious next act. */}
      {!position && here !== "position" ? (
        <Link
          href="/company-view"
          className="text-sm text-insight underline underline-offset-2"
        >
          Name your company to carry it through
        </Link>
      ) : null}
      {position && ids.length === 0 && here !== "desk" ? (
        <Link
          href="/decision-desk?tool=shortlist"
          className="text-sm text-insight underline underline-offset-2"
        >
          Pick vendors on the Decision Desk
        </Link>
      ) : null}
    </section>
  );
}
