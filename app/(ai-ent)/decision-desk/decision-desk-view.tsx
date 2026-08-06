"use client";

import { Suspense, useState } from "react";
import { InterrogateView } from "./interrogate-view";
import { AssessDecideView } from "./assess-decide-view";
import type { ShellFixture } from "@/lib/shell-fixture";

// A third step, the sourcing shortlist, briefly sat here (6 August 2026) and
// moved to Trust Rank the same day with the rest of the Security Desk
// material. It ranks vendors on their published contract terms, which is the
// Trust Rank question; these two steps are about the reader's own situation
// and their own weights.

type Tool = "finding" | "assess";

// The Decision Desk holds the two converging tools that used to be separate
// tabs: Interrogate (a situation in, a source-cited finding out) and Assess
// and Decide (your weights in, a derivable score out). They are two halves of
// the same moment , the call a CIO has to defend, and separating them made
// each look like a destination rather than a step.
//
// Both stay mounted and the inactive one is hidden, not unmounted: the
// interrogation is a conversation, and switching to the scoring tool must not
// throw it away.
export function DecisionDeskView({
  assessment,
  initialTool,
  liveKey = false,
}: {
  assessment: ShellFixture["assess"]["assessment"];
  initialTool: Tool;
  /** Whether a live analyst key is configured. Read on the server; the key
      itself never crosses this boundary. */
  liveKey?: boolean;
}) {
  const [tool, setTool] = useState<Tool>(initialTool);

  const pill = (id: Tool, label: string, sub: string) => (
    <button
      type="button"
      onClick={() => setTool(id)}
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
      <div className="grid grid-cols-1 gap-2 sm:grid-cols-2">
        {pill(
          "finding",
          "1 · The cited finding",
          "Describe your situation, answer sharp questions, and get a finding where every claim carries a source."
        )}
        {pill(
          "assess",
          "2 · The weighted score",
          "Set the weights to your priorities and read the score with its full derivation. The scores never move, only your weights do."
        )}
      </div>

      <div className={tool === "finding" ? "" : "hidden"}>
        <Suspense>
          <InterrogateView liveKey={liveKey} />
        </Suspense>
      </div>
      <div className={tool === "assess" ? "" : "hidden"}>
        <AssessDecideView assessment={assessment} />
      </div>
    </div>
  );
}
