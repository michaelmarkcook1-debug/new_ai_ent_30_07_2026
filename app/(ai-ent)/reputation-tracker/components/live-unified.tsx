"use client";

import { useEffect, useState } from "react";
import { brFetch, type BrSource } from "@/lib/br-client";
import { LaneBadge } from "@/lib/ui/badges";
import { DerivationDrawer } from "@/lib/ui/score";
import { MicroLabel } from "@/lib/ui/micro";
import { EmptyState } from "@/lib/ui/page";
import type { UnifiedReputation } from "../types";

// BoardRadar universe tickers with confirmed unified-reputation coverage
// (see DATA_COVERAGE.md). The AI labs above are not in this universe.
const TICKERS = ["MSFT", "GOOGL", "AMZN", "IBM", "ORCL", "CRM", "NOW", "SAP"];

// Turn the API's camelCase category keys into readable labels without
// changing the underlying metric names (e.g. workLifeBalance -> Work life balance).
function labelise(key: string): string {
  const spaced = key.replace(/([A-Z])/g, " $1").toLowerCase().trim();
  return spaced.charAt(0).toUpperCase() + spaced.slice(1);
}

function Rating({ value, outOf = 5 }: { value: number; outOf?: number }) {
  return (
    <span className="font-mono text-[11px] font-semibold">
      {value}
      <span className="font-normal text-muted"> / {outOf}</span>
    </span>
  );
}

function RatingList({ entries }: { entries: [string, number][] }) {
  return (
    <ul className="divide-y divide-base-300/60">
      {entries.map(([key, value]) => (
        <li key={key} className="flex items-center justify-between gap-2 py-1">
          <span className="text-[12px]">{labelise(key)}</span>
          <Rating value={value} />
        </li>
      ))}
    </ul>
  );
}

function Card({
  title,
  tooltip,
  badge,
  children,
}: {
  title: string;
  tooltip?: string;
  badge: React.ReactNode;
  children: React.ReactNode;
}) {
  return (
    <section className="rounded-lg border border-base-300 bg-base-100 p-4">
      <div className="flex items-start justify-between gap-2">
        <MicroLabel label={title} tooltip={tooltip} />
        {badge}
      </div>
      <div className="mt-2">{children}</div>
    </section>
  );
}

// LIVE section: the unified reputation read for the BoardRadar company
// universe, rendered section by section as the API returns it.
export function LiveUnifiedSection() {
  const [ticker, setTicker] = useState("MSFT");
  const [data, setData] = useState<UnifiedReputation | null>(null);
  const [source, setSource] = useState<BrSource>("live");
  const [errorCode, setErrorCode] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let cancelled = false;
    setLoading(true);
    setErrorCode(null);
    brFetch<UnifiedReputation>("reputation-tracker/unified", { ticker }).then(
      (res) => {
        if (cancelled) return;
        setSource(res.source);
        setLoading(false);
        if (res.ok && res.data) {
          setData(res.data);
        } else {
          setData(null);
          setErrorCode(res.errorCode ?? "UNKNOWN");
        }
      }
    );
    return () => {
      cancelled = true;
    };
  }, [ticker]);

  const lane = source === "mock" ? "mock" : "live";
  const glassdoor = data?.employeeReviews?.company?.glassdoor;
  const indeed = data?.employeeReviews?.company?.indeed;
  const sentiment = data?.competitiveSentiment;

  return (
    <section className="border-t border-base-300 pt-4">
      <div className="flex flex-wrap items-center gap-2">
        <MicroLabel
          label="BoardRadar coverage"
          tooltip="Live unified reputation for companies in the BoardRadar universe: customer reviews, employee reviews, market positioning and competitive sentiment. The private AI labs above are not in this universe."
        />
        <LaneBadge lane={lane} />
        <select
          aria-label="BoardRadar ticker"
          value={ticker}
          onChange={(e) => setTicker(e.target.value)}
          className="rounded border border-base-300 bg-base-100 px-2 py-1 text-[12px]"
        >
          {TICKERS.map((t) => (
            <option key={t} value={t}>
              {t}
            </option>
          ))}
        </select>
        <DerivationDrawer title="How these ratings are derived">
          <p>
            Everything in this section is passed through from the BoardRadar
            unified reputation endpoint for the selected ticker: customer
            review platforms (G2, Capterra, TrustRadius), employee review
            platforms (Glassdoor, Indeed) and the competitive sentiment read
            across social, product, pricing, developer and support signals.
          </p>
          <p className="text-muted">
            Ratings stay on each platform's own scale (out of 5 unless
            stated); AG does not rescale or blend them, and none of these
            figures feeds any AG score.
          </p>
        </DerivationDrawer>
      </div>
      <p className="mt-1 text-[11px] text-muted">
        Platform players from the BoardRadar company universe, shown as
        BoardRadar coverage. Where a company is not in the universe, no figure
        is shown.
      </p>

      <div className="mt-3">
        {loading ? (
          <p className="py-8 text-center font-mono text-[11px] text-muted">
            Loading live unified reputation for {ticker}...
          </p>
        ) : errorCode ? (
          <EmptyState
            title={`Live data unavailable (${errorCode})`}
            detail="The unified reputation call failed and no recorded fixture exists; no figure is shown rather than a guess."
          />
        ) : data ? (
          <div className="space-y-3">
            {/* Market positioning overview */}
            {data.overview?.description ? (
              <Card
                title={`${data.displayName || data.companyName} market positioning`}
                tooltip="The endpoint's own positioning narrative, shown verbatim."
                badge={<LaneBadge lane={lane} />}
              >
                <p className="text-[12.5px] leading-relaxed text-base-content/85">
                  {data.overview.description}
                </p>
                <p className="mt-2 font-mono text-[9px] uppercase tracking-wider text-muted">
                  Last updated{" "}
                  {new Date(data.overview.lastUpdated).toLocaleDateString("en-GB", {
                    day: "numeric",
                    month: "long",
                    year: "numeric",
                  })}
                </p>
              </Card>
            ) : null}

            <div className="grid grid-cols-1 gap-3 lg:grid-cols-2">
              {/* Customer reviews */}
              {data.customerReviews ? (
                <Card
                  title="Customer reviews"
                  tooltip="Review-platform ratings and the most-mentioned like and dislike categories, as returned by the endpoint."
                  badge={<LaneBadge lane={lane} />}
                >
                  <ul className="divide-y divide-base-300/60">
                    {data.customerReviews.platforms.map((p) => (
                      <li key={p.platform} className="flex items-center justify-between gap-2 py-1">
                        <span className="text-[12px]">{p.platform}</span>
                        <span className="flex items-center gap-2">
                          <span className="font-mono text-[10px] text-muted">
                            {p.reviewCount.toLocaleString("en-GB")} reviews
                          </span>
                          <Rating value={p.rating} />
                        </span>
                      </li>
                    ))}
                  </ul>
                  <div className="mt-2 grid grid-cols-1 gap-2 sm:grid-cols-2">
                    <div>
                      <p className="micro-label">Most liked</p>
                      <div className="mt-1 flex flex-wrap gap-1">
                        {data.customerReviews.likes.map((l) => (
                          <span key={l.category} className="inline-flex rounded-full bg-good-bg px-2 py-0.5 text-[10px] text-good">
                            {l.category} ({l.total})
                          </span>
                        ))}
                      </div>
                    </div>
                    <div>
                      <p className="micro-label">Most flagged</p>
                      <div className="mt-1 flex flex-wrap gap-1">
                        {data.customerReviews.dislikes.map((d) => (
                          <span key={d.category} className="inline-flex rounded-full bg-warn-bg px-2 py-0.5 text-[10px] text-warn">
                            {d.category} ({d.total})
                          </span>
                        ))}
                      </div>
                    </div>
                  </div>
                </Card>
              ) : (
                <EmptyState title="No customer review data" />
              )}

              {/* Employee reviews */}
              {glassdoor || indeed ? (
                <Card
                  title="Employee reviews"
                  tooltip="Employee review-platform ratings and category breakdowns, as returned by the endpoint."
                  badge={<LaneBadge lane={lane} />}
                >
                  <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
                    {glassdoor ? (
                      <div>
                        <div className="flex items-center justify-between">
                          <p className="text-[12px] font-semibold">Glassdoor</p>
                          <span className="flex items-center gap-2">
                            <span className="font-mono text-[10px] text-muted">
                              {glassdoor.reviewCount.toLocaleString("en-GB")} reviews
                            </span>
                            <Rating value={glassdoor.overallRating} />
                          </span>
                        </div>
                        <RatingList entries={Object.entries(glassdoor.categories)} />
                      </div>
                    ) : null}
                    {indeed ? (
                      <div>
                        <div className="flex items-center justify-between">
                          <p className="text-[12px] font-semibold">Indeed</p>
                          <span className="flex items-center gap-2">
                            <span className="font-mono text-[10px] text-muted">
                              {indeed.reviewCount.toLocaleString("en-GB")} reviews
                            </span>
                            <Rating value={indeed.overallRating} />
                          </span>
                        </div>
                        <RatingList entries={Object.entries(indeed.categories)} />
                      </div>
                    ) : null}
                  </div>
                </Card>
              ) : (
                <EmptyState title="No employee review data" />
              )}
            </div>

            {/* Satisfaction comparison tables */}
            {data.comparisonTables && data.comparisonTables.length > 0 ? (
              <div className="grid grid-cols-1 gap-3 lg:grid-cols-2">
                {data.comparisonTables.map((table) => (
                  <Card
                    key={table.category}
                    title={table.category}
                    tooltip="Per-metric satisfaction ratings for the primary company, on the platforms' own 5-point scale."
                    badge={<LaneBadge lane={lane} />}
                  >
                    <ul className="divide-y divide-base-300/60">
                      {table.rows.map((row) => (
                        <li key={row.metric} className="flex items-center justify-between gap-2 py-1">
                          <span className="text-[12px]">{row.metric}</span>
                          {typeof row.values[data.ticker] === "number" ? (
                            <Rating value={row.values[data.ticker]} />
                          ) : (
                            <span className="font-mono text-[10px] text-muted">no data</span>
                          )}
                        </li>
                      ))}
                    </ul>
                  </Card>
                ))}
              </div>
            ) : null}

            {/* Competitive sentiment */}
            {sentiment && Object.keys(sentiment.metrics ?? {}).length > 0 ? (
              <Card
                title="Competitive sentiment"
                tooltip="The endpoint's cross-company sentiment read: social, product, pricing, developer and support signals per peer."
                badge={<LaneBadge lane={lane} />}
              >
                <div className="overflow-x-auto">
                  <table className="w-full min-w-[560px] text-left text-[12px]">
                    <thead>
                      <tr className="border-b border-base-300">
                        <th className="py-1.5 pr-2 font-mono text-[9px] uppercase tracking-wider text-muted">
                          Signal
                        </th>
                        {Object.keys(sentiment.metrics).map((t) => (
                          <th key={t} className="px-2 py-1.5 font-mono text-[10px]">
                            {t}
                            {t === data.ticker ? (
                              <span className="ml-1 rounded bg-primary/10 px-1 py-0.5 text-[8px] font-semibold uppercase tracking-wider text-primary">
                                Primary
                              </span>
                            ) : null}
                          </th>
                        ))}
                      </tr>
                    </thead>
                    <tbody>
                      {(
                        [
                          ["Social sentiment (of 5)", (m) => m.social?.sentimentScore],
                          ["Dominant topic", (m) => m.social?.dominantTopic],
                          ["Trend", (m) => m.social?.trendDirection],
                          ["Product reliability (of 5)", (m) => m.product?.reliabilityScore],
                          ["Feature innovation (of 5)", (m) => m.product?.featureInnovation],
                          ["Value-for-money rank", (m) => m.pricing?.valueForMoneyRank],
                          ["Support quality (of 5)", (m) => m.support?.supportQuality],
                        ] as [string, (m: NonNullable<typeof sentiment>["metrics"][string]) => string | number | undefined][]
                      ).map(([label, pick]) => (
                        <tr key={label} className="border-b border-base-300/60">
                          <td className="py-1.5 pr-2 text-muted">{label}</td>
                          {Object.entries(sentiment.metrics).map(([t, m]) => {
                            const v = pick(m);
                            return (
                              <td key={t} className="px-2 py-1.5 font-mono text-[11px]">
                                {v === undefined || v === null ? (
                                  <span className="text-[10px] text-muted">no data</span>
                                ) : (
                                  v
                                )}
                              </td>
                            );
                          })}
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </Card>
            ) : null}
          </div>
        ) : (
          <EmptyState title="Awaiting public disclosure" />
        )}
      </div>
    </section>
  );
}
