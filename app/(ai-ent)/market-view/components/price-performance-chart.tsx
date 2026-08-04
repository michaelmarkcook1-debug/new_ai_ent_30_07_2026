"use client";

import { useMemo, useState } from "react";
import { LaneBadge } from "@/lib/ui/badges";
import { MicroLabel } from "@/lib/ui/micro";
import { DerivationDrawer } from "@/lib/ui/score";
import {
  AXES,
  axisView,
  axisDenominator,
  type PricePoint,
} from "@/lib/model-fit/price-performance";
import type { ModelRecord } from "@/lib/model-fit/engine";

// What capability costs, on whichever capability you asked for.
//
// The design problem is the axis with no data. Coding is the most asked-for
// capability in the catalogue and has nothing ingested against it. A switcher
// that silently omits it looks complete and is not; one that invents a series
// is worse. It ships dark, carrying the reason and the named sources, because
// a gap you can read is a roadmap and one you cannot is a lie.
//
// The other rule that keeps this honest: an axis covering 44 of 330 models
// must not be allowed to look like the whole market. The 286 unscored models
// are real products at real prices, so they keep their x position in a gutter
// under the plot and only lose their y.

const W = 720;
const H = 340;
const PAD = { l: 52, r: 18, t: 16, b: 64 };
const GUTTER_H = 26;

const IW = W - PAD.l - PAD.r;
const IH = H - PAD.t - PAD.b;

const fmtPrice = (p: number) => (p < 1 ? `$${p.toFixed(2)}` : `$${p.toFixed(0)}`);

export function PricePerformanceChart({ models }: { models: ModelRecord[] }) {
  const [axisId, setAxisId] = useState("intelligence");
  const view = useMemo(() => axisView(models, axisId), [models, axisId]);

  // Log x: prices run from $0.02 to well over $10, so a linear axis crushes
  // nine tenths of the catalogue against the left edge.
  const prices = [...view.scored, ...view.unscored].map((p) => p.price);
  const pMin = Math.min(...prices);
  const pMax = Math.max(...prices);
  const x = (p: number) =>
    PAD.l +
    ((Math.log10(p) - Math.log10(pMin)) /
      (Math.log10(pMax) - Math.log10(pMin))) *
      IW;

  const scores = view.scored.map((p) => p.score as number);
  const sMin = scores.length ? Math.min(...scores) : 0;
  const sMax = scores.length ? Math.max(...scores) : 1;
  const y = (s: number) =>
    PAD.t + IH - ((s - sMin) / (sMax - sMin || 1)) * IH;

  const labelled = new Set(view.labelled.map((p) => p.modelId));
  const priceTicks = [0.02, 0.1, 1, 10, 50].filter(
    (t) => t >= pMin && t <= pMax
  );

  return (
    <section className="mt-8">
      <div className="flex flex-wrap items-center gap-2">
        <MicroLabel
          label="What capability costs"
          tooltip="Independent benchmark scores against published list prices, with the models no cheaper option beats picked out."
        />
        <LaneBadge lane="aie" />
      </div>

      {/* Axis switcher. Coding is present and dark. */}
      <div className="mt-3 flex flex-wrap gap-1">
        {AXES.map((a) => {
          const off = a.status !== "live";
          const on = a.id === axisId;
          return (
            <button
              key={a.id}
              type="button"
              disabled={off}
              onClick={() => setAxisId(a.id)}
              title={off ? a.gap : `${a.label}: scored on ${a.unit}.`}
              className={`rounded border px-2.5 py-1.5 text-sm transition ${
                on
                  ? "border-primary bg-primary text-white"
                  : off
                    ? "cursor-not-allowed border-dashed border-base-300 text-muted/60"
                    : "border-base-300 hover:bg-base-300/50"
              }`}
            >
              {a.label}
              {off ? (
                <span className="ml-1.5 opacity-70">&middot; no data</span>
              ) : null}
            </button>
          );
        })}
      </div>

      <p className="measure mt-2 text-sm text-base-content/75">
        {axisDenominator(view)}. Cheaper is to the left, on a log scale.
      </p>

      <div className="mt-2 overflow-x-auto">
        <svg
          viewBox={`0 0 ${W} ${H}`}
          className="w-full min-w-[560px]"
          role="img"
          aria-label={`${view.axis.label}: ${view.scored.length} of ${view.total} models scored, plotted against input price.`}
        >
          {/* plot frame */}
          <line
            x1={PAD.l}
            x2={PAD.l + IW}
            y1={PAD.t + IH}
            y2={PAD.t + IH}
            stroke="currentColor"
            opacity={0.25}
          />
          <line
            x1={PAD.l}
            x2={PAD.l}
            y1={PAD.t}
            y2={PAD.t + IH}
            stroke="currentColor"
            opacity={0.25}
          />

          {priceTicks.map((t) => (
            <g key={t}>
              <line
                x1={x(t)}
                x2={x(t)}
                y1={PAD.t + IH}
                y2={PAD.t + IH + 4}
                stroke="currentColor"
                opacity={0.35}
              />
              <text
                x={x(t)}
                y={PAD.t + IH + 15}
                textAnchor="middle"
                className="fill-current text-[10px] opacity-65"
              >
                {fmtPrice(t)}
              </text>
            </g>
          ))}

          {/* Dominated first, so the frontier draws over it. */}
          {view.scored
            .filter((p) => !p.frontier)
            .map((p) => (
              <circle
                key={p.modelId}
                cx={x(p.price)}
                cy={y(p.score as number)}
                r={3}
                fill="rgb(59, 130, 246)"
                opacity={0.5}
              >
                <title>{`${p.modelId}\n${view.axis.label}: ${p.score}\n${fmtPrice(p.price)}/M input\nDominated: something cheaper scores at least as well`}</title>
              </circle>
            ))}

          {view.scored
            .filter((p) => p.frontier)
            .map((p) => (
              <circle
                key={p.modelId}
                cx={x(p.price)}
                cy={y(p.score as number)}
                r={6}
                fill="var(--ag-insight)"
                stroke="var(--ag-surface, white)"
                strokeWidth={2}
              >
                <title>{`${p.modelId}\n${view.axis.label}: ${p.score}\n${fmtPrice(p.price)}/M input\nOn the frontier: no cheaper model scores as well`}</title>
              </circle>
            ))}

          {/* Three direct labels. A 330-point scatter labelled in full is an
              unreadable wall of text; labelled not at all it is undiscussable. */}
          {view.labelled.map((p) => (
            <text
              key={`l-${p.modelId}`}
              x={x(p.price) + 9}
              y={y(p.score as number) + 3.5}
              className="fill-current text-[10px] font-semibold"
            >
              {p.modelId.replace(/\s*\(.*\)$/, "")}
            </text>
          ))}

          {/* The gutter. These models have a price but no measurement on this
              axis, so they keep their x and lose their y rather than vanish. */}
          {view.unscored.length > 0 ? (
            <>
              <line
                x1={PAD.l}
                x2={PAD.l + IW}
                y1={PAD.t + IH + 26}
                y2={PAD.t + IH + 26}
                stroke="currentColor"
                opacity={0.12}
                strokeDasharray="3 3"
              />
              {view.unscored.map((p) => (
                <circle
                  key={`u-${p.modelId}`}
                  cx={x(p.price)}
                  cy={PAD.t + IH + 26 + GUTTER_H / 2 - 5}
                  r={2.5}
                  fill="currentColor"
                  opacity={0.28}
                >
                  <title>{`${p.modelId}\n${fmtPrice(p.price)}/M input\nNot scored on ${view.axis.label}: the product is real, the measurement is missing`}</title>
                </circle>
              ))}
              <text
                x={PAD.l}
                y={H - 4}
                className="fill-current text-[10px] opacity-55"
              >
                not scored on this axis ({view.unscored.length})
              </text>
            </>
          ) : null}

          <text
            x={6}
            y={PAD.t + 10}
            className="fill-current text-[10px] opacity-65"
          >
            {view.axis.unit}
          </text>
          <text
            x={PAD.l + IW}
            y={PAD.t + IH + 15}
            textAnchor="end"
            className="fill-current text-[10px] opacity-55"
          >
            input price $/M, log
          </text>
        </svg>
      </div>

      <Legend />
      <WorkedExample models={models} />

      <div className="mt-3">
        <DerivationDrawer title="How the frontier is worked out">
          <p>
            A model sits on the frontier when nothing cheaper scores at least as
            well on the axis being shown. It is recomputed for each axis rather
            than read off the record: the catalogue carries a frontier flag, but
            that flag was computed against general intelligence. Grok 4.5 is
            undominated on intelligence and dominated on agentic; Claude Sonnet
            5, GLM-5.2, MiniMax-M3 and gpt-oss-20b are the reverse. Carrying one
            axis&apos;s answer onto another would draw an intelligence conclusion
            in agentic clothing.
          </p>
          <p>
            Price is list input price per million tokens. Output price and
            context window are published by the vendors but are not yet in this
            catalogue, at 0 of 330 each, so an input-only comparison understates
            what a workload actually costs. That is a real limit of this chart
            and not a rounding detail.
          </p>
        </DerivationDrawer>
      </div>
    </section>
  );
}

function Legend() {
  return (
    <div className="mt-2 flex flex-wrap items-center gap-x-4 gap-y-1 text-sm text-muted">
      <span className="flex items-center gap-1.5">
        <svg width="14" height="14" viewBox="0 0 14 14">
          <circle cx="7" cy="7" r="5" fill="var(--ag-insight)" stroke="white" strokeWidth="2" />
        </svg>
        On the frontier
      </span>
      <span className="flex items-center gap-1.5">
        <svg width="14" height="14" viewBox="0 0 14 14">
          <circle cx="7" cy="7" r="3" fill="rgb(59, 130, 246)" opacity="0.5" />
        </svg>
        Dominated
      </span>
      <span className="flex items-center gap-1.5">
        <svg width="14" height="14" viewBox="0 0 14 14">
          <circle cx="7" cy="7" r="2.5" fill="currentColor" opacity="0.28" />
        </svg>
        Priced but not scored here
      </span>
    </div>
  );
}

// The comparison that makes the chart worth reading, taken from the shipped
// catalogue rather than written as copy. Both figures are asserted in the
// test suite, so this paragraph cannot quietly go stale.
function WorkedExample({ models }: { models: ModelRecord[] }) {
  const v = axisView(models, "intelligence");
  const opus = v.scored.find((p) =>
    p.modelId.startsWith("Claude Opus 5 (Adaptive Reasoning, Max Effort)")
  );
  const fable = v.scored.find((p) => p.modelId.startsWith("Claude Fable 5"));
  if (!opus || !fable) return null;

  return (
    <p className="measure finding mt-3 rounded-lg p-4 text-sm">
      Read it like this. Claude Opus 5 scores{" "}
      <span className="finding-figure font-semibold">{opus.score}</span> at{" "}
      {fmtPrice(opus.price)}/M and sits on the frontier: nothing cheaper matches
      it. Claude Fable 5 scores{" "}
      <span className="finding-figure font-semibold">{fable.score}</span> at{" "}
      {fmtPrice(fable.price)}/M, which is a lower score at double the price, so
      it is dominated. On this chart that is one dot up and to the left of
      another, and it is the whole argument for checking price against
      capability before signing anything.
    </p>
  );
}
