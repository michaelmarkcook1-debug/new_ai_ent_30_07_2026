import Link from "next/link";
import { LaneBadge } from "@/lib/ui/badges";
import { MicroLabel } from "@/lib/ui/micro";
import { Accordion } from "@/lib/ui/accordion";
import { MetaRow } from "./executive-brief";
import type { MarketSignal } from "@/lib/market-metrics";
import type { RecommendationMeta } from "@/lib/pulse/brief";
import type { DataLane } from "@/lib/provenance";

// The three short decision lists: material risks, movers, supporting signals.
//
// Each is capped at three visible entries with the remainder behind an
// accordion, so nothing is deleted from the product, only moved out of the
// first read.
//
// One rule throughout: where the source gives a headline and nothing more,
// this says so rather than dressing the headline up as analysis. Inventing a
// cause for a vendor's movement would be inventing the most consequential part.

export function MaterialRisks({
  risks,
  lane,
  lastUpdated,
}: {
  risks: MarketSignal[];
  lane: DataLane;
  lastUpdated: string | null;
}) {
  const top = risks.slice(0, 3);
  const rest = risks.slice(3);

  return (
    <section>
      <div className="flex flex-wrap items-center justify-between gap-2">
        <div className="flex flex-wrap items-center gap-2">
          <MicroLabel
            label="What could go wrong"
            tooltip="The most material open risks against tracked vendors, and what to do about each."
          />
          <LaneBadge lane={lane} />
        </div>
        <Link
          href="/trust-rank"
          className="text-sm font-semibold text-primary hover:underline"
        >
          Full governance and risk analysis →
        </Link>
      </div>

      {top.length === 0 ? (
        <p className="mt-3 rounded-lg border border-dashed border-base-300 px-3 py-5 text-sm text-muted">
          No high-severity risk is currently open against a tracked vendor.
        </p>
      ) : (
        <div className="mt-3 grid grid-cols-1 gap-3 @4xl:grid-cols-3">
          {top.map((r) => {
            const meta: RecommendationMeta = {
              horizon: r.severity?.toLowerCase() === "high" ? "Immediate" : "90 days",
              lane,
              lastUpdated,
            };
            return (
              <article
                key={`${r.vendorId}-${r.headline}`}
                className="flex flex-col rounded-lg border border-base-300 bg-base-100 p-5"
              >
                <div className="flex items-start justify-between gap-2">
                  <h3 className="text-sm font-bold leading-snug">
                    {r.headline}
                  </h3>
                  {r.severity ? (
                    <span className="shrink-0 rounded-full bg-warn-bg px-2 py-0.5 font-mono text-sm uppercase text-warn">
                      {r.severity}
                    </span>
                  ) : null}
                </div>

                <dl className="mt-2.5 flex-1 space-y-2">
                  <div>
                    <dt className="font-mono text-sm uppercase tracking-wider text-muted">
                      Who is affected
                    </dt>
                    <dd className="measure text-sm leading-snug">
                      Buyers with {r.vendorName} in scope, and anyone holding it
                      on a shortlist.
                    </dd>
                  </div>
                  <div>
                    <dt className="font-mono text-sm uppercase tracking-wider text-muted">
                      What to do
                    </dt>
                    <dd className="measure text-sm leading-snug">
                      Raise it in the next vendor review and get a dated
                      remediation position before widening commitment.
                    </dd>
                  </div>
                </dl>

                <div className="mt-3 border-t border-base-300 pt-2">
                  <MetaRow meta={meta} />
                </div>
              </article>
            );
          })}
        </div>
      )}

      {rest.length > 0 ? (
        <div className="mt-2">
          <Accordion title="Further open risks" count={rest.length}>
            <ul className="space-y-1.5">
              {rest.map((r) => (
                <li key={`${r.vendorId}-${r.headline}`} className="text-sm">
                  <span className="font-semibold">{r.vendorName}</span>
                  <span className="text-muted"> — {r.headline}</span>
                </li>
              ))}
            </ul>
          </Accordion>
        </div>
      ) : null}
    </section>
  );
}

export function Movers({
  gaining,
  slipping,
  lane,
  lastUpdated,
}: {
  gaining: MarketSignal[];
  slipping: MarketSignal[];
  lane: DataLane;
  lastUpdated: string | null;
}) {
  const block = (
    title: string,
    list: MarketSignal[],
    implication: (v: string) => string
  ) => {
    const top = list.slice(0, 3);
    const rest = list.slice(3);
    return (
      <div>
        <div className="mb-2 flex flex-wrap items-center gap-2">
          <h3 className="text-sm font-bold">{title}</h3>
          <LaneBadge lane={lane} />
        </div>
        {top.length === 0 ? (
          <p className="rounded-lg border border-dashed border-base-300 px-3 py-4 text-sm text-muted">
            Nothing classified this way at the moment.
          </p>
        ) : (
          <ul className="space-y-2">
            {top.map((s) => (
              <li
                key={`${s.vendorId}-${s.headline}`}
                className="rounded-lg border border-base-300 bg-base-100 p-4"
              >
                <div className="flex flex-wrap items-baseline justify-between gap-2">
                  <Link
                    href={`/vendor-view/${s.vendorId}`}
                    className="text-sm font-bold hover:text-primary hover:underline"
                  >
                    {s.vendorName}
                  </Link>
                </div>
                <p className="measure mt-1 text-sm leading-snug text-muted">
                  {s.headline}
                </p>
                <p className="measure mt-1.5 text-sm leading-snug">
                  <span className="font-mono text-sm uppercase tracking-wider text-muted">
                    For buyers
                  </span>
                  <br />
                  {implication(s.vendorName)}
                </p>
              </li>
            ))}
          </ul>
        )}
        {rest.length > 0 ? (
          <div className="mt-2">
            <Accordion title="More in this list" count={rest.length}>
              <ul className="space-y-1">
                {rest.map((s) => (
                  <li key={`${s.vendorId}-${s.headline}`} className="text-sm">
                    <span className="font-semibold">{s.vendorName}</span>
                    <span className="text-muted"> — {s.headline}</span>
                  </li>
                ))}
              </ul>
            </Accordion>
          </div>
        ) : null}
      </div>
    );
  };

  return (
    <section>
      <div className="flex flex-wrap items-center justify-between gap-2">
        <MicroLabel
          label="Who is moving"
          tooltip="Vendors changing position, and what that means for a shortlist."
        />
        <Link
          href="/vendor-view"
          className="text-sm font-semibold text-primary hover:underline"
        >
          All vendor rankings →
        </Link>
      </div>
      <div className="mt-3 grid grid-cols-1 gap-4 @xl:grid-cols-2">
        {block(
          "Gaining",
          gaining,
          (v) =>
            `Worth adding to a shortlist you are about to close, if ${v} sits in a category you are buying.`
        )}
        {block(
          "Slipping",
          slipping,
          (v) =>
            `Worth a dated check before renewing or widening ${v}, rather than an immediate change.`
        )}
      </div>
      <p className="measure mt-2 text-sm text-muted">
        Our analysis reports the movement and the reason each vendor is
        classified that way. Where a cause is not published, none is asserted
        here: attributing a reason we cannot evidence would be the least
        reliable and most consequential part of the read.
      </p>
    </section>
  );
}

export interface PulseSignal {
  what: string;
  why: string;
  supports: string;
  source: string;
  href: string | null;
  lane: DataLane;
}

export function SupportingSignals({ signals }: { signals: PulseSignal[] }) {
  return (
    <section>
      <div className="flex flex-wrap items-center justify-between gap-2">
        <MicroLabel
          label="Signals behind today's Pulse"
          tooltip="The evidence the judgement above rests on."
        />
        <Link
          href="/news-feed"
          className="text-sm font-semibold text-primary hover:underline"
        >
          All market news →
        </Link>
      </div>

      {signals.length === 0 ? (
        <p className="mt-3 rounded-lg border border-dashed border-base-300 px-3 py-5 text-sm text-muted">
          No signal currently carries enough weight to sit behind today&apos;s
          judgement.
        </p>
      ) : (
        <ol className="mt-3 grid grid-cols-1 gap-3 @4xl:grid-cols-3">
          {signals.map((s, i) => (
            <li
              key={s.what}
              className="flex flex-col rounded-lg border border-base-300 bg-base-100 p-5"
            >
              <div className="flex items-center justify-between gap-2">
                <span className="font-mono text-sm uppercase tracking-wider text-muted">
                  Signal {i + 1}
                </span>
                <LaneBadge lane={s.lane} />
              </div>
              <p className="measure mt-1.5 text-sm font-semibold leading-snug">
                {s.what}
              </p>
              <dl className="mt-2 flex-1 space-y-2">
                <div>
                  <dt className="font-mono text-sm uppercase tracking-wider text-muted">
                    Why it matters
                  </dt>
                  <dd className="measure text-sm leading-snug">{s.why}</dd>
                </div>
                <div>
                  <dt className="font-mono text-sm uppercase tracking-wider text-muted">
                    Supports
                  </dt>
                  <dd className="measure text-sm leading-snug text-muted">
                    {s.supports}
                  </dd>
                </div>
              </dl>
              <div className="mt-3 flex flex-wrap items-center justify-between gap-2 border-t border-base-300 pt-2">
                {s.href ? (
                  <Link
                    href={s.href}
                    className="text-sm font-semibold text-primary hover:underline"
                  >
                    {s.source} →
                  </Link>
                ) : (
                  <span className="font-mono text-sm text-muted">
                    {s.source}
                  </span>
                )}
              </div>
            </li>
          ))}
        </ol>
      )}
    </section>
  );
}

export function DeeperAnalysis() {
  const links: [string, string, string][] = [
    ["/market-watch", "Market Watch", "Category shares, leaders and the winning or losing read"],
    ["/vendor-view", "Vendor View", "Full rankings and profiles for every tracked vendor"],
    ["/price-performance", "Price / Performance", "The full cost and capability analysis"],
    ["/competitive-intel", "Competitive Intel", "Model providers across ten assessed capabilities"],
    ["/financial-snapshot", "Financial Snapshot", "Vendor financials, segment revenue and disclosed AI revenue"],
    ["/trust-rank", "Trust Rank", "Governance, regulatory exposure and open risk"],
  ];
  return (
    <section>
      <MicroLabel
        label="Go deeper"
        tooltip="The full analysis behind each part of this brief."
      />
      <ul className="mt-2 grid grid-cols-1 gap-2 @xl:grid-cols-2 @4xl:grid-cols-3">
        {links.map(([href, title, blurb]) => (
          <li key={href}>
            <Link
              href={href}
              className="block rounded-lg border border-base-300 px-3 py-3 transition hover:border-primary"
            >
              <span className="text-sm font-semibold">{title}</span>
              <span className="measure mt-0.5 block text-sm leading-snug text-muted">
                {blurb}
              </span>
            </Link>
          </li>
        ))}
      </ul>
    </section>
  );
}
