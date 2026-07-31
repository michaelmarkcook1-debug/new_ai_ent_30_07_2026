import Link from "next/link";
import { LaneBadge } from "@/lib/ui/badges";
import { MicroLabel } from "@/lib/ui/micro";
import { ScorePill } from "@/lib/ui/score";
import type { Spotlight } from "../types";
import type { VendorMetrics } from "@/lib/market-metrics";

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
          <span className="rounded-full border border-base-300 px-2 py-0.5 font-mono text-[10px] text-muted">
            {spotlight.divergence}
          </span>
          <LaneBadge lane="sample" />
        </div>
      </div>

      <div className="mt-3 flex items-baseline gap-2">
        <span className="font-mono text-4xl font-bold">{spotlight.headlineScore}</span>
        <span className="font-mono text-[11px] text-muted">/ 100 composite</span>
      </div>

      <div className="mt-4 space-y-3">
        {spotlight.dimensions.map((d) => {
          const delta = d.narrative - d.reality;
          return (
            <div key={d.name}>
              <div className="flex items-center justify-between">
                <span className="text-[12px] font-semibold">{d.name}</span>
                <span
                  className={`font-mono text-[10px] ${delta > 0 ? "text-warn" : delta < 0 ? "text-good" : "text-muted"}`}
                  title="Narrative score minus reality score"
                >
                  {delta > 0 ? "+" : ""}
                  {delta} gap
                </span>
              </div>
              <div className="mt-1 space-y-1">
                <div className="flex items-center gap-2">
                  <span className="w-14 font-mono text-[9px] uppercase text-muted">Narrative</span>
                  <div className="h-1.5 flex-1 rounded-full bg-base-300/60">
                    <div
                      className="h-1.5 rounded-full bg-secondary/70 dark:bg-secondary-content/60"
                      style={{ width: `${d.narrative}%` }}
                    />
                  </div>
                  <span className="w-6 text-right font-mono text-[10px]">{d.narrative}</span>
                </div>
                <div className="flex items-center gap-2">
                  <span className="w-14 font-mono text-[9px] uppercase text-muted">Reality</span>
                  <div className="h-1.5 flex-1 rounded-full bg-base-300/60">
                    <div className="h-1.5 rounded-full bg-primary" style={{ width: `${d.reality}%` }} />
                  </div>
                  <span className="w-6 text-right font-mono text-[10px]">{d.reality}</span>
                </div>
              </div>
              <p className="mt-1 text-[11px] leading-snug text-muted">{d.caption}</p>
            </div>
          );
        })}
      </div>

      <div className="mt-4 flex items-center justify-between border-t border-base-300 pt-2">
        <span className="font-mono text-[10px] text-muted">
          {spotlight.sourceCounts.narrative} narrative + {spotlight.sourceCounts.reality} reality sources ·
          generated {spotlight.generated}
        </span>
        <Link
          href={`/vendor-view/${vendorId}`}
          className="text-[11px] font-semibold text-primary hover:underline"
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
          <p className="text-[11px] text-muted">
            {vendor.marketPosition ?? vendor.category}
          </p>
        </div>
        <LaneBadge lane="aie-live" />
      </div>

      <p className="mt-3 rounded border border-base-300 bg-base-200/60 px-2.5 py-2 text-[11.5px] leading-snug text-muted">
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
              <dd className="text-[11px] leading-snug text-muted">{note}</dd>
            </div>
            {value === null ? (
              <span className="shrink-0 font-mono text-[10px] text-muted">
                not published
              </span>
            ) : (
              <ScorePill score={value} />
            )}
          </div>
        ))}
      </dl>

      <div className="mt-4 flex items-center justify-between border-t border-base-300 pt-2">
        <span className="font-mono text-[10px] text-muted">
          {vendor.lastUpdated ? `updated ${vendor.lastUpdated.slice(0, 10)}` : "no update date published"}
        </span>
        <Link
          href={`/vendor-view/${vendor.id}`}
          className="text-[11px] font-semibold text-primary hover:underline"
        >
          Full vendor profile
        </Link>
      </div>
    </section>
  );
}
