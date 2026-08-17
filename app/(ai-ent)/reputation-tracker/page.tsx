import { VENDOR_DIRECTORY } from "@/lib/aie/vendor-directory";
import { PageHeader } from "@/lib/ui/page";
import { loadThirdPartySignals } from "./third-party-data";
import { AiePillarsSection } from "./components/aie-pillars";
import { ReputationHistoryChart } from "./components/history-chart";
import { LiveUnifiedSection } from "./components/live-unified";
import { ThirdPartySignals } from "./components/third-party";
import { AnalystInsight } from "@/lib/ui/analyst-insight";
import { reputationInsight, pickNews } from "@/lib/analyst/insight";
import { authorInsight } from "@/lib/analyst/author";
import { loadMarketMetrics } from "@/lib/market-metrics";
import { analystNews } from "@/lib/analyst/news-source";

// The Analyst Insight is a pure function of this page's data, so it only says
// something new when an input changes. News is the input that moves daily, and
// it is now fetched at render rather than baked in, so the page is regenerated
// once a day to pick it up.
export const revalidate = 86400;

export const metadata = { title: "Reputation Tracker | AI Enterprise" };

export default async function ReputationTrackerPage() {
  const news = await analystNews();
  const thirdParty = await loadThirdPartySignals();
  const vendorNames = Object.fromEntries(
    VENDOR_DIRECTORY.map((v) => [v.id, v.name]),
  );
  const m = await loadMarketMetrics();
  const insight = reputationInsight(
    m,
    pickNews(news.items, {
      categories: ["Risk event", "Strategy signal"],
      // The vendors this page covers, so the tie line can say whether the item
      // bears on the figures below or is market context.
      pageVendorIds: m.vendors.map((v) => v.id),
      vendorNames: new Map(m.vendors.map((v) => [v.id, v.name])),
    }),
    5,
    3
  );

  const written = await authorInsight(
    insight,
    "reputation",
    m.vendors.slice(0, 12).map((v) => v.name)
  );


  return (
    <>
      <PageHeader
        title="Reputation Tracker"
        subtitle="How the AI vendor set is perceived by the people who use it, build on it and work in it: three AIE reputation pillars, the live BoardRadar unified read for the platform players, and clearly separated third-party signals."
        lanes={["aie", "live", thirdParty.lane]}
      />
      <AnalystInsight
        insight={written.value}
        authorship={written.authorship}
        context="reputation"
      />
      <div className="space-y-4">
        <ReputationHistoryChart vendorNames={vendorNames} />
        <AiePillarsSection />
        <LiveUnifiedSection />
        <ThirdPartySignals view={thirdParty} />
      </div>
    </>
  );
}
