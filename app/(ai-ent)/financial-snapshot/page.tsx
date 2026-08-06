import { PageHeader } from "@/lib/ui/page";
import { PROBED_TICKERS, privateVendorCards } from "./data";
import { loadRevenueView } from "./segment-data";
import { LiveTickers } from "./components/live-tickers";
import { PrivateCompanyCards } from "./components/private-cards";
import { AiRevenuePanel } from "./components/ai-revenue";
import { PrivateRevenuePanel } from "./components/private-revenue";
import { DisclosureLadder } from "./components/disclosure-ladder";
import {
  publicLadder,
  privateLadder,
  publicCoverage,
} from "@/lib/finance/disclosure-ladder";
import { AnalystInsight } from "@/lib/ui/analyst-insight";
import { financialInsight, pickNews } from "@/lib/analyst/insight";
import { authorInsight } from "@/lib/analyst/author";
import { analystNews } from "@/lib/analyst/news-source";
import { DEFAULT_BAND } from "@/lib/finance/private-revenue";

export const metadata = { title: "Financial Snapshot | AI Enterprise" };

export default async function FinancialSnapshotPage() {
  const cards = privateVendorCards();
  const revenue = loadRevenueView();
  // One ladder, read by both the summary panel and the private cards. The
  // cards used to show an empty state while a derived range sat above them.
  const publicRows = publicLadder(PROBED_TICKERS);
  const privateRows = privateLadder();

  // The insight this page never had. financialInsight() was authored for it
  // and wired to nothing, so the strongest finding on the page , that most AI
  // revenue claims are in nobody's filings, was sitting in dead code.
  const news = await analystNews();
  const insight = financialInsight(
    pickNews(news.items, {
      categories: ["Market movement", "Strategy signal"],
      minImpact: 70,
    }),
    { disclosing: revenue.disclosingCount, total: revenue.totalCount },
    revenue.companies.filter((c) => c.segments?.length).length,
    revenue.companies.length,
    revenue.disclosureCapturedAt,
    {
      stated: privateRows.filter((r) => r.rung === "stated").length,
      notEstimable: privateRows.filter((r) => r.rung === "not_estimable").length,
      band: DEFAULT_BAND,
    }
  );
  const written = await authorInsight(insight, "financial", []);

  return (
    <>
      <PageHeader
        title="Financial Snapshot"
        subtitle="AI vendor financials on two honest lanes: live BoardRadar figures for the probed public tickers, and disclosed-figures-only cards for the private AI companies. When markets cross the chasm, buyers follow the herd: this page shows who is growing and where, without inventing a single number."
        lanes={["live", "aie"]}
      />
      <AnalystInsight
        insight={written.value}
        authorship={written.authorship}
        context="financial"
      />
      <div className="space-y-6">
        <AiRevenuePanel view={revenue} />
        <DisclosureLadder
          publicRows={publicRows}
          privateRows={privateRows}
          coverage={publicCoverage(PROBED_TICKERS)}
        />
        <LiveTickers tickers={PROBED_TICKERS} />
        <PrivateRevenuePanel
          vendors={cards.map((c) => ({ id: c.id, name: c.name }))}
        />
        <PrivateCompanyCards cards={cards} ladder={privateRows} />
      </div>
    </>
  );
}
