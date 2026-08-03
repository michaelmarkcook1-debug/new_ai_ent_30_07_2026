import { PageHeader } from "@/lib/ui/page";
import { MarketExplorer } from "./components/market-explorer";
import { loadWorkflowVendorIndex } from "@/lib/workflow-vendors";
import { DeliveryMatrix } from "./components/delivery-matrix";
import { ModelFit } from "./components/model-fit";

export const metadata = { title: "Model 4 Role | AI Enterprise" };

export default async function MarketViewPage() {
  const { byCategory } = await loadWorkflowVendorIndex();
  return (
    <>
      <PageHeader
        title="Model 4 Role"
        subtitle="Which model for which role, and what it costs: pick a role and the engine returns the cheapest model meeting its requirements, with the reasoning visible. Underneath, who is using which models, how and where."
        lanes={["derived", "aie-live", "aie", "live"]}
      />
      <div className="space-y-4">
        <ModelFit />
        <MarketExplorer workflowVendors={byCategory} />
        <DeliveryMatrix />
      </div>
    </>
  );
}
