import Link from "next/link";
import { LaneBadge } from "@/lib/ui/badges";
import { MicroLabel } from "@/lib/ui/micro";
import type { Spotlight } from "../types";

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
      <div className="flex items-start justify-between gap-2">
        <div>
          <MicroLabel
            label="Tracking"
            tooltip="Narrative versus reality: how the market conversation about this vendor compares with evidenced signals."
          />
          <h3 className="mt-0.5 text-[15px] font-bold">{vendorName}</h3>
        </div>
        <div className="flex items-center gap-2">
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
