"use client";

import { LaneBadge, SeverityBadge, type Severity } from "@/lib/ui/badges";
import { DerivationDrawer, ScorePill } from "@/lib/ui/score";
import { EmptyState } from "@/lib/ui/page";
import { Accordion } from "@/lib/ui/accordion";
import { MicroLabel } from "@/lib/ui/micro";
import type { GovernancePosture, LensVendor } from "../lens";

function levelSeverity(level: string): Severity {
  const l = level.toLowerCase();
  if (l === "high") return "HIGH";
  if (l === "medium") return "MEDIUM";
  return "LOW";
}

// Governance-posture pattern block, SAMPLE lane. Mirrors the BoardRadar
// /governance-risk response shape so the demo shows the pattern the live
// endpoint fills for universe companies.
export function GovernancePostureBlock({
  vendor,
  posture,
}: {
  vendor: LensVendor;
  posture: GovernancePosture | null;
}) {
  return (
    <section className="rounded-lg border border-base-300 bg-base-100 p-4">
      <div className="flex flex-wrap items-start justify-between gap-2">
        <div>
          <div className="flex items-center gap-2">
            <MicroLabel
              label="Governance posture (pattern)"
              tooltip="This block mirrors the BoardRadar governance-risk response shape: risk score, summary, key findings, recommendations, litigation assessment and activist vulnerability. For vendors outside the BoardRadar universe the content is illustrative SAMPLE."
            />
            <LaneBadge lane="sample" />
          </div>
          <h3 className="mt-1 text-[15px] font-bold">{vendor.name}</h3>
        </div>
        {posture ? (
          <span className="font-mono text-[10px] text-muted">
            Generated {posture.analysisDate}
          </span>
        ) : null}
      </div>

      {posture === null ? (
        <div className="mt-3">
          <EmptyState
            title="Awaiting public disclosure"
            detail={
              vendor.brTicker
                ? `No sample posture is held for ${vendor.name}: BoardRadar carries a live governance-risk analysis for this company (ticker ${vendor.brTicker}) in the company modules, so the demo does not overwrite it with sample content.`
                : `No governance-posture sample is held for ${vendor.name} in this demo, and no public disclosure fills the pattern. Nothing is invented in its place.`
            }
          />
        </div>
      ) : (
        <>
          <div className="mt-3 flex items-center gap-3">
            <div>
              <span className="micro-label">Governance risk score</span>
              <div className="mt-1 flex items-center gap-2">
                <ScorePill score={posture.riskScore} />
                <DerivationDrawer title="How the governance risk score is derived">
                  <p>
                    This block mirrors the BoardRadar governance-risk response
                    shape. For companies in the BoardRadar universe the live
                    endpoint computes the 0 to 100 risk score from filings,
                    litigation exposure, ownership structure and activist
                    vulnerability, and states its own confidence.
                  </p>
                  <p>
                    {posture.vendorName} is outside that universe, so the value
                    shown here is an illustrative SAMPLE that demonstrates the
                    pattern: it is not a measurement, and the badge says so.
                    Where no sample is held either, the block renders an honest
                    empty state instead of a number.
                  </p>
                </DerivationDrawer>
              </div>
            </div>
          </div>

          <p className="mt-3 text-[13px] leading-relaxed text-base-content/85">
            {posture.summary}
          </p>

          <div className="mt-3 space-y-2">
            <Accordion title="Key findings" count={posture.keyFindings.length}>
              <ul className="list-disc space-y-1.5 pl-4 text-[12px] leading-snug text-base-content/85">
                {posture.keyFindings.map((f) => (
                  <li key={f}>{f}</li>
                ))}
              </ul>
            </Accordion>
            <Accordion title="Recommendations" count={posture.recommendations.length}>
              <ul className="list-disc space-y-1.5 pl-4 text-[12px] leading-snug text-base-content/85">
                {posture.recommendations.map((r) => (
                  <li key={r}>{r}</li>
                ))}
              </ul>
            </Accordion>
          </div>

          <div className="mt-3 grid grid-cols-1 gap-3 md:grid-cols-2">
            <div className="rounded-lg border border-base-300 bg-base-100 p-3">
              <div className="flex items-center justify-between gap-2">
                <MicroLabel label="Litigation assessment" />
                <SeverityBadge
                  severity={levelSeverity(posture.litigationAssessment.exposure_level)}
                />
              </div>
              <p className="mt-1 font-mono text-[10px] text-muted">
                {posture.litigationAssessment.active_cases} tracked matters
                (sample count)
              </p>
              <ul className="mt-2 list-disc space-y-1.5 pl-4 text-[12px] leading-snug text-base-content/85">
                {posture.litigationAssessment.key_cases.map((c) => (
                  <li key={c}>{c}</li>
                ))}
              </ul>
            </div>
            <div className="rounded-lg border border-base-300 bg-base-100 p-3">
              <div className="flex items-center justify-between gap-2">
                <MicroLabel label="Activist and investor pressure" />
                <SeverityBadge
                  severity={levelSeverity(posture.activistVulnerability.risk_level)}
                />
              </div>
              <ul className="mt-2 list-disc space-y-1.5 pl-4 text-[12px] leading-snug text-base-content/85">
                {posture.activistVulnerability.likely_targets.map((t) => (
                  <li key={t}>{t}</li>
                ))}
              </ul>
            </div>
          </div>
        </>
      )}
    </section>
  );
}
