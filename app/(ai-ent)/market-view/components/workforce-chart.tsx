"use client";

import { useMemo, useState } from "react";
import { LaneBadge } from "@/lib/ui/badges";
import { MicroLabel } from "@/lib/ui/micro";
import { DerivationDrawer } from "@/lib/ui/score";
import {
  densityCurve,
  TIERS,
  CAP01_THRESHOLDS,
  TOP_TIER,
  TOP_TIER_INDEX,
  BANDWIDTH,
} from "@/lib/model-fit/workforce-curve";
import type {
  WorkforcePayload,
  IndustrySlice,
} from "@/lib/model-fit/workforce-payload";

// How much of a workforce actually needs a top-tier model.
//
// Two stacked panels sharing one x-axis, never two y-axes on one frame. A
// price line drawn over a population curve produces a crossing point that is
// an artefact of the axis scaling and reads to everyone as a finding. Stacking
// them makes the same comparison without inventing that moment.
//
// The curve is a smoothed interpolation over five measured tiers. The five
// measured points are drawn on it as dots, always, because the dots are the
// data and the curve is a reading of it.

const X_MIN = -6;
const X_MAX = 66;

// Ordinal blue ramp, low tier to high. Sequential rather than categorical:
// the tiers are ordered, and a categorical palette would imply they are not.
const BAND_FILL = [
  "rgba(191, 219, 254, 0.55)",
  "rgba(147, 197, 253, 0.55)",
  "rgba(96, 165, 250, 0.55)",
  "rgba(59, 130, 246, 0.55)",
  "rgba(29, 78, 216, 0.55)",
];

type View = "curve" | "bars";

const CAPS = [
  { id: "CAP-01", label: "General intelligence", axis: true },
  { id: "CAP-02", label: "Specialist knowledge", axis: false },
  { id: "CAP-05", label: "Instruction following", axis: false },
  { id: "CAP-07", label: "Tool use", axis: false },
];

const fmtPct = (x: number) => `${(x * 100).toFixed(1)}%`;
const fmtNum = (n: number) => n.toLocaleString("en-GB");
const fmtPrice = (p: number) => (p < 1 ? `$${p.toFixed(2)}` : `$${p.toFixed(2)}`);

export function WorkforceChart({ payload }: { payload: WorkforcePayload }) {
  const [industry, setIndustry] = useState<string>("All industries");
  const [view, setView] = useState<View>("curve");
  const [cap, setCap] = useState("CAP-01");

  const slice: IndustrySlice = useMemo(() => {
    if (industry === "All industries") return payload.all;
    return (
      payload.byIndustry.find((s) => s.industry === industry) ?? payload.all
    );
  }, [industry, payload]);

  const curve = useMemo(
    () => densityCurve(slice.measured, { bandwidth: BANDWIDTH }),
    [slice]
  );

  // Selecting a capability with no axis mapping forces the bar view, since
  // there is no real axis to place it on.
  const axisCap = CAPS.find((c) => c.id === cap)?.axis ?? false;
  const effectiveView: View = axisCap ? view : "bars";

  const anchor = payload.priceAnchor;

  return (
    <section className="mt-8">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <div className="flex flex-wrap items-center gap-2">
          <MicroLabel
            label="How much of a workforce needs a top-tier model"
            tooltip="Every role in the reference library, weighted by headcount, placed at the capability its requirements demand."
          />
          <LaneBadge lane="derived" />
        </div>
      </div>

      <p className="measure mt-2 text-sm text-base-content/75">
        {fmtPct(slice.topTierShare)} of staff need tier {TOP_TIER} or better,
        and {fmtPct(slice.peakTierShare)} need the top tier. Drawn from{" "}
        {fmtNum(slice.roleCount)} roles carrying {fmtNum(slice.totalHeadcount)}{" "}
        people.
      </p>

      {/* The multiple is computed from the staircase rather than asserted. The
          brief carried a 25x figure; the priced models do not support it, and
          printing a number the data does not hold is the one thing this
          product cannot do. Both endpoints are named so it is checkable. */}
      {anchor.multiple !== null &&
      anchor.commonPrice !== null &&
      anchor.topPrice !== null ? (
        <p className="measure mt-1.5 text-sm text-base-content/75">
          Crossing that line costs{" "}
          <span className="finding-figure font-semibold">
            {anchor.multiple.toFixed(1)}x
          </span>{" "}
          more per token: the cheapest model clearing tier 30 is{" "}
          {anchor.commonModel} at {fmtPrice(anchor.commonPrice)}/M, the cheapest
          clearing tier {TOP_TIER} is {anchor.topModel} at{" "}
          {fmtPrice(anchor.topPrice)}/M.
        </p>
      ) : null}

      {/* Controls */}
      <div className="mt-3 flex flex-wrap items-end gap-3">
        <label className="flex flex-col gap-1">
          <span className="micro-label">Industry</span>
          <select
            value={industry}
            onChange={(e) => setIndustry(e.target.value)}
            className="rounded border border-base-300 bg-base-100 px-2 py-1.5 text-sm"
          >
            <option>All industries</option>
            {payload.byIndustry.map((s) => (
              <option key={s.industry} value={s.industry}>
                {s.industry}
              </option>
            ))}
          </select>
        </label>

        <div className="flex flex-col gap-1">
          <span className="micro-label">View</span>
          <div className="flex overflow-hidden rounded border border-base-300">
            {(
              [
                ["curve", "Smoothed curve"],
                ["bars", "Measured tiers"],
              ] as const
            ).map(([v, label]) => {
              const on = effectiveView === v;
              const locked = v === "curve" && !axisCap;
              return (
                <button
                  key={v}
                  type="button"
                  disabled={locked}
                  onClick={() => setView(v)}
                  title={
                    locked
                      ? "The curve needs a real axis to place roles on, and only General intelligence has one."
                      : undefined
                  }
                  className={`px-3 py-1.5 text-sm transition ${
                    on
                      ? "bg-primary text-white"
                      : locked
                        ? "cursor-not-allowed text-muted/50"
                        : "hover:bg-base-300/50"
                  }`}
                >
                  {label}
                </button>
              );
            })}
          </div>
        </div>

        <div className="flex flex-col gap-1">
          <span className="micro-label">Capability</span>
          <div className="flex flex-wrap gap-1">
            {CAPS.map((c) => {
              // Disabled, not absent. A tab that vanishes in one view looks
              // like a bug; one that is present and explains itself is a fact
              // about the data.
              const disabled = view === "curve" && !c.axis && cap === "CAP-01";
              return (
                <button
                  key={c.id}
                  type="button"
                  disabled={disabled}
                  onClick={() => setCap(c.id)}
                  title={
                    c.axis
                      ? `${c.label}: mapped to the Intelligence Index, so it can be placed on the axis.`
                      : `${c.label} has no published model benchmark to map onto an axis, so it can only be shown as measured tiers.`
                  }
                  className={`rounded border px-2.5 py-1.5 text-sm transition ${
                    cap === c.id
                      ? "border-primary bg-primary text-white"
                      : disabled
                        ? "cursor-not-allowed border-base-300 text-muted/50"
                        : "border-base-300 hover:bg-base-300/50"
                  }`}
                >
                  {c.label}
                  {!c.axis ? <span className="ml-1 opacity-60">·</span> : null}
                </button>
              );
            })}
          </div>
        </div>
      </div>

      {slice.totalHeadcount === 0 ? (
        <p className="mt-4 rounded-lg border border-dashed border-base-300 px-3 py-6 text-center text-sm text-muted">
          No role in this industry carries a {cap} requirement profile, so there
          is no distribution to draw.
        </p>
      ) : (
        <div className="mt-4 overflow-x-auto">
          <div className="min-w-[560px]">
            {effectiveView === "curve" ? (
              <DensityPanel curve={curve} slice={slice} />
            ) : (
              <BarsPanel slice={slice} cap={cap} />
            )}
            <StaircasePanel payload={payload} />
          </div>
        </div>
      )}

      {/* The caveat that has to travel with the chart. Sold as "here is your
          workforce" this would be a fabrication; framed as a template it is
          honest, and it is the reason to upload a real headcount. */}
      <p className="measure mt-3 rounded-lg border border-warn/40 bg-warn-bg/40 px-3 py-2 text-sm">
        This is the shape of a reference {fmtNum(payload.all.totalHeadcount)}
        -person enterprise, not your org chart. The headcounts are per-role
        reference figures published with the role library. Upload your own
        headcount to see yours.
      </p>

      <ExceptionList slice={slice} />

      <div className="mt-3">
        <DerivationDrawer title="How this curve is built">
          <p>
            Every role in the library carries a {cap} requirement scored on five
            tiers. Each role is weighted by its reference headcount and placed
            at the point on the Intelligence Index that its tier requires, using
            the published calibration: tier 10 at 0, 30 at 20, 50 at 32, 70 at
            45, 90 at 56.
          </p>
          <p>
            The curve is a Gaussian kernel density over those positions at
            bandwidth {BANDWIDTH}. Narrower bandwidths were rejected on the
            data, not on taste: tier 30 holds {fmtPct(payload.all.measured[1].share)}{" "}
            of headcount and tier 50 holds {fmtPct(payload.all.measured[2].share)},
            a near-tie that a narrow kernel splits into two peaks. The chart
            would then assert a bimodal workforce that exists only in the
            smoothing. Switch to Measured tiers to see the five figures the
            curve is drawn through.
          </p>
          <p className="text-muted">
            The y-axis of the top panel is a density, normalised to its own
            peak. It is deliberately unlabelled as a count, because a smoothed
            distribution does not carry headcounts. The stems mark the five
            measured tier shares on that same 0-1 scale. They do not sit
            exactly on the curve, and are not made to: a kernel density does
            not pass through the points it smooths, and the distance between a
            stem and the line is the smoothing showing its work.
          </p>
        </DerivationDrawer>
      </div>
    </section>
  );
}

// ---------------------------------------------------------------- top panel

function DensityPanel({
  curve,
  slice,
}: {
  curve: { index: number; density: number }[];
  slice: IndustrySlice;
}) {
  const W = 720;
  const H = 220;
  const PAD = { l: 44, r: 16, t: 14, b: 4 };
  const iw = W - PAD.l - PAD.r;
  const ih = H - PAD.t - PAD.b;

  const x = (i: number) => PAD.l + ((i - X_MIN) / (X_MAX - X_MIN)) * iw;
  const y = (d: number) => PAD.t + ih - d * ih;

  const line = curve.map((p) => `${x(p.index)},${y(p.density)}`).join(" ");
  const area = `${PAD.l},${PAD.t + ih} ${line} ${PAD.l + iw},${PAD.t + ih}`;

  const peak = Math.max(...slice.measured.map((m) => m.share), 0.0001);

  return (
    <svg
      viewBox={`0 0 ${W} ${H}`}
      className="w-full"
      role="img"
      aria-label={`Workforce capability density. ${fmtPct(slice.topTierShare)} of staff at tier ${TOP_TIER} or above.`}
    >
      <defs>
        {/* One clip per tier band, so the fill under the curve is shaded by
            band without redrawing the curve five times. */}
        {TIERS.map((t, i) => {
          const lo = i === 0 ? X_MIN : (CAP01_THRESHOLDS[TIERS[i - 1]] + CAP01_THRESHOLDS[t]) / 2;
          const hi =
            i === TIERS.length - 1
              ? X_MAX
              : (CAP01_THRESHOLDS[t] + CAP01_THRESHOLDS[TIERS[i + 1]]) / 2;
          return (
            <clipPath key={t} id={`band-${t}`}>
              <rect x={x(lo)} y={PAD.t} width={Math.max(0, x(hi) - x(lo))} height={ih} />
            </clipPath>
          );
        })}
      </defs>

      {TIERS.map((t, i) => (
        <polygon
          key={t}
          points={area}
          fill={BAND_FILL[i]}
          clipPath={`url(#band-${t})`}
        />
      ))}

      {/* Right tail: everything at or above tier 70. */}
      <rect
        x={x(TOP_TIER_INDEX)}
        y={PAD.t}
        width={Math.max(0, x(X_MAX) - x(TOP_TIER_INDEX))}
        height={ih}
        fill="var(--ag-insight)"
        opacity={0.1}
      />
      <line
        x1={x(TOP_TIER_INDEX)}
        x2={x(TOP_TIER_INDEX)}
        y1={PAD.t}
        y2={PAD.t + ih}
        stroke="var(--ag-insight)"
        strokeWidth={2}
        strokeDasharray="4 3"
      />

      <polyline
        points={line}
        fill="none"
        stroke="rgb(30, 64, 175)"
        strokeWidth={2}
      />

      {/* The measured points. The curve interpolates; these are the data.
          Drawn as stems rather than bare dots, on the same 0-1 scale as the
          curve. A kernel density does not pass through the points it is
          smoothed from, so a bare dot sitting off the line reads as a drawing
          error and a dot forced onto the line would hide how far the smoothing
          moved it. The stem says "this is a measured height at this tier" and
          lets the reader see the gap for themselves. */}
      {slice.measured.map((m) => (
        <g key={m.tier}>
          <line
            x1={x(m.index)}
            x2={x(m.index)}
            y1={PAD.t + ih}
            y2={y(m.share / peak)}
            stroke="rgb(30, 64, 175)"
            strokeWidth={1.5}
            opacity={0.5}
          />
          <circle
            cx={x(m.index)}
            cy={y(m.share / peak)}
            r={4.5}
            fill="white"
            stroke="rgb(30, 64, 175)"
            strokeWidth={2}
          />
          <title>{`Tier ${m.tier}: ${fmtPct(m.share)} of staff (${fmtNum(m.headcount)} people)`}</title>
        </g>
      ))}

      <text
        x={x(TOP_TIER_INDEX) + 8}
        y={PAD.t + 16}
        className="fill-[var(--ag-insight)] text-[11px] font-semibold"
      >
        {fmtPct(slice.topTierShare)} of staff need this or better
      </text>

      <text x={6} y={PAD.t + 10} className="fill-current text-[10px] opacity-55">
        density
      </text>
    </svg>
  );
}

// ------------------------------------------------------------- bars variant

function BarsPanel({ slice, cap }: { slice: IndustrySlice; cap: string }) {
  const W = 720;
  const H = 220;
  const PAD = { l: 44, r: 16, t: 14, b: 4 };
  const iw = W - PAD.l - PAD.r;
  const ih = H - PAD.t - PAD.b;
  const peak = Math.max(...slice.measured.map((m) => m.share), 0.0001);
  const bw = iw / TIERS.length - 18;

  return (
    <svg viewBox={`0 0 ${W} ${H}`} className="w-full" role="img" aria-label={`Measured ${cap} tiers`}>
      {slice.measured.map((m, i) => {
        // Minimum 5px. Tier 90 is 0.7% and renders as nothing otherwise, and
        // "almost nobody needs the top tier" is the finding the chart exists
        // to show. A bar too small to see states the opposite.
        const raw = (m.share / peak) * ih;
        const h = m.share > 0 ? Math.max(5, raw) : 0;
        const cx = PAD.l + (iw / TIERS.length) * (i + 0.5);
        return (
          <g key={m.tier}>
            <rect
              x={cx - bw / 2}
              y={PAD.t + ih - h}
              width={bw}
              height={h}
              fill={BAND_FILL[i]}
              stroke="rgb(30, 64, 175)"
              strokeWidth={1}
            />
            <text
              x={cx}
              y={PAD.t + ih - h - 5}
              textAnchor="middle"
              className="fill-current text-[11px] font-semibold"
            >
              {fmtPct(m.share)}
            </text>
            <text
              x={cx}
              y={PAD.t + ih + 1}
              textAnchor="middle"
              className="fill-current text-[10px] opacity-60"
            >
              tier {m.tier}
            </text>
            <title>{`Tier ${m.tier}: ${fmtPct(m.share)} (${fmtNum(m.headcount)} people)`}</title>
          </g>
        );
      })}
    </svg>
  );
}

// ------------------------------------------------------------- bottom panel

function StaircasePanel({ payload }: { payload: WorkforcePayload }) {
  const W = 720;
  const H = 168;
  const PAD = { l: 44, r: 16, t: 10, b: 28 };
  const iw = W - PAD.l - PAD.r;
  const ih = H - PAD.t - PAD.b;

  const steps = payload.staircase;
  const x = (i: number) => PAD.l + ((i - X_MIN) / (X_MAX - X_MIN)) * iw;

  const prices = steps.map((s) => s.price).filter((p) => p > 0);
  const lo = Math.min(...prices);
  const hi = Math.max(...prices);
  // Log scale: the cheapest model is $0.02 and the dearest that clears the top
  // tier is $3. On a linear axis every step below a dollar collapses onto the
  // floor and the staircase reads as one jump.
  const y = (p: number) =>
    PAD.t + ih - ((Math.log10(p) - Math.log10(lo)) / (Math.log10(hi) - Math.log10(lo))) * ih;

  let d = "";
  steps.forEach((s, i) => {
    const px = x(s.index);
    const py = y(s.price);
    if (i === 0) d += `M ${px} ${py}`;
    else d += ` L ${px} ${y(steps[i - 1].price)} L ${px} ${py}`;
  });

  const ticks = TIERS.map((t) => CAP01_THRESHOLDS[t]);

  return (
    <svg viewBox={`0 0 ${W} ${H}`} className="w-full" role="img" aria-label="Cheapest model clearing each capability level">
      <rect
        x={x(TOP_TIER_INDEX)}
        y={PAD.t}
        width={Math.max(0, x(X_MAX) - x(TOP_TIER_INDEX))}
        height={ih}
        fill="var(--ag-insight)"
        opacity={0.1}
      />
      <line
        x1={x(TOP_TIER_INDEX)}
        x2={x(TOP_TIER_INDEX)}
        y1={PAD.t}
        y2={PAD.t + ih}
        stroke="var(--ag-insight)"
        strokeWidth={2}
        strokeDasharray="4 3"
      />

      <path d={d} fill="none" stroke="rgb(15, 118, 110)" strokeWidth={2} />

      {/* Shared x-axis, labelled once, under the lower panel. */}
      <line
        x1={PAD.l}
        x2={PAD.l + iw}
        y1={PAD.t + ih}
        y2={PAD.t + ih}
        stroke="currentColor"
        opacity={0.25}
      />
      {ticks.map((t, i) => (
        <g key={t}>
          <line
            x1={x(t)}
            x2={x(t)}
            y1={PAD.t + ih}
            y2={PAD.t + ih + 4}
            stroke="currentColor"
            opacity={0.4}
          />
          <text
            x={x(t)}
            y={PAD.t + ih + 15}
            textAnchor="middle"
            className="fill-current text-[10px] opacity-70"
          >
            {t}
          </text>
          <text
            x={x(t)}
            y={PAD.t + ih + 25}
            textAnchor="middle"
            className="fill-current text-[9px] opacity-45"
          >
            tier {TIERS[i]}
          </text>
        </g>
      ))}

      <text x={6} y={PAD.t + 10} className="fill-current text-[10px] opacity-55">
        $/M in
      </text>
      <text
        x={PAD.l + iw}
        y={H - 2}
        textAnchor="end"
        className="fill-current text-[10px] opacity-55"
      >
        Intelligence Index v4.1 (Artificial Analysis)
      </text>
    </svg>
  );
}

// ------------------------------------------------------------ exception list

function ExceptionList({ slice }: { slice: IndustrySlice }) {
  // Only when the cut spans more than one industry.
  const showIndustry =
    new Set(slice.exceptions.map((r) => r.industry)).size > 1;
  if (slice.exceptions.length === 0) {
    return (
      <p className="mt-4 rounded-lg border border-dashed border-base-300 px-3 py-4 text-sm text-muted">
        No role in this cut requires tier {TOP_TIER} or above, so there is no
        exception list to act on.
      </p>
    );
  }
  return (
    <div className="mt-4">
      <MicroLabel
        label={`The roles that do need it, largest first`}
        tooltip="The tier 70+ population, by headcount. This is the list to licence a frontier model against."
      />
      <div className="mt-2 overflow-x-auto">
        <table className="w-full min-w-[520px] text-sm">
          <thead>
            <tr className="border-b border-base-300 text-left">
              <th className="py-1.5 pr-3 font-semibold">Role</th>
              {/* The same role title appears in several industries with its
                  own headcount, so without this column two different rows read
                  as one duplicated row. */}
              {showIndustry ? (
                <th className="py-1.5 pr-3 font-semibold">Industry</th>
              ) : null}
              <th className="py-1.5 pr-3 font-semibold">Function</th>
              <th className="py-1.5 pr-3 text-right font-semibold">People</th>
              <th className="py-1.5 text-right font-semibold">Tier</th>
            </tr>
          </thead>
          <tbody>
            {slice.exceptions.map((r) => (
              <tr key={r.roleId} className="border-b border-base-300/50">
                <td className="py-1.5 pr-3">{r.name}</td>
                {showIndustry ? (
                  <td className="py-1.5 pr-3 text-muted">{r.industry}</td>
                ) : null}
                <td className="py-1.5 pr-3 text-muted">{r.function}</td>
                <td className="py-1.5 pr-3 text-right font-mono">
                  {fmtNum(r.headcount)}
                </td>
                <td className="py-1.5 text-right font-mono">{r.tier}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}
