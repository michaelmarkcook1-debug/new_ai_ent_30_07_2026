import { PageHeader } from "@/lib/ui/page";
import {
  loadCostCapability,
  loadFrontierFaceOff,
  loadPricingDataset,
  priceSpread,
} from "./data";
import { loadMarketMetrics } from "@/lib/market-metrics";
import {
  enrichWithSynthesis,
  priceSignal,
  signalsFromMetrics,
} from "@/lib/analyst/cross";
import { CostCapabilityChart } from "./components/cost-capability";
import { PricePerformanceChart } from "../market-view/components/price-performance-chart";
import { priceModels } from "@/lib/model-fit/price-payload";
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
  // Computed from the same view the chart plots. These were literals.
  const spread = priceSpread(ccForInsight);
  const insight = pricePerformanceInsight(
    spread,
    pickNews(news.items, { categories: ["Pricing", "Product launch"] }),
    ccForInsight.capturedAtDisplay ?? null
  );

  // Cross-signal. Price is this page's own reading; capability comes from the
  // assessment, which is the other half of the one relationship that matters
  // most to a buyer and which no single page could see. The benchmark capture
  // is the oldest input in the product, so the freshness gate decides whether
  // this may drive a why now or only stand as context.
  const metricsForCross = await loadMarketMetrics();
  const { insight: crossed, synthesis, signals } = enrichWithSynthesis(insight, [
    ...signalsFromMetrics(metricsForCross),
    ...(priceSignal(spread.ratio, spread.adequate, ccForInsight.capturedAt ?? null)
      ? [priceSignal(spread.ratio, spread.adequate, ccForInsight.capturedAt ?? null)!]
      : []),
  ]);

  const written = await authorInsight(
    crossed,
    "price and capability",
    ccForInsight.models.slice(0, 14).map((x) => x.model),
    null,
    { signals, synthesis }
  );


  return (
    <>
      <PageHeader
        title="Price / Performance Scorecard"
        subtitle="What capability costs: independent benchmark scores against published list prices, with the efficiency frontier picked out."
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

        {/* The capability the chart plots against price is a choice, and it
            changes the answer: the cheapest adequate model for coding is not
            the cheapest adequate model for agentic work. This toggles between
            the five scored axes.

            It lived only on ModelEngine until 5 August 2026, which is the
            wrong place for it to live alone: a reader on the page named
            Price / Performance is the one asking the question it answers. */}
        <PricePerformanceChart models={priceModels()} />

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
