import { describe, it, expect } from "vitest";
import {
  reachForBand,
  allRoleExposure,
  exposureFor,
  matchIndustry,
  industriesWithRoles,
} from "@/lib/exposure/role-exposure";
import { CAP01_THRESHOLDS } from "@/lib/model-fit/workforce-curve";

// Exposure is a derivation, so these tests pin the derivation rather than the
// prose around it.
//
// The measure exists because the obvious alternative is fabrication. A
// per-role "AI exposure percentage" for an arbitrary company is not published
// anywhere, and inventing one would be the single easiest way to break this
// product's promise while looking authoritative. This computes something real
// instead: the share of the tracked catalogue that already reaches the
// capability level a role's work demands.
//
// The first attempt at this compared the role's CAP-01 band (10 to 90) against
// the Intelligence Index (0 to about 61) directly. Two different scales, so
// every demanding role read as 0 per cent reachable and the chart would have
// been confidently wrong. The band goes through CAP01_THRESHOLDS, and the test
// below is what stops that returning.

describe("bands are mapped through the threshold table, not compared raw", () => {
  it("converts each band to its own index requirement", () => {
    // If these ever equal the band itself, the scale bug is back.
    expect(CAP01_THRESHOLDS[30]).toBe(20);
    expect(CAP01_THRESHOLDS[70]).toBe(45);
    expect(CAP01_THRESHOLDS[90]).toBe(56);
  });

  it("reach falls as the demand rises, and spans a real range", () => {
    const r10 = reachForBand(10);
    const r50 = reachForBand(50);
    const r90 = reachForBand(90);
    expect(r10).toBe(100); // threshold is zero: every scored model clears it
    expect(r10).toBeGreaterThan(r50);
    expect(r50).toBeGreaterThan(r90);
    // A measure that returned one value for every role would be useless, which
    // is exactly what the first candidate metric did.
    expect(r10 - r90).toBeGreaterThan(50);
  });

  it("puts the frontier-only band in single figures", () => {
    // Very few models reach the level the most demanding roles work at, and
    // that is the finding rather than a gap.
    expect(reachForBand(90)).toBeLessThan(10);
  });

  it("returns 0 for a band the table does not carry", () => {
    expect(reachForBand(42)).toBe(0);
  });
});

describe("the library reads end to end", () => {
  const all = allRoleExposure();

  it("scores every role that carries a CAP-01 requirement", () => {
    expect(all.length).toBe(294);
    expect(all.every((r) => r.reachPct >= 0 && r.reachPct <= 100)).toBe(true);
    expect(all.every((r) => r.name.length > 0)).toBe(true);
  });

  it("produces more than one distinct exposure value", () => {
    // The guard against the metric that scored all 294 roles identically.
    expect(new Set(all.map((r) => r.reachPct)).size).toBeGreaterThan(2);
  });

  it("puts support and service work above strategy and consulting", () => {
    // The direction has to be right or the panel is worse than useless. Work
    // that demands little of a model is work most models can already do.
    const byName = (n: string) => all.find((r) => r.name === n);
    const support = byName("Customer Support Advisor");
    const strategy = byName("Strategy Consultant");
    expect(support).toBeDefined();
    expect(strategy).toBeDefined();
    expect(support!.reachPct).toBeGreaterThan(strategy!.reachPct);
  });
});

describe("an industry view", () => {
  it("narrows to the industry when the library carries it", () => {
    const known = industriesWithRoles()[0];
    const v = exposureFor(known);
    expect(v.industry).toBe(known);
    expect(v.roles.every((r) => r.industry === known)).toBe(true);
    expect(v.total).toBe(v.roles.length);
  });

  it("falls back to the whole library rather than showing nothing", () => {
    // A reader who named a sector we do not carry is better served by the
    // cross-industry picture, labelled as such, than by a blank panel.
    const v = exposureFor("Deep Sea Mining");
    expect(v.industry).toBeNull();
    expect(v.roles.length).toBe(294);
  });

  it("sorts most reachable first, which is the order a buyer reads in", () => {
    const v = exposureFor(null);
    for (let i = 1; i < v.roles.length; i++) {
      expect(v.roles[i - 1].reachPct).toBeGreaterThanOrEqual(v.roles[i].reachPct);
    }
  });

  it("counts the two ends without overlapping them", () => {
    const v = exposureFor(null);
    expect(v.highExposure).toBeGreaterThan(0);
    expect(v.frontierOnly).toBeGreaterThan(0);
    expect(v.highExposure + v.frontierOnly).toBeLessThanOrEqual(v.total);
  });

  it("carries the denominator every figure rests on", () => {
    expect(exposureFor(null).modelsScored).toBe(330);
  });
});

describe("matching a researched company to an industry", () => {
  it("matches exactly and case-insensitively", () => {
    const known = industriesWithRoles()[0];
    expect(matchIndustry(known)).toBe(known);
    expect(matchIndustry(known.toUpperCase())).toBe(known);
  });

  it("returns null rather than guessing", () => {
    // A wrong industry puts a reader's functions against another sector's role
    // mix, which is worse than the labelled cross-industry view.
    expect(matchIndustry("Deep Sea Mining")).toBeNull();
    expect(matchIndustry(null)).toBeNull();
    expect(matchIndustry("")).toBeNull();
  });
});
