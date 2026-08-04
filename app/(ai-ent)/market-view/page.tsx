import { PageHeader } from "@/lib/ui/page";
import { MarketExplorer } from "./components/market-explorer";
import { loadWorkflowVendorIndex } from "@/lib/workflow-vendors";
import { ModelFit } from "./components/model-fit";

export const metadata = { title: "Model 4 Role | AI Enterprise" };

// The Service Providers delivery matrix used to sit at the foot of this page,
// hardcoded to Accenture with nothing on screen saying why that ticker and not
// another. It answered a different question from the rest of the tab — who
// delivers an AI programme, rather than which model suits a role — and the
// Ecosystem Navigator already answers it properly, with a chooser across every
// live provider rather than one fixed example. The panel is gone from here and
// the shortlist still links through to it.
export default async function MarketViewPage() {
  const { byCategory } = await loadWorkflowVendorIndex();
  return (
    <>
      <PageHeader
        title="Model 4 Role"
        subtitle="Which model for which role, and what it costs: pick a role and the engine returns the cheapest model meeting its requirements, with the reasoning visible. Underneath, who is using which models, how and where."
        lanes={["derived", "aie-live", "aie"]}
      />
      <div className="space-y-4">
        <ModelFit />
        <MarketExplorer workflowVendors={byCategory} />
      </div>
    </>
  );
}
