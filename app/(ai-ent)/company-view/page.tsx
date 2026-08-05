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
//
// The analyst reading follows the same rule. It renders only once a company is
// named, and when it does it is about that company against the tracked market
// rather than about the market alone: a market-position piece under the title
// "Your AI Position" was a reading of the industry that knew nothing about the
// reader.

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

  const research = typed.length > 1 ? await researchCompany(typed) : null;

  // The analyst reading is about the company the reader named, so there is
  // nothing to read until they name one. It used to render a market-position
  // piece regardless, which was a reading of the market wearing the title
  // "Your AI Position" while knowing nothing about the reader at all.
  const subject = research?.profile
    ? {
        label: `${research.profile.name} (${research.profile.industry})`,
        facts: [
          research.profile.what,
          ...research.findings.map((f) => f.statement),
          ...research.aiFindings.map((f) => f.statement),
        ].filter(Boolean),
      }
    : null;

  let written = null;
  if (subject) {
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
    written = await authorInsight(
      insight,
      "market position",
      metrics.vendors.slice(0, 12).map((v) => v.name),
      subject
    );
  }

  return (
    <>
      <PageHeader
        title="Your AI Position"
        subtitle="Name your company and its public sources are retrieved and read now, with every statement carrying the link it came from. The analyst reading then sets what was found against the tracked AI market: where the position is exposed, where it is defensible."
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

        {written ? (
          <AnalystInsight
            insight={written.value}
            authorship={written.authorship}
            context={`${research?.profile?.name ?? "this company"} against the AI market`}
          />
        ) : null}

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
