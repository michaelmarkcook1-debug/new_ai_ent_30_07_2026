import Link from "next/link";
import { PageHeader } from "@/lib/ui/page";
import { CompanyEntry } from "./components/company-entry";
import { ResearchedCompany } from "./components/researched-company";
import { researchCompany } from "@/lib/research/company";
import { AnalystInsight } from "@/lib/ui/analyst-insight";
import { positionInsight, pickNews } from "@/lib/analyst/insight";
import { authorInsight } from "@/lib/analyst/author";
import { analystNews } from "@/lib/analyst/news-source";
import { loadPulseMetrics } from "@/app/(ai-ent)/pulse/data";
import { readChangeLog, readWatchState } from "@/lib/changes/watchlist";

export const metadata = { title: "Your AI Position | AI Enterprise" };

// Your AI Position, for whichever company the reader names.
//
// This page was the Shell fixture: one company's figures, SAMPLE badged,
// standing in for every reader's. That made the whole tab a worked example
// rather than an answer, and it was the largest block of sample data in the
// product.
//
// It now takes a company name and researches it: public sources retrieved at
// the moment of asking, read by the analyst model, every statement carrying
// the link it came from. Where the sources say nothing, the page says nothing.
// The market reading underneath is unchanged and still comes from the tracked
// dataset, because that part was never about the reader's own company.

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
  const raw = (await searchParams).company;
  const typed = (Array.isArray(raw) ? raw[0] : raw)?.trim() ?? "";

  const [metrics, news, watch] = await Promise.all([
    loadPulseMetrics(),
    analystNews(),
    readWatchState(),
  ]);
  const movedSignals = readChangeLog().changes.length;
  const insight = positionInsight(
    metrics,
    { movedSignals, watchedVendors: watch.vendorIds.length },
    pickNews(news.items, { minImpact: 70 })
  );
  const written = await authorInsight(
    insight,
    "market position",
    metrics.vendors.slice(0, 12).map((v) => v.name)
  );

  const research = typed.length > 1 ? await researchCompany(typed) : null;

  return (
    <>
      <PageHeader
        title="Your AI Position"
        subtitle="Name your company and its public sources are retrieved and read now, with every statement carrying the link it came from. Underneath, the market reading you are positioning against."
        lanes={["live", "aie-live"]}
      />

      <div className="space-y-4">
        <section className="rounded-lg border border-base-300 bg-base-100 p-4">
          <CompanyEntry />
        </section>

        {research ? (
          <ResearchedCompany research={research} />
        ) : (
          <section className="rounded-lg border border-dashed border-base-300 bg-base-200/40 p-6">
            <h2 className="text-base font-bold">Name a company to begin</h2>
            <p className="measure mt-1.5 text-sm text-muted">
              Any company, listed or private. Its public sources are retrieved
              at that moment and read by the analyst model, and every statement
              you get back carries the link behind it. Where the sources say
              nothing, this page says nothing rather than filling the gap.
            </p>
          </section>
        )}

        <AnalystInsight
          insight={written.value}
          authorship={written.authorship}
          context="market position"
        />

        <section className="grid grid-cols-1 gap-3 @xl:grid-cols-2">
          {TAB_LINKS.map((t) => (
            <Link
              key={t.href}
              href={t.href}
              className="rounded-lg border border-base-300 bg-base-100 p-5 transition hover:border-primary"
            >
              <p className="text-sm font-bold">{t.title}</p>
              <p className="measure mt-1 text-sm text-muted">{t.blurb}</p>
            </Link>
          ))}
        </section>
      </div>
    </>
  );
}
