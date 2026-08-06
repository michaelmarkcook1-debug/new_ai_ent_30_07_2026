import { PageHeader } from "@/lib/ui/page";
import { loadWorkflowVendorIndex } from "@/lib/workflow-vendors";
import { WorkflowPicker } from "./workflow-picker";

export const metadata = { title: "Workflow Shortlist | AI Enterprise" };

// Workflow Shortlist (4 August 2026). This tool used to be the tail of Model
// 4 Role's filter bar, rendering its answer three panels below the control:
// a tool whose output is somewhere else is a tool that does not work. It is
// now its own tab under Vendor Assessment, because "who should we shortlist
// for this workflow" is a vendor question, not a model-fit question.
export default async function WorkflowShortlistPage() {
  const { byCategory } = await loadWorkflowVendorIndex();
  return (
    <>
      <PageHeader
        title="Workflow Shortlist"
        subtitle="Pick the workflow you want AI for, and get its risk and deployment profile with the vendors to buy it from and the models to build it on. The mapping from workflow to vendor category is editorial, and it is shown so you can disagree with it."
        lanes={["aie-live", "aie"]}
      />
      <WorkflowPicker workflowVendors={byCategory} />
    </>
  );
}
