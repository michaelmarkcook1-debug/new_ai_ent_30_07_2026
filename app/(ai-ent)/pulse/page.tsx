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
// Ported from The Security Desk, 6 August 2026. The Pulse read the market
// well and answered nothing about today: it had no way to say that a provider
// is down while you are looking at the page, and no line that paired a fact
// with what to do about it. Those are the daily habit, and they belong on the
// surface a reader opens first.
import { fetchStatuses, STATUS_SOURCE_COUNT } from "@/lib/desk/status";
import { fetchDeskNews } from "@/lib/desk/news";
import { assembleBrief } from "@/lib/desk/brief";
import { TodaysBrief } from "./components/todays-brief";
import { TheTape } from "./components/the-tape";
import { FirmsLikeYours } from "./components/firms-like-yours";

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

  // Today's spine. Both fetches are safe-fail by construction, so a dark
  // source costs the brief a section rather than costing the reader the page.
  // One clock reading for the whole render, so every countdown agrees.
  const asOf = new Date();
  const [statuses, deskNews] = await Promise.all([
    fetchStatuses(),
    fetchDeskNews(8),
  ]);
  const todaysBrief = assembleBrief(
    statuses,
    STATUS_SOURCE_COUNT,
    deskNews,
    watch.vendorIds,
    asOf
  );

  return (
    <>
      <PageHeader
        title="Your Pulse"
        subtitle="What changed overnight and what it means for you, then what changed in the market, why it matters, and what to do about it."
        lanes={["live", metrics.lane, "derived"]}
      />
      {/* The daily habit sits above the market read, because a reader opening
          this page in the morning wants "is anything on fire" answered before
          "how is the market trending". */}
      <div className="mb-4 space-y-4">
        <TodaysBrief brief={todaysBrief} />
        <div className="grid gap-4 lg:grid-cols-2">
          <TheTape
            statuses={statuses}
            attempted={STATUS_SOURCE_COUNT}
            watchedVendorIds={watch.vendorIds}
          />
          <FirmsLikeYours />
        </div>
      </div>
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
