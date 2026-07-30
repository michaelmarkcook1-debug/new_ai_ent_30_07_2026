import { LaneBadge } from "@/lib/ui/badges";
import { Accordion } from "@/lib/ui/accordion";
import { KpiGauge, DerivationDrawer, ScorePill } from "@/lib/ui/score";
import { MicroLabel } from "@/lib/ui/micro";
import { loadShellFixture } from "../data";

export const metadata = { title: "AI Exposure: Shell | New AI.Ent" };

// Mirrors the /ai-exposure response shape (riskScore, opportunityScore,
// aiReadinessScore, comparisonTable, keyFindings, recommendations) with a
// function-level exposure table for the buyer.
export default async function AiExposurePage() {
  const f = await loadShellFixture();
  const e = f.aiExposure;
  return (
    <div className="space-y-4">
      <section className="grid grid-cols-1 gap-3 sm:grid-cols-3">
        <KpiGauge
          label="AI OPPORTUNITY"
          tooltip="0 to 100, higher means AI helps this organisation more."
          score={e.opportunityScore}
          definition="0 to 100, higher is stronger. Where AI helps the functions."
          badge={<LaneBadge lane="sample" />}
        />
        <KpiGauge
          label="AI THREAT"
          tooltip="0 to 100, higher means more disruption to current ways of working."
          score={e.riskScore}
          definition="0 to 100, higher means more disruption risk."
          badge={<LaneBadge lane="sample" />}
          invert
        />
        <KpiGauge
          label="AI READINESS"
          tooltip="0 to 100, higher means better prepared to deploy at scale."
          score={e.aiReadinessScore}
          definition="0 to 100, higher is more ready."
          badge={<LaneBadge lane="sample" />}
        />
      </section>
      <div className="-mt-2 flex items-center gap-3">
        <DerivationDrawer title="How the exposure scores are derived">
          <p>
            The three headline scores mirror the live AI Exposure composite:
            function-level opportunity and threat signals, weighted by
            headcount and evidenced deployments, rolled up 0 to 100.
            Values are SAMPLE for the exemplar buyer.
          </p>
          <p className="text-muted">
            Shape mirrors GET /ai-exposure exactly, so a live buyer swap
            changes data, not code.
          </p>
        </DerivationDrawer>
      </div>

      <section className="rounded-lg border border-base-300 bg-base-100 p-4">
        <p className="text-[13px] leading-relaxed">{e.summary}</p>
      </section>

      <section className="rounded-lg border border-base-300 bg-base-100">
        <div className="flex items-center justify-between border-b border-base-300 px-3 py-2">
          <MicroLabel
            label="Function exposure"
            tooltip="Per function: how much AI helps versus threatens current workflows, 0 to 100."
          />
          <LaneBadge lane="sample" />
        </div>
        <div className="overflow-x-auto">
          <table className="w-full text-left">
            <thead>
              <tr className="border-b border-base-300">
                <th className="px-3 py-2 font-mono text-[10px] uppercase tracking-wider text-muted">Function</th>
                <th className="px-3 py-2 font-mono text-[10px] uppercase tracking-wider text-muted">Helps</th>
                <th className="px-3 py-2 font-mono text-[10px] uppercase tracking-wider text-muted">Threatens</th>
                <th className="px-3 py-2 font-mono text-[10px] uppercase tracking-wider text-muted">Reading</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-base-300">
              {e.functionExposure.map((row) => (
                <tr key={row.function} className="hover:bg-base-200/60">
                  <td className="px-3 py-2 text-[12.5px] font-semibold">{row.function}</td>
                  <td className="px-3 py-2"><ScorePill score={row.helps} /></td>
                  <td className="px-3 py-2"><ScorePill score={row.threatens} invert /></td>
                  <td className="px-3 py-2 text-[11.5px] text-muted">{row.note}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </section>

      <section className="rounded-lg border border-base-300 bg-base-100">
        <div className="flex items-center justify-between border-b border-base-300 px-3 py-2">
          <MicroLabel label="Peer comparison" tooltip="Delivery efficiency and AI strategy benchmark versus anonymised sector peers." />
          <LaneBadge lane="sample" />
        </div>
        <table className="w-full text-left">
          <thead>
            <tr className="border-b border-base-300">
              <th className="px-3 py-2 font-mono text-[10px] uppercase tracking-wider text-muted">Company</th>
              <th className="px-3 py-2 font-mono text-[10px] uppercase tracking-wider text-muted">Delivery efficiency</th>
              <th className="px-3 py-2 font-mono text-[10px] uppercase tracking-wider text-muted">AI strategy benchmark</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-base-300">
            {e.comparisonTable.map((c) => (
              <tr key={c.ticker} className={c.isMainCompany ? "bg-primary/5" : ""}>
                <td className="px-3 py-2 text-[12.5px] font-semibold">
                  {c.name}
                  {c.isMainCompany ? (
                    <span className="ml-2 rounded bg-primary px-1.5 py-0.5 font-mono text-[8px] font-bold uppercase text-white">Primary</span>
                  ) : null}
                </td>
                <td className="px-3 py-2"><ScorePill score={c.deliveryEfficiencyScore} estimated /></td>
                <td className="px-3 py-2"><ScorePill score={c.aiStrategyBenchmark} estimated /></td>
              </tr>
            ))}
          </tbody>
        </table>
      </section>

      <section className="grid grid-cols-1 gap-3 lg:grid-cols-2">
        <Accordion title="Key Findings" count={e.keyFindings.length} defaultOpen>
          <ul className="list-disc space-y-1.5 pl-4 text-[12.5px]">
            {e.keyFindings.map((k) => (
              <li key={k}>{k}</li>
            ))}
          </ul>
        </Accordion>
        <Accordion title="Recommendations" count={e.recommendations.length}>
          <ul className="list-disc space-y-1.5 pl-4 text-[12.5px]">
            {e.recommendations.map((k) => (
              <li key={k}>{k}</li>
            ))}
          </ul>
        </Accordion>
      </section>
    </div>
  );
}
