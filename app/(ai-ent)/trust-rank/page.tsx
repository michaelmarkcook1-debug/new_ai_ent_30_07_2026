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
import { loadMarketMetrics } from "@/lib/market-metrics";
import newsFixture from "@/fixtures/aie-live/news.json";

export const metadata = { title: "Trust Rank | AI Enterprise" };

export default async function TrustRankPage() {
  const postures = await loadGovernancePostures();
  const m = await loadMarketMetrics();
  const insight = governanceInsight(
    m,
    pickNews(newsFixture.news, { categories: ["Regulation", "Enterprise control"] }),
    13,
    5,
    "governance"
  );

  return (
    <>
      <PageHeader
        title="Trust Rank"
        subtitle="The vendor-oriented view over AI legislation: a jurisdiction grid with a vendor lens, vendor-specific rulings, dated regulatory events, and the evidence-graded governance assessment for the selected vendor."
        lanes={["aie", postures.lane]}
      />
      <AnalystInsight insight={insight} context="governance" />
      <TrustRankView
        vendors={loadLensVendors()}
        grid={loadGrid()}
        events={loadRegEvents()}
        postures={postures}
      />
    </>
  );
}
