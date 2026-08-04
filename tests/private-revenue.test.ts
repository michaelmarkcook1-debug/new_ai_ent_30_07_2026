import { describe, expect, it } from "vitest";
import {
  DEFAULT_BAND,
  estimateRevenue,
  formatUsdM,
  NOT_VALUATIONS,
  observedMultiple,
  observedMultiples,
  REVENUES,
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
      const implied =
        v.statedCurrency.amount * v.statedCurrency.usdPerUnit;
      // The USD figure must actually be the stated amount at the stated rate,
      // or the conversion note is decoration.
      expect(Math.abs(implied - v.valuationUsdM)).toBeLessThan(1);
    }
  });
});

describe("estimateRevenue", () => {
  it("prefers a stated revenue over anything inferred", () => {
    // Mistral has both a valuation and a reported revenue.
    const e = estimateRevenue("mistral", "Mistral");
    expect(e.basis).toBe("disclosed");
    expect(e.disclosed?.revenueUsdM).toBe(400);
    expect(e.lowUsdM).toBeNull();
    expect(e.highUsdM).toBeNull();
  });

  it("infers a range, never a point, from a valuation alone", () => {
    const e = estimateRevenue("anthropic", "Anthropic");
    expect(e.basis).toBe("implied_from_valuation");
    expect(e.lowUsdM).not.toBeNull();
    expect(e.highUsdM).not.toBeNull();
    expect(e.highUsdM!).toBeGreaterThan(e.lowUsdM!);
  });

  it("inverts the band: a higher multiple must imply less revenue", () => {
    // The easiest way to get this backwards is to divide by the wrong end,
    // which would put the whole range on the wrong side of the truth.
    const e = estimateRevenue("anthropic", "Anthropic", { low: 30, high: 90 });
    const v = VALUATIONS.find((x) => x.vendorId === "anthropic")!;
    expect(e.lowUsdM).toBeCloseTo(v.valuationUsdM / 90, 6);
    expect(e.highUsdM).toBeCloseTo(v.valuationUsdM / 30, 6);
  });

  it("widens the range as the band widens, and never crosses over", () => {
    const narrow = estimateRevenue("cohere", "Cohere", { low: 40, high: 50 });
    const wide = estimateRevenue("cohere", "Cohere", { low: 10, high: 120 });
    expect(wide.highUsdM! - wide.lowUsdM!).toBeGreaterThan(
      narrow.highUsdM! - narrow.lowUsdM!
    );
    for (const e of [narrow, wide]) {
      expect(e.lowUsdM!).toBeLessThanOrEqual(e.highUsdM!);
      expect(e.lowUsdM!).toBeGreaterThan(0);
    }
  });

  it("refuses to estimate where nothing is on the record", () => {
    for (const id of ["xai", "databricks", "together"]) {
      const e = estimateRevenue(id, id);
      expect(e.basis).toBe("no_basis");
      expect(e.lowUsdM).toBeNull();
      expect(e.highUsdM).toBeNull();
      expect(e.absence).toBeTruthy();
    }
  });

  it("never treats a compute commitment as a valuation", () => {
    // OpenAI's $110B infrastructure figure is the single largest number in the
    // feed and the most tempting thing to divide. It must produce no estimate.
    const e = estimateRevenue("openai", "OpenAI");
    expect(e.basis).toBe("no_basis");
    expect(e.lowUsdM).toBeNull();
    expect(e.absence).toMatch(/not a valuation/i);
    expect(NOT_VALUATIONS.some((n) => n.vendorId === "openai")).toBe(true);
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
    // Both Mistral citations are dated 2026-08-01, so the gap is zero days.
    expect(mistral!.daysApart).toBe(0);
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
    // valuation lane or to no basis — never to "disclosed".
    for (const v of new Set(REVENUES.map((r) => r.vendorId))) {
      const records = REVENUES.filter((r) => r.vendorId === v);
      if (records.every((r) => r.basis === "projection")) {
        const e = estimateRevenue(v, v);
        expect(e.basis).not.toBe("disclosed");
      }
    }
  });
});

describe("observedMultiple", () => {
  it("derives the anchor from the one pair that has both figures", () => {
    const m = observedMultiple();
    expect(m).not.toBeNull();
    expect(m!.vendorId).toBe("mistral");
    // 21,600 / 400 = 54
    expect(m!.multiple).toBeCloseTo(54, 1);
    // The revenue was reported as a floor, so the real multiple is lower and
    // the interface has to say so.
    expect(m!.isFloorDerived).toBe(true);
  });

  it("sits inside the default band, so the default is not arbitrary", () => {
    const m = observedMultiple()!;
    expect(m.multiple).toBeGreaterThanOrEqual(DEFAULT_BAND.low);
    expect(m.multiple).toBeLessThanOrEqual(DEFAULT_BAND.high);
  });
});

describe("formatUsdM", () => {
  it("reads in billions past a thousand million, and rounds honestly", () => {
    expect(formatUsdM(400)).toBe("$400M");
    expect(formatUsdM(6800)).toBe("$6.8B");
    expect(formatUsdM(380000)).toBe("$380B");
  });
});
