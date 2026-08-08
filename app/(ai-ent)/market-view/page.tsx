import Link from "next/link";
import { PageHeader } from "@/lib/ui/page";
import { ModelFit } from "./components/model-fit";
import { WorkforceChart } from "./components/workforce-chart";
import { PricePerformanceChart } from "./components/price-performance-chart";
import { workforcePayload } from "@/lib/model-fit/workforce-payload";
import { priceModels } from "@/lib/model-fit/price-payload";
import { CompanyContextBar } from "@/lib/position/context-bar";

export const metadata = { title: "ModelEngine | AI Enterprise" };

// ModelEngine is one tool now (4 August 2026). It has been Model 4 Role,
// FitEngine and Model for Role; the route stays /market-view throughout so no
// link ever breaks on a rename, and /model-for-role redirects here.
//
// It used to carry three things: the fit engine, an adoption explorer and a
// workflow selector. The adoption explorer's vendor-share model failed an
// external sanity check and was retired (what survived lives on /ai-adoption,
// with measured figures in its place); the workflow selector rendered its
// answer three panels away from the control and is now a working tool of its
// own at /workflow-shortlist.
// One tab, one question: which model fits this role, and what does it cost.
export default function MarketViewPage() {
  return (
    <>
      <PageHeader
        title="ModelEngine"
        subtitle="Pick a role and the engine returns the cheapest model meeting its requirements, with the reasoning, the eliminations and the cost all visible."
        lanes={["derived", "aie"]}
      />
      <CompanyContextBar here="engine" />
      <ModelFit />

      {/* The distribution behind the single answer above: the whole reference
          workforce at once, so a buyer can see how much of it the expensive
          tier actually applies to. Computed on the server because roles.json
          is 697KB and the chart needs five figures per industry. */}
      <WorkforceChart payload={workforcePayload()} />

      {/* The same question from the other side: this page starts from a role
          and returns one model, this chart starts from the models and shows
          what capability costs across all of them. Folded in from
          /price-performance on 4 August 2026, which keeps its route and its
          fuller treatment. */}
      <PricePerformanceChart models={priceModels()} />

      <p className="mt-4 text-sm">
        <Link
          href="/price-performance"
          className="inline-flex items-center gap-1.5 font-medium text-primary hover:underline"
        >
          The full price-performance analysis
          <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="m9 6 6 6-6 6" /></svg>
        </Link>
      </p>
    </>
  );
}
