import { PageHeader } from "@/lib/ui/page";
import {
  loadGrid,
  loadLensVendors,
  loadRegEvents,
  loadGovernancePostures,
} from "./data";
import { TrustRankView } from "./components/trust-rank-view";
import { AnalystInsight } from "@/lib/ui/analyst-insight";
import { governanceInsight, pickNews } from "@/lib/analyst/insight";
import { authorInsight } from "@/lib/analyst/author";
import { loadMarketMetrics } from "@/lib/market-metrics";
import { analystNews } from "@/lib/analyst/news-source";

// The Analyst Insight is a pure function of this page's data, so it only says
// something new when an input changes. News is the input that moves daily, and
// it is now fetched at render rather than baked in, so the page is regenerated
// once a day to pick it up.
export const revalidate = 86400;

export const metadata = { title: "Trust Rank | AI Enterprise" };

export default async function TrustRankPage() {
  const news = await analystNews();
  const postures = await loadGovernancePostures();
  const m = await loadMarketMetrics();
  const insight = governanceInsight(
    m,
    pickNews(news.items, { categories: ["Regulation", "Enterprise control"] }),
    13,
    5,
    "governance"
  );

  const written = await authorInsight(insight, "governance");


  return (
    <>
      <PageHeader
        title="Trust Rank"
        subtitle="The vendor-oriented view over AI legislation: a jurisdiction grid with a vendor lens, vendor-specific rulings, dated regulatory events, and the evidence-graded governance assessment for the selected vendor."
        lanes={["aie", postures.lane]}
      />
      <AnalystInsight
        insight={written.value}
        authorship={written.authorship}
        context="governance"
      />
      <TrustRankView
        vendors={loadLensVendors()}
        grid={loadGrid()}
        events={loadRegEvents()}
        postures={postures}
      />
    </>
  );
}
