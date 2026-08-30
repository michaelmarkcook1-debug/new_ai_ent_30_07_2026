import { describe, it, expect } from "vitest";
import {
  comparabilityBreaches,
  type ComparableFact,
} from "@/lib/analyst/comparability";
import { consultancyFiller } from "@/lib/analyst/canonical";
import { PAGE_QUESTIONS, pageQuestion, type PageId } from "@/lib/analyst/question";
import { THESES, groundedContext } from "@/lib/analyst/market-context";
import { loadMarketMetrics } from "@/lib/market-metrics";
import {
  vendorViewInsight,
  vendorComparableFacts,
  marketStructure,
  SEPARATION_MARGIN,
  CONTESTED_MARGIN,
} from "@/lib/analyst/insight";
import { pulseJudgement } from "@/lib/pulse/judgement";

// One argument per page, and the machinery that refuses several.
//
// THE FAILURE THESE TESTS EXIST FOR, quoted from live Vendor View on 30 August
// 2026: a single paragraph that moved from SAP's workflow automation lead, to
// Databricks against Google in cloud AI platform, to AMD and Groq carrying open
// risks, to how many vendors publish momentum. Six findings, three categories,
// two metrics, no argument. Every sentence was true, which is precisely why no
// truth guard caught it and why these had to be written.

// The facts a vendor page supplies, in the shape the guard checks against.
const FACTS: ComparableFact[] = [
  {
    subject: "SAP",
    category: "Workflow automation AI",
    population: "vendors scored in this category",
    metric: "category composite",
    period: "point",
  },
  {
    subject: "Salesforce",
    category: "Workflow automation AI",
    population: "vendors scored in this category",
    metric: "category composite",
    period: "point",
  },
  {
    subject: "Databricks",
    category: "Cloud AI platform",
    population: "vendors scored in this category",
    metric: "category composite",
    period: "point",
  },
  {
    subject: "Google",
    category: "Cloud AI platform",
    population: "vendors scored in this category",
    metric: "category composite",
    period: "point",
  },
  {
    subject: "AMD",
    category: "AI infrastructure",
    population: "vendors carrying an open high-severity finding",
    metric: "open risk count",
    period: "point",
  },
];

const market = { unit: "market" as const, marketLevelFinding: true };
const marketNoFinding = { unit: "market" as const, marketLevelFinding: false };
const category = { unit: "category" as const, marketLevelFinding: false };

// ================================= adversarial: the failure classes

describe("comparisons a page is not entitled to make", () => {
  it("1. rejects two category leaders stitched together with no synthesis", () => {
    const stitched =
      "SAP sits 0.8 clear of Salesforce in workflow automation. Databricks and Google are 0.05 apart in cloud AI platform.";
    const breaches = comparabilityBreaches(stitched, FACTS, marketNoFinding);
    expect(breaches.map((b) => b.kind)).toContain("cross-category");
    expect(breaches[0].detail).toMatch(/without first stating the market-level finding/);
  });

  it("2. rejects a category figure set against a different category's", () => {
    // The same sentence on a page whose argument is about one category is a
    // straight failure, with no market finding available to license it.
    const breaches = comparabilityBreaches(
      "SAP leads workflow automation while Databricks leads cloud AI platform.",
      FACTS,
      category
    );
    expect(breaches.map((b) => b.kind)).toContain("cross-category");
  });

  it("3. rejects an unrelated risk vendor inserted into a ranking argument", () => {
    const inserted =
      "SAP leads workflow automation AI. Meanwhile AMD carries an open high-severity risk.";
    const breaches = comparabilityBreaches(inserted, FACTS, marketNoFinding);
    expect(breaches.map((b) => b.kind)).toEqual(
      expect.arrayContaining(["cross-category", "cross-population"])
    );
  });

  it("mixes two metrics across categories and says so", () => {
    const breaches = comparabilityBreaches(
      "SAP leads workflow automation AI, and AMD carries open risk in AI infrastructure.",
      FACTS,
      marketNoFinding
    );
    expect(breaches.map((b) => b.kind)).toContain("cross-metric");
  });

  // ---------------------------------------------- and what it must allow

  it("7. allows a market conclusion supported by more than one category", () => {
    // The approved way across. The market-level finding is established first,
    // and the categories are then evidence for it rather than four arguments.
    const supported =
      "Differentiation survives in only two categories. SAP in workflow automation AI and Databricks in cloud AI platform are the two ends of that: one a real lead, one a tie.";
    expect(comparabilityBreaches(supported, FACTS, market)).toEqual([]);
  });

  it("8. allows a single vendor used to illustrate an established finding", () => {
    const illustrated =
      "Only two categories carry a decisive lead. SAP in workflow automation AI is what one looks like.";
    expect(comparabilityBreaches(illustrated, FACTS, marketNoFinding)).toEqual([]);
  });

  it("says nothing about a paragraph naming one vendor", () => {
    expect(
      comparabilityBreaches("SAP leads workflow automation AI.", FACTS, category)
    ).toEqual([]);
  });

  it("matches a name as a name, not as a run of letters", () => {
    // "Google" inside "Googlers" is not a reference to the vendor, and a bare
    // substring match would count it and fire a breach on one mention.
    expect(
      comparabilityBreaches("SAP leads. Googlers disagree.", FACTS, category)
    ).toEqual([]);
  });
});

// ================================= adversarial: filler

describe("4. consultancy filler is a quality failure, not a truth failure", () => {
  it("catches the phrases that would be true on any page in any year", () => {
    for (const bad of [
      "The data suggests vendors are converging.",
      "It is important to note that scores differ.",
      "Organisations should monitor developments closely.",
      "In the rapidly evolving AI landscape, buyers must adapt.",
      "Governance continues to evolve.",
    ]) {
      expect(consultancyFiller(bad), bad).not.toEqual([]);
    }
  });

  it("leaves ordinary careful writing alone", () => {
    for (const good of [
      "Only two categories carry a lead wide enough to decide anything.",
      "The data platform market is concentrated at the top.",
      "Buyers should note the exit terms before signing.",
      "This evolves into an incumbency rather than a shortlist.",
    ]) {
      expect(consultancyFiller(good), good).toEqual([]);
    }
  });

  it("returns the phrase so a retry can quote it back", () => {
    expect(consultancyFiller("The data suggests otherwise.")).toEqual([
      "the data suggests",
    ]);
  });
});

// ================================= the question registry

describe("every page has exactly one question", () => {
  it("declares a question, a unit, a population and what it must address", () => {
    for (const [id, q] of Object.entries(PAGE_QUESTIONS)) {
      expect(q.id, id).toBe(id);
      expect(q.question.endsWith("?"), id).toBe(true);
      expect(q.population.length, id).toBeGreaterThan(5);
      expect(q.mustAddress.length, id).toBeGreaterThan(0);
      expect(q.outOfScope.length, id).toBeGreaterThan(0);
    }
  });

  it("keeps neighbouring pages out of each other's job", () => {
    // The complaint that Market Watch reads like News, and Vendor View like a
    // leaderboard, is this field being absent.
    expect(pageQuestion("market-watch").outOfScope.join(" ")).toMatch(/News/i);
    expect(pageQuestion("vendor-view").outOfScope.join(" ")).toMatch(/ranked first/i);
    expect(pageQuestion("pulse").outOfScope.join(" ")).toMatch(/leaderboard/i);
  });

  it("asks each page a different question", () => {
    const qs = Object.values(PAGE_QUESTIONS).map((q) => q.question);
    expect(new Set(qs).size).toBe(qs.length);
  });
});

// ================================= 5. grounded context

describe("market context is grounded, never recalled", () => {
  it("offers a thesis only where this reading's own data instantiates it", () => {
    // THE RULE THAT KEEPS THIS HONEST. A thesis carries a predicate over the
    // computed structure, so it cannot be used to decorate a page whose data
    // says the opposite. Every one must be capable of being false.
    const wideOpen = {
      judged: 13,
      separated: 13,
      contested: 0,
      topThreeShare: 20,
      riskContradictions: 0,
      withMovement: 43,
      scored: 43,
      widest: null,
      closest: null,
    };
    for (const t of THESES) {
      expect(typeof t.appliesWhen(wideOpen), t.id).toBe("boolean");
    }
    const applicable = THESES.filter((t) => t.appliesWhen(wideOpen));
    // A market with no convergence, no concentration and no risk should not be
    // told that capability is commoditising.
    expect(applicable.map((t) => t.id)).not.toContain("capability-commoditising");
    expect(applicable.map((t) => t.id)).not.toContain("concentration-limits-choice");
    expect(applicable.map((t) => t.id)).not.toContain("governance-lags-capability");
  });

  it("states no dated event, because this product holds no evidence for one", () => {
    for (const t of THESES) {
      // A year in a thesis is a historical claim, and a historical claim needs
      // a source this layer does not have.
      expect(t.thesis, t.id).not.toMatch(/\b(19|20)\d{2}\b/);
      expect(t.thesis, t.id).not.toMatch(/\b(launched|released|announced)\b/i);
    }
  });

  it("gives every applicable thesis a basis in this page's own figures", async () => {
    const g = groundedContext(await loadMarketMetrics());
    expect(g.applicable.length).toBeGreaterThan(0);
    for (const a of g.applicable) {
      expect(a.basis.length).toBeGreaterThan(10);
      // The basis is what a reader would argue with, so it has to carry a
      // figure rather than restating the thesis.
      expect(a.basis).toMatch(/\d/);
    }
  }, 60_000);

  it("keeps the two margins apart and ordered", () => {
    expect(CONTESTED_MARGIN).toBeLessThan(SEPARATION_MARGIN);
  });
});

// ================================= 19. page-specific quality contracts

describe("the computed floor meets the same standard as the authored version", () => {
  it("VENDOR VIEW interprets market structure rather than narrating ranks", async () => {
    const m = await loadMarketMetrics();
    const d = vendorViewInsight(m);
    const st = marketStructure(m);

    // The headline is a conclusion about the market, not a vendor fact.
    expect(d.headline).toMatch(/differentiation|categor/i);
    // It says how much of the market is differentiated, which is the finding.
    expect(d.summary).toMatch(
      new RegExp(`${st.separated} of the ${st.judged}|${st.separated} of ${st.judged}`)
    );
    // A vendor may appear, and only as an example after the finding.
    if (st.widest) {
      const findingAt = d.summary.search(/of the \d+ categories|of \d+ judged/);
      const vendorAt = d.summary.indexOf(st.widest.leader);
      if (vendorAt >= 0) expect(vendorAt).toBeGreaterThan(findingAt);
    }
    expect(consultancyFiller(`${d.headline} ${d.summary}`)).toEqual([]);
  }, 60_000);

  it("VENDOR VIEW's action follows its analysis rather than arguing with it", async () => {
    // 9 and 10. The reading this replaced concluded that SAP led workflow
    // automation and then instructed the reader to chase remediation from AMD,
    // Groq and Lambda. Two arguments, one panel.
    const m = await loadMarketMetrics();
    const d = vendorViewInsight(m);
    const st = marketStructure(m);
    expect(d.decision).not.toBeNull();
    if (st.judged > 0 && st.separated / st.judged <= 0.4) {
      // The finding is that scores are not separating the market, so the
      // instruction has to be about where the effort should go instead.
      expect(d.decision!.instruction).toMatch(/terms|portability|exit|price/i);
      expect(d.decision!.whyNow).toMatch(/judged categories|inside the margin/i);
    }
  }, 60_000);

  it("VENDOR VIEW declares the population behind every fact it supplies", async () => {
    const facts = vendorComparableFacts(await loadMarketMetrics());
    expect(facts.length).toBeGreaterThan(4);
    for (const f of facts) {
      expect(f.population.length).toBeGreaterThan(5);
      expect(f.metric.length).toBeGreaterThan(3);
    }
    // Composites and risk counts are different metrics and must say so, or the
    // cross-metric check has nothing to fire on.
    expect(new Set(facts.map((f) => f.metric)).size).toBeGreaterThan(1);
  }, 60_000);

  it("PULSE leads on a market implication rather than a movement count", async () => {
    const m = await loadMarketMetrics();
    const withStructure = pulseJudgement({
      gaining: m.gaining,
      slipping: m.slipping,
      risks: m.risks,
      kpis: m.kpis,
      shareMovementPublished: m.shareMovementPublished,
      structure: marketStructure(m),
    });
    // "5 vendors gaining, 3 slipping" is the shape this replaces.
    expect(withStructure.headline).not.toMatch(/^\d+ vendors? (gaining|slipping)/);
    expect(withStructure.headline.length).toBeGreaterThan(30);
  }, 60_000);

  it("PULSE still says something true when no structure is supplied", async () => {
    // The structure is optional, and without it the old movement headline is
    // the honest answer rather than a manufactured one.
    const m = await loadMarketMetrics();
    const bare = pulseJudgement({
      gaining: m.gaining,
      slipping: m.slipping,
      risks: m.risks,
      kpis: m.kpis,
      shareMovementPublished: m.shareMovementPublished,
    });
    expect(bare.headline.length).toBeGreaterThan(0);
  }, 60_000);

  it("6. never describes a single capture as a change", async () => {
    const m = await loadMarketMetrics();
    const d = vendorViewInsight(m);
    const st = marketStructure(m);
    // Where most of the set publishes no direction of travel, the reading may
    // describe the market and may not claim it is moving.
    if (st.scored > 0 && st.withMovement / st.scored < 0.25) {
      expect(`${d.headline} ${d.summary}`).not.toMatch(
        /\b(rising|climbing|accelerating|widening|narrowing) (across|through) the market\b/i
      );
    }
  }, 60_000);
});

describe("every page's question is reachable from its id", () => {
  it("resolves each id", () => {
    const ids = Object.keys(PAGE_QUESTIONS) as PageId[];
    for (const id of ids) expect(pageQuestion(id).id).toBe(id);
  });
});
