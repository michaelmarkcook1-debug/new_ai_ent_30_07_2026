import Link from "next/link";
import { PageHeader } from "@/lib/ui/page";
import { ModelFit } from "./components/model-fit";
import { WorkforceChart } from "./components/workforce-chart";
import { workforcePayload } from "@/lib/model-fit/workforce-payload";

export const metadata = { title: "Model for Role | AI Enterprise" };

// Model for Role is one tool now (4 August 2026). It was called Model 4 Role,
// briefly FitEngine, and is back to naming the question it answers: a product
// name a CIO has to be taught is worse than a sentence they already
// understand. The route stays /market-view so existing links keep working;
// /model-for-role redirects here.
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
        title="Model for Role"
        subtitle="Pick a role and the engine returns the cheapest model meeting its requirements, with the reasoning, the eliminations and the cost all visible."
        lanes={["derived", "aie"]}
      />
      <ModelFit />

      {/* The distribution behind the single answer above: the whole reference
          workforce at once, so a buyer can see how much of it the expensive
          tier actually applies to. Computed on the server because roles.json
          is 697KB and the chart needs five figures per industry. */}
      <WorkforceChart payload={workforcePayload()} />

      {/* Price / Performance asks this same question from the other side: this
          page starts from a role and returns a model, that one starts from the
          models and shows what capability costs across all of them. It left
          the nav on 4 August 2026 and lives here now. */}
      <section className="mt-6 rounded-lg border border-base-300 bg-base-200/40 p-4">
        <h2 className="text-sm font-semibold">
          Coming at it from the other side
        </h2>
        <p className="measure mt-1 text-sm text-base-content/75">
          This page starts from a role and returns one model. Price /
          Performance starts from the models and shows what capability costs
          across all of them, with the efficiency frontier picked out: the
          models no cheaper option beats.
        </p>
        <Link
          href="/price-performance"
          className="mt-2.5 inline-flex items-center gap-1.5 text-sm font-medium text-primary hover:underline"
        >
          See price against capability
          <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="m9 6 6 6-6 6" /></svg>
        </Link>
      </section>
    </>
  );
}
