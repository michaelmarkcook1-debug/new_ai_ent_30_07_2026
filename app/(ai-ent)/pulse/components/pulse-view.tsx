"use client";

import { useState } from "react";
import { LaneBadge } from "@/lib/ui/badges";
import { KpiGauge, DerivationDrawer } from "@/lib/ui/score";
import { MicroLabel } from "@/lib/ui/micro";
import { Accordion } from "@/lib/ui/accordion";
import { SpotlightCard, VendorSnapshotCard, DerivedGapCard } from "./spotlight";
import { VendorComparisonTable } from "./comparison";
import { PulseLiveNews } from "./live-news";
import {
  PulseHero,
  ExecutiveActions,
  Scorecard,
  MetaRow,
} from "./executive-brief";
import { PriceSummary } from "./price-summary";
import { Workforce } from "./workforce";
import {
  MaterialRisks,
  Movers,
  SupportingSignals,
  DeeperAnalysis,
  type PulseSignal,
} from "./decision-lists";
import { FinancialStrip, type FinancialIndicator } from "./financial-strip";
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
  industries,
  complexityMix,
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
  industries: string[];
  complexityMix: {
    complex: number;
    moderate: number;
    simple: number;
    counted: number;
    total: number;
  };
  decisions: Record<string, VendorDecision>;
}) {
  const spotlightIds = Object.keys(fixture.spotlights);
  const [selected, setSelected] = useState(spotlightIds[0] ?? "anthropic");

  const isAiVendor = (v: (typeof metrics.vendors)[number]) =>
    v.category !== "AI investor";
  const selectable = metrics.vendors.filter(isAiVendor);

  const hasDerived = (id: string) =>
    Boolean(gap?.vendors.some((v) => v.vendorId === id && v.gap !== null));

  const withRead = selectable
    .filter((v) => fixture.spotlights[v.id])
    .sort((a, b) => a.name.localeCompare(b.name));
  const withDerived = selectable
    .filter((v) => !fixture.spotlights[v.id] && hasDerived(v.id))
    .sort((a, b) => a.name.localeCompare(b.name));
  const withoutRead = selectable
    .filter((v) => !fixture.spotlights[v.id] && !hasDerived(v.id))
    .sort((a, b) => a.name.localeCompare(b.name));

  const spotlight = fixture.spotlights[selected] ?? null;
  const selectedVendor = metrics.vendors.find((v) => v.id === selected) ?? null;
  const selectedGap =
    gap?.vendors.find((v) => v.vendorId === selected && v.gap !== null) ?? null;
  const selectedName = selectedVendor?.name ?? selected;
  const decision = decisions[selected] ?? null;

  const asOf = metrics.generatedAt ? metrics.generatedAt.slice(0, 10) : null;

  return (
    <div className="space-y-8">
      {/* 1. The judgement */}
      <PulseHero
        headline={fixture.editorial.title}
        judgement={fixture.editorial.body}
        changed={
          metrics.gaining.length + metrics.slipping.length > 0
            ? `${metrics.gaining.length} tracked vendors are gaining position and ${metrics.slipping.length} are slipping, and the gap between the best model and a near-equivalent has widened into a real commercial choice.`
            : "Vendor positions are steady this period, and the gap between the best model and a near-equivalent has widened into a real commercial choice."
        }
        matters="Capability is no longer the scarce input. Buying leverage now comes from matching model tier to task and from holding vendors to evidence rather than claims."
        todo="Tier your model spend before the next renewal, re-open any shortlist older than two quarters, and clear open governance risks before widening scope."
        action={`Recommended action: ${brief.overall.action}`}
        meta={brief.overall.meta}
        evidenceNote={`Drawn from ${metrics.kpis.reduce((a, k) => Math.max(a, k.sampleSize), 0)} tracked vendors, ${benchmark.modelCount} priced and benchmarked models, and the open risk and movement classifications published for this period.`}
        editorialDate={fixture.editorial.date}
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

      {/* 5 and 6. Where to spend it, and on which work */}
      <Workforce industries={industries} complexityMix={complexityMix} />

      {/* 7. One vendor, read properly */}
      <section>
        <div className="flex flex-wrap items-center justify-between gap-2">
          <div className="flex flex-wrap items-center gap-2">
            <MicroLabel
              label="Vendor spotlight"
              tooltip="What one vendor's position means for a buyer, not just how it scores."
            />
          </div>
          <select
            aria-label="Spotlight vendor"
            value={selected}
            onChange={(e) => setSelected(e.target.value)}
            className="max-w-full rounded border border-base-300 bg-base-100 px-2 py-1 text-[12px]"
          >
            <optgroup label="Narrative versus reality read published">
              {withRead.map((v) => (
                <option key={v.id} value={v.id}>
                  {v.name}
                </option>
              ))}
            </optgroup>
            <optgroup label="Derived read compiled">
              {withDerived.map((v) => (
                <option key={v.id} value={v.id}>
                  {v.name}
                </option>
              ))}
            </optgroup>
            <optgroup label="AG figures only">
              {withoutRead.map((v) => (
                <option key={v.id} value={v.id}>
                  {v.name}
                </option>
              ))}
            </optgroup>
          </select>
        </div>

        <div className="mt-3 grid grid-cols-1 gap-4 @4xl:grid-cols-3">
          <div className="@container @4xl:col-span-2">
            {spotlight ? (
              <SpotlightCard
                vendorId={selected}
                vendorName={selectedName}
                spotlight={spotlight}
              />
            ) : selectedGap && gap ? (
              <DerivedGapCard
                vendor={selectedGap}
                method={gap.method}
                generatedAt={gap.generatedAt}
                cohortSize={gap.vendorCount}
              />
            ) : selectedVendor ? (
              <VendorSnapshotCard vendor={selectedVendor} />
            ) : null}
          </div>

          {/* The decision, which is the part a buyer actually needs */}
          <div className="@container @4xl:col-span-1">
            {decision ? (
              <div className="rounded-lg border border-primary/40 bg-primary/5 p-4">
                <MicroLabel
                  label="What to do about it"
                  tooltip="The same composite, stated as an action."
                />
                <p className="mt-2 text-[20px] font-bold">{decision.status}</p>
                <p className="measure mt-1.5 text-[12px] leading-snug">
                  {decision.reason}
                </p>
                {decision.keyDimensions.length ? (
                  <p className="measure mt-2 text-[12px] leading-snug text-muted">
                    Based on {decision.keyDimensions.join(", ")}.
                  </p>
                ) : null}
                <div className="mt-3 border-t border-base-300 pt-2">
                  <MetaRow meta={decision.meta} />
                </div>
              </div>
            ) : null}
          </div>
        </div>
      </section>

      {/* 8. What could go wrong */}
      <MaterialRisks
        risks={metrics.risks}
        lane={metrics.lane}
        lastUpdated={metrics.generatedAt}
      />

      {/* 9. Who is moving */}
      <Movers
        gaining={metrics.gaining}
        slipping={metrics.slipping}
        lane={metrics.lane}
        lastUpdated={metrics.generatedAt}
      />

      {/* 10. The evidence underneath */}
      <SupportingSignals signals={signals} />

      {/* 11. Is the money holding */}
      <FinancialStrip
        indicators={financial.indicators}
        capturedAt={financial.capturedAt}
      />

      {/* 13. Everything that used to be above the fold, kept and collapsed */}
      <section className="space-y-2">
        <MicroLabel
          label="The underlying data"
          tooltip="Everything behind the brief, kept in full."
        />

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
