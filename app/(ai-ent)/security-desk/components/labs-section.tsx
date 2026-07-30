import { LaneBadge, ProvenanceBadge } from "@/lib/ui/badges";
import { ScorePill, DerivationDrawer } from "@/lib/ui/score";
import { MicroLabel } from "@/lib/ui/micro";
import { Accordion } from "@/lib/ui/accordion";
import type { LabPostureCard } from "../types";

// Sample half of The Security Desk: private AI labs sit outside the probed
// BoardRadar universe, so these cards carry no score, no incidents and no
// findings. They mirror the /cyber-risk schema shape with sample-lane
// posture prompts only.
export function LabsSection({ labs }: { labs: LabPostureCard[] }) {
  return (
    <section>
      <div className="flex items-center gap-2">
        <h2 className="text-[15px] font-bold">Private AI labs</h2>
        <LaneBadge lane="sample" />
      </div>
      <p className="mt-1 max-w-3xl text-[12px] text-muted">
        Anthropic, OpenAI, xAI, Mistral and Cohere sit outside the probed
        BoardRadar universe, so there is no live cyber analysis to show. The
        cards below are illustrative posture prompts for a buyer&apos;s own
        diligence: they make no findings, list no incidents and score nothing.
      </p>
      <div className="mt-3 grid grid-cols-1 gap-3 md:grid-cols-2 xl:grid-cols-3">
        {labs.map((lab) => (
          <article
            key={lab.id}
            className="flex flex-col gap-2.5 rounded-lg border border-base-300 bg-base-100 p-4"
          >
            <div className="flex items-start justify-between gap-2">
              <h3 className="text-[13px] font-bold">{lab.name}</h3>
              <LaneBadge lane="sample" />
            </div>
            <div className="flex flex-wrap items-center gap-2">
              <ScorePill score={lab.riskScore} lockedLabel="Not scored" />
              <DerivationDrawer title={`Why ${lab.name} has no score`}>
                <p>{lab.summary}</p>
                <p>{lab.threatLandscape}</p>
                <p>{lab.complianceStatus}</p>
                <p className="text-muted">
                  When BoardRadar coverage lands for private labs, the same
                  cyber risk analysis and score shown for the public platform
                  vendors will appear here. Until then no score is shown,
                  because inventing one would be fabrication.
                </p>
              </DerivationDrawer>
            </div>
            <p className="text-[12px] leading-relaxed text-muted">{lab.summary}</p>
            <div>
              <MicroLabel
                label="Assessment scope"
                tooltip="What The Security Desk would assess for this vendor once independent coverage exists. Illustrative, not a finding."
              />
              <p className="mt-1 text-[12px] leading-relaxed">{lab.securityPosture}</p>
            </div>
            <Accordion title="What to verify" count={lab.keyFindings.length}>
              <ul className="list-disc space-y-1 pl-4 text-[12px] leading-relaxed">
                {lab.keyFindings.map((item) => (
                  <li key={item}>{item}</li>
                ))}
              </ul>
            </Accordion>
            <Accordion title="Diligence recommendations" count={lab.recommendations.length}>
              <ul className="list-disc space-y-1 pl-4 text-[12px] leading-relaxed">
                {lab.recommendations.map((item) => (
                  <li key={item}>{item}</li>
                ))}
              </ul>
            </Accordion>
            <p className="text-[11px] text-muted">
              No incident or vulnerability claims: nothing verified exists to
              show, and nothing is invented in its place.
            </p>
            <div className="mt-auto border-t border-base-300 pt-2">
              <span className="micro-label">Where to verify</span>
              <ul className="mt-1 space-y-0.5 text-[11px] text-muted">
                {lab.evidenceSources.map((src) => (
                  <li key={src}>{src}</li>
                ))}
              </ul>
              <div className="mt-2">
                <ProvenanceBadge env={lab.provenance} />
              </div>
            </div>
          </article>
        ))}
      </div>
    </section>
  );
}
