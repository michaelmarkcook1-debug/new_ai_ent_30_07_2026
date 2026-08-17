import { describe, it, expect } from "vitest";
import { readFileSync } from "node:fs";
import path from "node:path";
import {
  categoryRankings,
  categoryRanking,
  categoryLeaders,
} from "@/lib/aie/category-rankings";
import { buildShortlist } from "@/lib/desk/shortlist";
import { isInvestor } from "@/lib/vendor/is-investor";

// These are AI Enterprise v1's numbers, parsed from its published pages because
// v1 does not expose the category composite on its API and is read-only.
//
// Parsing somebody's markup is the weakest link in this product's data, so the
// tests are about the failure mode rather than the happy path. The dangerous
// version of a broken parser is not one that throws, it is one that returns
// fewer rows, or zero, and leaves a page rendering yesterday's leader under
// today's date. Every check below is aimed at that.

const shareFixture = JSON.parse(
  readFileSync(
    path.join(process.cwd(), "fixtures", "aie-live", "market-share.json"),
    "utf8"
  )
) as { estimates: { vendorId: string; categoryId: string }[] };

describe("the category rankings", () => {
  it("holds all thirteen categories v1 ranks within", () => {
    expect(categoryRankings().length).toBe(13);
  });

  it("never carries an empty category", () => {
    // The specific shape of a silent parse failure.
    for (const c of categoryRankings()) {
      expect(c.ranked.length, `${c.categoryId} parsed empty`).toBeGreaterThan(0);
    }
  });

  it("ranks contiguously from 1, with no repeated vendor", () => {
    // The page renders its table more than once for responsive layouts, so a
    // parser that does not dedupe produces the same vendor at two ranks. That
    // happened on the first attempt and this is what caught it.
    for (const c of categoryRankings()) {
      const ids = c.ranked.map((r) => r.vendorId);
      expect(new Set(ids).size, `${c.categoryId} repeats a vendor`).toBe(
        ids.length
      );
      expect(c.ranked.map((r) => r.rank)).toEqual(
        c.ranked.map((_, i) => i + 1)
      );
    }
  });

  it("scores every vendor inside the 0 to 5 band, descending", () => {
    for (const c of categoryRankings()) {
      let last = Infinity;
      for (const r of c.ranked) {
        expect(r.composite, `${c.categoryId}/${r.vendorId}`).toBeGreaterThan(0);
        expect(r.composite, `${c.categoryId}/${r.vendorId}`).toBeLessThanOrEqual(5);
        expect(r.composite, `${c.categoryId} out of order`).toBeLessThanOrEqual(last);
        last = r.composite;
      }
    }
  });

  it("weights between 7 and 14 domains, depending on the category", () => {
    // Not a constant. A bare accelerator has no identity or governance surface,
    // so those domains are excluded rather than scored as insufficient, and AI
    // silicon weighs 7 where frontier models weigh 14. A parser that found one
    // number everywhere would be reading a heading, not the real value.
    const counts = new Set(categoryRankings().map((c) => c.domains));
    expect(counts.size).toBeGreaterThan(1);
    for (const c of categoryRankings()) {
      expect(c.domains, c.categoryId).toBeGreaterThanOrEqual(7);
      expect(c.domains, c.categoryId).toBeLessThanOrEqual(14);
    }
  });
});

describe("ranked plus held accounts for every vendor in the category", () => {
  it("reconciles against market-share, per category", () => {
    // The cross-check that makes the parse trustworthy: v1's own API says how
    // many vendors sit in each category, and ranked plus held must equal it.
    // A parser that dropped rows would pass every test above and fail this one.
    const total = new Map<string, number>();
    for (const e of shareFixture.estimates) {
      total.set(e.categoryId, (total.get(e.categoryId) ?? 0) + 1);
    }
    for (const c of categoryRankings()) {
      expect(
        c.ranked.length + c.held,
        `${c.categoryId}: ${c.ranked.length} ranked + ${c.held} held != ${total.get(c.categoryId)} in market-share`
      ).toBe(total.get(c.categoryId));
    }
  });

  it("never reports a negative held count", () => {
    for (const c of categoryRankings()) {
      expect(c.held, c.categoryId).toBeGreaterThanOrEqual(0);
    }
  });
});

describe("parity with what v1's front page shows", () => {
  // Read off ranking-engine-red.vercel.app on 16 August 2026. If v1 re-scores,
  // these move and this test should be updated deliberately after checking the
  // page, which is the point: it fails when we drift from v1 rather than
  // letting the two products quietly diverge again.
  const FRONT_PAGE: Record<string, [string, number, number, number]> = {
    frontier_model_api: ["anthropic", 3.65, 14, 0],
    enterprise_assistant: ["anthropic", 3.42, 5, 0],
    developer_coding_agent: ["anthropic", 3.69, 4, 0],
    agent_platform: ["anthropic", 3.34, 6, 0],
    rag_enterprise_search: ["google", 3.02, 5, 0],
    workflow_automation_ai: ["sap", 2.82, 4, 0],
    crm_customer_ai: ["oracle", 2.25, 3, 0],
    itsm_hr_service_ai: ["microsoft", 2.14, 3, 0],
    cloud_ai_platform: ["databricks", 3.05, 5, 0],
    regulated_industry_ai: ["rogo", 3.28, 4, 0],
    ai_silicon: ["nvidia", 4.09, 4, 1],
    ai_cloud_compute: ["google", 3.31, 7, 1],
    neocloud_inference: ["groq", 2.88, 6, 0],
  };

  it("names the same leader, score, ranked and held count in every category", () => {
    for (const [id, [vendorId, composite, ranked, held]] of Object.entries(
      FRONT_PAGE
    )) {
      const c = categoryRanking(id);
      expect(c, `${id} missing`).toBeTruthy();
      expect(c!.ranked[0].vendorId, `${id} leader`).toBe(vendorId);
      expect(c!.ranked[0].composite, `${id} composite`).toBe(composite);
      expect(c!.ranked.length, `${id} ranked count`).toBe(ranked);
      expect(c!.held, `${id} held count`).toBe(held);
    }
  });

  it("agrees that Anthropic leads four categories and OpenAI none", () => {
    // The whole reason for this module. On overallScore OpenAI leads frontier
    // models; on the category composite Anthropic does, and by 0.29 rather than
    // by a rounding error.
    const leaders = categoryLeaders();
    const anthropic = leaders.filter((l) => l.leader.vendorId === "anthropic");
    expect(anthropic.length).toBe(4);
    expect(leaders.some((l) => l.leader.vendorId === "openai")).toBe(false);

    const frontier = categoryRanking("frontier_model_api")!;
    expect(frontier.ranked[0].vendorId).toBe("anthropic");
    expect(frontier.ranked[1].vendorId).toBe("openai");
    expect(
      frontier.ranked[0].composite - frontier.ranked[1].composite
    ).toBeCloseTo(0.29, 2);
  });
});

describe("the assessment is the product's only vendor rating", () => {
  it("orders the Decision Desk shortlist exactly as the category ranking does", () => {
    // The shortlist used to rank on our own three-input composite, which named
    // a different order from the ranking on the same data. One rating, one
    // order: if these two ever diverge again, this fails.
    for (const c of categoryRankings()) {
      const list = buildShortlist(c.categoryId, undefined, 40, "all");
      if (!list) continue;
      // Compared as the intersection, because a vendor the assessment ranks may
      // carry no scorecard row here and would otherwise look like a reordering.
      const got = list.entries.map((e) => e.vendorId);
      const expected = c.ranked
        .filter((r) => !isInvestor(r.vendorId) && got.includes(r.vendorId))
        .map((r) => r.vendorId);
      expect(got, c.categoryId).toEqual(expected);
      for (const e of list.entries) {
        const r = c.ranked.find((x) => x.vendorId === e.vendorId)!;
        expect(e.score, `${c.categoryId}/${e.vendorId}`).toBe(r.composite);
      }
    }
  });

  it("never shortlists a vendor the assessment held", () => {
    // Held means the assessment looked and declined to score. Ranking it below
    // the scored vendors would invent an order the evidence refused to give.
    for (const c of categoryRankings()) {
      const list = buildShortlist(c.categoryId, undefined, 40, "all");
      if (!list) continue;
      const ranked = new Set(c.ranked.map((r) => r.vendorId));
      for (const e of list.entries) {
        expect(ranked.has(e.vendorId), `${e.name} was held in ${c.categoryId}`).toBe(true);
      }
    }
  });

  it("scores every card between 0 and 5, never on the 0 to 100 scale", () => {
    for (const c of categoryRankings()) {
      const list = buildShortlist(c.categoryId, undefined, 40, "all");
      if (!list) continue;
      for (const e of list.entries) {
        expect(e.score, `${e.name}`).toBeGreaterThan(0);
        expect(e.score, `${e.name}`).toBeLessThanOrEqual(5);
      }
    }
  });
});

describe("the variables behind each score", () => {
  it("carries domains for every ranked vendor", () => {
    for (const c of categoryRankings()) {
      for (const r of c.ranked) {
        expect(r.domains.length, `${c.categoryId}/${r.vendorId}`).toBeGreaterThan(0);
      }
    }
  });

  it("keeps an unscored domain distinguishable from a zero", () => {
    // An insufficient domain contributes zero to the composite but is not a
    // score of zero, and conflating them would report thin evidence as a
    // judgement about the vendor.
    const all = categoryRankings().flatMap((c) => c.ranked.flatMap((r) => r.domains));
    for (const d of all) {
      if (d.state !== "scored") expect(d.score, d.domain).toBeNull();
      else expect(d.score, d.domain).not.toBeNull();
    }
  });

  it("cites its evidence", () => {
    // evidenceCount is NOT asserted against the citation list. Two domains in
    // the source report an evidenceCount lower than the number of citations
    // they carry (dev_sentiment: count 2, three cited), so the two fields do
    // not describe the same population upstream. Both are recorded as given;
    // neither is treated as the other's total.
    const all = categoryRankings().flatMap((c) => c.ranked.flatMap((r) => r.domains));
    const cited = all.filter((d) => d.citations.length > 0);
    expect(cited.length).toBeGreaterThan(0);
    for (const d of cited) {
      expect(d.citations.length).toBeLessThanOrEqual(3);
      for (const u of d.citations) expect(u).toMatch(/^https?:\/\//);
    }
  });
});
