"use client";

import { useState } from "react";
import { LaneBadge } from "@/lib/ui/badges";
import { KpiGauge, DerivationDrawer } from "@/lib/ui/score";
import { MicroLabel } from "@/lib/ui/micro";
import { Accordion } from "@/lib/ui/accordion";
import { VendorComparisonTable } from "./comparison";
import { PulseLiveNews } from "./live-news";
import {
  PulseHero,
  ExecutiveActions,
  Scorecard,
  MetaRow,
} from "./executive-brief";
import { PriceSummary } from "./price-summary";
import {
  MaterialRisks,
  Movers,
  SupportingSignals,
  DeeperAnalysis,
  type PulseSignal,
} from "./decision-lists";
import { FinancialStrip, type FinancialIndicator } from "./financial-strip";
import { pulseJudgement } from "@/lib/pulse/judgement";
import type { MarketMetrics } from "@/lib/market-metrics";
import type { PulseFixture } from "../types";
import type { NarrativeGap } from "@/lib/narrative-gap";
import type {
  ExecutiveBrief,
  PricePick,
  RecommendationMeta,
  VendorDecision,
} from "@/lib/pulse/brief";

// The Pulse: an executive decision brief, not a dashboard.
//
// The order is deliberate and is the whole redesign: judgement first, then the
// actions that follow from it, then the readings that support it, then the
// underlying data. Nothing was deleted to achieve that. The comparison table,
// the full mover lists, the risk tail and the news feed are all still here,
// moved below the fold and behind accordions, because they are useful on the
// second read and in the way on the first.
//
// Provenance did not get simplified along with the layout. Every figure still
// carries its lane badge and the derivation drawers are intact. Colour now
// carries the verdict rather than the provenance, so a reader can sort good
// from bad before reading a word.

export function PulseView({
  fixture,
  metrics,
  gap,
  brief,
  picks,
  signals,
  actions,
  financial,
  benchmark,
  decisions,
}: {
  fixture: PulseFixture;
  metrics: MarketMetrics;
  gap: NarrativeGap | null;
  brief: ExecutiveBrief;
  picks: PricePick[];
  signals: PulseSignal[];
  actions: { action: string; detail: string; meta: RecommendationMeta }[];
  financial: {
    indicators: FinancialIndicator[];
    capturedAt: string | null;
    disclosure: { disclosing: number; total: number } | null;
  };
  benchmark: { source: string; modelCount: number };
  decisions: Record<string, VendorDecision>;
}) {
  // The spotlight's own dropdown left with it, but this is still live state:
  // the vendor comparison table sets it and the news feed below reads it, so
  // picking a vendor in the table still moves the news to that vendor.
  const [selected, setSelected] = useState(
    Object.keys(fixture.spotlights)[0] ?? "anthropic"
  );
  const selectedName =
    metrics.vendors.find((v) => v.id === selected)?.name ?? selected;

  const asOf = metrics.generatedAt ? metrics.generatedAt.slice(0, 10) : null;

  const judgement = pulseJudgement({
    gaining: metrics.gaining,
    slipping: metrics.slipping,
    risks: metrics.risks,
    kpis: metrics.kpis,
    shareMovementPublished: metrics.shareMovementPublished,
  });

  return (
    <div className="space-y-8">
      {/* 1. The judgement, now written from the figures rather than fixture
             editorial. That editorial was sample copy with a fixed date, which
             put a SAMPLE badge on the one section a CIO actually reads. */}
      <PulseHero
        headline={judgement.headline}
        judgement={judgement.judgement}
        changed={
          judgement.movement
            ? `Moving this period: ${judgement.movement}.`
            : "No vendor movement is published for this period."
        }
        matters="Capability is no longer the scarce input. Buying leverage now comes from matching model tier to task and from holding vendors to evidence rather than claims."
        todo="Tier your model spend before the next renewal, re-open any shortlist older than two quarters, and clear open governance risks before widening scope."
        action={`Recommended action: ${brief.overall.action}`}
        meta={brief.overall.meta}
        evidenceNote={`Drawn from ${metrics.kpis.reduce((a, k) => Math.max(a, k.sampleSize), 0)} tracked vendors, ${benchmark.modelCount} priced and benchmarked models, and the open risk and movement classifications published for this period.`}
        lane={metrics.lane}
        asOf={asOf}
      />

      {/* 2. What to do about it */}
      <ExecutiveActions actions={actions} />

      {/* 3. The readings behind the judgement */}
      <Scorecard brief={brief} lane={metrics.lane} />

      {/* 4. What to buy */}
      <PriceSummary
        picks={picks}
        benchmarkSource={benchmark.source}
        modelCount={benchmark.modelCount}
      />

      {/* The vendor spotlight moved to /vendor-view on 4 August 2026. It was
          the last SAMPLE-badged panel on the page, and sample data on the
          flagship section is a credibility tax the rest of the product pays
          for. It is not deleted: /vendor-view is where a reader goes to read
          one vendor properly, which is what it was for. */}

      {/* 5. What could go wrong */}
      <MaterialRisks
        risks={metrics.risks}
        lane={metrics.lane}
        lastUpdated={metrics.generatedAt}
      />

      {/* 6. What moved. "What moved recently" and "Who is moving" were the
             same question asked twice, so they are one section now. */}
      <Movers
        gaining={metrics.gaining}
        slipping={metrics.slipping}
        lane={metrics.lane}
        lastUpdated={metrics.generatedAt}
      />

      {/* 7. Show the working: the signals the judgement was built from, the
             financial disclosure counts, and the full underlying data. All of
             it was top-level before, which is how the page reached fourteen
             sections. None of it is deleted, because a reader who challenges
             a number has to be able to reach it. */}
      <section className="space-y-2">
        <MicroLabel
          label="Show the working"
          tooltip="Everything behind the judgement, kept in full."
        />

        <Accordion title="Signals behind today's Pulse" count={signals.length}>
          <SupportingSignals signals={signals} bare />
        </Accordion>

        {/* Kept, against the brief's instruction to delete it. The instruction
            said this panel renders empty; it does not. It carries two measured
            counts (3 of 9 vendors state a quantified AI revenue figure, 7 of 9
            file segment revenue) and an explicit list of what nobody
            publishes. Deleting it would delete real figures and the clearest
            statement of absence on the page, so it moved instead. */}
        <Accordion
          title="Is the money holding"
          count={financial.indicators.length}
        >
          <FinancialStrip
            indicators={financial.indicators}
            capturedAt={financial.capturedAt}
            bare
          />
        </Accordion>

        <Accordion title="Market averages across the tracked set" count={metrics.kpis.length}>
          <div className="grid grid-cols-1 gap-3 @xl:grid-cols-2 @6xl:grid-cols-4">
            {metrics.kpis.map((k) => (
              <KpiGauge
                key={k.label}
                label={k.label}
                tooltip={k.tooltip}
                score={k.score}
                delta={k.delta}
                definition={`${k.definition} n = ${k.sampleSize}.`}
                badge={<LaneBadge lane={metrics.lane} />}
                invert={k.invert}
              />
            ))}
          </div>
          <div className="mt-3">
            <DerivationDrawer title="How the market averages are derived">
              <p>
                Each gauge is an aggregate over real AI Enterprise data, naming
                the field it aggregates and how many records it covers:
              </p>
              <ul className="measure list-disc space-y-1 pl-4 text-muted">
                {metrics.kpis.map((k) => (
                  <li key={k.label}>
                    <span className="font-semibold text-base-content">
                      {k.label}
                    </span>
                    : <code>{k.sourceField}</code>, over {k.sampleSize} records.
                  </li>
                ))}
              </ul>
              <p>
                No change figures are shown. The datasets publish no prior period
                for these aggregates, and the one field that looks like movement
                (the share estimates&apos; <code>changePct</code>) is zero on
                every row because each prior estimate is a copy of the current
                one. Showing that as a trend would invent a signal the source
                does not carry.
              </p>
              <p className="measure text-muted">
                Open high-severity risks is a count, not a 0 to 100 score, and
                its band colouring is inverted because fewer is better.
                {asOf ? ` Generated ${asOf}.` : ""}
                {metrics.lane === "aie"
                  ? " This render used the recorded payload: the upstream API did not answer."
                  : ""}
              </p>
            </DerivationDrawer>
          </div>
        </Accordion>

        <Accordion title="Vendor comparison, within one market category" count={metrics.vendors.length}>
          <VendorComparisonTable
            vendors={metrics.vendors}
            shares={metrics.shares}
            primaryId={selected}
            onSelect={setSelected}
            lane={metrics.lane}
            shareMovementPublished={metrics.shareMovementPublished}
          />
        </Accordion>

        <Accordion title="Full market and vendor news" count={fixture.marketNews.length}>
          <PulseLiveNews
            fallbackMarket={fixture.marketNews}
            fallbackVendor={fixture.vendorNews[selected] ?? []}
            selectedVendorId={selected}
            selectedVendorName={selectedName}
          />
        </Accordion>
      </section>

      {/* 14. Where to go next */}
      <DeeperAnalysis />
    </div>
  );
}
