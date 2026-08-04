// The workforce capability distribution, and what capability costs.
//
// The question this answers: how much of a workforce actually needs a
// top-tier model. The answer, from the 294 roles in the FitEngine bundle
// weighted by their reference headcounts, is 14.8% at tier 70 or above and
// 0.7% at tier 90.
//
// Everything here is arithmetic over data already in the repo. No new source,
// no estimate, no per-company modelling.
//
// Two things this deliberately does NOT do.
//
// It does not put price on a second y-axis over the workforce curve. Two
// scales on one frame is the most common way a chart misleads: the crossing
// point of the two lines is an artefact of the axis choice and reads as a
// finding. The caller draws two stacked panels sharing one x-axis instead.
//
// It does not hide the measured points behind the smoothing. The curve is an
// interpolation over five measured tiers; the five points are the data. A
// caller that draws the curve without the dots is showing a shape the source
// never published, so `curve()` returns both and they travel together.

import type { Role, ModelRecord } from "./engine";

/** CAP-01 tier score -> position on the Intelligence Index (v4.1). */
export const CAP01_THRESHOLDS: Record<number, number> = {
  10: 0,
  30: 20,
  50: 32,
  70: 45,
  90: 56,
};

export const TIERS = [10, 30, 50, 70, 90] as const;

/**
 * The tier at which a role stops being servable by a mid-tier model. The
 * right-tail annotation and the exception list both key off this.
 */
export const TOP_TIER = 70;
export const TOP_TIER_INDEX = CAP01_THRESHOLDS[TOP_TIER];

/**
 * Bandwidth 9, not 5 or 7. Tier 30 carries 39.8% of headcount and tier 50
 * carries 39.6%: a near-tie. Narrow kernels resolve that tie into two peaks
 * and the chart then shows a bimodal workforce, which is an artefact of the
 * smoothing rather than anything in the data. At 9 it reads as the single
 * mode it is, at index ~27.
 */
export const BANDWIDTH = 9;

export interface MeasuredTier {
  tier: number;
  /** Where this tier sits on the Intelligence Index. */
  index: number;
  headcount: number;
  /** Share of the filtered workforce, 0-1. */
  share: number;
}

export interface CurvePoint {
  index: number;
  /** Density, normalised so the peak is 1. Unitless by design: the y-axis of
   *  a smoothed distribution is not a headcount and must not be labelled as
   *  one. */
  density: number;
}

export interface WorkforceCurve {
  measured: MeasuredTier[];
  curve: CurvePoint[];
  totalHeadcount: number;
  roleCount: number;
  /** Share of headcount at TOP_TIER or above, 0-1. */
  topTierShare: number;
  /** Share at tier 90, 0-1. Called out separately because it is the finding. */
  peakTierShare: number;
}

function cap01(role: Role): number | null {
  const s = role.profile?.["CAP-01"]?.score;
  return typeof s === "number" ? s : null;
}

const industryOf = (r: Role) => r.industry ?? "";

/** Roles for one industry, or all of them when industry is null. */
export function filterRoles(
  roles: Role[],
  industry: string | null
): Role[] {
  if (!industry) return roles;
  return roles.filter((r) => industryOf(r) === industry);
}

export function industries(roles: Role[]): string[] {
  return [...new Set(roles.map(industryOf).filter(Boolean))].sort();
}

export function measuredTiers(roles: Role[]): MeasuredTier[] {
  const byTier = new Map<number, number>();
  let total = 0;
  for (const r of roles) {
    const t = cap01(r);
    if (t === null) continue;
    const head = r.headcount ?? 0;
    byTier.set(t, (byTier.get(t) ?? 0) + head);
    total += head;
  }
  return TIERS.map((tier) => {
    const headcount = byTier.get(tier) ?? 0;
    return {
      tier,
      index: CAP01_THRESHOLDS[tier],
      headcount,
      // A tier with no headcount is a real zero, not a missing value.
      share: total > 0 ? headcount / total : 0,
    };
  });
}

/**
 * Gaussian kernel density over the Intelligence Index, each role weighted by
 * its headcount and placed at the index its tier requires.
 */
export function densityCurve(
  measured: MeasuredTier[],
  { bandwidth = BANDWIDTH, min = -6, max = 66, steps = 160 } = {}
): CurvePoint[] {
  const total = measured.reduce((a, m) => a + m.headcount, 0);
  const out: CurvePoint[] = [];
  if (total === 0) return out;

  let peak = 0;
  const raw: { index: number; value: number }[] = [];
  for (let i = 0; i <= steps; i++) {
    const index = min + ((max - min) * i) / steps;
    let value = 0;
    for (const m of measured) {
      if (m.headcount === 0) continue;
      const z = (index - m.index) / bandwidth;
      value += m.headcount * Math.exp(-0.5 * z * z);
    }
    raw.push({ index, value });
    if (value > peak) peak = value;
  }
  for (const { index, value } of raw) {
    out.push({ index, density: peak > 0 ? value / peak : 0 });
  }
  return out;
}

export function workforceCurve(
  roles: Role[],
  industry: string | null = null,
  bandwidth = BANDWIDTH
): WorkforceCurve {
  const scoped = filterRoles(roles, industry).filter(
    (r) => cap01(r) !== null
  );
  const measured = measuredTiers(scoped);
  const totalHeadcount = measured.reduce((a, m) => a + m.headcount, 0);
  const shareAtOrAbove = (tier: number) =>
    measured.filter((m) => m.tier >= tier).reduce((a, m) => a + m.share, 0);

  return {
    measured,
    curve: densityCurve(measured, { bandwidth }),
    totalHeadcount,
    roleCount: scoped.length,
    topTierShare: shareAtOrAbove(TOP_TIER),
    peakTierShare: shareAtOrAbove(90),
  };
}

export interface PriceStep {
  /** Capability level on the Intelligence Index. */
  index: number;
  /** Cheapest $/M input tokens among models clearing that level. */
  price: number;
  modelId: string;
  vendor: string;
}

/**
 * The cheapest model clearing each capability level: a step line, because the
 * price of capability moves in jumps as models drop out of contention rather
 * than sliding continuously.
 */
export function priceStaircase(
  models: ModelRecord[],
  { min = 0, max = 66, steps = 132 } = {}
): PriceStep[] {
  const priced = models.filter(
    (m) =>
      typeof m.benchmarks?.intelligence === "number" &&
      typeof m.cost_input_per_1m === "number" &&
      (m.cost_input_per_1m as number) > 0
  );

  const out: PriceStep[] = [];
  for (let i = 0; i <= steps; i++) {
    const index = min + ((max - min) * i) / steps;
    let best: ModelRecord | null = null;
    for (const m of priced) {
      if ((m.benchmarks?.intelligence as number) < index) continue;
      if (
        best === null ||
        (m.cost_input_per_1m as number) < (best.cost_input_per_1m as number)
      ) {
        best = m;
      }
    }
    // Past the most capable priced model nothing clears the bar. That is the
    // end of the line, not a price of zero.
    if (!best) break;
    out.push({
      index,
      price: best.cost_input_per_1m as number,
      modelId: best.model_id,
      vendor: best.vendor ?? "",
    });
  }
  return out;
}

/** How much more the top tier costs than the tier most of the workforce sits in. */
export function priceMultiple(
  staircase: PriceStep[],
  fromIndex: number,
  toIndex: number
): number | null {
  const at = (x: number) => {
    const hit = [...staircase].reverse().find((s) => s.index <= x);
    return hit?.price ?? null;
  };
  const lo = at(fromIndex);
  const hi = at(toIndex);
  if (lo === null || hi === null || lo === 0) return null;
  return hi / lo;
}

export interface ExceptionRole {
  roleId: string;
  name: string;
  industry: string;
  function: string;
  headcount: number;
  tier: number;
}

/**
 * The roles at tier 70 and above, largest first. This is the list a CIO acts
 * on: it is short, it is specific, and it is the whole population that
 * justifies a frontier-model licence.
 */
export function topTierRoles(
  roles: Role[],
  industry: string | null = null,
  limit = 12
): ExceptionRole[] {
  return filterRoles(roles, industry)
    .filter((r) => (cap01(r) ?? 0) >= TOP_TIER)
    .map((r) => ({
      roleId: r.role_id ?? "",
      name: r.name ?? r.role_id ?? "Unnamed role",
      industry: industryOf(r),
      function: r.function ?? "",
      headcount: r.headcount ?? 0,
      tier: cap01(r) as number,
    }))
    .sort((a, b) => b.headcount - a.headcount || a.name.localeCompare(b.name))
    .slice(0, limit);
}
