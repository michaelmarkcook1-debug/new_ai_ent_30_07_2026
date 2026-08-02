import { PageHeader } from "@/lib/ui/page";
import { INTELLIGENCE_VENDORS } from "@/lib/aie";
import { loadThirdPartySignals } from "./third-party-data";
import { AiePillarsSection } from "./components/aie-pillars";
import { ReputationHistoryChart } from "./components/history-chart";
import { LiveUnifiedSection } from "./components/live-unified";
import { ThirdPartySignals } from "./components/third-party";
import { AnalystInsight } from "@/lib/ui/analyst-insight";
import { reputationInsight, pickNews } from "@/lib/analyst/insight";
import { loadMarketMetrics } from "@/lib/market-metrics";
import newsFixture from "@/fixtures/aie-live/news.json";

export const metadata = { title: "Reputation Tracker | AI Enterprise" };

export default async function ReputationTrackerPage() {
  const thirdParty = await loadThirdPartySignals();
  const vendorNames = Object.fromEntries(
    INTELLIGENCE_VENDORS.map((v) => [v.id, v.name]),
  );
  const m = await loadMarketMetrics();
  const insight = reputationInsight(
    m,
    pickNews(newsFixture.news, { categories: ["Risk event", "Strategy signal"] }),
    5,
    3
  );

  return (
    <>
      <PageHeader
        title="Reputation Tracker"
        subtitle="How the AI vendor set is perceived by the people who use it, build on it and work in it: three AIE reputation pillars, the live BoardRadar unified read for the platform players, and clearly separated third-party signals."
        lanes={["aie", "live", thirdParty.lane]}
      />
      <AnalystInsight insight={insight} context="reputation" />
      <div className="space-y-4">
        <ReputationHistoryChart vendorNames={vendorNames} />
        <AiePillarsSection />
        <LiveUnifiedSection />
        <ThirdPartySignals view={thirdParty} />
      </div>
    </>
  );
}
