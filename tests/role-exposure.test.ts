import { describe, it, expect } from "vitest";
import {
  reachForBand,
  allRoleExposure,
  exposureFor,
  matchIndustry,
  industriesWithRoles,
} from "@/lib/exposure/role-exposure";
import { exposurePayload } from "@/lib/exposure/payload";
import { poolFor } from "@/lib/exposure/match";
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

describe("a sector is its specialists plus everyone's back office", () => {
  // The correction that changed the numbers most. 99 of the 294 roles carry
  // "*" as their industry, meaning one profile serves every sector: finance,
  // legal, HR, IT support, administration. Filtering to "Banking" and showing
  // only the six banking specialists described a bank with no back office, and
  // understated reach by dropping exactly the functions models have got
  // furthest into.
  it("includes the cross-industry roles alongside the sector's own", () => {
    const v = exposureFor("Banking");
    expect(v.basis).toBe("industry");
    expect(v.industry).toBe("Banking");
    expect(v.specific).toBeGreaterThan(0);
    expect(v.common).toBe(99);
    expect(v.total).toBe(v.specific + v.common);
    // Six specialists alone would have been the old answer.
    expect(v.total).toBeGreaterThan(50);
  });

  it("never treats the cross-industry marker as an industry", () => {
    // "*" sorts first in the industry list and is not a sector anyone is in.
    const v = exposureFor("*");
    expect(v.basis).toBe("cross-industry");
    expect(v.industry).toBeNull();
  });

  it("falls back to the macro sector before falling back to everything", () => {
    // A company we cannot place exactly is still better read against its own
    // sector than against the whole economy.
    const v = exposureFor("Retail Banking In Wales", "Financial services");
    expect(v.basis).toBe("macro");
    expect(v.macro).toBe("Financial services");
    expect(v.industry).toBeNull();
    expect(v.specific).toBeGreaterThan(0);
    // Narrower than the whole library, which is the point of the fallback.
    expect(v.specific).toBeLessThan(195);
  });

  it("says so plainly when nothing places the company", () => {
    const v = exposureFor("Deep Sea Mining", "Nothing That Exists");
    expect(v.basis).toBe("cross-industry");
    expect(v.industry).toBeNull();
    expect(v.macro).toBeNull();
    expect(v.total).toBe(294);
  });

  it("sorts most reachable first, which is the order a buyer reads in", () => {
    const v = exposureFor("Banking");
    for (let i = 1; i < v.roles.length; i++) {
      expect(v.roles[i - 1].reachPct).toBeGreaterThanOrEqual(v.roles[i].reachPct);
    }
  });

  it("carries the denominator every figure rests on", () => {
    expect(exposureFor("Banking").modelsScored).toBe(330);
  });

  it("keeps the sector signal instead of averaging it away", () => {
    // The reason the two means are reported separately. Specialist work varies
    // widely by sector; the 99 common roles do not vary at all. Blending five
    // or six specialists into ninety-nine common roles returns near enough the
    // same figure for every sector, which reads as a finding and is an
    // artefact of the averaging.
    const logistics = exposureFor("Transport & Logistics");
    const audit = exposureFor("Accounting & Audit");

    // The common half is identical, because it is the same 99 roles.
    expect(logistics.commonMean).toBe(audit.commonMean);

    // The sector half is not, and by a wide margin.
    expect(logistics.specificMean - audit.specificMean).toBeGreaterThan(20);

    // Blended, that difference all but disappears, which is the bug this
    // guards against.
    expect(Math.abs(logistics.meanReach - audit.meanReach)).toBeLessThan(5);
  });
});

describe("the browser half agrees with the library half", () => {
  // poolFor runs against the 27 KB payload and exposureFor against the 684 KB
  // library. They implement the same rule twice, so this is the test that
  // stops them drifting apart.
  const payload = exposurePayload();
  for (const [industry, macro] of [
    ["Banking", null],
    ["Software & SaaS", null],
    [null, "Financial services"],
    ["Deep Sea Mining", null],
  ] as [string | null, string | null][]) {
    it(`agrees for ${industry ?? "no industry"} / ${macro ?? "no macro"}`, () => {
      const a = exposureFor(industry, macro);
      const b = poolFor(payload, industry, macro);
      expect(b.basis).toBe(a.basis);
      expect(b.roles.length).toBe(a.total);
      expect(b.meanReach).toBe(a.meanReach);
      expect(b.widely).toBe(a.highExposure);
      expect(b.frontier).toBe(a.frontierOnly);
      expect(b.specific).toBe(a.specific);
      expect(b.common).toBe(a.common);
      expect(b.specificMean).toBe(a.specificMean);
      expect(b.commonMean).toBe(a.commonMean);
    });
  }
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
