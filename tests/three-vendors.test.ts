import { describe, it, expect } from "vitest";
import {
  detectMarket,
  threeVendorsFor,
  threeVendorsBlock,
  strategyMarkets,
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

describe("contract evidence coverage", () => {
  it("marks which of the three the Shield actually reaches", () => {
    // The Shield grades the published terms of model providers; the assessment
    // ranks every market. In six of thirteen markets none of the three is a
    // model provider, and the finding was writing "no evidence in this
    // workspace on X" once per vendor without ever saying why.
    const labs = threeVendorsFor("frontier model api for our engineering team")!;
    expect(labs.vendors.some((v) => v.contractEvidence)).toBe(true);

    const silicon = threeVendorsFor("We want to buy GPUs.")!;
    expect(silicon.vendors.every((v) => !v.contractEvidence)).toBe(true);
  });

  it("tells the model to state the gap once, not once per vendor", () => {
    const silicon = threeVendorsFor("We want to buy GPUs.")!;
    const block = threeVendorsBlock(silicon);
    expect(block).toMatch(/Do NOT write "no evidence on X" once per vendor/);
    expect(block).toContain(silicon.marketLabel);
  });
});

describe("word-boundary market detection", () => {
  it("does not fire on a keyword buried inside an ordinary word", () => {
    // Matched with String.includes, "ide" fired inside provide, decide, wider
    // and outside; "rag" inside average; "code" inside barcode and postcode.
    // Since those words are unavoidable in a sentence about a decision, almost
    // any situation scored a hit for the coding agent market. A luxury food
    // retailer asking about discount approval was placed in Developer/coding
    // agent and recommended vendors for a market it never mentioned.
    expect(detectMarket("We provide guidance and decide on wider rollout.")).toBeNull();
    expect(detectMarket("Average order value across our retail estate.")).toBeNull();
    expect(detectMarket("Barcode and postcode lookups in our stores.")).toBeNull();
  });

  it("still matches the word itself, including a plural", () => {
    expect(detectMarket("We want to buy GPUs.")?.id).toBe("ai_silicon");
    expect(detectMarket("We need chips for training.")?.id).toBe("ai_silicon");
    expect(detectMarket("RAG over our intranet.")?.id).toBe("rag_enterprise_search");
  });
});

describe("across the reader's AI strategy", () => {
  const retail = { sectorLabel: "Retail and consumer", marketIds: [] as string[] };

  it("draws one leader from each of the company's markets, not three from one", () => {
    const opp = strategyMarkets({ sectorTag: "retail_consumer", aiFindings: [], findings: [] })!;
    expect(opp.marketIds.length).toBeGreaterThan(1);
    const t = threeVendorsFor("discretionary discounting", opp)!;
    expect(t.spread).toBe("across your strategy");
    // Three different markets, which is what "the whole AI strategy" means.
    expect(new Set(t.vendors.map((v) => v.marketId)).size).toBe(t.vendors.length);
    // And no vendor taken twice.
    expect(new Set(t.vendors.map((v) => v.vendorId)).size).toBe(t.vendors.length);
  });

  it("reaches beyond the frontier labs", () => {
    // The single-market path returned the frontier three every time. Across a
    // strategy the markets are a mix, so application vendors and clouds appear.
    const opp = strategyMarkets({ sectorTag: "retail_consumer", aiFindings: [], findings: [] })!;
    const t = threeVendorsFor("x", opp)!;
    const frontier = new Set(["anthropic", "openai", "google", "meta", "mistral", "xai"]);
    expect(t.vendors.some((v) => !frontier.has(v.vendorId))).toBe(true);
  });

  it("falls back to one market when nothing is carried", () => {
    const t = threeVendorsFor("We need a coding agent for our engineering team.", null)!;
    expect(t.spread).toBe("one market");
    expect(new Set(t.vendors.map((v) => v.marketId)).size).toBe(1);
  });

  it("tells the model the scores are not comparable across markets", () => {
    const opp = strategyMarkets({ sectorTag: "retail_consumer", aiFindings: [], findings: [] })!;
    const block = threeVendorsBlock(threeVendorsFor("x", opp)!);
    expect(block).toMatch(/LEADS A DIFFERENT MARKET/);
    expect(block).toMatch(/never say one outscores another/);
  });

  it("returns null when there is neither a strategy nor a detectable market", () => {
    expect(threeVendorsFor("Nothing about widgets here.", null)).toBeNull();
    expect(strategyMarkets({ sectorTag: null, aiFindings: [], findings: [] })).toBeNull();
    expect(retail.marketIds.length).toBe(0);
  });
});

describe("security and data, every time", () => {
  it("carries the security domains for every vendor whether or not they are a strength", () => {
    for (const source of [
      threeVendorsFor("We need a coding agent for our engineering team.", null)!,
      threeVendorsFor("x", strategyMarkets({ sectorTag: "retail_consumer", aiFindings: [], findings: [] }))!,
    ]) {
      for (const v of source.vendors) {
        expect(v.security.length).toBeGreaterThan(0);
        const named = v.security.map((s) => s.domain);
        expect(named).toContain("data security privacy");
        expect(named).toContain("governance compliance");
      }
    }
  });

  it("instructs the finding to speak to security for each vendor", () => {
    const block = threeVendorsBlock(
      threeVendorsFor("We need a coding agent for our engineering team.", null)!
    );
    expect(block).toMatch(/SECURITY AND DATA ARE NOT OPTIONAL/);
    expect(block).toMatch(/Security and data:/);
  });
});
