"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { MicroLabel } from "@/lib/ui/micro";
import { latestPosition, type SavedPosition } from "@/lib/position/store";
import {
  opportunitiesFor,
  type PositionOpportunities,
} from "@/lib/position/opportunities";
import { useShortlist } from "@/lib/shortlist";

// What the rest of the chain makes relevant here.
//
// Trust Rank already read the shortlist server-side through the cookie, so it
// knew which vendors the reader had approved. It knew nothing about WHY: which
// company, which sector, or which AI areas that sector's workflows put them
// into. So it answered "what does the law put on you" for a generic reader
// while the product held a specific one.
//
// This closes that. It reads the same saved position Your AI Position wrote
// and the same shortlist the Decision Desk filled, and states what they make
// relevant on this page.
//
// IT NARROWS NOTHING. Every obligation and every vendor stays on the page
// below. Filtering a regulatory register down to what we think applies would
// be this product deciding which law a reader is subject to, from a workflow
// tag, which is not a judgement the evidence supports. This says where to look
// first and why, and leaves the register whole.
//
// CLIENT-SIDE, because the position lives in localStorage. The shortlist has a
// cookie mirror and the position does not; adding one is a bigger change than
// this panel needs, and the panel is above the fold either way.

/** Regulatory flags a workflow carries, mapped to the regimes on this page. */
const FLAG_TO_REGIME: Record<string, string> = {
  EU_AI_Act: "EU AI Act",
  GDPR: "EU AI Act",
  HIPAA: "US state and federal AI rules",
  SOX: "US state and federal AI rules",
  CCPA: "CCPA automated decision-making regulations",
  FINRA: "US state and federal AI rules",
  MiFID_II: "EU AI Act",
  BASEL_III: "EU AI Act",
  PCI_DSS: "US state and federal AI rules",
  FERPA: "US state and federal AI rules",
  FDA_21CFR11: "US state and federal AI rules",
  ISO_27001: "Security and assurance standards",
  SOC2: "Security and assurance standards",
};

export function YourExposure() {
  const [position, setPosition] = useState<SavedPosition | null>(null);
  const [opp, setOpp] = useState<PositionOpportunities | null>(null);
  const { ids, ready } = useShortlist();

  // After mount: localStorage does not exist during the server render.
  useEffect(() => {
    const p = latestPosition();
    setPosition(p);
    setOpp(p ? opportunitiesFor(p) : null);
  }, []);

  // Nothing carried and nothing approved is the ordinary first visit. A panel
  // saying so on every load is a standing apology for an unused feature.
  if (!position && (!ready || ids.length === 0)) return null;

  const regimes = opp
    ? [...new Set(opp.regulatoryFlags.map((f) => FLAG_TO_REGIME[f]).filter(Boolean))]
    : [];

  return (
    <section className="rounded-lg border border-insight/30 bg-insight/[0.06] p-4">
      <MicroLabel
        label="What your own work makes relevant here"
        tooltip="Read from the company you researched on Your AI Position and the vendors you approved on the Decision Desk. Nothing on this page is hidden or filtered as a result."
      />

      <ul className="mt-2 space-y-1.5 text-sm">
        {position ? (
          <li className="measure">
            You researched{" "}
            <strong className="font-semibold">{position.name}</strong>
            {opp ? (
              <>
                , placed in {opp.sectorLabel.toLowerCase()}. Its lead AI areas
                are{" "}
                <strong className="font-semibold">
                  {opp.lead.map((a) => a.label.toLowerCase()).join(", ")}
                </strong>
                , carrying {opp.topRisk} risk.
              </>
            ) : (
              <>. No sector was established, so no areas are named.</>
            )}
          </li>
        ) : null}

        {regimes.length > 0 ? (
          <li className="measure">
            Those areas carry{" "}
            <strong className="font-semibold">
              {opp?.regulatoryFlags.join(", ")}
            </strong>
            , which points first at {regimes.join(" and ")} in the obligations
            below. Every other regime is still listed: this is where to start,
            not a ruling on what binds you.
          </li>
        ) : null}

        {ready && ids.length > 0 ? (
          <li className="measure">
            <strong className="font-semibold">{ids.length}</strong> vendor
            {ids.length === 1 ? " is" : "s are"} approved on the Decision Desk,
            so the terms and the overnight changes below are already narrowed to
            them.
          </li>
        ) : (
          <li className="measure text-muted">
            No vendors approved yet. The Decision Desk names three and carries
            them here, which narrows the terms and the daily changes to your
            own list.
          </li>
        )}
      </ul>

      <div className="mt-2.5 flex flex-wrap gap-2">
        {!position ? (
          <Link
            href="/company-view"
            className="rounded-full border border-primary px-3 py-1 text-xs font-semibold text-primary transition hover:bg-primary hover:text-white"
          >
            Research your company
          </Link>
        ) : null}
        {ready && ids.length === 0 ? (
          <Link
            href="/decision-desk"
            className="rounded-full border border-primary px-3 py-1 text-xs font-semibold text-primary transition hover:bg-primary hover:text-white"
          >
            Get your three vendors
          </Link>
        ) : null}
      </div>
    </section>
  );
}
