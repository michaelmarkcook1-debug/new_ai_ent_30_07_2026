import { PageHeader } from "@/lib/ui/page";
import { ModelFit } from "./components/model-fit";

export const metadata = { title: "Model 4 Role | AI Enterprise" };

// Model 4 Role is one tool now (4 August 2026). It used to carry three: the
// fit engine, an adoption explorer and a workflow selector. The adoption
// explorer's vendor-share model failed an external sanity check and was
// retired (what survived lives on /ai-adoption, with measured figures in its
// place); the workflow selector rendered its answer three panels away from
// the control and is now a working tool of its own at /workflow-shortlist.
// One tab, one question: which model fits this role, and what does it cost.
export default function MarketViewPage() {
  return (
    <>
      <PageHeader
        title="Model 4 Role"
        subtitle="Pick a role and the engine returns the cheapest model meeting its requirements, with the reasoning, the eliminations and the cost all visible."
        lanes={["derived", "aie"]}
      />
      <ModelFit />
    </>
  );
}
