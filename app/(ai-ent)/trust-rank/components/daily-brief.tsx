import Link from "next/link";
import { MicroLabel } from "@/lib/ui/micro";
import { LaneBadge } from "@/lib/ui/badges";
import {
  upcoming,
  inForce,
  daysUntil,
  forWatchlist,
  OBLIGATIONS,
  OBLIGATIONS_RESEARCHED_AT,
  type Obligation,
} from "@/lib/aie/regulation/obligations";
import { vendorName } from "@/lib/aie/vendor-directory";

// The daily brief.
//
// Modelled on The Desk's Today page, and the thing worth copying is not the
// layout: it is that every row pairs a fact with what it means for the reader.
// A date on its own is a diary entry. "Article 50 is live and it binds you,
// not your vendor" is a brief.
//
// Three rules this page keeps:
//
//   Everything carries its receipt. Source name, publication date, evidence
//   class, and a link. A regulatory claim a reader cannot check is worth less
//   than no claim, because it still gets quoted.
//
//   Whose problem it is comes before what it says. Almost every tracker in
//   this market lists obligations without saying whether they land on the
//   model provider or on the organisation deploying. That is the first thing
//   a buyer needs and it is a column here.
//
//   An empty personal view is stated, never rendered blank. A reader with no
//   watchlist is told what the market read is and invited to build one, the
//   same rule the Pulse follows: an empty panel teaches somebody the feature
//   is broken rather than unfilled.

const BINDS_LABEL: Record<Obligation["binds"], string> = {
  provider: "Your vendor",
  deployer: "You",
  both: "Both",
};

const BINDS_TONE: Record<Obligation["binds"], string> = {
  provider: "border-base-300 bg-base-200/50 text-muted",
  deployer: "border-warn/50 bg-warn-bg/60 text-warn",
  both: "border-primary/40 bg-primary/10 text-primary",
};

function shortDate(iso: string): string {
  const [y, m, d] = iso.split("-");
  const months = [
    "Jan", "Feb", "Mar", "Apr", "May", "Jun",
    "Jul", "Aug", "Sep", "Oct", "Nov", "Dec",
  ];
  return `${Number(d)} ${months[Number(m) - 1]} ${y}`;
}

/** T−N days, or how long something has been live. Never a bare number. */
function countdown(days: number): string {
  if (days === 0) return "today";
  if (days > 0) {
    if (days < 45) return `T−${days} days`;
    const months = Math.round(days / 30.44);
    return `T−${days} days · about ${months} months`;
  }
  const since = Math.abs(days);
  if (since < 45) return `live for ${since} days`;
  return `live since ${Math.round(since / 30.44)} months ago`;
}

function ObligationRow({
  o,
  asOf,
  watched,
}: {
  o: Obligation;
  asOf: Date;
  watched: Set<string>;
}) {
  const days = daysUntil(o, asOf);
  const mine = o.affectedVendorIds.filter((v) => watched.has(v));

  return (
    <li className="border-b border-base-300/60 last:border-b-0">
      {/* Collapsed by default. Sixteen obligations rendered open is a wall a
          reader scrolls past rather than reads, and the summary line carries
          what they scan for: who it binds, which regime, and when.

          Native details/summary rather than a state hook, so this stays a
          server component and costs no client JavaScript. The two things a
          reader must not have to open a row to discover — that a date moved,
          and that it lands on a vendor they watch — are flagged in the
          summary itself. */}
      <details className="group py-3">
        <summary className="flex cursor-pointer list-none flex-wrap items-baseline gap-x-2 gap-y-1">
          <span className="font-mono text-[10px] text-muted transition-transform group-open:rotate-90">
            ▸
          </span>
          <span
            className={`rounded border px-1.5 py-0.5 font-mono text-[10px] font-semibold uppercase tracking-wider ${BINDS_TONE[o.binds]}`}
          >
            {BINDS_LABEL[o.binds]}
          </span>
          <span className="text-[13px] font-semibold">{o.regime}</span>
          {o.provision ? (
            <span className="font-mono text-[10px] uppercase tracking-wider text-muted">
              {o.provision}
            </span>
          ) : null}
          {o.moved ? (
            <span className="rounded border border-warn/50 bg-warn-bg/60 px-1 py-0.5 font-mono text-[9px] font-semibold uppercase tracking-wider text-warn">
              date moved
            </span>
          ) : null}
          {mine.length > 0 ? (
            <span className="rounded border border-primary/40 bg-primary/10 px-1 py-0.5 font-mono text-[9px] font-semibold uppercase tracking-wider text-primary">
              on your list
            </span>
          ) : null}
          <span className="ml-auto font-mono text-[10px] uppercase tracking-wider text-muted">
            {shortDate(o.effectiveDate)} · {countdown(days)}
          </span>
        </summary>

        <div className="mt-2 pl-4">

          <p className="measure mt-1 text-[12.5px] leading-relaxed text-muted">
            {o.requires}
          </p>

          {/* The point of the row. */}
          <p className="measure mt-1.5 text-[12.5px] font-medium leading-relaxed">
            {o.soWhat}
          </p>

          {mine.length > 0 ? (
            <p className="mt-1.5 rounded border border-primary/40 bg-primary/10 px-2 py-1 text-[11.5px] font-semibold text-primary">
              On your list: {mine.map(vendorName).join(", ")}
            </p>
          ) : null}

          {o.moved ? (
            <p className="measure mt-1.5 text-[11.5px] leading-relaxed text-warn">
              <b>This date moved.</b> It was {shortDate(o.moved.from)}, changed by{" "}
              {o.moved.by}. Anything planned against the old date needs rereading.
            </p>
          ) : null}

          {o.caveat ? (
            <p className="measure mt-1 text-[11.5px] leading-relaxed text-muted">
              {o.caveat}
            </p>
          ) : null}

          <a
            href={o.source.url}
            target="_blank"
            rel="noreferrer"
            className="mt-1.5 inline-block font-mono text-[10px] uppercase tracking-wider text-primary hover:underline"
          >
            {o.source.name} · {shortDate(o.source.published)} · class{" "}
            {o.source.evidenceClass} →
          </a>
        </div>
      </details>
    </li>
  );
}

export function DailyBrief({
  asOf,
  watchedVendorIds,
}: {
  /** Passed in rather than read here, so the render is a pure function. */
  asOf: Date;
  watchedVendorIds: string[];
}) {
  const watched = new Set(watchedVendorIds);
  const next = upcoming(asOf);
  const live = inForce(asOf);
  const mine = forWatchlist(watchedVendorIds);

  // What lands on the reader rather than on their vendors. This is the count
  // that changes behaviour, and no tracker in this market prints it.
  const onYou = OBLIGATIONS.filter(
    (o) => o.binds === "deployer" || o.binds === "both"
  );
  const onYouLive = onYou.filter((o) => daysUntil(o, asOf) <= 0);

  const jurisdictions = [
    ...new Set(OBLIGATIONS.map((o) => o.jurisdiction.split(" — ")[0])),
  ];

  return (
    <section className="finding-strong rounded-xl p-5 sm:p-6">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <MicroLabel
          label="Today's regulatory brief"
          tooltip="Dated obligations across the jurisdictions tracked, each carrying the source it was read from and whether it binds the model provider or you."
          heading
        />
        <LaneBadge lane="aie" />
      </div>

      <p className="measure mt-2 text-[13px] leading-relaxed">
        <b>
          {onYouLive.length} of the {OBLIGATIONS.length} tracked obligations are
          already in force and land on you rather than on your vendor.
        </b>{" "}
        {next.length} more are dated and coming, across{" "}
        {`${jurisdictions.join(", ")}.`} The column that matters is who carries
        each one: most AI regulation binds the organisation deploying, not the
        model provider, and a brief that lists dates without saying so leaves
        the reader assuming their vendor has it covered.
      </p>

      {/* The personal read, or an honest account of why there isn't one. */}
      {watchedVendorIds.length === 0 ? (
        <p className="measure mt-3 rounded border border-base-300 bg-base-200/40 px-3 py-2 text-[12.5px] leading-relaxed">
          <b>Nothing here is filtered to you yet.</b> Shortlist the vendors you
          actually run and this becomes a verdict on yours rather than the
          market&apos;s — the obligations landing on your providers get called
          out by name.{" "}
          <Link
            href="/vendor-view"
            className="font-semibold text-primary hover:underline"
          >
            Pick your vendors
          </Link>
          .
        </p>
      ) : mine.length === 0 ? (
        <p className="measure mt-3 rounded border border-base-300 bg-base-200/40 px-3 py-2 text-[12.5px] leading-relaxed">
          None of the {watchedVendorIds.length} vendors on your list carries a
          provider-side obligation in this set. That is a real absence rather
          than a gap: the duties that would bite you are the deployer ones
          below, and they apply whichever vendor you chose.
        </p>
      ) : (
        <p className="measure mt-3 rounded border border-primary/40 bg-primary/10 px-3 py-2 text-[12.5px] leading-relaxed">
          <b>{mine.length}</b>{" "}
          {mine.length === 1 ? "obligation lands" : "obligations land"} directly
          on vendors you watch. They are marked below.
        </p>
      )}

      <div className="mt-4">
        <p className="micro-label">
          Coming — {next.length} dated, soonest first · open a row for the
          detail and its source
        </p>
        <ul className="mt-1">
          {next.map((o) => (
            <ObligationRow key={o.id} o={o} asOf={asOf} watched={watched} />
          ))}
        </ul>
      </div>

      <div className="mt-5">
        <p className="micro-label">
          Already in force — {live.length}, most recent first
        </p>
        <ul className="mt-1">
          {live.map((o) => (
            <ObligationRow key={o.id} o={o} asOf={asOf} watched={watched} />
          ))}
        </ul>
      </div>

      <p className="measure mt-4 rounded border border-warn/40 bg-warn-bg/40 px-3 py-2 text-[11.5px] leading-relaxed">
        <b>This is a research summary, not legal advice.</b> Every row links the
        source it was read from and the date that source was published, because
        this area moves and secondary commentary goes stale fast — two public
        trackers still described a Colorado law that had been repealed three
        months earlier. Researched {shortDate(OBLIGATIONS_RESEARCHED_AT)}. Check
        the primary instrument before you commit budget to a date.
      </p>
    </section>
  );
}
