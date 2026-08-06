import { LaneBadge } from "@/lib/ui/badges";
import { MicroLabel } from "@/lib/ui/micro";
import type { StatusRow } from "@/lib/desk/status";
import { vendorIdForName } from "@/lib/desk/vendor-map";

// The Tape: are the labs up right now?
//
// Ported from The Security Desk, 6 August 2026. Nothing else in this product
// answers a question about this minute. Every other surface here is a
// considered read on a market that moves in weeks; this one is the only place
// a reader finds out that the thing they built on is down while they are
// looking at it.
//
// Two rules carried across from the source.
//
//   A source that does not answer renders nothing. Not "operational", not a
//   stale value, not an error card. The count below states how many of the
//   attempted pages replied, so a short strip reads as a dark source rather
//   than as a healthy market.
//
//   The provider's own words. `description` is whatever the status page says,
//   never our paraphrase of it, so "Partial System Degradation" is their
//   phrase and their judgement of severity, not ours.

export function TheTape({
  statuses,
  attempted,
  watchedVendorIds,
}: {
  statuses: StatusRow[];
  attempted: number;
  watchedVendorIds: string[];
}) {
  const watched = new Set(watchedVendorIds);
  const down = statuses.filter((s) => !s.operational);
  const mineDown = down.filter((s) => {
    const id = vendorIdForName(s.provider);
    return id !== null && watched.has(id);
  });

  return (
    <section className="rounded-lg border border-base-300 bg-base-100 p-5">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <MicroLabel
          label="The Tape"
          tooltip="Live status from each provider's own status page, read on this request. A page that does not answer shows nothing rather than something invented."
        />
        <LaneBadge lane="live" />
      </div>

      <p className="measure mt-2 text-[13px] leading-relaxed">
        {statuses.length === 0 ? (
          <>
            <b>No status page answered just now.</b> That is a fact about our
            reach, not about the providers: nothing here should be read as
            either up or down.
          </>
        ) : down.length === 0 ? (
          <>
            <b>All {statuses.length} providers reporting normal service.</b>{" "}
            Read from their own status pages on this request.
          </>
        ) : (
          <>
            <b>
              {down.length} of {statuses.length} providers reporting a problem
            </b>
            {mineDown.length > 0 ? (
              <>
                , and {mineDown.length === 1 ? "one is" : `${mineDown.length} are`}{" "}
                on your shortlist. Check your failover path and assume those
                calls fail.
              </>
            ) : (
              <>
                , none of them on your shortlist. The same failure is one
                procurement away.
              </>
            )}
          </>
        )}
      </p>

      {statuses.length > 0 ? (
        <div className="mt-3 flex flex-wrap gap-2">
          {statuses.map((s) => {
            const id = vendorIdForName(s.provider);
            const mine = id !== null && watched.has(id);
            return (
              <a
                key={s.provider}
                href={s.source.url}
                target="_blank"
                rel="noreferrer"
                title={`${s.provider}: ${s.description}. Opens ${s.source.name}.`}
                className={`inline-flex items-center gap-2 rounded border px-2.5 py-1.5 text-[12px] transition-colors hover:border-primary/50 ${
                  s.operational
                    ? "border-base-300 bg-base-200/40"
                    : "border-warn/50 bg-warn-bg"
                }`}
              >
                <span
                  className={`h-1.5 w-1.5 rounded-full ${s.operational ? "bg-good" : "bg-warn"}`}
                  aria-hidden
                />
                <span className="font-semibold">{s.provider}</span>
                <span
                  className={s.operational ? "text-muted" : "font-medium text-warn"}
                >
                  {s.description}
                </span>
                {mine ? (
                  <span className="rounded border border-primary/40 bg-primary/10 px-1 font-mono text-[9px] font-semibold uppercase tracking-wider text-primary">
                    yours
                  </span>
                ) : null}
              </a>
            );
          })}
        </div>
      ) : null}

      <p className="mt-3 font-mono text-[10px] uppercase tracking-wider text-muted">
        {statuses.length} of {attempted} status pages answered
        {statuses.length < attempted
          ? " · the rest show nothing rather than a guess"
          : ""}
      </p>
    </section>
  );
}
