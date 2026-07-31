import { LaneBadge } from "@/lib/ui/badges";
import { DerivationDrawer } from "@/lib/ui/score";
import type { ThirdPartyView } from "../third-party-data";

// Third-party signals divider section. Spec rule 4: third-party recognition
// lives only under this divider, attributed, and is never blended into any AG
// score. Each card is one real external source with the field it supplies,
// how far it reaches, how much of it the dataset marks verified, and when it
// was last fetched.

function fmtDate(iso: string | null): string | null {
  if (!iso) return null;
  return iso.slice(0, 10);
}

export function ThirdPartySignals({ view }: { view: ThirdPartyView }) {
  return (
    <section className="mt-6 border-t-2 border-dashed border-base-300 pt-4">
      <div className="flex flex-wrap items-center gap-2">
        <h2 className="text-[15px] font-bold">Third-party signals</h2>
        <LaneBadge lane={view.lane} />
        <span className="font-mono text-[10px] text-muted">
          {view.sources.length} sources
        </span>
      </div>
      <p className="mt-1 max-w-3xl text-[11.5px] text-muted">
        The external sources behind the reputation pillars, each named with the
        field it supplies and how far it reaches across the {view.vendorCount}{" "}
        vendors the dataset covers. These sit under this divider only: none of
        them is blended into any AG score, and AG publishes no rating of its
        own.
      </p>

      {view.sources.length === 0 ? (
        <p className="mt-3 rounded-lg border border-dashed border-base-300 px-3 py-6 text-[12px] text-muted">
          No third-party measured signals are available in the current
          reputation payload.
        </p>
      ) : (
        <div className="mt-3 grid grid-cols-1 gap-3 md:grid-cols-2 xl:grid-cols-3">
          {view.sources.map((s) => {
            const fetched = fmtDate(s.freshest);
            return (
              <article
                key={s.id}
                className="rounded-lg border border-base-300 bg-base-100 p-4"
              >
                <div className="flex items-start justify-between gap-2">
                  <span className="micro-label">{s.pillar} pillar</span>
                  <span className="rounded-full border border-base-300 px-2 py-0.5 font-mono text-[9px] text-muted">
                    {s.coverage} of {view.vendorCount}
                  </span>
                </div>
                <h3 className="mt-2 text-[13px] font-bold leading-snug">
                  {s.label}
                </h3>
                <p className="font-mono text-[9.5px] text-muted">{s.host}</p>
                <p className="mt-1.5 text-[11.5px] leading-snug text-muted">
                  {s.measures}
                </p>

                <dl className="mt-2 space-y-0.5 border-t border-base-300 pt-2">
                  {s.examples.map((e) => (
                    <div key={e.vendor} className="flex justify-between gap-2">
                      <dt className="text-[11px]">{e.vendor}</dt>
                      <dd className="font-mono text-[11px] font-semibold">
                        {e.value}
                      </dd>
                    </div>
                  ))}
                </dl>
                <p className="font-mono text-[9px] text-muted">{s.unit}</p>

                <div className="mt-2 flex flex-wrap items-center gap-1.5 border-t border-base-300 pt-2">
                  {s.verified > 0 ? (
                    <span
                      className="rounded bg-good-bg px-1.5 py-0.5 font-mono text-[8.5px] font-bold uppercase tracking-wider text-good"
                      title="Cells the dataset marks verified against the source."
                    >
                      {s.verified} verified
                    </span>
                  ) : null}
                  {s.documented > 0 ? (
                    <span className="rounded bg-base-200 px-1.5 py-0.5 font-mono text-[8.5px] font-bold uppercase tracking-wider text-muted">
                      {s.documented} documented
                    </span>
                  ) : null}
                  {s.seed > 0 ? (
                    <span
                      className="rounded bg-warn-bg px-1.5 py-0.5 font-mono text-[8.5px] font-bold uppercase tracking-wider text-warn"
                      title="Seed cells: recorded but not independently verified."
                    >
                      {s.seed} seed
                    </span>
                  ) : null}
                </div>
                <p className="mt-1 font-mono text-[9px] text-muted">
                  <code>{s.field}</code>
                  {fetched ? ` · fetched ${fetched}` : ""}
                </p>
              </article>
            );
          })}
        </div>
      )}

      <div className="mt-3">
        <DerivationDrawer title="How the third-party signals are handled">
          <p>
            Each card is one external source the reputation dataset cites, with
            the exact field it supplies. Coverage is how many of the{" "}
            {view.vendorCount} covered vendors carry a reading from that
            source; the rest are absent rather than filled in. The verified,
            documented and seed counts are the dataset&apos;s own cell grades,
            carried across unchanged.
          </p>
          <p>
            Two of these signals are deliberately read as lower-is-better.
            Status page incidents are self-reported by the vendor, so the count
            is a floor rather than a full record of downtime. Court filings are
            shown per thousand employees, because a raw count would rank by
            headcount rather than by exposure.
          </p>
          <p className="text-muted">
            {view.provenance
              ? `Dataset provenance: ${view.provenance}.`
              : "No provenance line is published with this payload."}
            {view.asOf ? ` Captured ${fmtDate(view.asOf)}.` : ""} These are
            third-party measurements shown as they arrive. They are never
            blended into an AG score, and no analyst-firm ranking, quadrant or
            wave is reproduced anywhere in this product.
          </p>
        </DerivationDrawer>
      </div>
    </section>
  );
}
