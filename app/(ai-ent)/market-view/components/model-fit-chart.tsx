"use client";

import { useMemo, useState } from "react";
import type { ModelRecord, RankedModel } from "@/lib/model-fit";

// Price against capability, for one role's join.
//
// Same idiom as the price-performance chart: log price left to right, the
// independent intelligence index bottom to top, hand-rolled SVG rather than a
// chart library so the states this picture has to carry can be drawn exactly.
//
// The states are the point of it. A survivor, an eliminated model and the
// recommendation are three different things, and the threshold line is where
// the judgement sits: everything below it was cut by a number nobody has
// measured yet. Drawing the line makes that arguable, which is the intent.

const W = 1000;
const H = 380;
const PAD = { top: 18, right: 18, bottom: 44, left: 54 };
const PLOT_W = W - PAD.left - PAD.right;
const PLOT_H = H - PAD.top - PAD.bottom;

const P_MIN = 0.01;
const P_MAX = 150;
const LOG_MIN = Math.log10(P_MIN);
const LOG_SPAN = Math.log10(P_MAX) - LOG_MIN;
const PRICE_TICKS = [0.01, 0.1, 1, 10, 100];

function xFor(price: number): number {
  return PAD.left + ((Math.log10(Math.max(price, P_MIN)) - LOG_MIN) / LOG_SPAN) * PLOT_W;
}

export interface ChartPoint {
  model: ModelRecord;
  price: number;
  intelligence: number;
  survives: boolean;
  isPick: boolean;
  isNextUp: boolean;
}

export function PriceCapabilityChart({
  models,
  survivors,
  pick,
  nextUp,
  threshold,
  thresholdLabel,
}: {
  models: ModelRecord[];
  survivors: RankedModel[];
  pick: RankedModel | null;
  nextUp: RankedModel | null;
  /** The intelligence threshold actually applied, if CAP-01 did any filtering. */
  threshold: number | null;
  thresholdLabel: string | null;
}) {
  const [hovered, setHovered] = useState<string | null>(null);

  const { points, maxIntel } = useMemo(() => {
    const live = new Set(survivors.map((m) => m.model_id));
    const plotted = models.filter(
      (m) =>
        m.cost_input_per_1m != null &&
        (m.benchmarks ?? {}).intelligence != null
    );
    const top = plotted.length
      ? Math.max(...plotted.map((m) => m.benchmarks!.intelligence as number))
      : 100;
    const maxIntel = Math.max(10, Math.ceil(top / 10) * 10);
    const points: ChartPoint[] = plotted.map((m) => ({
      model: m,
      price: m.cost_input_per_1m as number,
      intelligence: m.benchmarks!.intelligence as number,
      survives: live.has(m.model_id),
      isPick: pick != null && m.model_id === pick.model_id,
      isNextUp: nextUp != null && m.model_id === nextUp.model_id,
    }));
    return { points, maxIntel };
  }, [models, survivors, pick, nextUp]);

  const yFor = (v: number) => PAD.top + PLOT_H - (v / maxIntel) * PLOT_H;
  const intelTicks = Array.from({ length: 5 }, (_, i) => Math.round((maxIntel / 4) * i));
  const hoveredPoint = points.find((p) => p.model.model_id === hovered) ?? null;

  return (
    <figure className="m-0">
      <svg
        viewBox={`0 0 ${W} ${H}`}
        className="block h-auto w-full"
        role="img"
        aria-label="Every priced model plotted by input price against intelligence index, with the models this role eliminates shown apart from the survivors"
      >
        {intelTicks.map((t) => (
          <g key={`y${t}`}>
            <line
              x1={PAD.left}
              x2={W - PAD.right}
              y1={yFor(t)}
              y2={yFor(t)}
              stroke="var(--ag-base-300)"
              strokeWidth="1"
              opacity="0.6"
            />
            <text
              x={PAD.left - 8}
              y={yFor(t) + 3}
              textAnchor="end"
              className="font-mono"
              fontSize="10"
              fill="var(--ag-muted)"
            >
              {t}
            </text>
          </g>
        ))}
        {PRICE_TICKS.map((t) => (
          <g key={`x${t}`}>
            <line
              x1={xFor(t)}
              x2={xFor(t)}
              y1={PAD.top}
              y2={PAD.top + PLOT_H}
              stroke="var(--ag-base-300)"
              strokeWidth="1"
              opacity="0.6"
            />
            <text
              x={xFor(t)}
              y={PAD.top + PLOT_H + 16}
              textAnchor="middle"
              className="font-mono"
              fontSize="10"
              fill="var(--ag-muted)"
            >
              ${t}
            </text>
          </g>
        ))}
        <text
          x={PAD.left + PLOT_W / 2}
          y={H - 8}
          textAnchor="middle"
          className="font-mono"
          fontSize="10"
          fill="var(--ag-muted)"
        >
          input price per 1M tokens, log scale
        </text>
        <text
          x={-(PAD.top + PLOT_H / 2)}
          y={13}
          transform="rotate(-90)"
          textAnchor="middle"
          className="font-mono"
          fontSize="10"
          fill="var(--ag-muted)"
        >
          intelligence index
        </text>

        {/* The applied threshold. Everything below it was cut by a provisional number. */}
        {threshold != null && threshold > 0 && threshold <= maxIntel ? (
          <g>
            <line
              x1={PAD.left}
              x2={W - PAD.right}
              y1={yFor(threshold)}
              y2={yFor(threshold)}
              stroke="var(--ag-amber)"
              strokeWidth="1.5"
              strokeDasharray="5 4"
            />
            <text
              x={W - PAD.right}
              y={yFor(threshold) - 5}
              textAnchor="end"
              className="font-mono"
              fontSize="10"
              fill="var(--ag-amber)"
            >
              {thresholdLabel}
            </text>
          </g>
        ) : null}

        {/* Eliminated first, so survivors and the pick sit on top of them. */}
        {points
          .filter((p) => !p.survives)
          .map((p) => (
            <circle
              key={p.model.model_id}
              cx={xFor(p.price)}
              cy={yFor(p.intelligence)}
              r={hovered === p.model.model_id ? 5 : 2.6}
              fill="var(--ag-muted)"
              opacity="0.3"
              onMouseEnter={() => setHovered(p.model.model_id)}
              onMouseLeave={() => setHovered(null)}
            >
              <title>{`${p.model.model_id} — eliminated`}</title>
            </circle>
          ))}
        {points
          .filter((p) => p.survives && !p.isPick)
          .map((p) => (
            <circle
              key={p.model.model_id}
              cx={xFor(p.price)}
              cy={yFor(p.intelligence)}
              r={p.isNextUp ? 5 : 3.6}
              fill={p.isNextUp ? "none" : "var(--ag-aie)"}
              stroke={p.isNextUp ? "var(--ag-aie)" : "none"}
              strokeWidth="2"
              opacity="0.85"
              onMouseEnter={() => setHovered(p.model.model_id)}
              onMouseLeave={() => setHovered(null)}
            >
              <title>{`${p.model.model_id} — meets the requirements`}</title>
            </circle>
          ))}
        {points
          .filter((p) => p.isPick)
          .map((p) => (
            <g key={p.model.model_id}>
              <circle
                cx={xFor(p.price)}
                cy={yFor(p.intelligence)}
                r="9"
                fill="none"
                stroke="var(--ag-green)"
                strokeWidth="2"
              />
              <circle
                cx={xFor(p.price)}
                cy={yFor(p.intelligence)}
                r="4"
                fill="var(--ag-green)"
              >
                <title>{`${p.model.model_id} — the recommendation`}</title>
              </circle>
            </g>
          ))}

        {hoveredPoint ? (
          <g pointerEvents="none">
            <rect
              x={Math.min(xFor(hoveredPoint.price) + 10, W - 320)}
              y={Math.max(yFor(hoveredPoint.intelligence) - 34, PAD.top)}
              width="310"
              height="30"
              rx="4"
              fill="var(--ag-base-100)"
              stroke="var(--ag-base-300)"
            />
            <text
              x={Math.min(xFor(hoveredPoint.price) + 18, W - 312)}
              y={Math.max(yFor(hoveredPoint.intelligence) - 21, PAD.top + 13)}
              fontSize="11"
              fill="var(--ag-base-content)"
            >
              {hoveredPoint.model.model_id.slice(0, 44)}
            </text>
            <text
              x={Math.min(xFor(hoveredPoint.price) + 18, W - 312)}
              y={Math.max(yFor(hoveredPoint.intelligence) - 9, PAD.top + 25)}
              className="font-mono"
              fontSize="10"
              fill="var(--ag-muted)"
            >
              {`$${hoveredPoint.price} per 1M · index ${hoveredPoint.intelligence} · ${
                hoveredPoint.survives ? "meets the requirements" : "eliminated"
              }`}
            </text>
          </g>
        ) : null}
      </svg>
      <figcaption className="mt-1 flex flex-wrap items-center gap-x-4 gap-y-1 text-[10.5px] text-muted">
        <span className="inline-flex items-center gap-1.5">
          <span className="inline-block h-2.5 w-2.5 rounded-full bg-good" />
          the recommendation
        </span>
        <span className="inline-flex items-center gap-1.5">
          <span className="inline-block h-2 w-2 rounded-full bg-aie" />
          meets the requirements
        </span>
        <span className="inline-flex items-center gap-1.5">
          <span className="inline-block h-2 w-2 rounded-full border-2 border-aie" />
          next option up
        </span>
        <span className="inline-flex items-center gap-1.5">
          <span className="inline-block h-1.5 w-1.5 rounded-full bg-muted opacity-40" />
          eliminated
        </span>
        <span>
          Models with no published price or index are absent, not assumed. The catalogue
          publishes no output price, so the axis is input price.
        </span>
      </figcaption>
    </figure>
  );
}
