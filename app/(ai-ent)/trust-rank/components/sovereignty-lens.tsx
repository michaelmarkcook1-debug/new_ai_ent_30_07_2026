import { LaneBadge } from "@/lib/ui/badges";
import { MicroLabel } from "@/lib/ui/micro";
import {
  sovereigntyRows,
  sovereigntyCounts,
  FLAG_LABEL,
  type SovereigntyFlag,
} from "@/lib/shield/sovereignty";

// The Sovereignty Lens.
//
// The Shield answers "where does my data live". This answers the question that
// one cannot: which legal system reaches the company holding it. A vendor can
// host in Singapore and still sit under a parent subject to another country's
// law, and a buyer reading only the residency row will walk past that.
//
// Nothing here is a second dataset. Every row is a projection of the Shield's
// own marks plus one public-record fact (country of incorporation or parent
// headquarters), so the two can never drift apart. The lane is DERIVED for
// exactly that reason: no source publishes this cut, and we computed it from
// named inputs that can be re-checked.
//
// The flag is deliberately three-valued rather than a score. "Hard stop" is
// reserved for a vendor whose own document rules out a residency choice, which
// at present is DeepSeek and only because DeepSeek says so in writing.
// "Consideration" is where hosting and parentage disagree. Everything else
// carries no flag, and that is stated rather than left blank, because a blank
// cell reads as an unfinished assessment.

const FLAG_TONE: Record<SovereigntyFlag, string> = {
  "hard-stop": "border-error/50 bg-bad-bg text-error",
  consideration: "border-warn/50 bg-warn-bg text-warn",
  none: "border-base-300 bg-base-200/60 text-muted",
};

export function SovereigntyLens({ onList }: { onList: string[] }) {
  const rows = sovereigntyRows();
  const counts = sovereigntyCounts();
  const mine = new Set(onList);

  return (
    <section className="rounded-lg border border-base-300 bg-base-100 p-5">
      <div className="flex flex-wrap items-center gap-2">
        <MicroLabel
          label="The Sovereignty Lens"
          tooltip="Whose government can compel access. The same verified marks as the Shield, re-cut by the jurisdiction of the company holding your data rather than by where the data sits."
          heading
        />
        <LaneBadge lane="derived" />
      </div>

      <p className="measure mt-2 text-[13px] leading-relaxed">
        <b>
          Residency tells you where your data sits. It does not tell you who can
          reach it.
        </b>{" "}
        Of {rows.length} providers, {counts["hard-stop"]} rules out a residency
        choice in its own terms and {counts.consideration} host outside their
        parent&apos;s jurisdiction, which is the gap worth reading twice: the
        hosting is documented and the parentage still matters.{" "}
        {counts.none} carry no flag. Nothing here is a new claim about a vendor.
        It is the Shield&apos;s own marks plus the public record of where each
        company is incorporated.
      </p>

      <ul className="mt-4">
        {rows.map((r) => (
          <li key={r.slug} className="border-b border-base-300/60 last:border-b-0">
            <details className="group py-2.5">
              <summary className="flex cursor-pointer list-none flex-wrap items-baseline gap-x-2 gap-y-1">
                <span className="font-mono text-[10px] text-muted transition-transform group-open:rotate-90">
                  ▸
                </span>
                <span
                  className={`rounded border px-1.5 py-0.5 font-mono text-[10px] font-semibold uppercase tracking-wider ${FLAG_TONE[r.flag]}`}
                >
                  {FLAG_LABEL[r.flag]}
                </span>
                <span className="text-[13px] font-semibold">{r.vendor}</span>
                {mine.has(r.slug) ? (
                  <span className="rounded border border-primary/40 bg-primary/10 px-1 py-0.5 font-mono text-[9px] font-semibold uppercase tracking-wider text-primary">
                    on your list
                  </span>
                ) : null}
                <span className="ml-auto font-mono text-[10px] uppercase tracking-wider text-muted">
                  {r.hqJurisdiction}
                </span>
              </summary>

              <div className="mt-1.5 pl-4">
                <p className="measure text-[12.5px] leading-relaxed">
                  {r.flagNote}
                </p>

                <p className="micro-label mt-2.5">
                  Where the data sits, in the vendor&apos;s words
                </p>
                <p className="measure mt-0.5 text-[12.5px] leading-relaxed text-muted">
                  {r.residency.note}
                </p>
                {r.residency.source ? (
                  <a
                    href={r.residency.source.url}
                    target="_blank"
                    rel="noreferrer"
                    className="mt-1 inline-block font-mono text-[10px] uppercase tracking-wider text-primary hover:underline"
                  >
                    {r.residency.source.name} →
                  </a>
                ) : (
                  <p className="mt-1 font-mono text-[10px] uppercase tracking-wider text-muted">
                    No receipt obtained this pass
                  </p>
                )}

                <p className="micro-label mt-2.5">How long it is kept</p>
                <p className="measure mt-0.5 text-[12.5px] leading-relaxed text-muted">
                  {r.retention.note}
                </p>
                {r.retention.source ? (
                  <a
                    href={r.retention.source.url}
                    target="_blank"
                    rel="noreferrer"
                    className="mt-1 inline-block font-mono text-[10px] uppercase tracking-wider text-primary hover:underline"
                  >
                    {r.retention.source.name} →
                  </a>
                ) : (
                  <p className="mt-1 font-mono text-[10px] uppercase tracking-wider text-muted">
                    No receipt obtained this pass
                  </p>
                )}
              </div>
            </details>
          </li>
        ))}
      </ul>

      <p className="measure mt-3 rounded border border-base-300 bg-base-200/40 px-3 py-2 text-[11.5px] leading-relaxed text-muted">
        Country of incorporation and parent headquarters are public record for
        named companies, so they carry no vendor citation. Where the Shield
        already fetched a parent-company fact, that fetched fact is the one
        shown rather than a re-derived one. This lens does not attempt to
        summarise any country&apos;s access powers, which vary by instrument and
        by the data in question: it tells you which legal system to ask about.
      </p>
    </section>
  );
}
