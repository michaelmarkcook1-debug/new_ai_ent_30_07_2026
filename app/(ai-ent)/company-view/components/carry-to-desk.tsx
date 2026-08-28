"use client";

import { useRouter } from "next/navigation";
import { useState } from "react";
import { savePosition, type SavedPosition } from "@/lib/position/store";

// Its own file, and its own client boundary.
//
// `researched-company.tsx` is imported by the client research runner AND by
// the server-rendered Governance tab, so it cannot hold a client hook: marking
// that whole file "use client" would pull the entire research view into the
// browser bundle for a page that only server-renders it. The one interactive
// control lives here instead, which is the boundary Next actually wants.

/**
 * The button that carries this company to the Decision Desk.
 *
 * IT USED TO CARRY NOTHING. This was a bare link to /decision-desk, and the
 * desk opens on `latestPosition()`: the most recently SAVED company. A reader
 * who researched Boots and pressed a button saying "Take this to the Decision
 * Desk" arrived at a box prefilled with whichever company they had saved
 * previously, which for the reader who reported it was Fortnum & Mason from
 * three weeks earlier. The label promised a handoff the link could not perform,
 * and the failure was invisible: the desk looked like it had worked.
 *
 * Saving here does not contradict the rule that research is never retained
 * automatically. That rule exists so a tool does not quietly keep what you
 * typed. Pressing a button that says "take this" is the reader asking for
 * exactly that, and it is the same act the Save control beside it performs,
 * whose own copy says the point of saving is that "the Decision Desk opens
 * with this company already in the box".
 */
export function CarryToDesk({ position }: { position: SavedPosition }) {
  const router = useRouter();
  const [failed, setFailed] = useState(false);

  const carry = () => {
    // Saved before navigating, not after: the desk reads the store on mount,
    // so a save that lost the race would land the reader on the old company
    // again and look exactly like the bug this replaced.
    if (!savePosition(position)) {
      setFailed(true);
      return;
    }
    router.push("/decision-desk");
  };

  return (
    <>
      <button
        type="button"
        onClick={carry}
        className="tap mt-2 inline-block rounded-full border border-primary px-3 py-1 text-xs font-semibold text-primary transition hover:bg-primary hover:text-white"
      >
        Take this to the Decision Desk
      </button>
      {failed ? (
        <p className="mt-1.5 measure text-xs text-error">
          This browser would not store {position.name}, so the Decision Desk
          would open on the wrong company. Saving is blocked or the store is
          full.
        </p>
      ) : null}
    </>
  );
}
