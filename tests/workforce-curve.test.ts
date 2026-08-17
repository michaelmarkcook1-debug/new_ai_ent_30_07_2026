import { describe, it, expect } from "vitest";
import rolesJson from "@/lib/model-fit/data/roles.json";
import modelsJson from "@/lib/model-fit/data/models.json";
import {
  workforceCurve,
  measuredTiers,
  densityCurve,
  priceStaircase,
  priceMultiple,
  topTierRoles,
  industries,
  CAP01_THRESHOLDS,
  TOP_TIER_INDEX,
  BANDWIDTH,
} from "@/lib/model-fit/workforce-curve";
import { LIBRARY_ROLE_COUNT } from "@/lib/model-fit";
import type { Role, ModelRecord } from "@/lib/model-fit/engine";

const ROLES = Object.values(rolesJson as Record<string, unknown>) as Role[];
const MODELS = (
  Array.isArray(modelsJson) ? modelsJson : Object.values(modelsJson)
) as ModelRecord[];

const pct = (x: number) => Number((x * 100).toFixed(1));

describe("the workforce distribution", () => {
  it("reads the bundle the chart claims to read", () => {
    // Was a literal 294 until three construction design roles landed on 17
    // August 2026. Checking the chart's own read of the bundle against the
    // engine's index is the check that was meant: it catches the engine
    // silently dropping a role, which a hardcoded number never did.
    expect(ROLES.length).toBe(LIBRARY_ROLE_COUNT);
    const w = workforceCurve(ROLES);
    expect(w.totalHeadcount).toBe(17116);
    expect(industries(ROLES).length).toBe(37);
  });

  // These two numbers are the entire finding. If either moves, the annotation
  // on the chart is wrong and the chart should not ship.
  it("puts 14.8% of staff at tier 70+ and 0.7% at tier 90", () => {
    const w = workforceCurve(ROLES);
    expect(pct(w.topTierShare)).toBe(14.8);
    expect(pct(w.peakTierShare)).toBe(0.7);
  });

  it("keeps the five measured tiers alongside the smoothed curve", () => {
    const w = workforceCurve(ROLES);
    expect(w.measured.map((m) => m.tier)).toEqual([10, 30, 50, 70, 90]);
    expect(w.measured.map((m) => m.index)).toEqual([0, 20, 32, 45, 56]);
    expect(w.curve.length).toBeGreaterThan(100);
    // Shares are a partition of the workforce, so they sum to 1.
    const total = w.measured.reduce((a, m) => a + m.share, 0);
    expect(total).toBeCloseTo(1, 10);
  });

  it("places the tier thresholds where the calibration says", () => {
    expect(CAP01_THRESHOLDS).toEqual({ 10: 0, 30: 20, 50: 32, 70: 45, 90: 56 });
    expect(TOP_TIER_INDEX).toBe(45);
  });
});

describe("the smoothing bandwidth", () => {
  const modes = (bandwidth: number) => {
    const c = densityCurve(measuredTiers(ROLES), { bandwidth });
    let n = 0;
    for (let i = 1; i < c.length - 1; i++) {
      if (
        c[i].density > c[i - 1].density &&
        c[i].density >= c[i + 1].density &&
        c[i].density > 0.2
      ) {
        n += 1;
      }
    }
    return n;
  };

  // The reason bandwidth is 9 and not the more conventional 5 or 7: tier 30
  // holds 39.8% of headcount and tier 50 holds 39.6%. A narrow kernel splits
  // that near-tie into two peaks and the chart then asserts a bimodal
  // workforce that is an artefact of the smoothing.
  it("resolves the tier-30/tier-50 near-tie into one mode, not two", () => {
    expect(modes(5)).toBeGreaterThan(1);
    expect(modes(BANDWIDTH)).toBe(1);
  });

  it("puts the single mode near index 27", () => {
    const c = densityCurve(measuredTiers(ROLES), { bandwidth: BANDWIDTH });
    const peak = c.reduce((a, b) => (b.density > a.density ? b : a));
    expect(peak.index).toBeGreaterThan(24);
    expect(peak.index).toBeLessThan(30);
  });

  it("normalises density to a unitless peak of 1", () => {
    const c = densityCurve(measuredTiers(ROLES));
    expect(Math.max(...c.map((p) => p.density))).toBeCloseTo(1, 10);
  });

  it("returns nothing rather than a flat line when there is no headcount", () => {
    expect(densityCurve([])).toEqual([]);
  });
});

describe("the price staircase", () => {
  it("never gets cheaper as the capability bar rises", () => {
    const steps = priceStaircase(MODELS);
    expect(steps.length).toBeGreaterThan(10);
    for (let i = 1; i < steps.length; i++) {
      expect(steps[i].price).toBeGreaterThanOrEqual(steps[i - 1].price);
    }
  });

  it("stops where the models stop instead of charting a price of zero", () => {
    const steps = priceStaircase(MODELS);
    const best = Math.max(
      ...MODELS.map((m) => (m.benchmarks?.intelligence as number) ?? -1)
    );
    expect(steps[steps.length - 1].index).toBeLessThanOrEqual(best);
    expect(steps.every((s) => s.price > 0)).toBe(true);
  });

  it("names the model behind each step, so a price is checkable", () => {
    const steps = priceStaircase(MODELS);
    expect(steps.every((s) => s.modelId.length > 0)).toBe(true);
  });

  it("reports the multiple between the common tier and the top tier", () => {
    const m = priceMultiple(priceStaircase(MODELS), 20, TOP_TIER_INDEX);
    expect(m).not.toBeNull();
    expect(m as number).toBeGreaterThan(1);
  });
});

describe("the tier-70+ exception list", () => {
  it("returns the largest such roles, biggest first", () => {
    const list = topTierRoles(ROLES);
    expect(list.length).toBe(12);
    expect(list.every((r) => r.tier >= 70)).toBe(true);
    for (let i = 1; i < list.length; i++) {
      expect(list[i].headcount).toBeLessThanOrEqual(list[i - 1].headcount);
    }
  });

  it("accounts for no more headcount than the tier-70+ total", () => {
    const w = workforceCurve(ROLES);
    const listed = topTierRoles(ROLES, null, 1000).reduce(
      (a, r) => a + r.headcount,
      0
    );
    expect(listed).toBe(Math.round(w.topTierShare * w.totalHeadcount));
  });
});

describe("the industry filter", () => {
  it("recomputes the curve over one industry only", () => {
    const one = industries(ROLES)[0];
    const w = workforceCurve(ROLES, one);
    expect(w.roleCount).toBeGreaterThan(0);
    expect(w.roleCount).toBeLessThan(294);
    expect(w.totalHeadcount).toBeLessThan(17116);
    expect(w.measured.reduce((a, m) => a + m.share, 0)).toBeCloseTo(1, 10);
  });

  it("adds up to the whole across every industry", () => {
    const sum = industries(ROLES).reduce(
      (a, i) => a + workforceCurve(ROLES, i).totalHeadcount,
      0
    );
    expect(sum).toBe(17116);
  });

  it("survives an industry with nothing in it", () => {
    const w = workforceCurve(ROLES, "Nowhere");
    expect(w.totalHeadcount).toBe(0);
    expect(w.curve).toEqual([]);
    expect(w.topTierShare).toBe(0);
  });
});
