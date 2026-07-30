import { LaneBadge } from "@/lib/ui/badges";
import type { ReputationFixture } from "../types";

// Third-party signals divider section (spec rule: analyst recognitions live
// only under this divider, attributed, never blended into any AG score).
export function ThirdPartySignals({ fixture }: { fixture: ReputationFixture }) {
  return (
    <section className="mt-6 border-t-2 border-dashed border-base-300 pt-4">
      <div className="flex flex-wrap items-center gap-2">
        <h2 className="text-[15px] font-bold">Third-party signals</h2>
        <LaneBadge lane="sample" />
      </div>
      <p className="mt-1 max-w-2xl text-[11px] text-muted">
        Industry analyst recognition, attributed on wiring. These entries sit
        under this divider only: they are never blended into any AG score.
      </p>
      <div className="mt-3 grid grid-cols-1 gap-3 lg:grid-cols-3">
        {fixture.thirdPartySignals.map((s) => (
          <article key={s.id} className="rounded-lg border border-base-300 bg-base-100 p-4">
            <div className="flex items-start justify-between gap-2">
              <span className="micro-label">{s.period}</span>
              <LaneBadge lane="sample" />
            </div>
            <h3 className="mt-2 text-[13px] font-bold leading-snug">{s.title}</h3>
            <p className="mt-1 text-[12px] leading-snug text-muted">{s.detail}</p>
            <p className="mt-3 border-t border-base-300 pt-2 text-[11px] font-semibold text-base-content/80">
              {s.source}
            </p>
            <p className="font-mono text-[9px] uppercase tracking-wider text-muted">
              {s.sourceType}
            </p>
          </article>
        ))}
      </div>
      <p className="mt-2 font-mono text-[10px] text-muted">
        Generated {fixture.generated}. {fixture.note}
      </p>
    </section>
  );
}
