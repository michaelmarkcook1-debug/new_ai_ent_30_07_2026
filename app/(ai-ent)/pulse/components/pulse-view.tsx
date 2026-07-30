"use client";

import { useState } from "react";
import { LaneBadge } from "@/lib/ui/badges";
import { EditorialBanner, InsightCard } from "@/lib/ui/cards";
import { KpiGauge, DerivationDrawer } from "@/lib/ui/score";
import { MicroLabel } from "@/lib/ui/micro";
import { SpotlightCard } from "./spotlight";
import { VendorComparisonTable } from "./comparison";
import { DeliveryChannelWatch } from "./delivery-watch";
import { InterrogateHero } from "./interrogate-hero";
import { PulseLiveNews } from "./live-news";
import type { PulseFixture } from "../types";

// The Pulse, composed exactly in the Section 7 order: editorial banner,
// question chips, spotlight card, KPI gauges, comparison table, three
// insight columns, then news. One LIVE card: the delivery channel watch.
export function PulseView({ fixture }: { fixture: PulseFixture }) {
  const spotlightIds = Object.keys(fixture.spotlights);
  const [selected, setSelected] = useState(spotlightIds[0] ?? "anthropic");
  const spotlight = fixture.spotlights[selected] ?? fixture.spotlights[spotlightIds[0]];
  const selectedName =
    fixture.comparison.rows.find((r) => r.id === selected)?.name ?? selected;

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

      {/* 2. The hero: Interrogate, with the suggested chips inside it */}
      <InterrogateHero questions={fixture.questions} />

      <div className="grid grid-cols-1 gap-4 lg:grid-cols-3">
        {/* 3. Spotlight tracking card */}
        <div className="lg:col-span-2">
          <div className="mb-2 flex items-center gap-2">
            <MicroLabel label="Spotlight" tooltip="Pick a tracked vendor to inspect its narrative-versus-reality read." />
            <select
              aria-label="Spotlight vendor"
              value={selected}
              onChange={(e) => setSelected(e.target.value)}
              className="rounded border border-base-300 bg-base-100 px-2 py-1 text-[12px]"
            >
              {spotlightIds.map((id) => (
                <option key={id} value={id}>
                  {fixture.comparison.rows.find((r) => r.id === id)?.name ?? id}
                </option>
              ))}
            </select>
          </div>
          <SpotlightCard vendorId={selected} vendorName={selectedName} spotlight={spotlight} />
        </div>
        {/* LIVE delivery channel card */}
        <div className="lg:col-span-1">
          <div className="mb-2 h-[26px]" aria-hidden />
          <DeliveryChannelWatch />
        </div>
      </div>

      {/* 4. Four market KPI gauge cards */}
      <section className="grid grid-cols-1 gap-3 sm:grid-cols-2 xl:grid-cols-4">
        {fixture.kpis.map((k) => (
          <KpiGauge
            key={k.label}
            label={k.label}
            tooltip={k.tooltip}
            score={k.score}
            delta={k.delta}
            definition={k.definition}
            badge={<LaneBadge lane="sample" />}
            invert={k.invert}
          />
        ))}
      </section>
      <div className="-mt-2">
        <DerivationDrawer title="How the market KPIs are derived">
          <p>
            Each market KPI is a 0 to 100 composite over the tracked AI vendor
            universe. In this demo the values are illustrative samples carrying
            the SAMPLE badge; in production each composite is computed from
            confidence-labelled signals with the same derivation shown here.
          </p>
          <ul className="list-disc space-y-1 pl-4 text-muted">
            <li>Deal momentum: weighted count of evidenced deal and procurement signals.</li>
            <li>Enterprise adoption: breadth of production deployments, not pilots.</li>
            <li>Regulatory pressure: rules in force and enforcement activity by region.</li>
            <li>Talent flow: net movement of AI talent into the tracked set.</li>
          </ul>
          <p className="text-muted">
            Claims below the strong-evidence bar are suppressed rather than
            shown; nothing on this page is an invented measurement.
          </p>
        </DerivationDrawer>
      </div>

      {/* 5. Comparison table with metric tabs */}
      <VendorComparisonTable
        rows={fixture.comparison.rows}
        primaryId={selected}
        onSelect={setSelected}
      />

      {/* 6. Three insight columns */}
      <section className="grid grid-cols-1 gap-4 lg:grid-cols-3">
        {(
          [
            ["Strategic Issues", fixture.insights.strategic],
            ["Emerging Threats", fixture.insights.threats],
            ["Growth Opportunities", fixture.insights.opportunities],
          ] as const
        ).map(([title, list]) => (
          <div key={title}>
            <div className="mb-2 flex items-center gap-2">
              <h3 className="text-[13px] font-bold">{title}</h3>
              <LaneBadge lane="sample" />
            </div>
            <div className="space-y-2">
              {list.map((i) => (
                <InsightCard key={i.title} insight={i} />
              ))}
            </div>
          </div>
        ))}
      </section>

      {/* 7. Market news beside selected-vendor news, live from the AIE feed
          with the sample strips as the last-resort fallback */}
      <PulseLiveNews
        fallbackMarket={fixture.marketNews}
        fallbackVendor={fixture.vendorNews[selected] ?? []}
        selectedVendorId={selected}
        selectedVendorName={selectedName}
      />
    </div>
  );
}
