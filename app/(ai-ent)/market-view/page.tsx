import { PageHeader } from "@/lib/ui/page";
import { MarketExplorer } from "./components/market-explorer";
import { loadWorkflowVendorIndex } from "@/lib/workflow-vendors";
import { DeliveryMatrix } from "./components/delivery-matrix";

export const metadata = { title: "Model 4 Role | AI Enterprise" };

export default async function MarketViewPage() {
  const { byCategory } = await loadWorkflowVendorIndex();
  return (
    <>
      <PageHeader
        title="Model 4 Role"
        subtitle="Who is using which models, how and where: slice the AIE adoption dataset by industry, region and organisation size, inspect workflows with evidenced impact, and watch the live Service Providers delivery matrix."
        lanes={["aie-live", "aie", "live"]}
      />
      <MarketExplorer workflowVendors={byCategory} />
      <DeliveryMatrix />
    </>
  );
}
