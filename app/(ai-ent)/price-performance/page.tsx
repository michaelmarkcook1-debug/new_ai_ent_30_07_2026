import { PageHeader, EmptyState } from "@/lib/ui/page";
import { loadPricingDataset } from "./data";
import { PricingSection } from "./components/pricing-live";

export const metadata = { title: "Price / Performance | AI Enterprise" };

export default function PricePerformancePage() {
  const pricing = loadPricingDataset();
  return (
    <>
      <PageHeader
        title="Price / Performance Scorecard"
        subtitle="Token list pricing across the frontier and challenger model vendors, pulled live and date-stamped, attributed per row. Performance figures appear only when a third party can be named per cell."
        lanes={["aie-live", "aie"]}
      />
      <div className="space-y-6">
        {/* Pricing side: live from the deployed AIE pricing API, ported
            dataset as the fallback */}
        <PricingSection
          fallbackRows={pricing.rows}
          fallbackCapturedAt={pricing.capturedAtIso}
        />

        {/* Performance side: no benchmark dataset exists, so say so */}
        <section>
          <div className="flex items-center gap-3">
            <h2 className="whitespace-nowrap text-[15px] font-bold">
              Third-party signals
            </h2>
            <div className="h-px flex-1 bg-base-300" aria-hidden />
          </div>
          <p className="mt-1 max-w-3xl text-[12px] text-muted">
            The performance half of this scorecard shows third-party benchmark
            results only, attributed per cell.
          </p>
          <div className="mt-3">
            <EmptyState
              title="Awaiting curated benchmark data"
              detail="The AIE dataset carries no third-party benchmark results, so this page shows none. When curated benchmark feeds are wired in, each cell will name its benchmark, publisher and run date, attributed per cell and date-stamped like the pricing table. No benchmark figure is invented in the meantime."
            />
          </div>
        </section>
      </div>
    </>
  );
}
