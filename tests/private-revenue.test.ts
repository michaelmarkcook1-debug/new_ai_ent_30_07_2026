import { describe, expect, it } from "vitest";
import {
  DEFAULT_BAND,
  estimateRevenue,
  formatUsdM,
  impliedRange,
  NOT_VALUATIONS,
  observedMultiples,
  REVENUES,
  STALE_PAIR_DAYS,
  VALUATIONS,
} from "@/lib/finance/private-revenue";

// This module publishes numbers about companies that publish nothing, so the
// tests are mostly about what it must refuse to do.

describe("the record", () => {
  it("cites a publisher, a date and a quote for every figure", () => {
    for (const r of [...VALUATIONS, ...REVENUES]) {
      expect(r.citation.publisher.trim()).not.toBe("");
      expect(r.citation.asOf).toMatch(/^\d{4}-\d{2}-\d{2}$/);
      expect(r.citation.quote.trim().length).toBeGreaterThan(20);
    }
  });

  it("assigns every record a calibration class and a legal basis", () => {
    // The class keeps a data platform's multiple out of a frontier lab's
    // band; a record without one would silently calibrate the wrong regime.
    const classes = ["frontier_lab", "data_platform", "other"];
    for (const v of VALUATIONS) expect(classes).toContain(v.vendorClass);
    for (const r of REVENUES) {
      expect(classes).toContain(r.vendorClass);
      expect(["run_rate", "arr", "annual", "projection"]).toContain(r.basis);
    }
  });

  it("keeps the stated currency and rate visible when it converted one", () => {
    for (const v of VALUATIONS) {
      if (!v.statedCurrency) continue;
      const implied = v.statedCurrency.amount * v.statedCurrency.usdPerUnit;
      // The USD figure must actually be the stated amount at the stated rate,
      // or the conversion note is decoration.
      expect(Math.abs(implied - v.valuationUsdM)).toBeLessThan(1);
    }
    for (const r of REVENUES) {
      if (!r.statedCurrency) continue;
      const implied = r.statedCurrency.amount * r.statedCurrency.usdPerUnit;
      expect(Math.abs(implied - r.revenueUsdM)).toBeLessThan(1);
    }
  });
});

describe("estimateRevenue", () => {
  it("prefers a stated revenue over anything inferred, for every vendor that has both", () => {
    // Every vendor holding a valuation currently also has a reported revenue,
    // so the disclosed lane must win across the board: a valuation-implied
    // range shown where a real figure exists would be an invention.
    for (const v of new Set(VALUATIONS.map((x) => x.vendorId))) {
      const e = estimateRevenue(v, v);
      expect(e.basis).toBe("disclosed");
      expect(e.lowUsdM).toBeNull();
      expect(e.highUsdM).toBeNull();
    }
    expect(estimateRevenue("mistral", "Mistral").disclosed?.revenueUsdM).toBe(400);
    expect(estimateRevenue("anthropic", "Anthropic").disclosed?.revenueUsdM).toBe(47000);
    expect(estimateRevenue("databricks", "Databricks").disclosed?.revenueUsdM).toBe(6900);
    // OpenAI's latest-dated record is a full-year 2026 target , a projection,
    // so the disclosed figure must step back to the mid-year ARR.
    expect(estimateRevenue("openai", "OpenAI").disclosed?.revenueUsdM).toBe(25000);
  });

  it("inverts the band: a higher multiple must imply less revenue", () => {
    // The easiest way to get this backwards is to divide by the wrong end,
    // which would put the whole range on the wrong side of the truth. No live
    // vendor exercises the implied lane right now, so the arithmetic is held
    // directly.
    const r = impliedRange(380_000, { low: 30, high: 90 });
    expect(r.lowUsdM).toBeCloseTo(380_000 / 90, 6);
    expect(r.highUsdM).toBeCloseTo(380_000 / 30, 6);
  });

  it("widens the range as the band widens, and never crosses over", () => {
    const narrow = impliedRange(6_800, { low: 40, high: 50 });
    const wide = impliedRange(6_800, { low: 10, high: 120 });
    expect(wide.highUsdM - wide.lowUsdM).toBeGreaterThan(
      narrow.highUsdM - narrow.lowUsdM
    );
    for (const r of [narrow, wide]) {
      expect(r.lowUsdM).toBeLessThanOrEqual(r.highUsdM);
      expect(r.lowUsdM).toBeGreaterThan(0);
    }
  });

  it("refuses to estimate where nothing is on the record", () => {
    for (const id of ["xai", "together"]) {
      const e = estimateRevenue(id, id);
      expect(e.basis).toBe("no_basis");
      expect(e.lowUsdM).toBeNull();
      expect(e.highUsdM).toBeNull();
      expect(e.absence).toBeTruthy();
    }
  });

  it("never lets a compute commitment or contracted stream into the record", () => {
    // The largest numbers in the feed attach to OpenAI (infrastructure
    // commitments) and xAI (a contracted compute sale). Neither is a
    // valuation or a revenue, and both must stay in the exclusions with the
    // reason attached.
    expect(NOT_VALUATIONS.some((n) => n.vendorId === "openai")).toBe(true);
    expect(NOT_VALUATIONS.some((n) => n.vendorId === "xai")).toBe(true);
    // No valuation record may carry the commitment figures.
    for (const v of VALUATIONS) {
      expect([110_000, 100_000, 300_000]).not.toContain(v.valuationUsdM);
    }
    // xAI's contracted stream must not appear as revenue.
    expect(REVENUES.some((r) => r.vendorId === "xai")).toBe(false);
    // And its absence message carries the exclusion.
    expect(estimateRevenue("xai", "xAI").absence).toMatch(/not/i);
  });

  it("marks an unclosed round rather than presenting it as fact", () => {
    const mistral = VALUATIONS.find((v) => v.vendorId === "mistral")!;
    expect(mistral.state).toBe("in_talks");
  });
});

describe("observedMultiples", () => {
  it("pairs each valuation with the nearest-in-time non-projection revenue", () => {
    const pairs = observedMultiples();
    const mistral = pairs.find((p) => p.vendorId === "mistral");
    expect(mistral).toBeDefined();
    expect(mistral!.vendorClass).toBe("frontier_lab");
    // Both Mistral citations are dated 2026-08-01, so the gap is zero days:
    // and the pairing must pick the same-day $400M floor over the 2025 annual.
    expect(mistral!.daysApart).toBe(0);
    expect(mistral!.multiple).toBeCloseTo(54, 1);
    expect(mistral!.isFloorDerived).toBe(true);
  });

  it("flags stale pairs instead of dropping them or trusting them", () => {
    const pairs = observedMultiples();
    for (const p of pairs) {
      expect(p.stale).toBe(p.daysApart > STALE_PAIR_DAYS);
    }
    // Cohere is the canonical stale pair: an August valuation over February
    // revenue, 169 days apart. The 28x it implies prices two different
    // moments of the company. It must be carried, and it must be flagged.
    const cohere = pairs.find((p) => p.vendorId === "cohere");
    expect(cohere).toBeDefined();
    expect(cohere!.stale).toBe(true);
    // And with the dates verified, every Anthropic pair is fresh: the
    // February valuation pairs with December revenue (43 days), the June
    // valuation with June revenue (14 days).
    for (const p of pairs.filter((x) => x.vendorId === "anthropic")) {
      expect(p.stale).toBe(false);
    }
  });

  it("never derives a multiple from a projection", () => {
    // A real valuation over a hoped-for revenue prices a company that does
    // not exist yet. If a projection record ever sneaks into the pairing,
    // this fails.
    for (const p of observedMultiples()) {
      const revs = REVENUES.filter(
        (r) => r.vendorId === p.vendorId && r.basis === "projection"
      );
      for (const r of revs) {
        const v = VALUATIONS.find((x) => x.vendorId === p.vendorId)!;
        const projectionMultiple =
          Math.round((v.valuationUsdM / r.revenueUsdM) * 10) / 10;
        // The published multiple must not equal one derived from a projection
        // unless a genuine non-projection record happens to coincide.
        const nonProjection = REVENUES.some(
          (x) =>
            x.vendorId === p.vendorId &&
            x.basis !== "projection" &&
            Math.round((v.valuationUsdM / x.revenueUsdM) * 10) / 10 ===
              projectionMultiple
        );
        if (!nonProjection) expect(p.multiple).not.toBe(projectionMultiple);
      }
    }
  });

  it("filters by class, so no cross-regime calibration is possible", () => {
    for (const p of observedMultiples("frontier_lab")) {
      expect(p.vendorClass).toBe("frontier_lab");
    }
    for (const p of observedMultiples("data_platform")) {
      expect(p.vendorClass).toBe("data_platform");
    }
  });
});

describe("the dated series", () => {
  it("serves the LATEST non-projection figure as the disclosed one", () => {
    // With one record this is trivially true; the test is here for the day a
    // second, older figure lands and the find() would otherwise grab it.
    for (const v of new Set(REVENUES.map((r) => r.vendorId))) {
      const e = estimateRevenue(v, v);
      if (e.basis !== "disclosed") continue;
      const nonProjections = REVENUES.filter(
        (r) => r.vendorId === v && r.basis !== "projection"
      );
      const latest = nonProjections.reduce((a, b) =>
        Date.parse(a.citation.asOf) >= Date.parse(b.citation.asOf) ? a : b
      );
      expect(e.disclosed!.citation.asOf).toBe(latest.citation.asOf);
    }
  });

  it("returns the full series oldest-first, projections included", () => {
    const e = estimateRevenue("mistral", "Mistral");
    expect(e.series.length).toBeGreaterThan(0);
    for (let i = 1; i < e.series.length; i++) {
      expect(
        Date.parse(e.series[i].citation.asOf)
      ).toBeGreaterThanOrEqual(Date.parse(e.series[i - 1].citation.asOf));
    }
  });

  it("never lets a projection become the figure", () => {
    // A vendor whose only record is a projection must fall through to the
    // valuation lane or to no basis, never to "disclosed".
    for (const v of new Set(REVENUES.map((r) => r.vendorId))) {
      const records = REVENUES.filter((r) => r.vendorId === v);
      if (records.every((r) => r.basis === "projection")) {
        const e = estimateRevenue(v, v);
        expect(e.basis).not.toBe("disclosed");
      }
    }
  });
});

describe("the default band", () => {
  it("contains every fresh frontier-lab pair, so the default is not arbitrary", () => {
    const fresh = observedMultiples("frontier_lab").filter((p) => !p.stale);
    expect(fresh.length).toBeGreaterThan(0);
    for (const p of fresh) {
      expect(p.multiple).toBeGreaterThanOrEqual(DEFAULT_BAND.low);
      expect(p.multiple).toBeLessThanOrEqual(DEFAULT_BAND.high);
    }
  });

  it("keeps the data platforms in their own calibration class", () => {
    const platforms = observedMultiples("data_platform");
    expect(platforms.length).toBeGreaterThan(0);
    for (const p of platforms) {
      expect(p.vendorId).toBe("databricks");
    }
    // And none of them leaks into the frontier set.
    const frontier = observedMultiples("frontier_lab");
    expect(frontier.some((p) => p.vendorId === "databricks")).toBe(false);
  });
});

describe("formatUsdM", () => {
  it("reads in billions past a thousand million, and rounds honestly", () => {
    expect(formatUsdM(400)).toBe("$400M");
    expect(formatUsdM(6800)).toBe("$6.8B");
    expect(formatUsdM(380000)).toBe("$380B");
  });
});
