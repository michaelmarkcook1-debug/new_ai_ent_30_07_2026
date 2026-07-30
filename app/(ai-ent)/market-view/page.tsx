import { PageHeader } from "@/lib/ui/page";
import { MarketExplorer } from "./components/market-explorer";
import { DeliveryMatrix } from "./components/delivery-matrix";

export const metadata = { title: "Market View | New AI.Ent" };

export default function MarketViewPage() {
  return (
    <>
      <PageHeader
        title="Market View"
        subtitle="Who is using which models, how and where: slice the AIE adoption dataset by industry, region and organisation size, inspect workflows with evidenced impact, and watch the live Service Providers delivery matrix."
        lanes={["aie-live", "aie", "live"]}
      />
      <MarketExplorer />
      <DeliveryMatrix />
    </>
  );
}
