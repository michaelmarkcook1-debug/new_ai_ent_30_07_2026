import { PageHeader } from "@/lib/ui/page";
import { loadCostCapability, loadPricingDataset } from "./data";
import { CostCapabilityChart } from "./components/cost-capability";
import { PricingDisclosure } from "./components/pricing-disclosure";

export const metadata = { title: "Price / Performance | AI Enterprise" };

export default function PricePerformancePage() {
  const pricing = loadPricingDataset();
  const costCapability = loadCostCapability();
  return (
    <>
      <PageHeader
        title="Price / Performance Scorecard"
        subtitle="What capability costs: independent benchmark scores against published list prices, with the efficiency frontier picked out. The full token pricing table sits underneath, on request."
        lanes={["aie-live", "aie"]}
      />
      <div className="space-y-5">
        {/* Third-party signals: benchmark scores are never AG's own, so the
            attributed divider sits above them per the house rule. */}
        <section>
          <div className="flex items-center gap-3">
            <h2 className="whitespace-nowrap text-[15px] font-bold">
              Third-party signals
            </h2>
            <div className="h-px flex-1 bg-base-300" aria-hidden />
          </div>
          <p className="mt-1 max-w-3xl text-[12px] text-muted">
            Benchmark results below are published by {costCapability.benchmarkSource},
            attributed and dated per cell. AG produces no benchmark of its own
            and never blends a third-party score into an AG figure.
          </p>
        </section>

        <CostCapabilityChart view={costCapability} />

        <PricingDisclosure
          fallbackRows={pricing.rows}
          fallbackCapturedAt={pricing.capturedAtIso}
        />
      </div>
    </>
  );
}
