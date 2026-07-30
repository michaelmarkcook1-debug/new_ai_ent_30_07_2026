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

export const metadata = { title: "Market Watch | AI Enterprise" };

// Market Watch: the AIE homepage market read. Category shares and the
// winning/losing read now pull live from the deployed AIE app; the ported
// seed stays as the explicit fallback and everything else remains PORT lane.
export default function MarketWatchPage() {
  const { regime, signals } = getMarketToday();
  const categories = getCategoryShares();
  const lookups = getShareLookups();
  const dependency = getDependencyByLayer();
  const leaders = getCategoryLeaders();
  const watchlists = getWatchlists();

  return (
    <>
      <PageHeader
        title="Market Watch"
        subtitle="The enterprise AI market read: today's regime and source-cited signals, live share by category, the live winning and losing read, dependency concentration and category leaders. All figures keep their native confidence labels; news lives on The Pulse and News."
        lanes={["aie-live", "aie"]}
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
