import { PageHeader } from "@/lib/ui/page";
import { PROBED_TICKERS, privateVendorCards } from "./data";
import { loadRevenueView } from "./segment-data";
import { PrivateCompanyCards } from "./components/private-cards";
import { AiRevenuePanel } from "./components/ai-revenue";
import { DisclosureLadder } from "./components/disclosure-ladder";
import {
  publicLadder,
  privateLadder,
  publicCoverage,
} from "@/lib/finance/disclosure-ladder";
import { Accordion } from "@/lib/ui/accordion";
import { AnalystInsight } from "@/lib/ui/analyst-insight";
import { financialInsight, pickNews } from "@/lib/analyst/insight";
import { authorInsight } from "@/lib/analyst/author";
import { analystNews } from "@/lib/analyst/news-source";

export const metadata = { title: "Financial Snapshot | AI Enterprise" };

export default async function FinancialSnapshotPage() {
  const cards = privateVendorCards();
  const revenue = loadRevenueView();
  // One ladder, read by both the summary panel and the private cards. The
  // cards used to show an empty state while a derived range sat above them.
  const publicRows = publicLadder(PROBED_TICKERS);
  const privateRows = privateLadder();

  // The insight this page never had. financialInsight() was authored for it
  // and wired to nothing, so the strongest finding on the page, that most AI
  // revenue claims are in nobody's filings, was sitting in dead code.
  const news = await analystNews();
  const insight = financialInsight(
    pickNews(news.items, {
      categories: ["Market movement", "Strategy signal"],
      minImpact: 70,
      // The private companies this page actually carries a rung for. `key` is
      // the vendor id, which is what the news feed names vendors by.
      pageVendorIds: privateRows.map((r) => r.key),
      vendorNames: new Map(privateRows.map((r) => [r.key, r.name])),
    }),
    { disclosing: revenue.disclosingCount, total: revenue.totalCount },
    revenue.companies.filter((c) => c.segments?.length).length,
    revenue.companies.length,
    revenue.disclosureCapturedAt,
    {
      stated: privateRows.filter((r) => r.rung === "stated").length,
      notEstimable: privateRows.filter((r) => r.rung === "not_estimable").length,
    }
  );
  const written = await authorInsight(insight, "financial", []);

  return (
    <>
      <PageHeader
        title="Financial Snapshot"
        subtitle="What AI vendors have actually disclosed about AI revenue, and where a claim has nothing behind it. Disclosed figures only: no estimate, no inference, no invented number."
        lanes={["live", "aie"]}
      />
      <AnalystInsight
        insight={written.value}
        authorship={written.authorship}
        context="financial"
      />
      {/* Two panels open, one collapsed. This page carried five, and three of
          them were answering a question this product does not ask.

          LIVE TICKERS, REMOVED. It rendered share price, EBITDA, gross margin
          and "moderate activist risk exposure with some areas that could
          attract investor scrutiny". That is written for somebody buying the
          stock, not somebody buying the software, and Michael has already
          ruled valuation out of scope: this program is for buyers. The live
          BoardRadar lane is not lost with it, because Reputation Tracker,
          Trust Rank, News Feed and Company View all still demonstrate it.

          PRIVATE REVENUE ESTIMATOR, REMOVED. A slider that multiplied a
          valuation by a revenue multiple to produce a range. Honestly built,
          and still an estimate of a number nobody outside those companies
          knows, on a page whose entire argument is that undisclosed figures
          should not be treated as known. The disclosure ladder below already
          answers the buyer's version of that question, which is whether the
          company has said anything at all.

          What stays is the finding: what a vendor has actually disclosed
          about AI revenue, and where a claim has nothing behind it. */}
      <div className="space-y-6">
        <AiRevenuePanel view={revenue} />
        <DisclosureLadder
          publicRows={publicRows}
          privateRows={privateRows}
          coverage={publicCoverage(PROBED_TICKERS)}
        />
        <Accordion title="Private companies, and what is behind each claim" count={cards.length}>
          <PrivateCompanyCards cards={cards} ladder={privateRows} />
        </Accordion>
      </div>
    </>
  );
}
