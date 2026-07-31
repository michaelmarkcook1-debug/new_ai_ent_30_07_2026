"use client";

import { useMemo, useRef, useState } from "react";
import { LaneBadge } from "@/lib/ui/badges";
import { MicroLabel } from "@/lib/ui/micro";
import { DerivationDrawer } from "@/lib/ui/score";
import type { CostCapabilityModel, CostCapabilityView } from "../data";

// Cost versus capability, ported from the AI Enterprise model inventory and
// normalised to this app's tokens and type scale. Log price on the x axis,
// independent Intelligence Index on the y axis, with the efficiency frontier
// picked out and named: models that no cheaper peer beats on intelligence.
//
// Three things carry the readability at 330 points: colour separates the model
// builders, the frontier is labelled in place (the region above and left of it
// is empty by construction, so the labels have nowhere to collide with data),
// and hover snaps to the nearest point rather than asking anyone to hit a
// three-pixel target.

const W = 1000;
const H = 560;
const PAD = { top: 24, right: 24, bottom: 52, left: 56 };
const PLOT_W = W - PAD.left - PAD.right;
const PLOT_H = H - PAD.top - PAD.bottom;

const P_MIN = 0.01;
const P_MAX = 150;
const LOG_MIN = Math.log10(P_MIN);
const LOG_SPAN = Math.log10(P_MAX) - LOG_MIN;

const PRICE_TICKS = [0.01, 0.1, 1, 10, 100];
// Minor ticks inside each decade, so the log compression stays legible.
const PRICE_MINOR = [0.02, 0.05, 0.2, 0.5, 2, 5, 20, 50];

// Categorical palette for model builders. Deliberately excludes green: green
// is reserved for the efficiency frontier, and a provider wearing it would
// read as a quality signal rather than an identity.
const PALETTE = [
  "#2b50c8",
  "#e8590c",
  "#9333ea",
  "#0891b2",
  "#be185d",
  "#b45309",
  "#7c3aed",
  "#dc2626",
  "#0369a1",
  "#a16207",
  "#db2777",
  "#475569",
];
const UNATTRIBUTED_COLOUR = "#94a3b8";

function priceLabel(v: number): string {
  if (v >= 1) return `$${v}`;
  return `$${v}`;
}

function xFor(price: number): number {
  return (
    PAD.left +
    ((Math.log10(Math.max(price, P_MIN)) - LOG_MIN) / LOG_SPAN) * PLOT_W
  );
}

// Frontier labels use the model family without its effort or configuration
// suffix; the full name stays in the hover readout and the title element.
function shortName(model: string): string {
  const base = model.replace(/\s*\([^)]*\)\s*$/, "").trim();
  return base.length > 26 ? `${base.slice(0, 25)}…` : base;
}

export function CostCapabilityChart({ view }: { view: CostCapabilityView }) {
  const svgRef = useRef<SVGSVGElement>(null);
  const [hovered, setHovered] = useState<string | null>(null);
  const [frontierOnly, setFrontierOnly] = useState(false);
  const [muted, setMuted] = useState<Set<string>>(() => new Set());

  const colourOf = useMemo(() => {
    const map = new Map<string, string>();
    view.providers.forEach((p, i) => {
      map.set(
        p.name,
        p.name === "Unattributed" ? UNATTRIBUTED_COLOUR : PALETTE[i % PALETTE.length]
      );
    });
    return map;
  }, [view.providers]);

  const { points, maxIntel } = useMemo(() => {
    const top = Math.max(...view.models.map((m) => m.intelligence));
    const maxIntel = Math.ceil(top / 10) * 10;
    const points = view.models.map((m) => ({
      m,
      x: xFor(m.inputPerM),
      y: PAD.top + PLOT_H - (m.intelligence / maxIntel) * PLOT_H,
    }));
    return { points, maxIntel };
  }, [view.models]);

  const shown = useMemo(
    () =>
      points.filter(
        (p) =>
          !muted.has(p.m.provider) && (!frontierOnly || p.m.frontier)
      ),
    [points, muted, frontierOnly]
  );

  const frontierPts = useMemo(
    () => points.filter((p) => p.m.frontier).sort((a, b) => a.x - b.x),
    [points]
  );

  // Label placement: walk the frontier left to right (intelligence rises with
  // price by construction, so y falls) and push each label up until it clears
  // the one before it.
  const frontierLabels = useMemo(() => {
    const GAP = 15;
    let prevY = Number.POSITIVE_INFINITY;
    return frontierPts.map((p) => {
      const y = Math.min(p.y, prevY - GAP);
      prevY = y;
      return { p, labelY: Math.max(y, PAD.top + 8) };
    });
  }, [frontierPts]);

  const hoveredPoint = useMemo(
    () => shown.find((p) => p.m.model === hovered) ?? null,
    [shown, hovered]
  );

  // Snap to the nearest plotted point in viewBox space. The SVG carries a
  // viewBox and no fixed height, so its rendered box keeps the viewBox aspect
  // ratio and this conversion needs no letterbox correction.
  function handleMove(e: React.MouseEvent<SVGSVGElement>) {
    const svg = svgRef.current;
    if (!svg) return;
    const r = svg.getBoundingClientRect();
    if (r.width === 0) return;
    const vx = ((e.clientX - r.left) / r.width) * W;
    const vy = ((e.clientY - r.top) / r.height) * H;
    let best: CostCapabilityModel | null = null;
    let bestD = Infinity;
    for (const p of shown) {
      const d = (p.x - vx) ** 2 + (p.y - vy) ** 2;
      if (d < bestD) {
        bestD = d;
        best = p.m;
      }
    }
    setHovered(bestD <= 36 * 36 && best ? best.model : null);
  }

  const intelTicks = Array.from({ length: maxIntel / 10 + 1 }, (_, i) => i * 10);

  const toggleProvider = (name: string) =>
    setMuted((prev) => {
      const next = new Set(prev);
      if (next.has(name)) next.delete(name);
      else next.add(name);
      // Muting every provider would blank the chart; treat that as a reset.
      return next.size === view.providers.length ? new Set() : next;
    });

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
            independent Intelligence Index. The green line is the efficiency
            frontier: models no cheaper peer beats on intelligence, named on the
            chart. Anything behind it is dominated, meaning something cheaper
            scores at least as well. Cheap and capable is the top left.
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

      {/* Controls */}
      <div className="mt-3 flex flex-wrap items-center gap-2 border-y border-base-300 py-2">
        <button
          type="button"
          onClick={() => setFrontierOnly((v) => !v)}
          className={`rounded-full border px-2.5 py-1 text-[11px] font-medium transition ${
            frontierOnly
              ? "border-primary bg-primary text-white"
              : "border-base-300 text-muted hover:border-primary hover:text-primary"
          }`}
        >
          Frontier only ({view.frontierCount})
        </button>
        {muted.size > 0 ? (
          <button
            type="button"
            onClick={() => setMuted(new Set())}
            className="rounded-full border border-primary px-2.5 py-1 text-[11px] font-semibold text-primary"
          >
            Show all providers
          </button>
        ) : null}
        <span className="font-mono text-[10px] text-muted">
          {shown.length} of {view.count} plotted
        </span>
      </div>

      {/* Provider legend, doubling as the filter */}
      <div className="mt-2 flex flex-wrap items-center gap-1.5">
        <MicroLabel
          label="Provider"
          tooltip="Model builder, read off the model name. Click to hide or show a family."
        />
        {view.providers.map((p) => {
          const on = !muted.has(p.name);
          return (
            <button
              key={p.name}
              type="button"
              onClick={() => toggleProvider(p.name)}
              title={`${p.count} models, ${p.frontierCount} on the frontier`}
              className={`inline-flex items-center gap-1 rounded-full border px-2 py-0.5 text-[10.5px] transition ${
                on
                  ? "border-base-300 text-base-content"
                  : "border-base-300 text-muted opacity-40"
              }`}
            >
              <span
                className="inline-block h-2 w-2 rounded-full"
                style={{ background: colourOf.get(p.name) }}
                aria-hidden
              />
              {p.name}
              <span className="font-mono text-[9px] text-muted">{p.count}</span>
            </button>
          );
        })}
      </div>

      <div className="mt-2">
        <svg
          ref={svgRef}
          viewBox={`0 0 ${W} ${H}`}
          className="w-full"
          role="img"
          aria-label={`Scatter plot of ${view.count} models: input price against Intelligence Index`}
          onMouseMove={handleMove}
          onMouseLeave={() => setHovered(null)}
        >
          {/* Plot field */}
          <rect
            x={PAD.left}
            y={PAD.top}
            width={PLOT_W}
            height={PLOT_H}
            className="fill-base-200/40"
          />

          {/* Minor price gridlines */}
          {PRICE_MINOR.map((p) => (
            <line
              key={`xm${p}`}
              x1={xFor(p)}
              x2={xFor(p)}
              y1={PAD.top}
              y2={PAD.top + PLOT_H}
              stroke="var(--ag-base-300)"
              strokeWidth={1}
              opacity={0.3}
            />
          ))}

          {/* Intelligence gridlines */}
          {intelTicks.map((t) => {
            const y = PAD.top + PLOT_H - (t / maxIntel) * PLOT_H;
            const major = t % 20 === 0;
            return (
              <g key={`y${t}`}>
                <line
                  x1={PAD.left}
                  x2={W - PAD.right}
                  y1={y}
                  y2={y}
                  stroke="var(--ag-base-300)"
                  strokeWidth={1}
                  opacity={major ? 0.8 : 0.35}
                />
                {major ? (
                  <text
                    x={PAD.left - 9}
                    y={y + 3.5}
                    textAnchor="end"
                    className="fill-[var(--ag-muted)] font-mono"
                    fontSize={10}
                  >
                    {t}
                  </text>
                ) : null}
              </g>
            );
          })}

          {/* Major price gridlines and labels */}
          {PRICE_TICKS.map((p) => (
            <g key={`x${p}`}>
              <line
                x1={xFor(p)}
                x2={xFor(p)}
                y1={PAD.top}
                y2={PAD.top + PLOT_H}
                stroke="var(--ag-base-300)"
                strokeWidth={1}
                opacity={0.8}
              />
              <text
                x={xFor(p)}
                y={PAD.top + PLOT_H + 16}
                textAnchor="middle"
                className="fill-[var(--ag-muted)] font-mono"
                fontSize={10}
              >
                {priceLabel(p)}
              </text>
            </g>
          ))}

          {/* Axis titles */}
          <text
            x={PAD.left + PLOT_W / 2}
            y={H - 12}
            textAnchor="middle"
            className="fill-[var(--ag-muted)]"
            fontSize={11}
          >
            Input price, US dollars per 1M tokens (log scale)
          </text>
          <text
            transform={`rotate(-90 14 ${PAD.top + PLOT_H / 2})`}
            x={14}
            y={PAD.top + PLOT_H / 2}
            textAnchor="middle"
            className="fill-[var(--ag-muted)]"
            fontSize={11}
          >
            Intelligence Index
          </text>

          {/* Dominated points, drawn first so the frontier sits above them */}
          {shown
            .filter((p) => !p.m.frontier)
            .map((p, i) => (
              <circle
                key={`d${p.m.model}-${i}`}
                cx={p.x}
                cy={p.y}
                r={3.2}
                fill={colourOf.get(p.m.provider)}
                opacity={hovered ? 0.28 : 0.62}
                style={{ transition: "opacity 140ms" }}
              >
                <title>
                  {p.m.model}: Intelligence {p.m.intelligence}, $
                  {p.m.inputPerM} per 1M input
                </title>
              </circle>
            ))}

          {/* Efficiency frontier */}
          <polyline
            points={frontierPts.map((p) => `${p.x},${p.y}`).join(" ")}
            fill="none"
            stroke="var(--ag-primary)"
            strokeWidth={2}
            strokeLinejoin="round"
            opacity={0.85}
          />
          {frontierLabels.map(({ p, labelY }) => (
            <g key={`f${p.m.model}`}>
              {/* Leader line into the empty region above and left of the
                  frontier, where nothing can plot by definition. */}
              <line
                x1={p.x - 7}
                y1={p.y}
                x2={p.x - 13}
                y2={labelY}
                stroke="var(--ag-primary)"
                strokeWidth={1}
                opacity={0.45}
              />
              <text
                x={p.x - 16}
                y={labelY + 3.5}
                textAnchor="end"
                className="fill-current"
                fontSize={10.5}
                fontWeight={600}
              >
                {shortName(p.m.model)}
              </text>
              <circle
                cx={p.x}
                cy={p.y}
                r={5.5}
                fill="var(--ag-primary)"
                stroke="var(--ag-base-100)"
                strokeWidth={1.5}
              >
                <title>
                  {p.m.model}: Intelligence {p.m.intelligence}, $
                  {p.m.inputPerM} per 1M input, on the efficiency frontier
                </title>
              </circle>
            </g>
          ))}

          {/* Hover: crosshair to both axes, then the point picked out */}
          {hoveredPoint ? (
            <g style={{ pointerEvents: "none" }}>
              <line
                x1={PAD.left}
                x2={hoveredPoint.x}
                y1={hoveredPoint.y}
                y2={hoveredPoint.y}
                stroke="var(--ag-base-content)"
                strokeWidth={1}
                strokeDasharray="3 3"
                opacity={0.45}
              />
              <line
                x1={hoveredPoint.x}
                x2={hoveredPoint.x}
                y1={hoveredPoint.y}
                y2={PAD.top + PLOT_H}
                stroke="var(--ag-base-content)"
                strokeWidth={1}
                strokeDasharray="3 3"
                opacity={0.45}
              />
              <circle
                cx={hoveredPoint.x}
                cy={hoveredPoint.y}
                r={7}
                fill="none"
                stroke={colourOf.get(hoveredPoint.m.provider)}
                strokeWidth={2}
              />
              <circle
                cx={hoveredPoint.x}
                cy={hoveredPoint.y}
                r={3.2}
                fill={colourOf.get(hoveredPoint.m.provider)}
              />
            </g>
          ) : null}
        </svg>
      </div>

      {/* Readout, so the figures are legible without chasing a tooltip */}
      <div className="mt-1 min-h-[36px] rounded border border-base-300 bg-base-200/50 px-3 py-1.5">
        {hoveredPoint ? (
          <p className="flex flex-wrap items-center gap-x-2 text-[12px]">
            <span
              className="inline-block h-2.5 w-2.5 rounded-full"
              style={{ background: colourOf.get(hoveredPoint.m.provider) }}
              aria-hidden
            />
            <span className="font-semibold">{hoveredPoint.m.model}</span>
            <span className="font-mono text-[11px] text-muted">
              {hoveredPoint.m.provider} · Intelligence{" "}
              {hoveredPoint.m.intelligence} · ${hoveredPoint.m.inputPerM} per 1M
              input
              {hoveredPoint.m.throughput
                ? ` · ${hoveredPoint.m.throughput} tok/s`
                : ""}
            </span>
            {hoveredPoint.m.frontier ? (
              <span className="rounded bg-primary px-1.5 py-0.5 font-mono text-[8.5px] font-bold uppercase tracking-wider text-white">
                Efficiency frontier
              </span>
            ) : null}
          </p>
        ) : (
          <p className="text-[11px] text-muted">
            Move over the chart to read the nearest model, its index score and
            its price. Click a provider above to hide or isolate a family.
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
            qualify, and they are the ones named on the chart. A model behind
            the frontier is dominated, meaning a cheaper model scores at least
            as well. The region above and to the left of the line is empty by
            construction, which is why the labels sit there.
          </p>
          <p>
            Colour groups models by builder, read off the model name rather
            than supplied by the source: a name the rules do not recognise is
            shown as Unattributed rather than guessed into a family. It is a
            grouping aid, not a statement about who owns or hosts the model.
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
