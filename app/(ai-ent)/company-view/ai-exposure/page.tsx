import { LaneBadge } from "@/lib/ui/badges";
import { Accordion } from "@/lib/ui/accordion";
import { KpiGauge, DerivationDrawer, ScorePill } from "@/lib/ui/score";
import { MicroLabel } from "@/lib/ui/micro";
import { EmptyState } from "@/lib/ui/page";
import { resolveCompany } from "@/lib/company-source";
import { brServerFetch } from "@/lib/br-server";
import { loadShellFixture } from "../data";
import { CompanyShell } from "../components/company-shell";

export const metadata = { title: "AI Exposure | AI Enterprise" };

interface FunctionExposureRow {
  function: string;
  helps: number;
  threatens: number;
  note: string;
}
interface ComparisonRow {
  ticker: string;
  name: string;
  isMainCompany?: boolean;
  deliveryEfficiencyScore: number | null;
  aiStrategyBenchmark: number | null;
}
interface AiExposure {
  hasAnalysis?: boolean;
  companyName?: string;
  riskScore: number | null;
  opportunityScore: number | null;
  aiReadinessScore: number | null;
  summary: string;
  comparisonTable: ComparisonRow[];
  functionExposure?: FunctionExposureRow[];
  keyFindings: string[];
  recommendations: string[];
}

// The /ai-exposure tab. For the Shell exemplar this renders the sample
// fixture; for a BoardRadar-covered company it renders the live response,
// which carries the same field names. Function exposure is fixture-only:
// the live endpoint does not return it, so that table is shown only when the
// data actually contains it rather than being filled with estimates.
export default async function AiExposurePage({
  searchParams,
}: {
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}) {
  const params = await searchParams;
  const company = resolveCompany(params.company);

  let e: AiExposure | null;
  let live = false;

  if (company.live && company.ticker) {
    const res = await brServerFetch<AiExposure>("ai-exposure", {
      ticker: company.ticker,
    });
    live = res.source === "live";
    e = res.data;
    if (e && e.hasAnalysis === false) {
      return (
        <CompanyShell company={company} displayName={e.companyName}>
          <EmptyState
            title={`No AI exposure analysis for ${company.ticker}`}
            detail="This company resolves in the API but carries no exposure analysis. Awaiting coverage rather than an estimated score."
          />
        </CompanyShell>
      );
    }
    if (!e) {
      return (
        <CompanyShell company={company}>
          <EmptyState
            title={`AI exposure unavailable for ${company.ticker}`}
            detail="The live call did not answer and no recorded response exists for this company."
          />
        </CompanyShell>
      );
    }
  } else {
    const f = await loadShellFixture();
    e = f.aiExposure;
  }

  const lane = company.live ? (live ? "live" : "mock") : "sample";
  const scoreNote = company.live
    ? "Values as returned by the endpoint."
    : "Values are SAMPLE for the exemplar buyer.";

  return (
    <CompanyShell company={company} displayName={e.companyName}>
    <div className="space-y-4">
      <section className="grid grid-cols-1 gap-3 @3xl:grid-cols-3">
        <KpiGauge
          label="AI OPPORTUNITY"
          tooltip="0 to 100, higher means AI helps this organisation more."
          score={e.opportunityScore}
          definition="0 to 100, higher is stronger. Where AI helps the functions."
          badge={<LaneBadge lane={lane} />}
        />
        <KpiGauge
          label="AI THREAT"
          tooltip="0 to 100, higher means more disruption to current ways of working."
          score={e.riskScore}
          definition="0 to 100, higher means more disruption risk."
          badge={<LaneBadge lane={lane} />}
          invert
        />
        <KpiGauge
          label="AI READINESS"
          tooltip="0 to 100, higher means better prepared to deploy at scale."
          score={e.aiReadinessScore}
          definition="0 to 100, higher is more ready."
          badge={<LaneBadge lane={lane} />}
        />
      </section>
      <div className="-mt-2 flex items-center gap-3">
        <DerivationDrawer title="How the exposure scores are derived">
          <p>
            The three headline scores are the endpoint&apos;s own
            <code> opportunityScore</code>, <code>riskScore</code> and{" "}
            <code>aiReadinessScore</code>, each 0 to 100. AI threat is banded
            inverted, because a higher figure is worse. {scoreNote}
          </p>
          <p className="text-muted">
            {company.live
              ? "This tab is running against a company in the BoardRadar universe, so these are live figures, not a pattern."
              : "Shell is not in the coverage universe, so this is sample content shaped exactly like GET /ai-exposure. Pick a covered company in the header to see the same tab on live data."}
          </p>
        </DerivationDrawer>
      </div>

      <section className="rounded-lg border border-base-300 bg-base-100 p-5">
        <p className="measure text-sm leading-relaxed">{e.summary}</p>
      </section>

      {e.functionExposure && e.functionExposure.length > 0 ? (
        <section className="rounded-lg border border-base-300 bg-base-100">
          <div className="flex items-center justify-between border-b border-base-300 px-3 py-2.5">
            <MicroLabel
              label="Function exposure"
              tooltip="Per function: how much AI helps versus threatens current workflows, 0 to 100."
            />
            <LaneBadge lane={lane} />
          </div>
          <div className="overflow-x-auto">
            <table className="w-full text-left">
              <thead>
                <tr className="border-b border-base-300">
                  <th className="px-3 py-2.5 font-mono text-xs uppercase tracking-wider text-muted">
                    Function
                  </th>
                  <th className="px-3 py-2.5 font-mono text-xs uppercase tracking-wider text-muted">
                    Helps
                  </th>
                  <th className="px-3 py-2.5 font-mono text-xs uppercase tracking-wider text-muted">
                    Threatens
                  </th>
                  <th className="px-3 py-2.5 font-mono text-xs uppercase tracking-wider text-muted">
                    Reading
                  </th>
                </tr>
              </thead>
              <tbody className="divide-y divide-base-300">
                {e.functionExposure.map((row) => (
                  <tr key={row.function} className="hover:bg-base-200/60">
                    <td className="px-3 py-2.5 text-sm font-semibold">
                      {row.function}
                    </td>
                    <td className="px-3 py-2.5">
                      <ScorePill score={row.helps} />
                    </td>
                    <td className="px-3 py-2.5">
                      <ScorePill score={row.threatens} invert />
                    </td>
                    <td className="px-3 py-2.5 text-xs text-muted">
                      {row.note}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </section>
      ) : company.live ? (
        <section className="rounded-lg border border-dashed border-base-300 px-3 py-4">
          <p className="measure text-xs text-muted">
            The live endpoint returns no function-level exposure breakdown for
            this company, so no table is shown. Nothing is estimated in its
            place.
          </p>
        </section>
      ) : null}

      <section className="rounded-lg border border-base-300 bg-base-100">
        <div className="flex items-center justify-between border-b border-base-300 px-3 py-2.5">
          <MicroLabel
            label="Peer comparison"
            tooltip="Delivery efficiency and AI strategy benchmark versus sector peers, as returned by the endpoint."
          />
          <LaneBadge lane={lane} />
        </div>
        {e.comparisonTable.length === 0 ? (
          <p className="px-3 py-4 text-xs text-muted">
            No peer set is returned for this company.
          </p>
        ) : (
          <table className="w-full text-left">
            <thead>
              <tr className="border-b border-base-300">
                <th className="px-3 py-2.5 font-mono text-xs uppercase tracking-wider text-muted">
                  Company
                </th>
                <th className="px-3 py-2.5 font-mono text-xs uppercase tracking-wider text-muted">
                  Delivery efficiency
                </th>
                <th className="px-3 py-2.5 font-mono text-xs uppercase tracking-wider text-muted">
                  AI strategy benchmark
                </th>
              </tr>
            </thead>
            <tbody className="divide-y divide-base-300">
              {e.comparisonTable.map((c) => (
                <tr
                  key={c.ticker}
                  className={c.isMainCompany ? "bg-primary/5" : ""}
                >
                  <td className="px-3 py-2.5 text-sm font-semibold">
                    {c.name}
                    {c.isMainCompany ? (
                      <span className="ml-2 rounded bg-primary px-1.5 py-0.5 font-mono text-xs font-bold uppercase text-white">
                        Primary
                      </span>
                    ) : null}
                  </td>
                  <td className="px-3 py-2.5">
                    <ScorePill
                      score={c.deliveryEfficiencyScore}
                      estimated={!company.live}
                    />
                  </td>
                  <td className="px-3 py-2.5">
                    <ScorePill
                      score={c.aiStrategyBenchmark}
                      estimated={!company.live}
                    />
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </section>

      <section className="grid grid-cols-1 gap-3 @2xl:grid-cols-2">
        <Accordion
          title="Key Findings"
          count={e.keyFindings.length}
          defaultOpen
        >
          <ul className="measure list-disc space-y-1.5 pl-4 text-sm">
            {e.keyFindings.map((k) => (
              <li key={k}>{k}</li>
            ))}
          </ul>
        </Accordion>
        <Accordion title="Recommendations" count={e.recommendations.length}>
          <ul className="measure list-disc space-y-1.5 pl-4 text-sm">
            {e.recommendations.map((k) => (
              <li key={k}>{k}</li>
            ))}
          </ul>
        </Accordion>
      </section>
    </div>
    </CompanyShell>
  );
}
