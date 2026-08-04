import { PageHeader } from "@/lib/ui/page";
import { loadPulseFixture, loadPulseMetrics } from "./data";
import { PulseView } from "./components/pulse-view";
import { loadNarrativeGap } from "@/lib/narrative-gap";
import { loadCostCapability } from "@/app/(ai-ent)/price-performance/data";
import { buildScorecard, buildPricePicks, decisionFor } from "@/lib/pulse/brief";
import {
  buildFinancialIndicators,
  buildSignals,
  buildActions,
} from "@/lib/pulse/assemble";
import type { VendorDecision } from "@/lib/pulse/brief";
import { SinceLastLook } from "./components/since-last-look";
import { readWatchState, readChangeLog, buildSinceView } from "@/lib/changes/watchlist";

export const metadata = { title: "The Pulse | AI Enterprise" };

// Everything derived is computed here, on the server, from the same selectors
// the rest of the app uses. The view renders; it does not calculate.

export default async function PulsePage() {
  const [fixture, metrics, gap, financial] = await Promise.all([
    loadPulseFixture(),
    loadPulseMetrics(),
    loadNarrativeGap(),
    buildFinancialIndicators(),
  ]);

  // The watchlist comes off a cookie, so this has to be per-request rather
  // than statically rendered: two readers with different shortlists must not
  // be served each other's page.
  const watch = await readWatchState();
  const since = buildSinceView(readChangeLog(), watch);

  const cost = loadCostCapability();
  const brief = buildScorecard(metrics, cost.models);
  const picks = buildPricePicks(
    cost.models,
    cost.capturedAtDisplay ?? null,
    cost.benchmarkSource
  );

  // The scorecard returns the values it computed, so the actions and signals
  // cite the same numbers rather than recomputing them and drifting.
  const { priceRatio, highRisks, readiness } = brief.facts;

  const signals = buildSignals(
    metrics,
    priceRatio,
    cost.models.length,
    financial.disclosure
  );
  const actions = buildActions(
    priceRatio,
    highRisks,
    readiness,
    metrics.generatedAt
  );

  // A decision per vendor, from the composite already calculated. This adds
  // interpretation only: lib/market-metrics.ts still owns the number.
  const riskVendorIds = new Set(metrics.risks.map((r) => r.vendorId));
  const decisions: Record<string, VendorDecision> = {};
  for (const v of metrics.vendors) {
    decisions[v.id] = decisionFor(
      v.composite,
      v.reputation,
      v.momentum,
      riskVendorIds.has(v.id),
      metrics.lane,
      v.lastUpdated ?? metrics.generatedAt
    );
  }

  return (
    <>
      <PageHeader
        title="The Pulse"
        subtitle="What changed in the enterprise AI market, why it matters, and what to do about it."
        lanes={[metrics.lane, "derived"]}
      />
      <SinceLastLook
        view={since}
        vendorNames={Object.fromEntries(
          metrics.vendors.map((v) => [v.id, v.name])
        )}
      />
      <PulseView
        fixture={fixture}
        metrics={metrics}
        gap={gap}
        brief={brief}
        picks={picks}
        signals={signals}
        actions={actions}
        financial={financial}
        benchmark={{
          source: cost.benchmarkSource,
          modelCount: cost.models.length,
        }}
        decisions={decisions}
      />
    </>
  );
}
