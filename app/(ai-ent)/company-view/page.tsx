import Link from "next/link";
import { LaneBadge } from "@/lib/ui/badges";
import { EditorialBanner } from "@/lib/ui/cards";
import { KpiGauge, DerivationDrawer } from "@/lib/ui/score";
import { loadShellFixture } from "./data";
import { resolveCompany } from "@/lib/company-source";
import { CompanyShell } from "./components/company-shell";
import { ExemplarOnly } from "./components/exemplar-only";

export const metadata = { title: "Your AI Position | AI Enterprise" };

const TAB_LINKS = [
  { href: "/company-view/ai-exposure", title: "AI Exposure", blurb: "Where AI helps or threatens each function of the business." },
  { href: "/company-view/talent", title: "Talent Intelligence", blurb: "Workforce readiness, AI literacy by level, role exposure." },
  { href: "/company-view/trust-rank", title: "Governance & Obligations", blurb: "Your governance posture and the regulatory grid across ten jurisdictions: what binds you, where." },
  { href: "/decision-desk", title: "Decision Desk", blurb: "When the position is clear: a cited finding and a weighted, derivable score for the decision itself." },
];

export default async function CompanyOverviewPage({
  searchParams,
}: {
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}) {
  const company = resolveCompany((await searchParams).company);
  if (company.live) {
    return (
      <CompanyShell company={company}>
        <ExemplarOnly
          tab="Overview"
          pathname="/company-view"
          reason="This overview is an editorial digest written for the exemplar buyer, and the API publishes no per-company equivalent."
        />
      </CompanyShell>
    );
  }
  const f = await loadShellFixture();
  return (
    <CompanyShell company={company}>
    <div className="space-y-4">
      <EditorialBanner
        title={f.overview.insight.title}
        date={f.overview.insight.date}
        badge={<LaneBadge lane="sample" />}
      >
        {f.overview.insight.body}
      </EditorialBanner>

      <section className="grid grid-cols-1 gap-3 @xl:grid-cols-2 @6xl:grid-cols-4">
        {f.overview.kpis.map((k) => (
          <KpiGauge
            key={k.label}
            label={k.label}
            tooltip={k.tooltip}
            score={k.score}
            delta={k.delta}
            definition={k.definition}
            badge={<LaneBadge lane="sample" />}
          />
        ))}
      </section>
      <div className="-mt-2">
        <DerivationDrawer title="How the company KPIs are derived">
          <p>
            Each KPI is a 0 to 100 composite for the exemplar buyer, shaped
            like the corresponding live BoardRadar composites. Values are
            SAMPLE badged; the derivation pattern is the one a live buyer
            would see: evidence-weighted signals per function, confidence
            labelled, with weak claims suppressed rather than shown.
          </p>
        </DerivationDrawer>
      </div>


      <section className="grid grid-cols-1 gap-3 @xl:grid-cols-2">
        {TAB_LINKS.map((t) => (
          <Link
            key={t.href}
            href={t.href}
            className="rounded-lg border border-base-300 bg-base-100 p-5 transition hover:border-primary"
          >
            <p className="text-sm font-bold">{t.title}</p>
            <p className="mt-1 text-sm text-muted">{t.blurb}</p>
            <p className="mt-2 text-xs font-semibold text-primary">Open</p>
          </Link>
        ))}
      </section>
    </div>
    </CompanyShell>
  );
}
