"use client";

import { useMemo, useState } from "react";
import { burnOf, shortName, type ModelRecord, type RankedModel } from "@/lib/model-fit";

// Price against capability, for one role's join.
//
// Hand-rolled SVG rather than a chart library, so the states this picture has to
// carry can be drawn exactly. The states are the point of it: a model that
// qualifies, one that has been eliminated, and the recommendation are three
// different things, and the threshold line is where the judgement sits.
//
// Two ideas here are load-bearing and neither is decoration.
//
// The x axis is EFFECTIVE cost, not list price. A reasoning model at max effort
// burns several times the tokens of a non-reasoning one on the same task, so
// comparing their per-token prices compares nothing. Multiplying by the burn
// figure is the only way the axis means anything, and it is an assumption, so
// it can be switched off.
//
// Models whose burn is unknown are WITHHELD from the burn-adjusted view rather
// than assumed to be 1.0. The catalogue does not state an effort level for a
// third of its models, and quietly treating those as cheap would put them on the
// frontier by default. The count of what is withheld is stated under the chart.

const W = 1000;
const H = 400;
const PAD = { top: 20, right: 20, bottom: 48, left: 56 };
const PLOT_W = W - PAD.left - PAD.right;
const PLOT_H = H - PAD.top - PAD.bottom;

const P_MIN = 0.01;
const P_MAX = 300;
const LOG_MIN = Math.log10(P_MIN);
const LOG_SPAN = Math.log10(P_MAX) - LOG_MIN;
const PRICE_TICKS = [0.01, 0.1, 1, 10, 100];

function xFor(price: number): number {
  return PAD.left + ((Math.log10(Math.max(price, P_MIN)) - LOG_MIN) / LOG_SPAN) * PLOT_W;
}

function priceLabel(v: number): string {
  return v >= 1 ? `$${v}` : `$${v}`;
}

/**
 * The label for a frontier point, keeping the effort variant.
 *
 * Dropping the tag to save width collapsed four separate frontier points into
 * four labels all reading "Claude Opus 5", which is the precise thing
 * shortName() exists to prevent: Opus at max and Opus at medium are different
 * products at different prices, and on this chart they are different points.
 * The full id stays in the hover readout either way.
 */
function frontierName(modelId: string): string {
  const n = shortName(modelId);
  return n.length > 28 ? `${n.slice(0, 27)}…` : n;
}

interface Point {
  model: ModelRecord;
  cost: number;
  listPrice: number;
  burn: number | null;
  intelligence: number;
  survives: boolean;
  isPick: boolean;
  isNextUp: boolean;
  onFrontier: boolean;
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
  /** Plain English, e.g. "General intelligence needs 60". */
  thresholdLabel: string | null;
}) {
  const [hovered, setHovered] = useState<string | null>(null);
  const [adjustForBurn, setAdjustForBurn] = useState(true);
  const [sizeByBurn, setSizeByBurn] = useState(true);

  const { points, frontier, maxIntel, withheld, plotted } = useMemo(() => {
    const live = new Set(survivors.map((m) => m.model_id));
    const priced = models.filter(
      (m) => m.cost_input_per_1m != null && (m.benchmarks ?? {}).intelligence != null
    );
    // Unknown burn is withheld from the adjusted view, never imputed.
    const usable = priced.filter((m) => !adjustForBurn || burnOf(m.model_id) !== null);
    const withheld = priced.length - usable.length;

    const top = usable.length
      ? Math.max(...usable.map((m) => m.benchmarks!.intelligence as number))
      : 100;
    const maxIntel = Math.max(10, Math.ceil(top / 10) * 10);

    const pts: Point[] = usable.map((m) => {
      const burn = burnOf(m.model_id);
      const listPrice = m.cost_input_per_1m as number;
      return {
        model: m,
        listPrice,
        burn,
        cost: adjustForBurn ? listPrice * (burn ?? 1) : listPrice,
        intelligence: m.benchmarks!.intelligence as number,
        survives: live.has(m.model_id),
        isPick: pick != null && m.model_id === pick.model_id,
        isNextUp: nextUp != null && m.model_id === nextUp.model_id,
        onFrontier: false,
      };
    });

    // The efficiency frontier: nothing cheaper scores as high. Walk left to
    // right and keep every model that beats the best seen so far.
    const byCost = [...pts].sort((a, b) => a.cost - b.cost);
    let best = -Infinity;
    const frontier: Point[] = [];
    for (const p of byCost) {
      if (p.intelligence > best) {
        best = p.intelligence;
        p.onFrontier = true;
        frontier.push(p);
      }
    }
    return { points: pts, frontier, maxIntel, withheld, plotted: usable.length };
  }, [models, survivors, pick, nextUp, adjustForBurn]);

  const yFor = (v: number) => PAD.top + PLOT_H - (v / maxIntel) * PLOT_H;
  const intelTicks = Array.from({ length: 5 }, (_, i) => Math.round((maxIntel / 4) * i));
  const hoveredPoint = points.find((p) => p.model.model_id === hovered) ?? null;

  // Label placement: walk the frontier left to right, where intelligence rises
  // with cost by construction so y only falls, and push each label up until it
  // clears the one before it. Same approach as the price-performance chart.
  const frontierLabels = useMemo(() => {
    const GAP = 14;
    // Roughly 5.6px per character at this size: enough to know whether a
    // right-anchored label would run off the left edge of the plot.
    const widthOf = (s: string) => s.length * 5.6;
    let prev = Number.POSITIVE_INFINITY;
    return frontier.map((p) => {
      const wanted = yFor(p.intelligence) - 10;
      const labelY = Math.max(PAD.top + 6, Math.min(wanted, prev - GAP));
      prev = labelY;
      const label = frontierName(p.model.model_id);
      // The cheapest frontier model sits hard against the left axis, where a
      // label placed to its left falls off the chart. Those flip to the right.
      const flip = xFor(p.cost) - 12 - widthOf(label) < PAD.left;
      return { p, labelY, label, flip };
    });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [frontier, maxIntel]);

  // Dot radius carries the burn multiplier when asked to: bigger dot, more
  // tokens spent reaching the same answer.
  const radiusFor = (p: Point, base: number) => {
    if (!sizeByBurn || p.burn === null) return base;
    return base * (0.62 + Math.min(p.burn, 4.5) / 4.5);
  };

  return (
    <figure className="m-0">
      <svg
        viewBox={`0 0 ${W} ${H}`}
        className="block h-auto w-full"
        role="img"
        aria-label={`${plotted} models plotted by ${adjustForBurn ? "burn-adjusted cost" : "list price"} against intelligence index, with the models this role eliminates shown apart from those that qualify`}
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
              fontSize="11.5"
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
              fontSize="11.5"
              fill="var(--ag-muted)"
            >
              {priceLabel(t)}
            </text>
          </g>
        ))}
        <text
          x={PAD.left}
          y={H - 10}
          className="font-mono"
          fontSize="12"
          fill="var(--ag-muted)"
        >
          {adjustForBurn
            ? "effective cost per 1M, adjusted for reasoning burn"
            : "list price per 1M input tokens"}
        </text>
        <text
          x={-(PAD.top + PLOT_H / 2)}
          y={13}
          transform="rotate(-90)"
          textAnchor="middle"
          className="font-mono"
          fontSize="11.5"
          fill="var(--ag-muted)"
        >
          intelligence index
        </text>

        {/* The applied threshold, in plain English. Everything below the line
            was cut by a number nobody has measured. */}
        {threshold != null && threshold > 0 && threshold <= maxIntel ? (
          <g>
            <line
              x1={PAD.left}
              x2={W - PAD.right}
              y1={yFor(threshold)}
              y2={yFor(threshold)}
              stroke="var(--ag-amber)"
              strokeWidth="1.5"
              strokeDasharray="6 4"
            />
            <text
              x={W - PAD.right}
              y={yFor(threshold) - 6}
              textAnchor="end"
              className="font-mono"
              fontSize="12.5"
              fill="var(--ag-amber)"
            >
              {thresholdLabel}
            </text>
          </g>
        ) : null}

        {/* The efficiency frontier: nothing cheaper scores as high. */}
        {frontier.length > 1 ? (
          <polyline
            points={frontier.map((p) => `${xFor(p.cost)},${yFor(p.intelligence)}`).join(" ")}
            fill="none"
            stroke="var(--ag-green)"
            strokeWidth="1.75"
            strokeLinejoin="round"
            opacity="0.75"
          />
        ) : null}

        {/* Frontier models, named. The region above and left of the frontier is
            empty by construction, so labels placed there have nothing to
            collide with except each other, and the walk below pushes each one
            clear of the last. */}
        {frontierLabels.map(({ p, labelY, label, flip }) => (
          <g key={`fl-${p.model.model_id}`} pointerEvents="none">
            <line
              x1={xFor(p.cost)}
              y1={yFor(p.intelligence)}
              x2={xFor(p.cost) + (flip ? 9 : -9)}
              y2={labelY}
              stroke="var(--ag-green)"
              strokeWidth="1"
              opacity="0.4"
            />
            <text
              x={xFor(p.cost) + (flip ? 12 : -12)}
              y={labelY + 3.5}
              textAnchor={flip ? "start" : "end"}
              fontSize="10.5"
              fontWeight="600"
              fill="var(--ag-base-content)"
            >
              {label}
            </text>
          </g>
        ))}

        {/* Eliminated first, so the survivors and the pick sit on top. */}
        {points
          .filter((p) => !p.survives)
          .map((p) => (
            <circle
              key={p.model.model_id}
              cx={xFor(p.cost)}
              cy={yFor(p.intelligence)}
              r={radiusFor(p, hovered === p.model.model_id ? 5 : 3)}
              fill="var(--ag-muted)"
              opacity="0.28"
              onMouseEnter={() => setHovered(p.model.model_id)}
              onMouseLeave={() => setHovered(null)}
            >
              <title>{`${p.model.model_id}: eliminated`}</title>
            </circle>
          ))}
        {points
          .filter((p) => p.survives && !p.isPick)
          .map((p) => (
            <circle
              key={p.model.model_id}
              cx={xFor(p.cost)}
              cy={yFor(p.intelligence)}
              r={radiusFor(p, p.isNextUp ? 5 : 4)}
              fill={p.isNextUp ? "none" : "var(--ag-aie)"}
              stroke={p.isNextUp ? "var(--ag-aie)" : "none"}
              strokeWidth="2"
              opacity="0.85"
              onMouseEnter={() => setHovered(p.model.model_id)}
              onMouseLeave={() => setHovered(null)}
            >
              <title>{`${p.model.model_id}: qualifies for this role`}</title>
            </circle>
          ))}
        {points
          .filter((p) => p.isPick)
          .map((p) => (
            <g key={p.model.model_id}>
              {/* Purple, not green. Green already draws the efficiency
                  frontier on this chart, which is a property of the models;
                  the recommendation is AG's pick out of them, and the two
                  read as one thing while they share a colour. */}
              <circle
                cx={xFor(p.cost)}
                cy={yFor(p.intelligence)}
                r="10"
                fill="none"
                stroke="var(--ag-insight)"
                strokeWidth="2"
              />
              <circle
                cx={xFor(p.cost)}
                cy={yFor(p.intelligence)}
                r="4.5"
                fill="var(--ag-insight)"
              >
                <title>{`${p.model.model_id}: the recommendation`}</title>
              </circle>
            </g>
          ))}

        {hoveredPoint ? (
          <g pointerEvents="none">
            <rect
              x={Math.min(xFor(hoveredPoint.cost) + 12, W - 350)}
              y={Math.max(yFor(hoveredPoint.intelligence) - 38, PAD.top)}
              width="340"
              height="34"
              rx="4"
              fill="var(--ag-base-100)"
              stroke="var(--ag-base-300)"
            />
            <text
              x={Math.min(xFor(hoveredPoint.cost) + 20, W - 342)}
              y={Math.max(yFor(hoveredPoint.intelligence) - 24, PAD.top + 14)}
              fontSize="12.5"
              fill="var(--ag-base-content)"
            >
              {hoveredPoint.model.model_id.slice(0, 46)}
            </text>
            <text
              x={Math.min(xFor(hoveredPoint.cost) + 20, W - 342)}
              y={Math.max(yFor(hoveredPoint.intelligence) - 11, PAD.top + 27)}
              className="font-mono"
              fontSize="12.5"
              fill="var(--ag-muted)"
            >
              {`index ${hoveredPoint.intelligence} · $${hoveredPoint.listPrice} list${
                hoveredPoint.burn !== null
                  ? ` · ${hoveredPoint.burn}× burn · $${hoveredPoint.cost.toFixed(2)} effective`
                  : " · burn not stated"
              } · ${hoveredPoint.survives ? "qualifies" : "eliminated"}`}
            </text>
          </g>
        ) : null}
      </svg>

      <div className="mt-2 flex flex-wrap items-center gap-x-5 gap-y-2 text-xs">
        <label className="inline-flex items-center gap-1.5">
          <input
            type="checkbox"
            checked={adjustForBurn}
            onChange={(e) => setAdjustForBurn(e.target.checked)}
            className="accent-[var(--ag-primary)]"
          />
          Cost adjusted for token burn
        </label>
        <label className="inline-flex items-center gap-1.5">
          <input
            type="checkbox"
            checked={sizeByBurn}
            onChange={(e) => setSizeByBurn(e.target.checked)}
            className="accent-[var(--ag-primary)]"
          />
          Dot size shows token burn
        </label>
        <span className="inline-flex items-center gap-1.5 text-muted">
          <span className="inline-block h-1 w-1 rounded-full bg-muted" />
          <span className="inline-block h-1.5 w-1.5 rounded-full bg-muted" />
          <span className="inline-block h-2 w-2 rounded-full bg-muted" />
          <span className="inline-block h-2.5 w-2.5 rounded-full bg-muted" />
          low effort to max effort
        </span>
      </div>

      <div className="mt-2 flex flex-wrap items-center gap-x-4 gap-y-1 text-xs text-muted">
        <span className="inline-flex items-center gap-1.5">
          <span className="inline-block h-2.5 w-2.5 rounded-full bg-insight" />
          the recommendation
        </span>
        <span className="inline-flex items-center gap-1.5">
          <span className="inline-block h-2 w-2 rounded-full bg-aie" />
          qualifies for this role
        </span>
        <span className="inline-flex items-center gap-1.5">
          <span className="inline-block h-2 w-2 rounded-full border-2 border-aie" />
          next option up
        </span>
        <span className="inline-flex items-center gap-1.5">
          <span className="inline-block h-1.5 w-1.5 rounded-full bg-muted opacity-40" />
          eliminated
        </span>
        <span className="inline-flex items-center gap-1.5">
          <span className="inline-block h-0.5 w-4 bg-good" />
          efficiency frontier, {frontier.length} models
        </span>
      </div>

      <figcaption className="measure mt-2 text-xs leading-relaxed text-warn">
        {plotted} models plotted
        {withheld > 0
          ? `, ${withheld} withheld because the catalogue states no reasoning effort for them, and assuming one would put them on the frontier by default`
          : ""}
        . The line is the efficiency frontier: nothing cheaper scores as high.
        {adjustForBurn
          ? " Cost is multiplied by how many tokens each variant burns reaching the same answer, which is inferred from the model's effort label and is not a measurement. Artificial Analysis publishes measured output tokens per task, which would replace it."
          : " Cost is the list price per input token, which is not comparable across effort levels: a max-effort variant spends several times the tokens of a non-reasoning one on the same task."}{" "}
        Models with no published price or index are absent from both views, not
        assumed.
      </figcaption>
    </figure>
  );
}
