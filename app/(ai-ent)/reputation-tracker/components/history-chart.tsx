"use client";

import { useMemo, useState } from "react";
import { LaneBadge } from "@/lib/ui/badges";
import { DerivationDrawer } from "@/lib/ui/score";
import { MicroLabel } from "@/lib/ui/micro";
import history from "@/fixtures/reputation-history.json";

// Quarterly developer-discussion history, in the house line style.
//
// What this is not: a reputation score over time. The reputation dataset
// publishes point-in-time pillar scores and no history, so plotting those
// would mean inventing the past. What it is: one real observable signal
// underneath the developer pillar, backfilled eight quarters from a named
// public source, with every vendor's series independently queryable.

interface Point {
  period: string;
  stories: number | null;
  meanPoints: number | null;
  meanComments: number | null;
}
interface Series {
  vendorId: string;
  name: string;
  query: string;
  ambiguity: string | null;
  series: Point[];
  total: number;
}

const W = 900;
const H = 380;
const PAD = { top: 18, right: 132, bottom: 40, left: 52 };
const PW = W - PAD.left - PAD.right;
const PH = H - PAD.top - PAD.bottom;

// Categorical, green reserved for the app's primary accent on the focused
// line so the highlight always reads.
const PALETTE = [
  "#2b50c8", "#e8590c", "#9333ea", "#0891b2", "#be185d",
  "#b45309", "#dc2626", "#7c3aed", "#0369a1", "#64748b",
];

export function ReputationHistoryChart() {
  const data = history as {
    quarters: string[];
    capturedAt: string;
    provenance: string;
    source: string;
    vendors: Series[];
  };

  const [muted, setMuted] = useState<Set<string>>(() => new Set());
  const [focus, setFocus] = useState<string | null>(null);
  const [hover, setHover] = useState<number | null>(null);

  const quarters = data.quarters;
  const shown = useMemo(
    () => data.vendors.filter((v) => !muted.has(v.vendorId)),
    [data.vendors, muted]
  );

  const max = useMemo(() => {
    const vals = shown.flatMap((v) =>
      v.series.map((p) => p.stories ?? 0)
    );
    const top = Math.max(1, ...vals);
    // Round up to a clean tick so the axis reads.
    const mag = Math.pow(10, Math.floor(Math.log10(top)));
    return Math.ceil(top / mag) * mag;
  }, [shown]);

  const x = (i: number) =>
    PAD.left + (quarters.length === 1 ? PW / 2 : (i / (quarters.length - 1)) * PW);
  const y = (v: number) => PAD.top + PH - (v / max) * PH;

  const ticks = Array.from({ length: 5 }, (_, i) => Math.round((max / 4) * i));

  const toggle = (id: string) =>
    setMuted((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next.size === data.vendors.length ? new Set() : next;
    });

  return (
    <section className="rounded-lg border border-base-300 bg-base-100 p-4">
      <div className="flex flex-wrap items-start justify-between gap-2">
        <div>
          <div className="flex flex-wrap items-center gap-2">
            <MicroLabel
              label="Developer discussion, eight quarters"
              tooltip="Hacker News story volume per quarter per vendor. A real observable signal behind the developer reputation pillar, not a reputation score."
            />
            <LaneBadge lane="live" />
            <span className="font-mono text-[10px] text-muted">
              {quarters[0]} to {quarters[quarters.length - 1]}
            </span>
          </div>
          <p className="mt-1 max-w-3xl text-[11.5px] text-muted">
            How much the developer community is talking about each vendor, by
            quarter. This is discussion volume, not sentiment and not a
            reputation score: the reputation dataset publishes no history, so
            nothing here is back-projected from today&apos;s pillar scores.
          </p>
        </div>
        {muted.size > 0 ? (
          <button
            type="button"
            onClick={() => setMuted(new Set())}
            className="rounded-full border border-primary px-2.5 py-1 text-[11px] font-semibold text-primary"
          >
            Show all
          </button>
        ) : null}
      </div>

      <div className="mt-2 flex flex-wrap items-center gap-1.5">
        {data.vendors.map((v, i) => {
          const on = !muted.has(v.vendorId);
          return (
            <button
              key={v.vendorId}
              type="button"
              onClick={() => toggle(v.vendorId)}
              onMouseEnter={() => setFocus(v.vendorId)}
              onMouseLeave={() => setFocus(null)}
              title={v.ambiguity ?? `Exact query: "${v.query}"`}
              className={`inline-flex items-center gap-1 rounded-full border px-2 py-0.5 text-[10.5px] transition ${
                on ? "border-base-300" : "border-base-300 opacity-40"
              }`}
            >
              <span
                className="inline-block h-2 w-2 rounded-full"
                style={{ background: PALETTE[i % PALETTE.length] }}
                aria-hidden
              />
              {v.name}
              {v.ambiguity ? (
                <span className="text-warn" title={v.ambiguity}>
                  &#9888;
                </span>
              ) : null}
            </button>
          );
        })}
      </div>

      <div className="mt-2 overflow-x-auto">
        <svg
          viewBox={`0 0 ${W} ${H}`}
          className="w-full min-w-[560px]"
          role="img"
          aria-label={`Quarterly Hacker News discussion volume for ${data.vendors.length} AI vendors across ${quarters.length} quarters`}
          onMouseLeave={() => setHover(null)}
        >
          {ticks.map((t) => (
            <g key={t}>
              <line
                x1={PAD.left}
                x2={W - PAD.right}
                y1={y(t)}
                y2={y(t)}
                stroke="var(--ag-base-300)"
                strokeWidth={1}
                opacity={t === 0 ? 0.9 : 0.45}
              />
              <text
                x={PAD.left - 8}
                y={y(t) + 3.5}
                textAnchor="end"
                className="fill-[var(--ag-muted)] font-mono"
                fontSize={9.5}
              >
                {t.toLocaleString("en-GB")}
              </text>
            </g>
          ))}

          {quarters.map((q, i) => (
            <g key={q}>
              <line
                x1={x(i)}
                x2={x(i)}
                y1={PAD.top}
                y2={PAD.top + PH}
                stroke="var(--ag-base-300)"
                strokeWidth={1}
                opacity={hover === i ? 0.9 : 0.25}
              />
              <text
                x={x(i)}
                y={PAD.top + PH + 16}
                textAnchor="middle"
                className="fill-[var(--ag-muted)] font-mono"
                fontSize={9.5}
                fontWeight={hover === i ? 700 : 400}
              >
                {q}
              </text>
              {/* Invisible hit strip per quarter */}
              <rect
                x={x(i) - PW / (quarters.length - 1) / 2}
                y={PAD.top}
                width={PW / (quarters.length - 1)}
                height={PH}
                fill="transparent"
                onMouseEnter={() => setHover(i)}
              />
            </g>
          ))}

          {shown.map((v) => {
            const idx = data.vendors.findIndex((d) => d.vendorId === v.vendorId);
            const colour = PALETTE[idx % PALETTE.length];
            const dim = focus !== null && focus !== v.vendorId;
            const pts = v.series
              .map((p, i) => `${x(i)},${y(p.stories ?? 0)}`)
              .join(" ");
            return (
              <g
                key={v.vendorId}
                opacity={dim ? 0.15 : 1}
                style={{ transition: "opacity 150ms" }}
              >
                <polyline
                  points={pts}
                  fill="none"
                  stroke={colour}
                  strokeWidth={focus === v.vendorId ? 2.6 : 1.7}
                  strokeLinejoin="round"
                  strokeLinecap="round"
                />
                {v.series.map((p, i) =>
                  hover === i ? (
                    <circle
                      key={p.period}
                      cx={x(i)}
                      cy={y(p.stories ?? 0)}
                      r={3.4}
                      fill={colour}
                      stroke="var(--ag-base-100)"
                      strokeWidth={1.2}
                    />
                  ) : null
                )}
                {/* End label, so a line is identifiable without the legend */}
                <text
                  x={W - PAD.right + 6}
                  y={y(v.series[v.series.length - 1].stories ?? 0) + 3.5}
                  className="fill-current"
                  fontSize={10}
                  fontWeight={focus === v.vendorId ? 700 : 500}
                >
                  {v.name}
                </text>
              </g>
            );
          })}

          <text
            x={PAD.left - 40}
            y={PAD.top - 6}
            className="fill-[var(--ag-muted)] font-mono"
            fontSize={9}
          >
            stories
          </text>
        </svg>
      </div>

      {/* Readout for the hovered quarter */}
      <div className="mt-1 min-h-[34px] rounded border border-base-300 bg-base-200/50 px-3 py-1.5">
        {hover === null ? (
          <p className="text-[11px] text-muted">
            Move over the chart for the quarter breakdown. Hover a legend chip
            to isolate one vendor; click to hide it.
          </p>
        ) : (
          <p className="flex flex-wrap items-center gap-x-3 gap-y-1 text-[11.5px]">
            <span className="font-mono font-bold">{quarters[hover]}</span>
            {shown
              .map((v) => ({ v, n: v.series[hover]?.stories ?? 0 }))
              .sort((a, b) => b.n - a.n)
              .slice(0, 6)
              .map(({ v, n }) => (
                <span key={v.vendorId} className="font-mono text-[11px]">
                  {v.name}{" "}
                  <span className="font-bold">{n.toLocaleString("en-GB")}</span>
                </span>
              ))}
          </p>
        )}
      </div>

      <div className="mt-2">
        <DerivationDrawer title="How the history is built">
          <p>
            Each point is the number of Hacker News stories mentioning the
            vendor in that quarter, from the public Algolia search API, with
            the date range applied at the query. Queries are exact-quoted:
            loose matching turns &quot;Cohere&quot; into &quot;coherent&quot;
            and inflates it by two orders of magnitude, which is why the legend
            shows the exact term used.
          </p>
          <p>
            <strong>This is not a reputation score over time.</strong> The
            reputation dataset publishes point-in-time pillar scores and no
            history at all, so a pillar trend line would have to be
            back-projected from today&apos;s figure, which would be inventing
            the past. This plots one real observable signal underneath the
            developer pillar instead, and it measures how much is being said,
            not whether it is positive.
          </p>
          <p className="text-muted">
            A warning marker on a legend chip means the vendor name collides
            with something else even when quoted, so that series reads high.
            Source: {data.source}, captured {data.capturedAt}.
          </p>
        </DerivationDrawer>
      </div>
    </section>
  );
}
