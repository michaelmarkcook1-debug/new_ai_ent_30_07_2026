import Link from "next/link";
import { PageHeader } from "@/lib/ui/page";
import { CompanyEntry } from "./components/company-entry";
import { ResearchRunner } from "./components/research-runner";
import { Assumptions } from "./components/assumptions";
import { exposurePayload } from "@/lib/exposure/payload";
import { CompanyContextBar } from "@/lib/position/context-bar";

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

  // No research and no reading on the server. Both happen in one streamed
  // request the browser drives, so the tab is usable while it runs and the
  // wheel reports real stages rather than an animation.

  return (
    <>
      <PageHeader
        title="Your AI Position"
        subtitle="Name your company and its public sources are retrieved and read now, with every statement carrying the link it came from. The analyst reading then sets what was found against the tracked AI market: where the position is exposed, where it is defensible."
        lanes={["live", "aie-live"]}
      />
      <CompanyContextBar here="position" />

      <div className="space-y-4">
        <section className="rounded-lg border border-base-300 bg-base-100 p-4">
          <CompanyEntry />
        </section>

        {typed.length > 1 ? (
          <>
            <ResearchRunner company={typed} exposure={exposurePayload()} />
            {/* The figures no source holds, left to the reader rather than
                estimated. Below the retrieved findings on purpose: what is
                cited comes first, what is assumed comes after and is marked. */}
            <Assumptions company={typed} />
          </>
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
