"use client";

import { LaneBadge } from "@/lib/ui/badges";
import { DerivationDrawer, ScorePill } from "@/lib/ui/score";
import { EmptyState } from "@/lib/ui/page";
import { MicroLabel } from "@/lib/ui/micro";
import type { VendorPosture } from "@/lib/vendor-posture";
import type { LensVendor } from "../lens";

// Governance posture for the selected vendor, from the real AI Enterprise
// governance capability assessment: a maturity reading, the dataset's own row
// status and evidence grade, the evidence excerpt behind it, and the open
// risks the vendor record lists.
//
// This is an assessment of published governance practice. It is not the
// BoardRadar governance-risk analysis, which covers public companies and
// reports litigation and activist exposure. The two are different
// measurements over different universes and are never merged.

const STATUS_HELP: Record<string, string> = {
  verified: "Checked against a primary source.",
  tested: "Tested against public or proxy evidence.",
  documented: "Recorded from vendor documentation.",
  inferred: "Inferred from adjacent signals: the weakest basis here.",
};

export function GovernancePostureBlock({
  vendor,
  posture,
  lane,
}: {
  vendor: LensVendor;
  posture: VendorPosture | null;
  lane: "aie" | "aie-live";
}) {
  return (
    <section className="rounded-lg border border-base-300 bg-base-100 p-5">
      <div className="flex flex-wrap items-start justify-between gap-2">
        <div>
          <div className="flex items-center gap-2">
            <MicroLabel
              label="Governance posture"
              tooltip="The AI Enterprise governance capability assessment for this vendor: maturity, row status, evidence grade and the evidence excerpt behind it."
            />
            <LaneBadge lane={lane} />
          </div>
          <h3 className="mt-1 text-base font-bold">{vendor.name}</h3>
        </div>
        {posture ? (
          <div className="flex flex-wrap items-center gap-2">
            <ScorePill score={posture.maturity} lockedLabel="Not assessed" />
            <span
              className="font-mono text-xs uppercase tracking-wider text-muted"
              title={
                posture.status
                  ? (STATUS_HELP[posture.status] ?? posture.status)
                  : undefined
              }
            >
              {posture.status ?? "no status"}
              {posture.evidenceGrade ? ` · ${posture.evidenceGrade}` : ""}
            </span>
          </div>
        ) : null}
      </div>

      {posture === null ? (
        <div className="mt-3">
          <EmptyState
            title="No governance assessment recorded"
            detail={`The AI Enterprise dataset holds no governance capability row for ${vendor.name}. Awaiting assessment rather than an estimated posture.`}
          />
        </div>
      ) : (
        <div className="mt-3 space-y-3">
          {posture.note ? (
            <div>
              <MicroLabel
                label="Evidence"
                tooltip="The evidence excerpt the assessment cites for this row, carried across unchanged."
              />
              <p className="measure mt-0.5 text-sm leading-relaxed text-muted">
                {posture.note}
              </p>
            </div>
          ) : (
            <p className="text-sm text-muted">
              No evidence note is recorded against this assessment.
            </p>
          )}

          {posture.riskProfile.length > 0 ? (
            <div>
              <MicroLabel
                label="Open risks on the vendor record"
                tooltip="The risks the vendor record lists, carried across verbatim. Not governance findings made here."
              />
              <ul className="mt-1 flex flex-wrap gap-1">
                {posture.riskProfile.map((r) => (
                  <li
                    key={r}
                    className="rounded-full border border-base-300 px-2 py-0.5 text-xs text-muted"
                  >
                    {r}
                  </li>
                ))}
              </ul>
            </div>
          ) : null}

          <div className="flex flex-wrap items-center justify-between gap-2 border-t border-base-300 pt-2">
            <span className="font-mono text-xs text-muted">
              {posture.lastVerified
                ? `verified ${posture.lastVerified.slice(0, 10)}`
                : "no verification date"}
            </span>
            <DerivationDrawer title="How the governance posture is derived">
              <p>
                The score is the governance capability maturity from the AI
                Enterprise assessment, 0 to 100, with the dataset&apos;s own
                row status and evidence grade beside it. Grades run E1
                (strongest) to E5. The evidence excerpt above is what the
                assessment cites; it is not rewritten here.
              </p>
              <p>
                This is an assessment of published governance practice. It is
                not the BoardRadar governance-risk analysis, which covers
                public companies and reports litigation and activist exposure.
                Those measure different things over different universes, so
                they are shown separately and never combined into one figure.
              </p>
              <p className="measure text-muted">
                A status of inferred means the reading rests on adjacent
                signals rather than a primary source. Where the dataset has no
                row for a vendor, this block says so instead of estimating a
                posture.
              </p>
            </DerivationDrawer>
          </div>
        </div>
      )}
    </section>
  );
}
