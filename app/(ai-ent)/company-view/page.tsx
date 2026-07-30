import Link from "next/link";
import { LaneBadge } from "@/lib/ui/badges";
import { EditorialBanner, QuestionChips } from "@/lib/ui/cards";
import { KpiGauge, DerivationDrawer } from "@/lib/ui/score";
import { loadShellFixture } from "./data";

export const metadata = { title: "Company View: Shell | New AI.Ent" };

const TAB_LINKS = [
  { href: "/company-view/ai-exposure", title: "AI Exposure", blurb: "Where AI helps or threatens each function of the business." },
  { href: "/company-view/talent", title: "Talent Intelligence", blurb: "Workforce readiness, AI literacy by level, role exposure." },
  { href: "/company-view/trust-rank", title: "Trust Rank", blurb: "Governance posture and the regulatory grid across ten jurisdictions." },
  { href: "/company-view/assess", title: "Assess and Decide", blurb: "The weighted four-dimension adoption decision, derivation one click away." },
];

export default async function CompanyOverviewPage() {
  const f = await loadShellFixture();
  return (
    <div className="space-y-4">
      <EditorialBanner
        title={f.overview.insight.title}
        date={f.overview.insight.date}
        badge={<LaneBadge lane="sample" />}
      >
        {f.overview.insight.body}
      </EditorialBanner>

      <section className="grid grid-cols-1 gap-3 sm:grid-cols-2 xl:grid-cols-4">
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

      <section>
        <h3 className="mb-2 text-[13px] font-bold">Ask about your organisation</h3>
        <QuestionChips questions={f.overview.questions} />
      </section>

      <section className="grid grid-cols-1 gap-3 sm:grid-cols-2">
        {TAB_LINKS.map((t) => (
          <Link
            key={t.href}
            href={t.href}
            className="rounded-lg border border-base-300 bg-base-100 p-4 transition hover:border-primary"
          >
            <p className="text-[13px] font-bold">{t.title}</p>
            <p className="mt-1 text-[12px] text-muted">{t.blurb}</p>
            <p className="mt-2 text-[11px] font-semibold text-primary">Open</p>
          </Link>
        ))}
      </section>
    </div>
  );
}
