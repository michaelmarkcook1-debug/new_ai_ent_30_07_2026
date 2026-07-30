import { PageHeader } from "@/lib/ui/page";
import {
  getCategoryLeaders,
  getCategoryShares,
  getDependencyByLayer,
  getMarketToday,
  getWatchlists,
} from "./data";
import { MarketToday } from "./components/market-today";
import { CategoryShare } from "./components/category-share";
import { DependencyByLayer } from "./components/dependency-by-layer";
import { CategoryLeaders } from "./components/category-leaders";

export const metadata = { title: "Market Watch | New AI.Ent" };

// Market Watch: the AIE homepage market read. PORT lane throughout; every
// figure is an AIE dataset field or a documented count over dataset rows.
export default function MarketWatchPage() {
  const { regime, signals } = getMarketToday();
  const categories = getCategoryShares();
  const dependency = getDependencyByLayer();
  const leaders = getCategoryLeaders();
  const watchlists = getWatchlists();

  return (
    <>
      <PageHeader
        title="Market Watch"
        subtitle="The enterprise AI market read from the AIE dataset: today's regime and source-cited signals, share by category, dependency concentration and category leaders. All figures keep their native confidence labels; news lives on The Pulse and News."
        lanes={["aie"]}
      />
      <div className="space-y-6">
        <MarketToday regime={regime} signals={signals} />
        <CategoryShare categories={categories} />
        <DependencyByLayer view={dependency} />
        <CategoryLeaders leaders={leaders} watchlists={watchlists} />
      </div>
    </>
  );
}
