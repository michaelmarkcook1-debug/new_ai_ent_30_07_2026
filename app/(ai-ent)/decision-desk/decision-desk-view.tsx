"use client";

import { Suspense, useEffect, useRef, useState } from "react";
import { useSearchParams } from "next/navigation";
import { InterrogateView } from "./interrogate-view";
import { AssessDecideView } from "./assess-decide-view";
import { ShortlistView } from "./shortlist-view";
import type { ShellFixture } from "@/lib/shell-fixture";
import type { ShortlistPayload } from "@/lib/desk/shortlist-payload";

// A third step, the sourcing shortlist, briefly sat here (6 August 2026) and
// moved to Trust Rank the same day with the rest of the Security Desk
// material. It ranks vendors on their published contract terms, which is the
// Trust Rank question; these two steps are about the reader's own situation
// and their own weights.

type Tool = "finding" | "assess" | "shortlist";

// The Decision Desk holds the two converging tools that used to be separate
// tabs: Interrogate (a situation in, a source-cited finding out) and Assess
// and Decide (your weights in, a derivable score out). They are two halves of
// the same moment: the call a CIO has to defend, and separating them made
// each look like a destination rather than a step.
//
// Both stay mounted and the inactive one is hidden, not unmounted: the
// interrogation is a conversation, and switching to the scoring tool must not
// throw it away.
export function DecisionDeskView({
  assessment,
  initialTool,
  liveKey = false,
  shortlist,
}: {
  assessment: ShellFixture["assess"]["assessment"];
  initialTool: Tool;
  /** Whether a live analyst key is configured. Read on the server; the key
      itself never crosses this boundary. */
  liveKey?: boolean;
  /** Computed on the server: the vendor directory and the three scoring
      modules behind the composite never reach the browser. */
  shortlist: ShortlistPayload;
}) {
  const [tool, setTool] = useState<Tool>(initialTool);
  const params = useSearchParams();
  const panelRef = useRef<HTMLDivElement>(null);
  // The ?tool= actually acted on.
  //
  // `initialTool` is a useState initial value, so it is read once on mount and
  // a client-side navigation never reaches it. The finding's own "Score it
  // against your weights" link points at /decision-desk?tool=assess, and a
  // reader clicking it is ALREADY on /decision-desk: the URL changed, the
  // server recomputed initialTool, and the step on screen did not move. The
  // link did nothing, from the one place it is most likely to be clicked.
  //
  // Tracks which value was acted on rather than whether any has been, so the
  // reader's own pill clicks are never fought: clicking step 1 while the URL
  // still says assess leaves them on step 1.
  const actedOn = useRef<string | null>(initialTool);

  useEffect(() => {
    const wanted = params.get("tool");
    if (wanted !== "assess" && wanted !== "shortlist" && wanted !== "finding") return;
    if (wanted === actedOn.current) return;
    actedOn.current = wanted;
    setTool(wanted);
    // The links sit at the bottom of a long finding, so switching the step
    // without moving the viewport looks exactly like nothing happening.
    panelRef.current?.scrollIntoView({ behavior: "smooth", block: "start" });
  }, [params]);

  const pill = (id: Tool, label: string, sub: string) => (
    <button
      type="button"
      onClick={() => {
        // Recorded too, so a later link to a step the reader has since moved
        // away from still switches: without this, going to assess by link,
        // clicking back to the finding, then following the same link again
        // would compare equal and do nothing.
        actedOn.current = id;
        setTool(id);
      }}
      aria-pressed={tool === id}
      className={`rounded-lg border px-4 py-2.5 text-left transition ${
        tool === id
          ? "border-primary bg-primary/[0.06]"
          : "border-base-300 bg-base-100 hover:border-primary/50"
      }`}
    >
      <span className={`block text-sm font-bold ${tool === id ? "text-primary" : ""}`}>
        {label}
      </span>
      <span className="mt-0.5 block text-xs text-muted">{sub}</span>
    </button>
  );

  return (
    <div className="space-y-4">
      <div className="grid grid-cols-1 gap-2 sm:grid-cols-3">
        {/* One line each. These carried two-clause descriptions that the page
            subtitle restated above them and each tool restated again on
            opening, so the same three sentences appeared three times before a
            reader had done anything. */}
        {pill("finding", "1 · The cited finding", "Your situation in, a sourced finding out.")}
        {pill("assess", "2 · The weighted score", "Your weights in, a derivable score out.")}
        {pill("shortlist", "3 · Three vendors, and what next", "The three to look at, and the sequence that tests them.")}
      </div>

      <div ref={panelRef} className="scroll-mt-4" />

      <div className={tool === "finding" ? "" : "hidden"}>
        <Suspense>
          <InterrogateView liveKey={liveKey} />
        </Suspense>
      </div>
      <div className={tool === "assess" ? "" : "hidden"}>
        <AssessDecideView assessment={assessment} />
      </div>
      <div className={tool === "shortlist" ? "" : "hidden"}>
        <ShortlistView payload={shortlist} />
      </div>
    </div>
  );
}
