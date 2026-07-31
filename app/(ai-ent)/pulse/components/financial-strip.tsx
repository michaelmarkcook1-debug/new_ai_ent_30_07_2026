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
          className="text-[11.5px] font-semibold text-primary hover:underline"
        >
          Full financial snapshot →
        </Link>
      </div>

      <div className="mt-3 grid grid-cols-1 gap-3 sm:grid-cols-2 xl:grid-cols-4">
        {indicators.map((ind) => (
          <div
            key={ind.label}
            className="rounded-lg border border-base-300 bg-base-100 p-4"
          >
            <div className="flex items-start justify-between gap-2">
              <h3 className="font-mono text-[10px] uppercase tracking-wider text-muted">
                {ind.label}
              </h3>
              <LaneBadge lane={ind.lane} />
            </div>
            <p
              className={`mt-1.5 text-[17px] font-bold leading-tight ${ind.isAbsence ? "text-muted" : ""}`}
            >
              {ind.value}
            </p>
            <p className="mt-1 text-[11.5px] leading-snug text-muted">
              {ind.detail}
            </p>
          </div>
        ))}
      </div>

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
          <p className="text-muted">
            Private vendors file nothing, so they are outside this entirely
            rather than being estimated into it.
            {capturedAt ? ` Filings captured ${capturedAt.slice(0, 10)}.` : ""}
          </p>
        </DerivationDrawer>
      </div>
    </section>
  );
}
