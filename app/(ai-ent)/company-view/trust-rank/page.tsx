import { LaneBadge } from "@/lib/ui/badges";
import { Accordion } from "@/lib/ui/accordion";
import { DerivationDrawer, KpiGauge } from "@/lib/ui/score";
import { MicroLabel } from "@/lib/ui/micro";
import { loadShellFixture } from "../data";

export const metadata = { title: "Trust Rank: Shell | AI Enterprise" };

function StatusChip({ status }: { status: string }) {
  const inForce = status.toLowerCase().includes("in force") || status.toLowerCase().includes("enacted");
  const guidance = status.toLowerCase().includes("guidance") || status.toLowerCase().includes("evolving");
  return (
    <span
      className={`inline-flex whitespace-nowrap rounded-full px-2 py-0.5 font-mono text-[10px] font-semibold ${
        inForce ? "bg-bad-bg text-error" : guidance ? "bg-base-200 text-muted" : "bg-warn-bg text-warn"
      }`}
      title={inForce ? "Binding obligations apply" : guidance ? "Non-binding or evolving" : "Enacted, application phasing in"}
    >
      {status}
    </span>
  );
}

// Governance posture (mirrors /governance-risk) plus the regulatory grid
// seeded from AIE legislation material (spec Section 5). One of the two
// moments that sell the product; the grid answers "what binds us, where".
export default async function TrustRankPage() {
  const f = await loadShellFixture();
  const g = f.trustRank.governance;
  return (
    <div className="space-y-4">
      <section className="grid grid-cols-1 gap-4 lg:grid-cols-3">
        <KpiGauge
          label="GOVERNANCE RISK"
          tooltip="0 to 100, higher means more governance risk in AI deployment. Mirrors the live governance-risk composite."
          score={g.riskScore}
          definition="0 to 100, lower is better. AI governance risk for this organisation."
          badge={<LaneBadge lane="sample" />}
          invert
        />
        <div className="rounded-lg border border-base-300 bg-base-100 p-4 lg:col-span-2">
          <div className="flex items-center justify-between">
            <MicroLabel label="Posture summary" tooltip="Narrative mirror of the live governance-risk summary field." />
            <LaneBadge lane="sample" />
          </div>
          <p className="mt-2 text-[13px] leading-relaxed">{g.summary}</p>
          <div className="mt-2">
            <DerivationDrawer title="How the governance score is derived">
              <p>
                Mirrors GET /governance-risk: a 0 to 100 composite over control
                effectiveness, disclosure quality, litigation exposure and
                AI-specific assurance gaps, each confidence labelled. SAMPLE
                for the exemplar buyer.
              </p>
            </DerivationDrawer>
          </div>
        </div>
      </section>

      <section className="grid grid-cols-1 gap-3 lg:grid-cols-2">
        <Accordion title="Key Findings" count={g.keyFindings.length} defaultOpen>
          <ul className="list-disc space-y-1.5 pl-4 text-[12.5px]">
            {g.keyFindings.map((k) => <li key={k}>{k}</li>)}
          </ul>
        </Accordion>
        <Accordion title="Recommendations" count={g.recommendations.length}>
          <ul className="list-disc space-y-1.5 pl-4 text-[12.5px]">
            {g.recommendations.map((k) => <li key={k}>{k}</li>)}
          </ul>
        </Accordion>
      </section>

      {/* The regulatory grid */}
      <section className="rounded-lg border border-base-300 bg-base-100">
        <div className="flex flex-wrap items-center justify-between gap-2 border-b border-base-300 px-3 py-2">
          <MicroLabel
            label="Regulatory grid"
            tooltip="AI regulation by jurisdiction and what it means for this organisation's deployments. Rows seeded from the AIE legislation material are badged AIE dataset; the rest are SAMPLE."
          />
          <div className="flex items-center gap-1.5">
            <LaneBadge lane="aie" />
            <LaneBadge lane="sample" />
          </div>
        </div>
        <div className="overflow-x-auto">
          <table className="w-full text-left">
            <thead>
              <tr className="border-b border-base-300">
                <th className="px-3 py-2 font-mono text-[10px] uppercase tracking-wider text-muted">Jurisdiction</th>
                <th className="px-3 py-2 font-mono text-[10px] uppercase tracking-wider text-muted">Regime</th>
                <th className="px-3 py-2 font-mono text-[10px] uppercase tracking-wider text-muted">Status</th>
                <th className="px-3 py-2 font-mono text-[10px] uppercase tracking-wider text-muted">What it means here</th>
                <th className="px-3 py-2 font-mono text-[10px] uppercase tracking-wider text-muted">Source</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-base-300">
              {f.trustRank.regulatoryGrid.map((r) => (
                <tr key={r.jurisdiction} className="align-top hover:bg-base-200/60">
                  <td className="px-3 py-2.5 text-[12.5px] font-bold whitespace-nowrap">{r.jurisdiction}</td>
                  <td className="px-3 py-2.5 text-[12px]">{r.regime}</td>
                  <td className="px-3 py-2.5"><StatusChip status={r.status} /></td>
                  <td className="px-3 py-2.5 max-w-md text-[12px] text-muted">{r.note}</td>
                  <td className="px-3 py-2.5"><LaneBadge lane={r.aieSource ? "aie" : "sample"} /></td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </section>

      {/* Vendor-specific rulings */}
      <section className="rounded-lg border border-base-300 bg-base-100 p-4">
        <div className="flex items-center justify-between">
          <MicroLabel label="Vendor-specific rulings and controls" tooltip="Regulatory items that attach to vendors rather than jurisdictions." />
        </div>
        <div className="mt-2 grid grid-cols-1 gap-2 sm:grid-cols-2">
          {f.trustRank.vendorRulings.map((v) => (
            <div key={v.item} className="rounded border border-base-300 p-3">
              <div className="flex items-center justify-between gap-2">
                <span className="text-[12px] font-semibold">{v.vendor}</span>
                <LaneBadge lane={v.aieSource ? "aie" : "sample"} />
              </div>
              <p className="mt-0.5 text-[12px] font-medium text-primary">{v.item}</p>
              <p className="mt-1 text-[11.5px] text-muted">{v.note}</p>
            </div>
          ))}
        </div>
      </section>
    </div>
  );
}
