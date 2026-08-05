import { PageHeader } from "@/lib/ui/page";
import {
  loadCostCapability,
  loadFrontierFaceOff,
  loadPricingDataset,
} from "./data";
import { CostCapabilityChart } from "./components/cost-capability";
import { FrontierFaceOff } from "./components/frontier-faceoff";
import { PricingDisclosure } from "./components/pricing-disclosure";
import { AnalystInsight } from "@/lib/ui/analyst-insight";
import { pricePerformanceInsight, pickNews } from "@/lib/analyst/insight";
import { authorInsight } from "@/lib/analyst/author";
import { analystNews } from "@/lib/analyst/news-source";

// The Analyst Insight is a pure function of this page's data, so it only says
// something new when an input changes. News is the input that moves daily, and
// it is now fetched at render rather than baked in, so the page is regenerated
// once a day to pick it up.
export const revalidate = 86400;

export const metadata = { title: "Price / Performance | AI Enterprise" };

export default async function PricePerformancePage() {
  const news = await analystNews();
  const pricing = loadPricingDataset();
  const costCapability = loadCostCapability();
  const faceOff = loadFrontierFaceOff();
  const ccForInsight = loadCostCapability();
  const insight = pricePerformanceInsight(
    {
      models: ccForInsight.models.length,
      vendors: ccForInsight.providers.length,
      ratio: 25,
      adequate: 29,
    },
    pickNews(news.items, { categories: ["Pricing", "Product launch"] }),
    ccForInsight.capturedAtDisplay ?? null
  );

  const written = await authorInsight(
    insight,
    "price and capability",
    ccForInsight.models.slice(0, 14).map((x) => x.model)
  );


  return (
    <>
      <PageHeader
        title="Price / Performance Scorecard"
        subtitle="What capability costs: independent benchmark scores against published list prices, with the efficiency frontier picked out. The full token pricing table sits underneath, on request."
        lanes={["aie-live", "aie"]}
      />
      <AnalystInsight
        insight={written.value}
        authorship={written.authorship}
        context="price and capability"
      />
      <div className="space-y-5">
        {/* Third-party signals: benchmark scores are never AG's own, so the
            attributed divider sits above them per the house rule. */}
        <section>
          <div className="flex items-center gap-3">
            <h2 className="whitespace-nowrap text-base font-bold">
              Third-party signals
            </h2>
            <div className="h-px flex-1 bg-base-300" aria-hidden />
          </div>
          <p className="mt-1 measure text-sm text-muted">
            Benchmark results below are published by {costCapability.benchmarkSource},
            attributed and dated per cell. AG produces no benchmark of its own
            and never blends a third-party score into an AG figure.
          </p>
        </section>

        <FrontierFaceOff view={faceOff} />

        <CostCapabilityChart view={costCapability} />

        <PricingDisclosure
          fallbackRows={pricing.rows}
          fallbackCapturedAt={pricing.capturedAtIso}
          recheckedAt="2026-08-02"
          recheckedVendors={pricing.recheckedVendors}
        />
      </div>
    </>
  );
}
