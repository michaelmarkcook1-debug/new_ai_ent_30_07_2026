import Link from "next/link";
import { LaneBadge } from "@/lib/ui/badges";
import { MicroLabel } from "@/lib/ui/micro";
import { ScorePill, DerivationDrawer } from "@/lib/ui/score";
import type { Spotlight } from "../types";
import type { VendorMetrics } from "@/lib/market-metrics";
import type { GapVendor } from "@/lib/narrative-gap";

// Spotlight tracking card using the narrative-versus-reality pattern:
// headline score, divergence badge, paired bars with deltas and captions,
// footer with source counts and generated date. SAMPLE badged.
export function SpotlightCard({
  vendorId,
  vendorName,
  spotlight,
}: {
  vendorId: string;
  vendorName: string;
  spotlight: Spotlight;
}) {
  return (
    <section className="rounded-lg border border-base-300 bg-base-100 p-4">
      <div className="flex flex-wrap items-start justify-between gap-2">
        <div>
          <MicroLabel
            label="Tracking"
            tooltip="Narrative versus reality: how the market conversation about this vendor compares with evidenced signals."
          />
          <h3 className="mt-0.5 text-[15px] font-bold">{vendorName}</h3>
        </div>
        <div className="flex flex-wrap items-center gap-2">
          <span className="rounded-full border border-base-300 px-2 py-0.5 font-mono text-[12px] text-muted">
            {spotlight.divergence}
          </span>
          <LaneBadge lane="sample" />
        </div>
      </div>

      <div className="mt-3 flex items-baseline gap-2">
        <span className="font-mono text-4xl font-bold">{spotlight.headlineScore}</span>
        <span className="font-mono text-[12px] text-muted">/ 100 composite</span>
      </div>

      <div className="mt-4 space-y-3">
        {spotlight.dimensions.map((d) => {
          const delta = d.narrative - d.reality;
          return (
            <div key={d.name}>
              <div className="flex items-center justify-between">
                <span className="text-[12px] font-semibold">{d.name}</span>
                <span
                  className={`font-mono text-[12px] ${delta > 0 ? "text-warn" : delta < 0 ? "text-good" : "text-muted"}`}
                  title="Narrative score minus reality score"
                >
                  {delta > 0 ? "+" : ""}
                  {delta} gap
                </span>
              </div>
              <div className="mt-1 space-y-1">
                <div className="flex items-center gap-2">
                  <span className="w-14 font-mono text-[12px] uppercase text-muted">Narrative</span>
                  <div className="h-1.5 flex-1 rounded-full bg-base-300/60">
                    <div
                      className="h-1.5 rounded-full bg-secondary/70 dark:bg-secondary-content/60"
                      style={{ width: `${d.narrative}%` }}
                    />
                  </div>
                  <span className="w-6 text-right font-mono text-[12px]">{d.narrative}</span>
                </div>
                <div className="flex items-center gap-2">
                  <span className="w-14 font-mono text-[12px] uppercase text-muted">Reality</span>
                  <div className="h-1.5 flex-1 rounded-full bg-base-300/60">
                    <div className="h-1.5 rounded-full bg-primary" style={{ width: `${d.reality}%` }} />
                  </div>
                  <span className="w-6 text-right font-mono text-[12px]">{d.reality}</span>
                </div>
              </div>
              <p className="mt-1 text-[12px] leading-snug text-muted">{d.caption}</p>
            </div>
          );
        })}
      </div>

      <div className="mt-4 flex items-center justify-between border-t border-base-300 pt-2">
        <span className="font-mono text-[12px] text-muted">
          {spotlight.sourceCounts.narrative} narrative + {spotlight.sourceCounts.reality} reality sources ·
          generated {spotlight.generated}
        </span>
        <Link
          href={`/vendor-view/${vendorId}`}
          className="text-[12px] font-semibold text-primary hover:underline"
        >
          Full vendor profile
        </Link>
      </div>
    </section>
  );
}

const plural = (n: number, one: string, many: string) =>
  `${n} ${n === 1 ? one : many}`;

// The derived narrative-versus-reality read, for vendors with no hand-written
// one. Same question as the editorial card above, answered by measurement
// rather than judgement, and badged DERIVED rather than SAMPLE so the two are
// never mistaken for each other.
//
// Both numbers are percentiles within the tracked AI vendor set, not absolute
// scores, because a capability score and a story count share no scale. The
// card says so rather than leaving a reader to assume "82" means 82 out of 100
// of anything.
export function DerivedGapCard({
  vendor,
  method,
  generatedAt,
  cohortSize,
}: {
  vendor: GapVendor;
  method: {
    reality: string;
    narrative: string;
    portfolio: string;
    gap: string;
    threshold: string;
    bias: string;
  };
  generatedAt: string;
  cohortSize: number;
}) {
  const gap = vendor.gap ?? 0;
  const narrative = vendor.narrativeScore ?? 0;
  const reality = vendor.realityScore ?? 0;

  return (
    <section className="rounded-lg border border-base-300 bg-base-100 p-4">
      <div className="flex flex-wrap items-start justify-between gap-2">
        <div>
          <MicroLabel
            label="Tracking"
            tooltip="Narrative versus reality, computed from measured inputs rather than written by hand."
          />
          <h3 className="mt-0.5 text-[15px] font-bold">{vendor.name}</h3>
          <p className="text-[12px] text-muted">
            {vendor.marketPosition ?? vendor.category}
          </p>
        </div>
        <div className="flex flex-wrap items-center gap-2">
          <span className="rounded-full border border-base-300 px-2 py-0.5 font-mono text-[12px] text-muted">
            {vendor.direction}
          </span>
          <LaneBadge lane="derived" />
        </div>
      </div>

      <div className="mt-3 flex items-baseline gap-2">
        <span
          className={`font-mono text-4xl font-bold ${gap > 0 ? "text-warn" : gap < 0 ? "text-good" : ""}`}
        >
          {gap > 0 ? "+" : ""}
          {gap}
        </span>
        <span className="font-mono text-[12px] text-muted">
          percentile points of gap
        </span>
      </div>

      <div className="mt-4 space-y-1.5">
        <div className="flex items-center gap-2">
          <span className="w-14 font-mono text-[12px] uppercase text-muted">
            Narrative
          </span>
          <div className="h-1.5 flex-1 rounded-full bg-base-300/60">
            <div
              className="h-1.5 rounded-full bg-secondary/70 dark:bg-secondary-content/60"
              style={{ width: `${narrative}%` }}
            />
          </div>
          <span className="w-9 text-right font-mono text-[12px]">{narrative}</span>
        </div>
        <div className="flex items-center gap-2">
          <span className="w-14 font-mono text-[12px] uppercase text-muted">
            Reality
          </span>
          <div className="h-1.5 flex-1 rounded-full bg-base-300/60">
            <div
              className="h-1.5 rounded-full bg-primary"
              style={{ width: `${reality}%` }}
            />
          </div>
          <span className="w-9 text-right font-mono text-[12px]">{reality}</span>
        </div>
      </div>

      <p className="mt-2 text-[12px] leading-snug text-muted">
        Both are percentiles within the {cohortSize} tracked AI vendors, not
        scores out of 100. Narrative is how far the technical conversation
        carries this vendor; reality is its evidence-weighted capability
        maturity.
      </p>

      {/* Where the portfolio departs from its own headline. A single overall
          number hides exactly what a buyer needs to know: a vendor strong on
          average can be weak precisely where their use case lives. */}
      {vendor.portfolio.length > 0 ? (
        <div className="mt-4 border-t border-base-300 pt-3">
          <MicroLabel
            label="Where the portfolio does not match the headline"
            tooltip="Capabilities furthest from this vendor's own overall standing, measured against the same capability in every other vendor."
          />
          <ul className="mt-2 space-y-2">
            {vendor.portfolio.slice(0, 4).map((c) => {
              const soft = c.divergence < 0;
              return (
                <li key={c.capabilityId} className="flex items-center gap-2.5">
                  <span
                    className={`w-14 shrink-0 text-right font-mono text-[13px] font-bold ${soft ? "text-warn" : "text-good"}`}
                  >
                    {c.divergence > 0 ? "+" : ""}
                    {c.divergence}
                  </span>
                  <div className="min-w-0 flex-1">
                    <div className="flex flex-wrap items-baseline gap-x-2">
                      <span className="text-[13px] font-semibold">
                        {c.capability}
                      </span>
                      <span className="font-mono text-[12px] text-muted">
                        {c.percentile} percentile
                      </span>
                      {c.thinEvidence ? (
                        <span className="rounded-full bg-warn-bg px-1.5 py-0.5 font-mono text-[12px] text-warn">
                          {c.evidenceGrade} asserted
                        </span>
                      ) : (
                        <span className="font-mono text-[12px] text-muted">
                          {c.evidenceGrade}
                        </span>
                      )}
                    </div>
                    <p className="text-[12px] leading-snug text-muted">
                      {soft
                        ? `Sits well below this vendor's own standing. If your use case leans on ${c.capability.toLowerCase()}, the headline overstates them.`
                        : `Runs ahead of this vendor's own standing, so it is a genuine strength rather than a halo from the overall score.`}
                    </p>
                  </div>
                </li>
              );
            })}
          </ul>
        </div>
      ) : null}

      <div className="mt-3 border-t border-base-300 pt-2">
        <DerivationDrawer title="How this is derived">
          <p>
            <strong>Reality.</strong> {method.reality} For {vendor.name} that is{" "}
            {vendor.realityRows} assessed capability rows, weakest evidence
            grade {vendor.realityWeakestEvidence ?? "not recorded"}, giving a
            weighted maturity of {vendor.reality ?? "not available"} before
            ranking.
          </p>
          <p>
            <strong>Narrative.</strong> {method.narrative}
          </p>
          <p>
            For {vendor.name} the sources that cleared the threshold were{" "}
            <strong>{vendor.narrativeSources.join(" and ") || "none"}</strong>:{" "}
            {plural(vendor.aieNews.items, "tagged news item", "tagged news items")}
            {vendor.hn
              ? `, and ${plural(vendor.hn.stories, "Hacker News story", "Hacker News stories")} on ${vendor.domain} drawing ${plural(vendor.hn.points, "point", "points")} and ${plural(vendor.hn.comments, "comment", "comments")}`
              : ", and no domain mapped for story matching"}
            . {method.threshold}
          </p>
          <p>
            <strong>The gap.</strong> {method.gap}
          </p>
          <p>
            <strong>Portfolio mismatch.</strong> {method.portfolio}
          </p>
          <p className="text-muted">
            <strong>What this does not measure.</strong> {method.bias}
          </p>
          <p className="text-muted">
            Compiled {generatedAt.slice(0, 10)} by
            scripts/narrative-reality-gap.mjs. It is a derived reading, not a
            published figure, and not the same thing as the hand-written
            editorial read carried for a few vendors.
          </p>
        </DerivationDrawer>
      </div>

      <div className="mt-2 flex items-center justify-end border-t border-base-300 pt-2">
        <Link
          href={`/vendor-view/${vendor.vendorId}`}
          className="text-[12px] font-semibold text-primary hover:underline"
        >
          Full vendor profile
        </Link>
      </div>
    </section>
  );
}

// Shown when the picked vendor has no narrative-versus-reality read.
//
// The spotlight above is an editorial judgement written per vendor, and it
// exists for four of them. Every other tracked vendor is offered in the picker
// anyway, because refusing to select them is worse than saying what is and is
// not published. Rather than a bare "nothing here", this shows the AG figures
// that do exist for the vendor, all of them real, so the slot stays useful.
//
// It deliberately invents no narrative or reality score. Those are exactly the
// kind of per-vendor number this app never fabricates.
export function VendorSnapshotCard({ vendor }: { vendor: VendorMetrics }) {
  const rows: Array<[string, number | null, string]> = [
    ["AG score", vendor.composite, "AG's overall score for this vendor."],
    ["Capability", vendor.maturity, "Mean evidence-graded capability maturity."],
    ["Reputation", vendor.reputation, "Mean of the customer, developer and employee pillars."],
    ["Momentum", vendor.momentum, "Rolling 30 day reading, published for a subset only."],
  ];

  return (
    <section className="rounded-lg border border-base-300 bg-base-100 p-4">
      <div className="flex flex-wrap items-start justify-between gap-2">
        <div>
          <MicroLabel
            label="Tracking"
            tooltip="The AG figures published for this vendor. No narrative-versus-reality read is written for it."
          />
          <h3 className="mt-0.5 text-[15px] font-bold">{vendor.name}</h3>
          <p className="text-[12px] text-muted">
            {vendor.marketPosition ?? vendor.category}
          </p>
        </div>
        <LaneBadge lane="aie-live" />
      </div>

      <p className="mt-3 rounded border border-base-300 bg-base-200/60 px-2.5 py-2 text-[12px] leading-snug text-muted">
        No narrative-versus-reality read is published for {vendor.name}. That
        comparison is written by hand for a few vendors at a time, and inventing
        one here would be inventing the numbers. What AG does publish for this
        vendor is below.
      </p>

      <dl className="mt-3 space-y-2">
        {rows.map(([label, value, note]) => (
          <div key={label} className="flex items-center justify-between gap-3">
            <div className="min-w-0">
              <dt className="text-[12px] font-semibold">{label}</dt>
              <dd className="text-[12px] leading-snug text-muted">{note}</dd>
            </div>
            {value === null ? (
              <span className="shrink-0 font-mono text-[12px] text-muted">
                not published
              </span>
            ) : (
              <ScorePill score={value} />
            )}
          </div>
        ))}
      </dl>

      <div className="mt-4 flex items-center justify-between border-t border-base-300 pt-2">
        <span className="font-mono text-[12px] text-muted">
          {vendor.lastUpdated ? `updated ${vendor.lastUpdated.slice(0, 10)}` : "no update date published"}
        </span>
        <Link
          href={`/vendor-view/${vendor.id}`}
          className="text-[12px] font-semibold text-primary hover:underline"
        >
          Full vendor profile
        </Link>
      </div>
    </section>
  );
}
