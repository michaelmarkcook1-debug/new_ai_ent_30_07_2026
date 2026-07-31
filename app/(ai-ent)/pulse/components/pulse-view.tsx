"use client";

import { useState } from "react";
import { LaneBadge } from "@/lib/ui/badges";
import { EditorialBanner } from "@/lib/ui/cards";
import { KpiGauge, DerivationDrawer } from "@/lib/ui/score";
import { MicroLabel } from "@/lib/ui/micro";
import { SpotlightCard } from "./spotlight";
import { VendorComparisonTable } from "./comparison";
import { DeliveryChannelWatch } from "./delivery-watch";
import { PulseLiveNews } from "./live-news";
import { SignalCard } from "./signal-card";
import type { MarketMetrics } from "@/lib/market-metrics";
import type { PulseFixture } from "../types";

// The Pulse. The market figures are real throughout: KPI gauges, the
// comparison table and the three signal columns all read from the AI
// Enterprise datasets through lib/market-metrics. The analyst banner and the
// narrative versus reality spotlight stay SAMPLE-badged, because they are
// editorial judgements no dataset publishes.
//
// Suggested questions now live in the top-bar Ask AI menu rather than as a
// chip grid here, so the page leads with its own subject.
export function PulseView({
  fixture,
  metrics,
}: {
  fixture: PulseFixture;
  metrics: MarketMetrics;
}) {
  const spotlightIds = Object.keys(fixture.spotlights);
  const [selected, setSelected] = useState(spotlightIds[0] ?? "anthropic");
  const spotlight =
    fixture.spotlights[selected] ?? fixture.spotlights[spotlightIds[0]];
  const selectedName =
    metrics.vendors.find((v) => v.id === selected)?.name ?? selected;

  const vendorHref = (id: string) =>
    metrics.vendors.some((v) => v.id === id) ? `/vendor-view/${id}` : null;

  const asOf = metrics.generatedAt
    ? metrics.generatedAt.slice(0, 10)
    : null;

  return (
    <div className="space-y-4">
      {/* 1. Analyst Insight editorial banner */}
      <EditorialBanner
        title={fixture.editorial.title}
        date={fixture.editorial.date}
        badge={<LaneBadge lane="sample" />}
      >
        {fixture.editorial.body}
      </EditorialBanner>

      <div className="grid grid-cols-1 gap-4 lg:grid-cols-3">
        {/* 3. Spotlight tracking card */}
        <div className="lg:col-span-2">
          <div className="mb-2 flex items-center gap-2">
            <MicroLabel
              label="Spotlight"
              tooltip="Pick a tracked vendor to inspect its narrative-versus-reality read."
            />
            <select
              aria-label="Spotlight vendor"
              value={selected}
              onChange={(e) => setSelected(e.target.value)}
              className="rounded border border-base-300 bg-base-100 px-2 py-1 text-[12px]"
            >
              {spotlightIds.map((id) => (
                <option key={id} value={id}>
                  {metrics.vendors.find((v) => v.id === id)?.name ?? id}
                </option>
              ))}
            </select>
          </div>
          <SpotlightCard
            vendorId={selected}
            vendorName={selectedName}
            spotlight={spotlight}
          />
        </div>
        {/* LIVE delivery channel card */}
        <div className="lg:col-span-1">
          <div className="mb-2 h-[26px]" aria-hidden />
          <DeliveryChannelWatch />
        </div>
      </div>

      {/* 4. Market averages, every one a real aggregate */}
      <section>
        <h2 className="text-[15px] font-bold">Market averages</h2>
        <p className="mt-0.5 max-w-3xl text-[12px] text-muted">
          How the typical tracked AI vendor looks today. Each figure is an
          average across the vendor set, not a score for any one vendor, and
          each says how many it covers.
        </p>
      </section>
      <section className="grid grid-cols-1 gap-3 sm:grid-cols-2 xl:grid-cols-5">
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
      </section>
      <div className="-mt-2">
        <DerivationDrawer title="How the market KPIs are derived">
          <p>
            Every gauge is an aggregate over real AI Enterprise data, and each
            one names the exact field it aggregates and how many records it
            covers:
          </p>
          <ul className="list-disc space-y-1 pl-4 text-muted">
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
            (the share estimates&apos; <code>changePct</code>) is zero on every
            row because each prior estimate is a copy of the current one.
            Showing that as a trend would invent a signal the source does not
            carry.
          </p>
          <p className="text-muted">
            Open high-severity risks is a count, not a 0 to 100 score, and its
            band colouring is inverted because fewer is better.
            {asOf ? ` Dashboard generated ${asOf}.` : ""}
            {metrics.lane === "aie"
              ? " This render used the recorded payload: the upstream API did not answer."
              : ""}
          </p>
        </DerivationDrawer>
      </div>

      {/* 5. Comparison table, within one market category */}
      <VendorComparisonTable
        vendors={metrics.vendors}
        shares={metrics.shares}
        primaryId={selected}
        onSelect={setSelected}
        lane={metrics.lane}
        shareMovementPublished={metrics.shareMovementPublished}
      />

      {/* 6. Three real signal columns, straight from the dashboard */}
      <section className="grid grid-cols-1 gap-4 lg:grid-cols-3">
        {(
          [
            [
              "Open risk alerts",
              metrics.risks,
              "Risks the dataset records against tracked vendors, with its own severity and confidence.",
            ],
            [
              "Reading as gaining",
              metrics.gaining,
              "Vendors the dashboard reads as gaining, with the reason it gives.",
            ],
            [
              "Reading as slipping",
              metrics.slipping,
              "Vendors the dashboard reads as slipping, with the reason it gives.",
            ],
          ] as const
        ).map(([title, list, blurb]) => (
          <div key={title}>
            <div className="mb-1 flex items-center gap-2">
              <h3 className="text-[13px] font-bold">{title}</h3>
              <LaneBadge lane={metrics.lane} />
              <span className="font-mono text-[10px] text-muted">
                {list.length}
              </span>
            </div>
            <p className="mb-2 text-[11px] text-muted">{blurb}</p>
            <div className="space-y-2">
              {list.length === 0 ? (
                <p className="rounded-lg border border-dashed border-base-300 px-3 py-4 text-[11.5px] text-muted">
                  Nothing recorded in this feed at the moment.
                </p>
              ) : (
                list.map((s) => (
                  <SignalCard
                    key={`${s.vendorId}-${s.headline}`}
                    signal={s}
                    vendorHref={vendorHref(s.vendorId)}
                  />
                ))
              )}
            </div>
          </div>
        ))}
      </section>

      {/* 7. Market news beside selected-vendor news, live from the AIE feed */}
      <PulseLiveNews
        fallbackMarket={fixture.marketNews}
        fallbackVendor={fixture.vendorNews[selected] ?? []}
        selectedVendorId={selected}
        selectedVendorName={selectedName}
      />
    </div>
  );
}
