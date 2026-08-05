import { PageHeader } from "@/lib/ui/page";
import {
  getCategoryLeaders,
  getCategoryShares,
  getDependencyByLayer,
  getMarketToday,
  getShareLookups,
  getWatchlists,
} from "./data";
import { MarketToday } from "./components/market-today";
import { CategoryShareLive } from "./components/category-share-live";
import { WinningLosing } from "./components/winning-losing";
import { DependencyByLayer } from "./components/dependency-by-layer";
import { CategoryLeaders } from "./components/category-leaders";
import { AnalystInsight } from "@/lib/ui/analyst-insight";
import { marketWatchInsight, pickNews } from "@/lib/analyst/insight";
import { authorInsight } from "@/lib/analyst/author";
import { loadMarketMetrics } from "@/lib/market-metrics";
import { analystNews } from "@/lib/analyst/news-source";

// The Analyst Insight is a pure function of this page's data, so it only says
// something new when an input changes. News is the input that moves daily, and
// it is now fetched at render rather than baked in, so the page is regenerated
// once a day to pick it up.
export const revalidate = 86400;

export const metadata = { title: "Market Watch | AI Enterprise" };

// Market Watch: the AIE homepage market read. Category shares and the
// winning/losing read now pull live from the deployed AIE app; the ported
// seed stays as the explicit fallback and everything else remains PORT lane.
export default async function MarketWatchPage() {
  const news = await analystNews();
  const { regime, signals } = getMarketToday();
  const categories = getCategoryShares();
  const lookups = getShareLookups();
  const dependency = getDependencyByLayer();
  const leaders = getCategoryLeaders();
  const watchlists = getWatchlists();

  const metricsForInsight = await loadMarketMetrics();
  const insight = marketWatchInsight(
    metricsForInsight,
    pickNews(news.items, { categories: ["Market movement", "Strategy signal"] })
  );

  const written = await authorInsight(
    insight,
    "market",
    metricsForInsight.vendors.slice(0, 12).map((v) => v.name)
  );


  return (
    <>
      <PageHeader
        title="Market Watch"
        subtitle="The enterprise AI market read: today's regime and source-cited signals, live share by category, the live winning and losing read, dependency concentration and category leaders. All figures keep their native evidence labels; news lives on The Pulse and News."
        lanes={["aie-live", "aie"]}
      />
      <AnalystInsight
        insight={written.value}
        authorship={written.authorship}
        context="market"
      />
      <div className="space-y-6">
        <MarketToday regime={regime} signals={signals} />
        <CategoryShareLive fallback={categories} lookups={lookups} />
        <WinningLosing />
        <DependencyByLayer view={dependency} />
        <CategoryLeaders leaders={leaders} watchlists={watchlists} />
      </div>
    </>
  );
}
