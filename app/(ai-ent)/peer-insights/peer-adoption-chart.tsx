"use client";

import Link from "next/link";
import { DerivationDrawer } from "@/lib/ui/score";

// Peer adoption chart: which AI vendors the cohort is running, as a ranked
// bar chart rather than a list of thin rules.
//
// Two things the chart has to carry honestly. The share figures are a
// modelled segment estimate, not audited market share, so the source's own
// provenance line stays visible. And each row carries the dataset's own
// confidence label and the number of contributing cells behind it, because a
// 5 per cent share off 3 cells is not the same claim as 5 per cent off 45.

export interface PeerAdoptionRow {
  vendor: string;
  share: number;
  contributingCells: number;
  confidence: string;
}

const W = 720;
const ROW_H = 30;
// Right padding carries the percentage plus the evidence behind it. The chart
// computed contributingCells and confidence and then printed neither, so every
// row read as an equally solid figure: at "all industries" a row rests on 45
// cells, at one region on 9, and the rubric's own confidence runs Low to High.
const PAD = { top: 26, right: 188, bottom: 30, left: 168 };
const PLOT_W = W - PAD.left - PAD.right;

export function PeerAdoptionChart({
  rows,
  vendorIdFor,
  provenance,
  showDerivation = true,
}: {
  rows: PeerAdoptionRow[];
  vendorIdFor?: (vendor: string) => string | undefined;
  provenance?: string | null;
  /** Off where the host panel already carries a fuller derivation drawer. */
  showDerivation?: boolean;
}) {
  if (rows.length === 0) return null;

  const max = rows.reduce((a, r) => Math.max(a, r.share), 0);
  // Round the axis up to the next 5 points so the ticks read cleanly.
  const axisMax = Math.max(0.05, Math.ceil((max * 100) / 5) * 5 / 100);
  const H = PAD.top + rows.length * ROW_H + PAD.bottom;
  const ticks = Array.from(
    { length: Math.round((axisMax * 100) / 5) + 1 },
    (_, i) => (i * 5) / 100
  );
  const x = (share: number) => PAD.left + (share / axisMax) * PLOT_W;

  return (
    <div>
      <svg
        viewBox={`0 0 ${W} ${H}`}
        className="w-full"
        role="img"
        aria-label={`Most-adopted vendors across this cohort: ${rows.length} vendors by modelled adoption share`}
      >
        {/* Gridlines and axis */}
        {ticks.map((t) => (
          <g key={t}>
            <line
              x1={x(t)}
              x2={x(t)}
              y1={PAD.top - 8}
              y2={PAD.top + rows.length * ROW_H}
              stroke="var(--ag-base-300)"
              strokeWidth={1}
              opacity={t === 0 ? 0.9 : 0.45}
            />
            <text
              x={x(t)}
              y={PAD.top - 13}
              textAnchor="middle"
              className="fill-[var(--ag-muted)] font-mono"
              fontSize={9}
            >
              {Math.round(t * 100)}%
            </text>
          </g>
        ))}

        {rows.map((r, i) => {
          const y = PAD.top + i * ROW_H;
          const barY = y + 6;
          const barH = ROW_H - 14;
          const id = vendorIdFor?.(r.vendor);
          const label = (
            <text
              x={PAD.left - 10}
              y={y + ROW_H / 2}
              textAnchor="end"
              dominantBaseline="middle"
              className="fill-current"
              fontSize={12}
              fontWeight={i === 0 ? 700 : 500}
            >
              {r.vendor}
            </text>
          );
          return (
            <g key={r.vendor}>
              <text
                x={PAD.left - 152}
                y={y + ROW_H / 2}
                dominantBaseline="middle"
                className="fill-[var(--ag-muted)] font-mono"
                fontSize={9.5}
              >
                {i + 1}
              </text>
              {id ? <Link href={`/vendor-view/${id}`}>{label}</Link> : label}

              <rect
                x={PAD.left}
                y={barY}
                width={Math.max(1, x(r.share) - PAD.left)}
                height={barH}
                rx={3}
                fill="var(--ag-primary)"
                opacity={i === 0 ? 1 : 0.78}
              >
                {/* One template string, not interleaved nodes: React refuses
                    an array of children on <title> and logs on every render. */}
                <title>
                  {`${r.vendor}: ${(r.share * 100).toFixed(1)}% modelled adoption share, ${r.contributingCells} contributing cells`}
                </title>
              </rect>

              <text
                x={x(r.share) + 8}
                y={y + ROW_H / 2}
                dominantBaseline="middle"
                className="fill-current font-mono"
                fontSize={11.5}
                fontWeight={700}
              >
                {(r.share * 100).toFixed(1)}%
              </text>

              {/* Anchored to the right edge rather than to the bar, so the
                  evidence column lines up and stays readable however long
                  the bars are. */}
              <text
                x={W - 6}
                y={y + ROW_H / 2}
                textAnchor="end"
                dominantBaseline="middle"
                className="fill-[var(--ag-muted)] font-mono"
                fontSize={9}
              >
                {r.contributingCells} cells · {r.confidence.toLowerCase()}
              </text>
            </g>
          );
        })}

        <text
          x={PAD.left + PLOT_W / 2}
          y={H - 8}
          textAnchor="middle"
          className="fill-[var(--ag-muted)]"
          fontSize={10}
        >
          Modelled adoption share of the cohort
        </text>
      </svg>

      {showDerivation ? (
      <div className="mt-1">
        <DerivationDrawer title="How the adoption shares are derived">
          <p>
            Each bar is the share of observed adoption signal the vendor holds
            within this cohort, with the number of contributing cells behind
            it. Cell counts matter: the
            same percentage off three cells and off forty-five is not the same
            claim, so both are shown rather than the percentage alone.
          </p>
          <p className="measure text-muted">
            {provenance
              ? `Source provenance, carried across verbatim: ${provenance}`
              : "This is a modelled segment estimate, not audited market share."}{" "}
            It is a directional read on where adoption signal concentrates, not
            a measurement of revenue or seats, and it is never blended into any
            AG score.
          </p>
        </DerivationDrawer>
      </div>
      ) : null}
    </div>
  );
}
