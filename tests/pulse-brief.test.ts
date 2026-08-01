import { describe, it, expect } from "vitest";
import {
  buildScorecard,
  buildPricePicks,
  decisionFor,
} from "@/lib/pulse/brief";
import type { MarketMetrics, MarketKpi } from "@/lib/market-metrics";
import type { CostCapabilityModel } from "@/app/(ai-ent)/price-performance/data";

// The first two blocks are regression tests for readings that shipped wrong.
// Both rendered a confident, labelled sentence that was false, which is the
// specific failure this page must not have.

const kpi = (label: string, score: number | null, n = 47): MarketKpi => ({
  label,
  tooltip: "",
  score,
  delta: null,
  definition: "",
  sourceField: "field",
  sampleSize: n,
});

const model = (
  intelligence: number,
  inputPerM: number,
  frontier = false
): CostCapabilityModel => ({
  model: `m${intelligence}-${inputPerM}`,
  intelligence,
  inputPerM,
  throughput: null,
  frontier,
  provider: "Test",
});

function metrics(over: Partial<MarketMetrics> = {}): MarketMetrics {
  return {
    vendors: [],
    shares: [],
    kpis: [kpi("AVERAGE AG CAPABILITY SCORE", 58.5), kpi("HIGH-SEVERITY RISK ALERTS", 6)],
    risks: [],
    gaining: [],
    slipping: [],
    lane: "aie-live",
    generatedAt: "2026-07-31T00:00:00.000Z",
    reputationAsOf: null,
    shareAsOf: null,
    shareMovementPublished: false,
    ...over,
  };
}

const share = (categoryId: string, estimatedShare: number) => ({
  vendorId: `v${estimatedShare}`,
  categoryId,
  estimatedShare,
  confidence: 0.8,
  source: "test",
  sourceDate: "2026-07-31",
  methodology: "test",
  changePct: null,
});

describe("competitive intensity", () => {
  it("never exceeds 100 per cent when shares span several categories", () => {
    // The bug: shares are per-category and each category sums to about 100.
    // Pooling them and taking the top three produced 118.3 per cent.
    const shares = [
      share("a", 50), share("a", 30), share("a", 15), share("a", 5),
      share("b", 45), share("b", 35), share("b", 12), share("b", 8),
      share("c", 60), share("c", 25), share("c", 10), share("c", 5),
    ];
    const out = buildScorecard(metrics({ shares }), [model(50, 1)]);
    const dim = out.scorecard.find((d) => d.key === "intensity");
    const pct = Number(/about ([\d.]+) per cent/.exec(dim!.meaning)?.[1]);
    expect(pct).toBeLessThanOrEqual(100);
    expect(pct).toBeGreaterThan(0);
  });

  it("computes concentration inside a category, not across the pool", () => {
    // Two categories, top three of each = 95. Pooling would give 3 x 50 = 150.
    const shares = [
      share("a", 50), share("a", 30), share("a", 15), share("a", 5),
      share("b", 50), share("b", 30), share("b", 15), share("b", 5),
    ];
    const out = buildScorecard(metrics({ shares }), [model(50, 1)]);
    const dim = out.scorecard.find((d) => d.key === "intensity");
    expect(dim!.meaning).toContain("95");
  });

  it("reports not published when no category has three estimates", () => {
    const out = buildScorecard(
      metrics({ shares: [share("a", 60), share("b", 40)] }),
      [model(50, 1)]
    );
    const dim = out.scorecard.find((d) => d.key === "intensity");
    expect(dim!.status).toBe("Not published");
  });
});

describe("price efficiency", () => {
  it("measures the cost of the last capability increment, not the frontier flag", () => {
    // The bug: comparing frontier-flagged models against the rest is
    // tautological, since the flag marks the Pareto-efficient set. Here the
    // frontier flags are deliberately misleading and must not change the read.
    const models = [
      model(100, 50, false), // top capability, expensive
      model(85, 1, true), // reaches 85 per cent for 1/50th the price
      model(40, 0.5, true),
      model(20, 0.1, false),
    ];
    const out = buildScorecard(metrics(), models);
    const dim = out.scorecard.find((d) => d.key === "price");
    expect(out.facts.priceRatio).toBe(50);
    expect(dim!.status).toBe("Favourable");
    expect(dim!.meaning).toContain("80 per cent");
  });

  it("reports tight when a near-equivalent costs about the same", () => {
    const out = buildScorecard(metrics(), [model(100, 10), model(90, 9)]);
    const dim = out.scorecard.find((d) => d.key === "price");
    expect(dim!.status).toBe("Tight");
  });

  it("says not published rather than guessing when nothing is priced", () => {
    const out = buildScorecard(metrics(), []);
    const dim = out.scorecard.find((d) => d.key === "price");
    expect(dim!.status).toBe("Not published");
    expect(out.facts.priceRatio).toBeNull();
  });
});

describe("direction of travel", () => {
  it("shows a direction only where a prior reading exists", () => {
    // Momentum is classified by the source, so it may carry one. The other
    // four have no prior period published and must not draw an arrow.
    const out = buildScorecard(metrics(), [model(50, 1)]);
    const withDirection = out.scorecard.filter(
      (d) => d.direction !== "unpublished"
    );
    expect(withDirection.every((d) => d.key === "momentum")).toBe(true);
  });
});

describe("price picks", () => {
  const models = [
    model(100, 50),
    model(85, 1),
    model(40, 0.5),
    model(20, 0.1),
  ];

  it("refuses to claim an improvement from a single capture", () => {
    const picks = buildPricePicks(models, "2026-07-31", "Test benchmark");
    const improvement = picks.find((p) =>
      p.slot.toLowerCase().includes("improvement")
    );
    expect(improvement!.model).toBeNull();
    expect(improvement!.unavailable).toMatch(/insufficient evidence/i);
  });

  it("never lets best value be won by a model below the median score", () => {
    const picks = buildPricePicks(models, null, "Test benchmark");
    const bestValue = picks.find((p) => p.slot.startsWith("Best value"));
    // The 0.1-priced model has the best points per dollar but is far below
    // median capability, so it must not take the slot.
    expect(bestValue!.model).not.toBe("m20-0.1");
  });

  it("returns a stated absence, not an empty list, with no data", () => {
    const picks = buildPricePicks([], null, "Test benchmark");
    expect(picks.length).toBeGreaterThan(0);
    expect(picks[0].unavailable).toMatch(/data unavailable/i);
  });

  it("attaches confidence, horizon and evidence state to every pick", () => {
    for (const p of buildPricePicks(models, "2026-07-31", "Test")) {
      expect(["High", "Medium", "Low"]).toContain(p.meta.confidence);
      expect(["Immediate", "30 days", "90 days", "12 months"]).toContain(
        p.meta.horizon
      );
      expect(p.meta.lane).toBe("derived");
    }
  });
});

describe("vendor decision", () => {
  it("pauses on an open high-severity risk whatever the score", () => {
    const d = decisionFor(92, 80, 70, true, "aie-live", null);
    expect(d.status).toBe("Pause");
  });

  it("monitors rather than guessing when no composite is published", () => {
    const d = decisionFor(null, null, null, false, "aie-live", null);
    expect(d.status).toBe("Monitor");
    expect(d.meta.confidence).toBe("Low");
  });

  it("shortlists a strong score and tests a middling one", () => {
    expect(decisionFor(75, null, null, false, "aie-live", null).status).toBe(
      "Shortlist"
    );
    expect(decisionFor(60, null, null, false, "aie-live", null).status).toBe(
      "Test"
    );
  });

  it("cites the dimensions behind the call", () => {
    const d = decisionFor(75, 80, 60, false, "aie-live", null);
    expect(d.keyDimensions.join(" ")).toContain("75");
    expect(d.keyDimensions.join(" ")).toContain("80");
  });
});

describe("no-data behaviour", () => {
  it("builds a full scorecard with empty inputs and claims nothing", () => {
    const bare = metrics({ kpis: [], shares: [], gaining: [], slipping: [] });
    const out = buildScorecard(bare, []);
    expect(out.scorecard).toHaveLength(5);
    const claimed = out.scorecard.filter((d) => d.status !== "Not published");
    expect(claimed).toHaveLength(0);
    expect(out.overall.recommendation).toBeTruthy();
  });
});
