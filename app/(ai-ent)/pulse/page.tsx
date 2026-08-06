import { PageHeader } from "@/lib/ui/page";
import { loadPulseFixture, loadPulseMetrics } from "./data";
import { PulseView } from "./components/pulse-view";
import { loadNarrativeGap } from "@/lib/narrative-gap";
import { loadCostCapability } from "@/app/(ai-ent)/price-performance/data";
import { buildScorecard, buildPricePicks, decisionFor } from "@/lib/pulse/brief";
import { scorecardSet } from "@/lib/vendor/composite-data";
import {
  buildFinancialIndicators,
  buildSignals,
  buildActions,
} from "@/lib/pulse/assemble";
import type { VendorDecision } from "@/lib/pulse/brief";
import { SinceLastLook } from "./components/since-last-look";
import { pulseJudgement } from "@/lib/pulse/judgement";
import { authorPulse, authorActions, authorSince } from "@/lib/analyst/author";
import { readWatchState, readChangeLog, buildSinceView } from "@/lib/changes/watchlist";

// The Security Desk material briefly lived here (6 August 2026) and moved to
// Trust Rank the same day. Two reasons, both Michael's and both right.
//
// This page already has a judgement panel. Today's Pulse is the analyst-written
// read on the market, and it is what `finding-strong` in globals.css means by
// "the hero judgement on a page: the Pulse". Putting a second brief above it
// gave the page two heroes and displaced the one the rule names.
//
// And the Desk material belongs together. Split across six tabs it was six
// additions to six products; on one surface it is a product. Trust Rank is
// where it lives now.

export const metadata = { title: "Your Pulse | AI Enterprise" };

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

  // The composite, for the Verdict dial. Only the raw inputs travel: the
  // weights are adjustable in the browser, so the score is recomputed there.
  const cards = scorecardSet();
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

  // Today's Pulse, the three actions and the returning-reader panel are all
  // written by the analyst model over figures computed above. Each falls back
  // to its computed text when the model is unavailable or caught inventing a
  // figure, so the page never depends on the call succeeding.
  const computedJudgement = pulseJudgement({
    gaining: metrics.gaining,
    slipping: metrics.slipping,
    risks: metrics.risks,
    kpis: metrics.kpis,
    shareMovementPublished: metrics.shareMovementPublished,
  });
  const asOfDay = metrics.generatedAt ? metrics.generatedAt.slice(0, 10) : null;

  const [writtenPulse, writtenActions, writtenSince] = await Promise.all([
    authorPulse(computedJudgement, {
      movers: computedJudgement.movement,
      asOf: asOfDay,
    }),
    authorActions(actions, computedJudgement.judgement),
    authorSince({
      lastSeen: since.lastSeen,
      watchedCount: since.watchedCount,
      changes: (since.watchedCount > 0 ? since.watched : since.everything)
        .slice(0, 8)
        .map((c) => `${c.label}: ${c.from} to ${c.to}`),
    }),
  ]);

  const authoredActions = actions.map((a, i) => ({
    ...a,
    action: writtenActions.value[i]?.action ?? a.action,
    detail: writtenActions.value[i]?.detail ?? a.detail,
  }));

  return (
    <>
      <PageHeader
        title="Your Pulse"
        subtitle="What changed in the enterprise AI market, why it matters, and what to do about it."
        lanes={[metrics.lane, "derived"]}
      />
      <PulseView
        fixture={fixture}
        metrics={metrics}
        gap={gap}
        brief={brief}
        picks={picks}
        signals={signals}
        actions={authoredActions}
        financial={financial}
        benchmark={{
          source: cost.benchmarkSource,
          modelCount: cost.models.length,
        }}
        decisions={decisions}
        judgement={writtenPulse.value}
        authorship={writtenPulse.authorship}
        // Rendered as a slot rather than a sibling so it can sit directly
        // under Today's Pulse: a returning reader wants the judgement first
        // and what has moved since their last visit immediately after it.
        sinceLastLook={
          <SinceLastLook
            narrative={writtenSince?.value ?? null}
            view={since}
            vendorNames={Object.fromEntries(
              metrics.vendors.map((v) => [v.id, v.name])
            )}
          />
        }
        verdict={{
          vendors: cards.vendors.map((v) => ({
            vendorId: v.vendorId,
            name: v.name,
            inputs: v.inputs,
          })),
          coverage: cards.coverage,
          total: cards.total,
        }}
      />
    </>
  );
}
