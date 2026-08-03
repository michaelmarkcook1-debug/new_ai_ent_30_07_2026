import Link from "next/link";
import { LaneBadge } from "@/lib/ui/badges";
import { MicroLabel } from "@/lib/ui/micro";
import { DerivationDrawer } from "@/lib/ui/score";
import { MetaRow } from "./executive-brief";
import type { PricePick } from "@/lib/pulse/brief";

// The five price-performance calls, compact. The full analysis stays on its
// own page; this is only the decisions.
//
// A pick with no evidence renders as the reason it has none, in the product's
// own language, rather than being quietly dropped. A missing card would read
// as "nothing to say here", which is a different claim from "one capture
// cannot show movement".

export function PriceSummary({
  picks,
  benchmarkSource,
  modelCount,
}: {
  picks: PricePick[];
  benchmarkSource: string;
  modelCount: number;
}) {
  return (
    <section>
      <div className="flex flex-wrap items-center justify-between gap-2">
        <div className="flex flex-wrap items-center gap-2">
          <MicroLabel
            label="What to buy, and what to challenge"
            tooltip="The price-performance calls, from the current benchmark capture."
          />
          <LaneBadge lane="derived" />
        </div>
        <Link
          href="/price-performance"
          className="text-sm font-semibold text-primary hover:underline"
        >
          Full price-performance analysis →
        </Link>
      </div>

      <div className="mt-3 grid grid-cols-1 gap-3 @xl:grid-cols-2 @4xl:grid-cols-3">
        {picks.map((p) => (
          <div
            key={p.slot}
            className="flex flex-col rounded-lg border border-base-300 bg-base-100 p-5"
          >
            <h3 className="font-mono text-sm uppercase tracking-wider text-muted">
              {p.slot}
            </h3>

            {p.unavailable ? (
              // An absence is stated, not shouted. Rendering these at the same
              // weight as a finding put four "no data" messages among the
              // thirteen largest items on the page.
              <p className="measure mt-2 flex-1 text-sm leading-snug text-muted">
                {p.unavailable}
              </p>
            ) : (
              <>
                <p className="mt-1.5 text-balance text-lg font-bold leading-tight">
                  {p.model}
                </p>
                <p className="measure mt-1.5 text-sm leading-snug text-muted">
                  {p.reason}
                </p>
                <p className="measure mt-2 flex-1 text-sm leading-snug">
                  <span className="font-mono text-sm uppercase tracking-wider text-muted">
                    Enterprise fit
                  </span>
                  <br />
                  {p.fit}
                </p>
              </>
            )}

            <div className="mt-3 border-t border-base-300 pt-2">
              <MetaRow meta={p.meta} />
            </div>
          </div>
        ))}
      </div>

      <div className="mt-2">
        <DerivationDrawer title="How these picks are chosen">
          <p>
            All five read the same capture: {modelCount} models carrying both a
            published input price and a {benchmarkSource} benchmark score. Value
            is benchmark points per dollar of input cost per million tokens.
          </p>
          <p>
            <strong>Best value</strong> is the highest points-per-dollar among
            models scoring at or above the median benchmark score, so the slot
            cannot be won by something too weak to deploy.{" "}
            <strong>Lowest cost</strong> and <strong>complex reasoning</strong>{" "}
            are the extremes of price and score respectively.{" "}
            <strong>Priced above evidenced value</strong> is the weakest
            points-per-dollar among models priced at or above the field median.
          </p>
          <p className="measure text-muted">
            Input price only. Output tokens are priced separately and the mix
            varies by workload, so a blended figure would imply a workload this
            has not measured. Treat these as a starting shortlist to test
            against your own token mix, not a purchase order.
          </p>
        </DerivationDrawer>
      </div>
    </section>
  );
}
