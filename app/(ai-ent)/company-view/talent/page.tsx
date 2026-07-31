import { LaneBadge } from "@/lib/ui/badges";
import { DerivationDrawer, ScorePill } from "@/lib/ui/score";
import { MicroLabel } from "@/lib/ui/micro";
import { loadShellFixture } from "../data";
import { resolveCompany } from "@/lib/company-source";
import { brServerFetch } from "@/lib/br-server";
import { CompanyShell } from "../components/company-shell";
import { LiveTalentExposure } from "./live-exposure";

export const metadata = { title: "Talent Intelligence | AI Enterprise" };

// Mirrors /talent/* and the AI talent exposure shape for the buyer's
// workforce (spec Section 5). All SAMPLE.
export default async function TalentPage({
  searchParams,
}: {
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}) {
  const company = resolveCompany((await searchParams).company);

  // The AI talent exposure matrix has a live equivalent with the same field
  // names, so a covered company gets the real thing. The surrounding sections
  // (workforce pyramid, functional readiness, leadership signals) are written
  // for the exemplar and have no per-company source, so they are omitted
  // rather than shown under another company's name.
  if (company.live && company.ticker) {
    const res = await brServerFetch<{ matrix: Record<string, unknown> }>(
      "ai-talent/exposure",
      { ticker: company.ticker }
    );
    return (
      <CompanyShell company={company} displayName={
        (res.data?.matrix?.displayName as string | undefined) ?? null
      }>
        <LiveTalentExposure
          matrix={res.data?.matrix ?? null}
          source={res.source}
          ticker={company.ticker}
        />
      </CompanyShell>
    );
  }

  const f = await loadShellFixture();
  const t = f.talent;
  const x = t.aiTalentExposure;
  const fmt = new Intl.NumberFormat("en-GB");
  return (
    <CompanyShell company={company}>
    <div className="space-y-4">
      <section className="rounded-lg border border-primary/25 bg-primary/5 p-4">
        <div className="flex items-center justify-between">
          <span className="micro-label text-primary">Talent insight</span>
          <LaneBadge lane="sample" />
        </div>
        <p className="mt-1 text-[13px] leading-relaxed">{t.insight}</p>
      </section>

      {/* KPI strip mirroring the talent intelligence kpis object */}
      <section className="grid grid-cols-2 gap-3 sm:grid-cols-3 xl:grid-cols-6">
        {[
          { label: "HEADCOUNT", value: fmt.format(t.kpis.headcount), sub: `${t.kpis.headcountYoY > 0 ? "+" : ""}${fmt.format(t.kpis.headcountYoY)} YoY` },
          { label: "ATTRITION", value: `${t.kpis.attritionPct}%`, sub: t.kpis.attritionWindow },
          { label: "AI TRAINED", value: t.kpis.aiTrainedLabel, sub: t.kpis.aiTrainedSub },
          { label: "AI SPECIALISTS", value: t.kpis.aiSpecialistsLabel, sub: t.kpis.aiSpecialistsSub },
          { label: "AVG TENURE", value: `${t.kpis.avgTenureYears} yrs`, sub: t.kpis.avgTenureSource },
          { label: "AI EXPOSURE", value: `${x.avgAiExposurePct}%`, sub: x.avgAiExposureBasis },
        ].map((k) => (
          <div key={k.label} className="rounded-lg border border-base-300 bg-base-100 p-3">
            <MicroLabel label={k.label} />
            <p className="mt-1 font-mono text-xl font-bold">{k.value}</p>
            <p className="text-[10px] text-muted">{k.sub}</p>
          </div>
        ))}
      </section>

      <section className="grid grid-cols-1 gap-4 lg:grid-cols-2">
        {/* AI literacy pyramid over time */}
        <div className="rounded-lg border border-base-300 bg-base-100 p-4">
          <div className="flex items-center justify-between">
            <MicroLabel label="AI literacy by level" tooltip={t.pyramidMetric} />
            <LaneBadge lane="sample" />
          </div>
          <div className="mt-3 space-y-2.5">
            {t.pyramid.map((p) => (
              <div key={p.level}>
                <div className="flex items-center justify-between text-[11.5px]">
                  <span className="font-semibold">{p.level}</span>
                  <span className="font-mono text-[10px] text-muted">
                    24m {p.previous24m} → 12m {p.previous} → 6m {p.previous6m} → now{" "}
                    <span className="font-bold text-base-content">{p.current}</span>
                  </span>
                </div>
                <div className="mt-1 h-2 rounded-full bg-base-300/60">
                  <div className="h-2 rounded-full bg-primary" style={{ width: `${p.current}%` }} />
                </div>
              </div>
            ))}
          </div>
          <div className="mt-3">
            <DerivationDrawer title="How the literacy index is derived">
              <p>
                Index 0 to 100 per organisational level, mirroring the live
                talent pyramid series (24 months, 12 months, 6 months,
                current). Values are SAMPLE for the exemplar buyer.
              </p>
            </DerivationDrawer>
          </div>
        </div>

        {/* Functional distribution */}
        <div className="rounded-lg border border-base-300 bg-base-100 p-4">
          <div className="flex items-center justify-between">
            <MicroLabel label="Workforce by function" tooltip="Share of headcount by functional family, per cent." />
            <LaneBadge lane="sample" />
          </div>
          <div className="mt-3 space-y-2.5">
            {t.functional.map((fn) => (
              <div key={fn.name}>
                <div className="flex items-center justify-between text-[11.5px]">
                  <span>{fn.name}</span>
                  <span className="font-mono">{fn.pct}%</span>
                </div>
                <div className="mt-1 h-2 rounded-full bg-base-300/60">
                  <div className="h-2 rounded-full bg-secondary/70 dark:bg-secondary-content/60" style={{ width: `${fn.pct}%` }} />
                </div>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* AI talent exposure */}
      <section className="rounded-lg border border-base-300 bg-base-100">
        <div className="flex items-center justify-between border-b border-base-300 px-3 py-2">
          <MicroLabel
            label="AI talent exposure"
            tooltip={`Share of each role's tasks that AI changes materially. High exposure threshold: ${x.highExposureThresholdPct} per cent. Coverage: ${x.roleCoveragePct} per cent of headcount.`}
          />
          <LaneBadge lane="sample" />
        </div>
        <p className="px-3 pt-2 text-[12px] text-muted">{x.summary}</p>
        <div className="overflow-x-auto">
          <table className="w-full text-left">
            <thead>
              <tr className="border-b border-base-300">
                <th className="px-3 py-2 font-mono text-[10px] uppercase tracking-wider text-muted">Role family</th>
                <th className="px-3 py-2 font-mono text-[10px] uppercase tracking-wider text-muted">AI exposure</th>
                <th className="px-3 py-2 font-mono text-[10px] uppercase tracking-wider text-muted">Direction</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-base-300">
              {x.roles.map((r) => (
                <tr key={r.role} className="hover:bg-base-200/60">
                  <td className="px-3 py-2 text-[12.5px] font-semibold">{r.role}</td>
                  <td className="px-3 py-2"><ScorePill score={r.exposurePct} estimated invert /></td>
                  <td className="px-3 py-2">
                    <span
                      className={`font-mono text-[11px] ${r.direction === "growing" ? "text-good" : r.direction === "contracting" ? "text-error" : "text-muted"}`}
                    >
                      {r.direction === "growing" ? "▲" : r.direction === "contracting" ? "▼" : "▬"} {r.direction}
                    </span>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </section>

      {/* Leadership signals: role-level only, no named individuals in sample data */}
      <section className="rounded-lg border border-base-300 bg-base-100 p-4">
        <div className="flex items-center justify-between">
          <MicroLabel label="Leadership signals" tooltip="Public leadership statements about AI, summarised at role level. Sample content carries no named individuals." />
          <LaneBadge lane="sample" />
        </div>
        <div className="mt-2 space-y-2">
          {t.leadership.map((l) => (
            <div key={l.speaker} className="rounded border border-base-300 p-3">
              <div className="flex items-center justify-between">
                <span className="text-[12px] font-semibold">{l.speaker}</span>
                <span className={`font-mono text-[10px] uppercase ${l.signal === "high" ? "text-good" : "text-warn"}`}>
                  {l.signal} signal
                </span>
              </div>
              <p className="mt-1 text-[12px] text-muted">{l.quote}</p>
              <p className="mt-1 font-mono text-[10px] text-muted">{l.source} · {l.date}</p>
            </div>
          ))}
        </div>
      </section>
    </div>
    </CompanyShell>
  );
}
