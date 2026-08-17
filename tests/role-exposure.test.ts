import { describe, it, expect } from "vitest";
import {
  reachForBand,
  allRoleExposure,
  exposureView,
} from "@/lib/exposure/role-exposure";
import { verticalLens, taggedIndustries } from "@/lib/exposure/vertical";
import { exposurePayload } from "@/lib/exposure/payload";
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
// The first attempt compared the role's CAP-01 band (10 to 90) against the
// Intelligence Index (0 to about 61) directly. Two different scales, so every
// demanding role read as 0 per cent reachable and the chart would have been
// confidently wrong. The band goes through CAP01_THRESHOLDS, and the first
// block below is what stops that returning.

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
    // A measure returning one value for every role would be useless, which is
    // exactly what the first candidate metric did.
    expect(r10 - r90).toBeGreaterThan(50);
  });

  it("puts the frontier-only band in single figures", () => {
    expect(reachForBand(90)).toBeLessThan(10);
  });

  it("returns 0 for a band the table does not carry", () => {
    expect(reachForBand(42)).toBe(0);
  });
});

describe("the reading rests on the multi-industry roles", () => {
  // These 99 apply to a bank, a grocer and a shipyard alike, so nothing has to
  // be guessed about a company for the reading to be true of it. Sector
  // specialists were tried first: five to seven roles per industry, needing the
  // company placed in a taxonomy that can be got wrong, and once these 99 were
  // correctly included beside them every sector returned the same number.
  const view = exposureView();

  it("reads 99 roles across 18 functions", () => {
    expect(view.total).toBe(99);
    expect(view.roles.length).toBe(99);
    expect(view.functions.length).toBe(18);
    expect(view.functions.reduce((a, f) => a + f.roles.length, 0)).toBe(99);
  });

  it("takes only the roles that serve every sector", () => {
    expect(view.roles.every((r) => r.industry === "*")).toBe(true);
  });

  it("spans the full range rather than clustering", () => {
    const reaches = view.roles.map((r) => r.reachPct);
    expect(Math.min(...reaches)).toBeLessThan(5);
    expect(Math.max(...reaches)).toBe(100);
    expect(new Set(reaches).size).toBeGreaterThan(3);
  });

  it("puts service desks above chief officers", () => {
    // The direction has to be right or the panel is worse than useless.
    const byName = (n: string) => view.roles.find((r) => r.name === n);
    expect(byName("Customer Support Advisor")!.reachPct).toBeGreaterThan(
      byName("Chief Transformation Officer")!.reachPct
    );
  });

  it("sorts functions most reached first, and roles within them", () => {
    for (let i = 1; i < view.functions.length; i++) {
      expect(view.functions[i - 1].meanReach).toBeGreaterThanOrEqual(
        view.functions[i].meanReach
      );
    }
    for (const fn of view.functions) {
      expect(fn.leader).toBe(fn.roles[0]);
      for (let i = 1; i < fn.roles.length; i++) {
        expect(fn.roles[i - 1].reachPct).toBeGreaterThanOrEqual(
          fn.roles[i].reachPct
        );
      }
    }
  });

  it("carries the denominator every figure rests on", () => {
    expect(view.modelsScored).toBe(330);
  });
});

describe("the shared profile is a real limitation, not a hidden one", () => {
  it("gives a multi-industry role one reading for every sector", () => {
    // The library carries one profile per cross-industry role, which its own
    // specification records as wrong and not yet fixable from evidence. A
    // customer care agent in investment banking does harder work than one in
    // retail and these figures cannot see it. The panel says so, and the
    // vertical lens below carries the difference that IS recorded.
    const agents = allRoleExposure().filter(
      (r) => r.name === "Customer Support Advisor"
    );
    expect(agents.length).toBe(1);
    expect(agents[0].industry).toBe("*");
  });
});

describe("the vertical lens carries what actually differs by sector", () => {
  // Capability cannot vary by sector here, so the lens reads assurance
  // instead: the risk tier, reliability bar and safe autonomy of the workflows
  // the catalogue tags to that sector. All recorded, none inferred.
  it("separates a regulated sector from a light-touch one", () => {
    const finance = verticalLens("financial_services")!;
    const tech = verticalLens("technology_software")!;
    expect(finance).toBeTruthy();
    expect(tech).toBeTruthy();
    expect(finance.meanRisk).toBeGreaterThan(tech.meanRisk);
    expect(finance.meanReliability).toBeGreaterThan(tech.meanReliability);
  });

  it("puts financial services at the top of the reliability bar", () => {
    expect(verticalLens("financial_services")!.meanReliability).toBe(5);
  });

  it("takes the most constrained autonomy, not the average", () => {
    // A sector is governed by its most constrained work, so the tightest
    // default is the honest one to print.
    const finance = verticalLens("financial_services")!;
    expect(["advisory_only", "human_in_loop"]).toContain(
      finance.tightestAutonomy
    );
  });

  it("flags a sector resting on too few workflows", () => {
    // Only 25 of 75 workflows carry industry tags and some sectors have one or
    // two. Two workflows are a hint, not a sector profile.
    const thin = taggedIndustries()
      .map((t) => verticalLens(t)!)
      .filter((l) => l.workflows < 4);
    expect(thin.length).toBeGreaterThan(0);
    for (const l of thin) expect(l.thin).toContain("rather than a profile");
  });

  it("returns null rather than falling back to the catalogue average", () => {
    // An average presented as a sector reading would look like a fact about
    // banking and be a fact about everything.
    expect(verticalLens(null)).toBeNull();
    expect(verticalLens("real_estate" as never)).toBeNull();
  });

  it("compares each sector with the catalogue rather than in the abstract", () => {
    const finance = verticalLens("financial_services")!;
    expect(finance.vsAll.risk).toBeGreaterThan(0);
    expect(finance.vsAll.reliability).toBeGreaterThan(0);
  });
});

describe("the payload the browser receives", () => {
  const p = exposurePayload();

  it("carries the roles, the functions and every sector lens", () => {
    expect(p.roles.length).toBe(99);
    expect(p.functions.length).toBe(18);
    expect(Object.keys(p.verticals).length).toBe(taggedIndustries().length);
    expect(p.modelsScored).toBe(330);
  });

  it("stays small enough to send", () => {
    // The role library is 684 KB and must never reach the browser.
    //
    // Raised from 60 KB on 17 August 2026. The sector pilot went from six
    // sectors to the fifteen the classifier knows, so rolePilots went from
    // roughly 30 KB to 133 KB and carries 234 deltas with the sentence
    // explaining each. That is the correct payload for the coverage: the old
    // figure was small because two thirds of the taxonomy had no evidence.
    //
    // Still a real ceiling, because this is sent to every reader on the tab.
    // If it needs to come down, the lever is the `why` prose rather than the
    // deltas, since switching sector is meant to be instant and offline.
    expect(JSON.stringify(p).length).toBeLessThan(170_000);
  });

  it("agrees with the server-side view it was flattened from", () => {
    const v = exposureView();
    expect(p.meanReach).toBe(v.meanReach);
    expect(p.widelyReached).toBe(v.highExposure);
    expect(p.frontierOnly).toBe(v.frontierOnly);
  });
});
