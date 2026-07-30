"use client";

import { useMemo, useState } from "react";
import { LaneBadge } from "@/lib/ui/badges";
import { MicroLabel } from "@/lib/ui/micro";
import { DerivationDrawer } from "@/lib/ui/score";
import type { CostCapabilityModel, CostCapabilityView } from "../data";

// Cost versus capability, ported from the AI Enterprise model inventory and
// normalised to this app's tokens and type scale. Log price on the x axis,
// independent Intelligence Index on the y axis, with the efficiency frontier
// picked out: models that no cheaper peer beats on intelligence.

const W = 760;
const H = 360;
// Right padding leaves room for the $100 tick label to sit inside the frame.
const PAD = { top: 16, right: 34, bottom: 44, left: 48 };
const PLOT_W = W - PAD.left - PAD.right;
const PLOT_H = H - PAD.top - PAD.bottom;

const PRICE_TICKS = [0.01, 0.1, 1, 10, 100];

function priceLabel(v: number): string {
  if (v >= 1) return `$${v}`;
  return `$${v.toFixed(2).replace(/0$/, "")}`;
}

export function CostCapabilityChart({ view }: { view: CostCapabilityView }) {
  const [hovered, setHovered] = useState<CostCapabilityModel | null>(null);
  const [frontierOnly, setFrontierOnly] = useState(false);

  const { points, maxIntel } = useMemo(() => {
    const maxIntel = Math.ceil(
      Math.max(...view.models.map((m) => m.intelligence)) / 20
    ) * 20;
    const minP = Math.log10(0.01);
    const maxP = Math.log10(150);
    const points = view.models.map((m) => {
      const x =
        PAD.left +
        ((Math.log10(Math.max(m.inputPerM, 0.01)) - minP) / (maxP - minP)) *
          PLOT_W;
      const y = PAD.top + PLOT_H - (m.intelligence / maxIntel) * PLOT_H;
      return { m, x, y };
    });
    return { points, maxIntel };
  }, [view.models]);

  const shown = frontierOnly ? points.filter((p) => p.m.frontier) : points;
  // Round steps of 20 rather than thirds, so the axis reads cleanly.
  const intelTicks = Array.from(
    { length: maxIntel / 20 + 1 },
    (_, i) => i * 20
  );

  return (
    <section className="rounded-lg border border-base-300 bg-base-100 p-4">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <div className="flex flex-wrap items-center gap-2">
            <h2 className="text-[15px] font-bold">Cost versus capability</h2>
            <LaneBadge lane="aie-live" />
            <span className="font-mono text-[10px] text-muted">
              {view.count} priced models
            </span>
          </div>
          <p className="mt-1 max-w-3xl text-[12px] text-muted">
            Every tracked model that publishes both a real list price and an
            independent Intelligence Index. The highlighted edge is the
            efficiency frontier: models no cheaper peer beats on intelligence.
            Points behind it are dominated, meaning something cheaper is at
            least as capable. Upper left is the sweet spot (capable and cheap).
          </p>
        </div>
        <div className="rounded-lg border border-base-300 bg-base-200/60 px-3 py-2">
          <MicroLabel
            label="Benchmark source"
            tooltip="Third-party benchmark publisher. AG produces no benchmark of its own; every score here is attributed and dated."
          />
          <p className="mt-0.5 text-[12px] font-bold">{view.benchmarkSource}</p>
          <p className="font-mono text-[9px] text-muted">
            freshest {view.freshestBenchmarkDisplay}
          </p>
        </div>
      </div>

      <div className="mt-3 flex flex-wrap items-center gap-2">
        <button
          type="button"
          onClick={() => setFrontierOnly((v) => !v)}
          className={`rounded-full border px-2.5 py-1 text-[11px] font-medium transition ${
            frontierOnly
              ? "border-primary bg-primary text-white"
              : "border-base-300 text-muted hover:border-primary hover:text-primary"
          }`}
        >
          Efficiency frontier only ({view.frontierCount})
        </button>
        <span className="font-mono text-[10px] text-muted">
          {shown.length} of {view.count} plotted
        </span>
      </div>

      <div className="mt-2 overflow-x-auto">
        <svg
          viewBox={`0 0 ${W} ${H}`}
          className="w-full min-w-[560px]"
          role="img"
          aria-label={`Scatter plot of ${view.count} models: input price against Intelligence Index`}
        >
          {/* Intelligence gridlines */}
          {intelTicks.map((t) => {
            const y = PAD.top + PLOT_H - (t / maxIntel) * PLOT_H;
            return (
              <g key={`y${t}`}>
                <line
                  x1={PAD.left}
                  x2={W - PAD.right}
                  y1={y}
                  y2={y}
                  stroke="var(--ag-base-300)"
                  strokeWidth={1}
                  opacity={0.6}
                />
                <text
                  x={PAD.left - 8}
                  y={y + 3}
                  textAnchor="end"
                  className="fill-[var(--ag-muted)] font-mono"
                  fontSize={9}
                >
                  {t}
                </text>
              </g>
            );
          })}

          {/* Price ticks (log scale) */}
          {PRICE_TICKS.map((p) => {
            const x =
              PAD.left +
              ((Math.log10(p) - Math.log10(0.01)) /
                (Math.log10(150) - Math.log10(0.01))) *
                PLOT_W;
            return (
              <g key={`x${p}`}>
                <line
                  x1={x}
                  x2={x}
                  y1={PAD.top}
                  y2={PAD.top + PLOT_H}
                  stroke="var(--ag-base-300)"
                  strokeWidth={1}
                  opacity={0.35}
                />
                <text
                  x={x}
                  y={PAD.top + PLOT_H + 14}
                  textAnchor="middle"
                  className="fill-[var(--ag-muted)] font-mono"
                  fontSize={9}
                >
                  {priceLabel(p)}
                </text>
              </g>
            );
          })}

          {/* Axis titles */}
          <text
            x={PAD.left + PLOT_W / 2}
            y={H - 6}
            textAnchor="middle"
            className="fill-[var(--ag-muted)]"
            fontSize={10}
          >
            Input price, US dollars per 1M tokens (log scale)
          </text>
          <text
            transform={`rotate(-90 12 ${PAD.top + PLOT_H / 2})`}
            x={12}
            y={PAD.top + PLOT_H / 2}
            textAnchor="middle"
            className="fill-[var(--ag-muted)]"
            fontSize={10}
          >
            Intelligence Index
          </text>

          {/* Frontier path */}
          {!frontierOnly ? (
            <polyline
              points={points
                .filter((p) => p.m.frontier)
                .sort((a, b) => a.x - b.x)
                .map((p) => `${p.x},${p.y}`)
                .join(" ")}
              fill="none"
              stroke="var(--ag-primary)"
              strokeWidth={1.5}
              strokeDasharray="4 3"
              opacity={0.7}
            />
          ) : null}

          {/* Points */}
          {shown.map((p, i) => (
            <circle
              key={`${p.m.model}-${i}`}
              cx={p.x}
              cy={p.y}
              r={p.m.frontier ? 4.5 : 3}
              fill={p.m.frontier ? "var(--ag-primary)" : "none"}
              stroke={p.m.frontier ? "var(--ag-base-100)" : "var(--ag-muted)"}
              strokeWidth={p.m.frontier ? 1.5 : 1}
              opacity={p.m.frontier ? 1 : 0.55}
              onMouseEnter={() => setHovered(p.m)}
              onMouseLeave={() => setHovered(null)}
              style={{ cursor: "pointer" }}
            >
              <title>
                {p.m.model}: Intelligence {p.m.intelligence}, $
                {p.m.inputPerM} per 1M input
                {p.m.throughput ? `, ${p.m.throughput} tokens per second` : ""}
              </title>
            </circle>
          ))}
        </svg>
      </div>

      {/* Hover readout, so the figures are legible without a tooltip */}
      <div className="mt-1 min-h-[34px] rounded border border-base-300 bg-base-200/50 px-3 py-1.5">
        {hovered ? (
          <p className="text-[12px]">
            <span className="font-semibold">{hovered.model}</span>
            <span className="ml-2 font-mono text-[11px] text-muted">
              Intelligence {hovered.intelligence} · ${hovered.inputPerM} per 1M
              input
              {hovered.throughput ? ` · ${hovered.throughput} tok/s` : ""}
              {hovered.frontier ? " · on the efficiency frontier" : ""}
            </span>
          </p>
        ) : (
          <p className="text-[11px] text-muted">
            Hover a point to read its model, index score and price.
          </p>
        )}
      </div>

      <div className="mt-2">
        <DerivationDrawer title="How this chart is derived">
          <p>
            Each point is one commercially available model that publishes both
            a real list input price and an independent Intelligence Index score
            from {view.benchmarkSource}. AG produces no benchmark of its own:
            the scores are third-party, attributed and dated, and appear here
            unaltered.
          </p>
          <p>
            The efficiency frontier is computed, not supplied: sorting by
            ascending price and keeping each model whose index beats every
            strictly cheaper model. {view.frontierCount} of {view.count} models
            qualify. A model behind the frontier is dominated, meaning a
            cheaper model scores at least as well.
          </p>
          <p className="text-muted">
            Price is the published list price per 1M input tokens on a log
            scale, so the cheap end stays readable; it is not a negotiated
            enterprise rate. Benchmarks and prices both move quickly, which is
            why the capture date and the freshest benchmark date sit beside the
            chart. Models without either a price or an index are absent rather
            than plotted at zero.
          </p>
        </DerivationDrawer>
      </div>
    </section>
  );
}
