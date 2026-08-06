"use client";

import { useMemo, useState } from "react";
import { LaneBadge } from "@/lib/ui/badges";
import { MicroLabel } from "@/lib/ui/micro";
import { DerivationDrawer } from "@/lib/ui/score";
import {
  DEFAULT_BAND,
  estimateRevenue,
  formatUsdM,
  marketSlice,
  observedMultiples,
  type MultipleBand,
} from "@/lib/finance/private-revenue";

// Revenue for the private labs, as a range with its assumption on the outside.
//
// The slider is not a toy. It is the honest form for a number nobody outside
// these companies knows: the reader moves the multiple and watches the range
// move, which teaches the uncertainty far better than a footnote does. A single
// figure here would be the most confidently wrong thing on the platform.

export function PrivateRevenuePanel({
  vendors,
}: {
  vendors: { id: string; name: string }[];
}) {
  const [band, setBand] = useState<MultipleBand>(DEFAULT_BAND);
  const pairs = observedMultiples();

  const rows = useMemo(
    () => vendors.map((v) => estimateRevenue(v.id, v.name, band)),
    [vendors, band]
  );

  const implied = rows.filter((r) => r.basis === "implied_from_valuation");
  const disclosed = rows.filter((r) => r.basis === "disclosed");

  return (
    <section className="finding rounded-lg p-5">
      <div className="flex flex-wrap items-center gap-2">
        <MicroLabel
          label="Private company revenue"
          tooltip="What the private AI labs earn, on the only two footings available: what they have said, and what their valuation implies."
        />
        <LaneBadge lane="derived" />
      </div>
      <p className="measure mt-1 text-sm text-muted">
        None of these companies publishes accounts. {disclosed.length} of{" "}
        {rows.length} has stated a revenue figure; {implied.length} can be
        inferred from a disclosed valuation, as a range; the rest cannot be
        estimated at all and say so.
      </p>

      {/* The assumption, on the outside where it can be argued with. */}
      <div className="mt-4 rounded-lg border border-base-300 bg-base-100 p-4">
        <div className="flex flex-wrap items-baseline justify-between gap-2">
          <MicroLabel
            label="The assumption"
            tooltip="Revenue is inferred as valuation divided by a revenue multiple. Nobody outside these companies knows the multiple, so it is a control, not a constant."
          />
          <span className="font-mono text-sm font-bold">
            {band.low}× to {band.high}× revenue
          </span>
        </div>
        <div className="mt-3 grid grid-cols-1 gap-3 @xl:grid-cols-2">
          {(
            [
              ["low", "Low multiple (implies more revenue)"],
              ["high", "High multiple (implies less revenue)"],
            ] as const
          ).map(([key, label]) => (
            <label key={key} className="flex flex-col gap-1">
              <span className="text-xs text-muted">{label}</span>
              <input
                type="range"
                min={5}
                max={150}
                step={5}
                value={band[key]}
                onChange={(e) => {
                  const n = Number(e.target.value);
                  setBand((b) =>
                    key === "low"
                      ? { low: Math.min(n, b.high), high: b.high }
                      : { low: b.low, high: Math.max(n, b.low) }
                  );
                }}
                className="w-full accent-[var(--ag-insight)]"
              />
            </label>
          ))}
        </div>
        {pairs.length > 0 ? (
          <div className="mt-2">
            <p className="measure text-xs text-muted">
              For scale, the multiples this product can actually observe: each
              a cited valuation over the nearest-in-time cited revenue:
            </p>
            <ul className="mt-1 flex flex-wrap gap-x-4 gap-y-0.5">
              {pairs.map((p) => (
                <li
                  key={`${p.vendorId}-${p.valuationUsdM}`}
                  className="font-mono text-xs text-muted"
                >
                  <span className="font-semibold text-base-content">
                    {p.vendorId}
                  </span>{" "}
                  {p.isFloorDerived ? "≤" : "~"}
                  {p.multiple}×
                  {p.stale ? (
                    <span
                      className="ml-1 rounded bg-warn-bg px-1 py-0.5 text-[10px] font-semibold uppercase tracking-wider text-warn"
                      title={`The valuation and revenue citations are ${p.daysApart} days apart: this pair prices two different moments of the company and does not anchor the band.`}
                    >
                      stale
                    </span>
                  ) : null}
                </li>
              ))}
            </ul>
            <p className="measure mt-1 text-xs text-muted">
              Floor-derived multiples (≤) are ceilings, and stale pairs divide
              citations from different quarters. Public enterprise software
              trades nearer 5× to 15×. That spread is why this is a band and
              not a number.
            </p>
          </div>
        ) : null}
      </div>

      <ul className="mt-4 space-y-2">
        {rows.map((r) => (
          <li
            key={r.vendorId}
            className="rounded-lg border border-base-300 bg-base-100 p-4"
          >
            <div className="flex flex-wrap items-baseline justify-between gap-x-3 gap-y-1">
              <h3 className="text-base font-bold">{r.vendorName}</h3>
              {r.basis === "disclosed" && r.disclosed ? (
                <span className="finding-figure font-mono text-xl font-bold">
                  {r.disclosed.isFloor ? "above " : ""}
                  {formatUsdM(r.disclosed.revenueUsdM)}
                </span>
              ) : r.basis === "implied_from_valuation" &&
                r.lowUsdM !== null &&
                r.highUsdM !== null ? (
                <span className="finding-figure font-mono text-xl font-bold">
                  {formatUsdM(r.lowUsdM)} to {formatUsdM(r.highUsdM)}
                </span>
              ) : (
                <span className="font-mono text-sm text-muted">
                  not estimable
                </span>
              )}
            </div>

            {r.basis === "disclosed" && r.disclosed ? (
              <div>
                <p className="measure mt-1 text-sm text-muted">
                  Reported {r.disclosed.basis.replace(/_/g, "-")} revenue.{" "}
                  <span className="italic">
                    &ldquo;{r.disclosed.citation.quote}&rdquo;
                  </span>{" "}
                  {r.disclosed.citation.publisher}, {r.disclosed.citation.asOf}.
                </p>
                {r.series.length > 1 ? (
                  <p className="mt-1 font-mono text-xs text-muted">
                    {r.series
                      .map(
                        (x) =>
                          `${x.citation.asOf.slice(0, 7)}: ${x.isFloor ? "above " : ""}${formatUsdM(x.revenueUsdM)}${x.basis === "projection" ? " (target)" : ""}`
                      )
                      .join(" → ")}
                  </p>
                ) : null}
                {r.disclosed.caveats ? (
                  <p className="measure mt-1 text-xs text-warn">
                    {r.disclosed.caveats}
                  </p>
                ) : null}
                {(() => {
                  // The cross-check lane: what an independently measured
                  // market implies for one slice of this vendor's revenue.
                  // Never blended with the reported figure: when the two
                  // differ by an order of magnitude, the gap is the finding.
                  const slice = marketSlice(r.vendorId);
                  if (!slice || !r.disclosed) return null;
                  const ratio = r.disclosed.revenueUsdM / slice.sliceUsdM;
                  return (
                    <p className="measure mt-2 rounded border border-base-300 bg-base-200/40 px-2 py-1.5 text-xs text-muted">
                      <span className="font-mono text-[10px] font-semibold uppercase tracking-wider">
                        Cross-check
                      </span>{" "}
                      A {slice.check.sharePct}% share of the{" "}
                      {formatUsdM(slice.check.marketUsdM)}{" "}
                      {slice.check.marketMeasure} that{" "}
                      {slice.check.citation.publisher} measured implies{" "}
                      <strong className="text-base-content">
                        ~{formatUsdM(slice.sliceUsdM)}
                      </strong>{" "}
                      for that slice alone
                      {ratio > 2 ? (
                        <>
                          {" "}
: a fraction of the reported total, which says most
                          of this vendor&apos;s revenue sits outside what that
                          measure can see (consumer subscriptions, coding
                          tools, licensing). The two are different quantities
                          and are never combined.
                        </>
                      ) : (
                        <>
                          . Measured slice and reported total are the same
                          order of magnitude here.
                        </>
                      )}
                    </p>
                  );
                })()}
              </div>
            ) : r.basis === "implied_from_valuation" && r.valuation ? (
              <p className="measure mt-1 text-sm text-muted">
                Inferred from a{" "}
                <strong className="text-base-content">
                  {formatUsdM(r.valuation.valuationUsdM)}
                </strong>{" "}
                valuation
                {r.valuation.statedCurrency
                  ? ` (stated as ${r.valuation.statedCurrency.code} ${(r.valuation.statedCurrency.amount / 1000).toFixed(0)}B, converted at ${r.valuation.statedCurrency.usdPerUnit} which is this product's assumption, not the source's)`
                  : ""}
                {r.valuation.state === "in_talks" ? (
                  <>
                    {" "}
                    <span className="rounded bg-warn-bg px-1.5 py-0.5 font-mono text-xs font-semibold uppercase tracking-wider text-warn">
                      In talks
                    </span>{" "}
                    <span>
                      The round has not closed, so the valuation is a report of
                      an intention and everything derived from it inherits that.
                    </span>
                  </>
                ) : null}{" "}
                {r.valuation.citation.publisher}, {r.valuation.citation.asOf}.
              </p>
            ) : (
              <p className="measure mt-1 text-sm text-muted">{r.absence}</p>
            )}
          </li>
        ))}
      </ul>

      <div className="mt-3">
        <DerivationDrawer title="How these ranges are derived">
          <p>
            Two lanes, and they are never mixed. A vendor that has stated a
            revenue figure shows that figure with the sentence it came from. A
            vendor that has not, but whose valuation is on the record, shows{" "}
            <strong className="text-base-content">
              valuation ÷ multiple
            </strong>{" "}
            across the whole band, which is arithmetic on one assumption rather
            than a measurement.
          </p>
          <p>
            The band inverts on purpose: a higher multiple implies less revenue
            for the same valuation, so the top of the multiple band produces the
            bottom of the revenue range.
          </p>
          <p className="measure text-muted">
            What is excluded matters as much. A compute or infrastructure
            commitment is not an equity valuation and is never divided by a
            multiple, however large the headline; the panel names the figure and
            says why it is not used. A round that is only reported as in talks is
            carried, but flagged, because the alternative is either to publish a
            rumour as fact or to hide a real signal.
          </p>
          <p className="measure text-muted">
            Treat every range here as an order of magnitude, not a forecast. It
            is a way of asking whether a vendor is a hundred-million or a
            ten-billion business, and it will not settle anything finer.
          </p>
        </DerivationDrawer>
      </div>
    </section>
  );
}
