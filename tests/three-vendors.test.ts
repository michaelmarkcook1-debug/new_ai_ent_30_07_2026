import { describe, it, expect } from "vitest";
import {
  detectMarket,
  threeVendorsFor,
  threeVendorsBlock,
} from "@/lib/desk/three-vendors";
import { categoryRankings } from "@/lib/aie/category-rankings";
import { MARKET_CATEGORY_LIST } from "@/lib/comparability";

// The three vendors a cited finding recommends.
//
// These pin the RULES rather than the vendors. Which three come back changes
// every time the assessment is re-synced from v1, and a test asserting
// "Anthropic, OpenAI, Google" would fail on a data refresh that was working
// correctly. What must not change is that the three come from the weighted
// assessment, in its order, or not at all.

describe("market detection", () => {
  it("returns null rather than guessing when nothing names a market", () => {
    expect(detectMarket("Nothing here about widgets at all.")).toBeNull();
    expect(detectMarket("")).toBeNull();
  });

  it("prefers a market named outright over one inferred", () => {
    // "coding" would infer the developer agent market; naming the frontier
    // market outright has to win.
    const m = detectMarket("We do coding work but this is about Frontier model/API");
    expect(m?.basis).toBe("named in the situation");
    expect(m?.id).toBe("frontier_model_api");
  });

  it("infers from the buyer's own words, not from our labels", () => {
    // Nobody types "Neocloud & inference". They type this.
    const m = detectMarket("We need cheap inference at high throughput.");
    expect(m?.id).toBe("neocloud_inference");
    expect(m?.basis).toBe("inferred from the situation");
  });

  it("only ever returns a market the taxonomy actually holds", () => {
    const known = new Set(MARKET_CATEGORY_LIST.map((c) => c.id));
    const probes = [
      "agentic onboarding for a bank",
      "we want to buy GPUs",
      "regulated insurance workflow",
      "enterprise search over our intranet",
      "contact centre automation",
      "lakehouse and data science platform",
      "helpdesk ticket deflection",
      "copilot for knowledge workers",
      "hyperscaler capacity for a training run",
      "coding agent for our engineering team",
    ];
    for (const p of probes) {
      const m = detectMarket(p);
      if (m) expect(known.has(m.id)).toBe(true);
    }
  });
});

describe("the three vendors", () => {
  it("returns exactly three, in the assessment's own order", () => {
    const t = threeVendorsFor("We need cheap inference at high throughput.");
    expect(t).not.toBeNull();
    expect(t!.vendors).toHaveLength(3);
    // Read, never re-sorted. Re-ranking here would invent a second opinion
    // about a market the assessment has already ranked.
    expect(t!.vendors.map((v) => v.rank)).toEqual([1, 2, 3]);
    const composites = t!.vendors.map((v) => v.composite);
    expect(composites[0]).toBeGreaterThanOrEqual(composites[1]);
    expect(composites[1]).toBeGreaterThanOrEqual(composites[2]);
  });

  it("matches the ranking it claims to read, vendor for vendor", () => {
    const t = threeVendorsFor("We want to buy GPUs.")!;
    const source = categoryRankings().find((c) => c.categoryId === t.marketId)!;
    expect(t.vendors.map((v) => v.vendorId)).toEqual(
      source.ranked.slice(0, 3).map((r) => r.vendorId)
    );
    expect(t.vendors.map((v) => v.composite)).toEqual(
      source.ranked.slice(0, 3).map((r) => r.composite)
    );
  });

  it("is null when no market is detected, and never falls back to a default", () => {
    expect(threeVendorsFor("Nothing here about widgets at all.")).toBeNull();
  });

  it("states the held count rather than presenting a partial market as whole", () => {
    // AI silicon holds one vendor back for thin evidence. A reader told "the
    // top three" without being told one was withheld is being told the market
    // is smaller than it is.
    const t = threeVendorsFor("We want to buy GPUs.")!;
    const source = categoryRankings().find((c) => c.categoryId === t.marketId)!;
    expect(t.held).toBe(source.held);
    expect(t.alsoRanked).toBe(source.ranked.length - 3);
  });

  it("never leaks a raw taxonomy id into anything a reader sees", () => {
    // Shipped twice before: "frontier_model_api" on a button, and
    // "workflow_automation_ai" in a sentence.
    for (const c of MARKET_CATEGORY_LIST) {
      const t = threeVendorsFor(c.name);
      if (!t) continue;
      expect(t.marketLabel).not.toMatch(/_/);
      expect(threeVendorsBlock(t)).not.toContain(t.marketId);
    }
  });

  it("links each vendor to a route that exists, not to a filter that does nothing", () => {
    // ModelEngine, Trust Rank and Integrators read the shortlist cookie, not a
    // query param, so a `?vendor=` link would navigate and filter nothing.
    const t = threeVendorsFor("We need cheap inference at high throughput.")!;
    for (const v of t.vendors) {
      expect(v.profileHref).toBe(`/vendor-view/${v.vendorId}`);
      expect(v.profileHref).not.toContain("?");
    }
  });

  it("every market in the taxonomy can support three, or is honestly short", () => {
    for (const c of categoryRankings()) {
      // Nothing in the product may claim three from a market holding fewer.
      const t = threeVendorsFor(c.label);
      if (t && t.marketId === c.categoryId) {
        expect(t.vendors.length).toBe(Math.min(3, c.ranked.length));
      }
    }
  });
});

describe("the prompt block", () => {
  it("tells the model the three are settled, not candidates", () => {
    const block = threeVendorsBlock(
      threeVendorsFor("We need cheap inference at high throughput.")!
    );
    expect(block).toMatch(/Do not substitute, add a fourth, or reorder/);
    expect(block).toMatch(/they are the answer/);
  });

  it("carries the score and the evidence, so the model cannot invent either", () => {
    const t = threeVendorsFor("We want to buy GPUs.")!;
    const block = threeVendorsBlock(t);
    for (const v of t.vendors) {
      expect(block).toContain(v.name);
      expect(block).toContain(v.composite.toFixed(2));
      expect(block).toContain(`${v.evidenced} of ${v.domainsTotal} domains`);
    }
  });

  it("carries no em-dash", () => {
    for (const c of MARKET_CATEGORY_LIST) {
      const t = threeVendorsFor(c.name);
      if (t) expect(threeVendorsBlock(t)).not.toContain("—");
    }
  });
});
