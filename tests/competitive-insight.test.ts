import { describe, it, expect } from "vitest";
import { readFileSync } from "node:fs";
import { competitiveInsight, type CapabilityRow } from "@/lib/analyst/insight";
import { vendorIdsInCategory, MARKET_CATEGORY_LIST } from "@/lib/comparability";
import type { MarketMetrics } from "@/lib/market-metrics";

// Competitive Intel's headline said the opposite of what its own data said.
//
// The function took a `categoryName` and a provider count scoped to that
// category, then computed its top and median from every tracked vendor. TSMC,
// a chip foundry, was the "top" for a page about model providers, which pushed
// the global spread to 17.9 and tripped the WIDE branch. Every one of the
// thirteen categories is actually narrow. So the page told buyers capability
// still separates the leaders and to Shortlist, when its own numbers said
// capability has converged and the move is to Renegotiate.
//
// That is the exact cross-category contamination the comparability rule exists
// to prevent, reintroduced inside the analyst layer rather than in a chart.

const stubMetrics = () =>
  ({ lane: "aie", generatedAt: "2026-08-17", vendors: [] } as unknown as MarketMetrics);

/** Mean capability per vendor, straight from the fixture the page reads. */
function meansByVendor(): Map<string, number> {
  const caps = JSON.parse(
    readFileSync("fixtures/aie-live/capabilities.json", "utf8")
  ) as { vendorCapabilities: { vendorId: string; maturityScore: number | null }[] };
  const acc = new Map<string, number[]>();
  for (const r of caps.vendorCapabilities ?? []) {
    if (typeof r.maturityScore !== "number") continue;
    acc.set(r.vendorId, [...(acc.get(r.vendorId) ?? []), r.maturityScore]);
  }
  return new Map(
    [...acc].map(([id, v]) => [id, v.reduce((a, b) => a + b, 0) / v.length])
  );
}

function rowsFor(categoryId: string): CapabilityRow[] {
  const means = meansByVendor();
  return vendorIdsInCategory(categoryId)
    .filter((id) => means.has(id))
    .map((id) => ({ name: id, mean: means.get(id) as number }));
}

describe("competitive insight scoping", () => {
  it("reads only the rows it was given, never the whole market", () => {
    // Three rows, all close together. If this reached past them to any global
    // population it could not produce this spread.
    const insight = competitiveInsight(
      stubMetrics(),
      null,
      "Workflow automation AI",
      10,
      [
        { name: "a", mean: 62 },
        { name: "b", mean: 60 },
        { name: "c", mean: 58 },
      ]
    );
    expect(insight.summary).toContain("Across 3 providers");
    expect(insight.summary).toContain("Workflow automation AI");
    expect(insight.summary).toContain("62");
    expect(insight.summary).toContain("60");
    // 62 - 60 = 2, comfortably narrow.
    expect(insight.action).toBe("Renegotiate");
  });

  it("takes the provider count from the rows, so count and scores agree", () => {
    // The defect in one line: the count was category scoped and the scores
    // were not, and both sat in the same sentence.
    for (const c of MARKET_CATEGORY_LIST) {
      const rows = rowsFor(c.id);
      if (rows.length < 3) continue;
      const insight = competitiveInsight(stubMetrics(), null, c.name, 10, rows);
      expect(insight.summary).toContain(`Across ${rows.length} providers`);
    }
  });

  it("never quotes a score from outside the category it names", () => {
    const means = meansByVendor();
    for (const c of MARKET_CATEGORY_LIST) {
      const rows = rowsFor(c.id);
      if (rows.length < 3) continue;
      const inside = rows.map((r) => r.mean as number).sort((a, b) => b - a);
      const insight = competitiveInsight(stubMetrics(), null, c.name, 10, rows);
      const top = Math.round(inside[0] * 10) / 10;
      expect(insight.summary).toContain(String(top));
      // The global maximum belongs to a foundry and must not appear unless it
      // genuinely is this category's own top.
      const globalMax = Math.round(Math.max(...means.values()) * 10) / 10;
      if (globalMax !== top) {
        expect(insight.summary).not.toContain(`scores ${globalMax} for`);
      }
    }
  });

  it("says which category it could not read, when it cannot", () => {
    const insight = competitiveInsight(stubMetrics(), null, "CRM/customer AI", 10, [
      { name: "a", mean: 60 },
    ]);
    expect(insight.insufficient).not.toBeNull();
    expect(JSON.stringify(insight)).toContain("CRM/customer AI");
  });
});

describe("every category the dropdown offers", () => {
  it("has enough assessed vendors to draw a comparison", () => {
    // The dropdown offered seven of thirteen on the grounds that the rubric
    // did not describe the rest. It describes all of them: every member of
    // every category carries all ten capabilities, scored and graded.
    for (const c of MARKET_CATEGORY_LIST) {
      const rows = rowsFor(c.id);
      expect(
        rows.length,
        `${c.name} has ${rows.length} assessed vendors`
      ).toBeGreaterThanOrEqual(3);
    }
  });
});
