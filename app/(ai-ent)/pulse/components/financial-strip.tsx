import Link from "next/link";
import { LaneBadge } from "@/lib/ui/badges";
import { MicroLabel } from "@/lib/ui/micro";
import { DerivationDrawer } from "@/lib/ui/score";
import type { DataLane } from "@/lib/provenance";

// Four financial indicators, no more. The full analysis stays on Financial
// Snapshot; this only answers whether the money behind the market is holding.
//
// The most useful thing this section reports is an absence: six of the nine
// tracked public vendors state no AI revenue figure at all in their filings.
// That is a finding, not a gap to be filled with an estimate, and it is shown
// as prominently as the figures that do exist.

export interface FinancialIndicator {
  label: string;
  value: string;
  detail: string;
  lane: DataLane;
  /** True when the value is an absence rather than a measurement. */
  isAbsence?: boolean;
}

export function FinancialStrip({
  indicators,
  capturedAt,
}: {
  indicators: FinancialIndicator[];
  capturedAt: string | null;
}) {
  const measured = indicators.filter((i) => !i.isAbsence);
  const absent = indicators.filter((i) => i.isAbsence);

  return (
    <section>
      <div className="flex flex-wrap items-center justify-between gap-2">
        <div className="flex flex-wrap items-center gap-2">
          <MicroLabel
            label="Is the money holding"
            tooltip="Four indicators on the financial footing behind the vendor set."
          />
          <LaneBadge lane="aie" />
        </div>
        <Link
          href="/financial-snapshot"
          className="text-[12px] font-semibold text-primary hover:underline"
        >
          Full financial snapshot →
        </Link>
      </div>

      {/* Indicators that carry a figure get a card. Ones that carry an absence
          get a single shared line underneath, because four cards each saying
          "not disclosed" in 17px bold spent most of this section's space, and
          most of its visual weight, on nothing. The absence is still stated:
          it is just no longer the loudest thing here. */}
      <div className="mt-3 grid grid-cols-1 gap-3 @xl:grid-cols-2 @6xl:grid-cols-4">
        {measured.map((ind) => (
          <div
            key={ind.label}
            className="rounded-lg border border-base-300 bg-base-100 p-4"
          >
            <div className="flex items-start justify-between gap-2">
              <h3 className="font-mono text-[12px] uppercase tracking-wider text-muted">
                {ind.label}
              </h3>
              <LaneBadge lane={ind.lane} />
            </div>
            <p className="mt-1.5 text-[24px] font-bold leading-none">
              {ind.value}
            </p>
            <p className="measure mt-1.5 text-[13px] leading-snug text-muted">
              {ind.detail}
            </p>
          </div>
        ))}
      </div>

      {absent.length > 0 ? (
        <p className="measure mt-2 text-[12px] leading-snug text-muted">
          <span className="font-semibold">Not available: </span>
          {absent.map((a) => a.label.toLowerCase()).join(", ")}. Nobody
          publishes these for this vendor set, and no estimate is substituted
          in their place.
        </p>
      ) : null}

      <div className="mt-2">
        <DerivationDrawer title="Where these come from">
          <p>
            Read from SEC filings for the tracked public vendors: segment
            revenue extracted from the filing instance documents, and any
            quantified AI revenue statement found by full-text search of the
            filings themselves.
          </p>
          <p>
            <strong>
              Most vendors state no AI revenue figure, and that is reported as
              an absence rather than estimated.
            </strong>{" "}
            Where a vendor does not disclose, this shows &quot;not
            disclosed&quot;. No range, no analyst override and no modelled
            figure is substituted, because presenting a construction as a
            reported fact is the failure this section exists to avoid.
          </p>
          <p className="measure text-muted">
            Private vendors file nothing, so they are outside this entirely
            rather than being estimated into it.
            {capturedAt ? ` Filings captured ${capturedAt.slice(0, 10)}.` : ""}
          </p>
        </DerivationDrawer>
      </div>
    </section>
  );
}
