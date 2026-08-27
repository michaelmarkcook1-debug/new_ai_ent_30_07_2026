import { describe, it, expect } from "vitest";
import {
  POPULATION_LABEL,
  samePopulation,
  signal,
  type Signal,
  type SignalPopulation,
} from "@/lib/analyst/signals";
import { synthesise } from "@/lib/analyst/synthesis";
import {
  enrichWithSynthesis,
  frontierCohort,
  signalsFromMetrics,
  priceSignal,
} from "@/lib/analyst/cross";
import { pricePerformanceInsight } from "@/lib/analyst/insight";
import type { MarketMetrics } from "@/lib/market-metrics";

// Two readings can share a dimension, a scale and a date and still be about
// different things.
//
// WHAT WENT WRONG. The capability half of the capability/price relationship
// was taken across every non-investor vendor the assessment tracks: 43
// companies spanning silicon, CRM, service management, sovereign providers and
// enterprise applications, most of which sell nothing a token price could be
// quoted for. The price half was taken across frontier language models. The
// combined sentence told a buyer what a premium was buying in a market nobody
// had measured, and the only reason it never reached a reader is that the
// landscape spread happened to sit the wrong side of a threshold. Widening the
// threshold would have shipped it.
//
// So the universe is declared on the reading and checked before two readings
// are allowed to meet.

const NOW = Date.parse("2026-08-27T12:00:00Z");
const DAY = 24 * 60 * 60 * 1000;
const recent = new Date(NOW - 2 * DAY).toISOString();

const make = (
  id: string,
  dimension: Signal["dimension"],
  state: string,
  population: SignalPopulation,
  source: string,
  extra: { members?: string[]; subject?: string } = {}
): Signal =>
  signal({
    id,
    subject: extra.subject ?? "a set",
    population,
    members: extra.members,
    dimension,
    state,
    observedAt: recent,
    lane: "aie",
    evidence: {
      claim: `${dimension} reading from ${source}`,
      source,
      basis: "measured",
      lane: "aie",
      asOf: recent,
    },
  });

const CAP_FRONTIER = make(
  "cap-frontier",
  "capability",
  "narrow",
  "frontier-model-providers",
  "AIE capability matrix",
  { subject: "the frontier model cohort" }
);
const CAP_LANDSCAPE = make(
  "cap-landscape",
  "capability",
  "narrow",
  "tracked-vendor-set",
  "AIE capability matrix",
  { subject: "the assessed set" }
);
const CAP_UNDECLARED = signal({
  id: "cap-undeclared",
  subject: "some set",
  dimension: "capability",
  state: "narrow",
  observedAt: recent,
  lane: "aie",
  evidence: {
    claim: "a capability reading nobody scoped",
    source: "AIE capability matrix",
    basis: "measured",
    lane: "aie",
    asOf: recent,
  },
});
const PRICE_FRONTIER = make(
  "price",
  "price",
  "wide, and separated from capability",
  "frontier-model-providers",
  "Artificial Analysis benchmark"
);

// ------------------------------------------------------- the comparability test

describe("declaring the universe a reading was taken over", () => {
  it("calls two readings over the same declared universe comparable", () => {
    expect(samePopulation(CAP_FRONTIER, PRICE_FRONTIER)).toBe(true);
  });

  it("calls two readings over different universes incomparable", () => {
    expect(samePopulation(CAP_LANDSCAPE, PRICE_FRONTIER)).toBe(false);
  });

  it("never calls an undeclared reading comparable, even to another one", () => {
    // Two rules nobody has thought about are not thereby about the same thing.
    const other = signal({ ...CAP_UNDECLARED, id: "other", dimension: "price" });
    expect(samePopulation(CAP_UNDECLARED, PRICE_FRONTIER)).toBe(false);
    expect(samePopulation(CAP_UNDECLARED, other)).toBe(false);
  });

  it("defaults an undeclared reading to unspecified rather than guessing", () => {
    expect(CAP_UNDECLARED.population).toBe("unspecified");
    expect(CAP_UNDECLARED.members).toEqual([]);
  });

  it("gives every population a reader-facing name", () => {
    for (const key of Object.keys(POPULATION_LABEL) as SignalPopulation[]) {
      expect(POPULATION_LABEL[key].length).toBeGreaterThan(3);
      // The internal key never reaches a sentence.
      expect(POPULATION_LABEL[key]).not.toContain("-");
    }
  });
});

// -------------------------------------------- incomparable evidence is refused

describe("incompatible populations cannot be synthesised", () => {
  it("synthesises capability and price taken over the same market", () => {
    const hit = synthesise([CAP_FRONTIER, PRICE_FRONTIER], NOW).find(
      (s) => s.id === "capability-price-divergence"
    );
    expect(hit).toBeDefined();
    expect(hit!.signals.map((s) => s.population)).toEqual([
      "frontier-model-providers",
      "frontier-model-providers",
    ]);
  });

  it("refuses a landscape capability reading against a frontier price reading", () => {
    // THE DEFECT. Both readings are real, both are current, both are the right
    // state, and the comparison is still meaningless.
    const found = synthesise([CAP_LANDSCAPE, PRICE_FRONTIER], NOW);
    expect(found.find((s) => s.id === "capability-price-divergence")).toBeUndefined();
  });

  it("refuses an undeclared capability reading against a frontier price reading", () => {
    const found = synthesise([CAP_UNDECLARED, PRICE_FRONTIER], NOW);
    expect(found.find((s) => s.id === "capability-price-divergence")).toBeUndefined();
  });

  it("picks the comparable reading when both are present", () => {
    // A page emits the landscape reading and the frontier reading. The rule
    // must take the one it can actually compare, not whichever was pushed
    // first, and must not be defeated by the order they arrive in.
    for (const order of [
      [CAP_LANDSCAPE, CAP_FRONTIER, PRICE_FRONTIER],
      [CAP_FRONTIER, CAP_LANDSCAPE, PRICE_FRONTIER],
      [PRICE_FRONTIER, CAP_LANDSCAPE, CAP_FRONTIER],
    ]) {
      const hit = synthesise(order, NOW).find(
        (s) => s.id === "capability-price-divergence"
      );
      expect(hit).toBeDefined();
      expect(hit!.signals.map((s) => s.id)).toContain("cap-frontier");
      expect(hit!.signals.map((s) => s.id)).not.toContain("cap-landscape");
    }
  });

  it("names the population it measured in the finding it writes", () => {
    const hit = synthesise([CAP_FRONTIER, PRICE_FRONTIER], NOW).find(
      (s) => s.id === "capability-price-divergence"
    )!;
    expect(hit.finding).toContain("frontier model providers");
    expect(hit.finding).toContain("taken over the same set of vendors");
  });

  // The invariant, asserted over every combination rather than the one case.
  it("never emits a like-for-like finding spanning two populations", () => {
    const universe = [
      CAP_FRONTIER,
      CAP_LANDSCAPE,
      CAP_UNDECLARED,
      PRICE_FRONTIER,
      make("price-landscape", "price", "wide, and separated from capability", "tracked-vendor-set", "Artificial Analysis benchmark"),
      make("rep-frontier", "reputation", "widely spread, with a weak tail", "frontier-model-providers", "AIE reputation pillars"),
      make("rep-landscape", "reputation", "widely spread, with a weak tail", "tracked-vendor-set", "AIE reputation pillars"),
    ];
    const LIKE_FOR_LIKE = new Set([
      "capability-price-divergence",
      "commercial-tradeoff",
    ]);
    // Every subset of the universe.
    for (let mask = 0; mask < 1 << universe.length; mask++) {
      const subset = universe.filter((_, i) => mask & (1 << i));
      for (const found of synthesise(subset, NOW)) {
        if (!LIKE_FOR_LIKE.has(found.id)) continue;
        const populations = new Set(found.signals.map((s) => s.population));
        expect(populations.size).toBe(1);
        expect(populations.has("unspecified")).toBe(false);
      }
    }
  });
});

// --------------------------------------------------- the same company, twice

describe("a vendor-level contradiction must be about one vendor", () => {
  const leads = (name: string) =>
    make("pos", "position", "clear, and leads its market", "tracked-vendor-set", "AIE vendor rankings", {
      subject: name,
      members: [name],
    });
  const risky = (names: string[]) =>
    make(
      "risk",
      "risk",
      `carrying ${names.length} open high-severity findings across ${names.length} vendors`,
      "tracked-vendor-set",
      "AIE risk register",
      { subject: "the tracked set", members: names }
    );

  it("fires where the leader is one of the vendors carrying a finding", () => {
    const hit = synthesise([leads("NVIDIA"), risky(["NVIDIA", "Groq"])], NOW).find(
      (s) => s.id === "strength-risk-divergence"
    );
    expect(hit).toBeDefined();
    expect(hit!.finding).toContain("NVIDIA");
    expect(hit!.implication).toContain("NVIDIA");
  });

  it("refuses to pair a leader with an unrelated company's findings", () => {
    // What it did: read the assessment's widest lead in workflow automation
    // beside a silicon vendor's open findings and told the reader to attach
    // the second's remediation position to the first's shortlist entry.
    const found = synthesise([leads("SAP"), risky(["Cerebras", "NVIDIA"])], NOW);
    expect(found.find((s) => s.id === "strength-risk-divergence")).toBeUndefined();
  });

  it("never names two different companies in one strength/risk finding", () => {
    for (const leader of ["SAP", "NVIDIA", "Groq", "Anthropic"]) {
      const hit = synthesise(
        [leads(leader), risky(["Cerebras", "NVIDIA", "Groq"])],
        NOW
      ).find((s) => s.id === "strength-risk-divergence");
      if (!hit) continue;
      // The vendor it fired on is the leader, and no other company is named.
      expect(hit.finding).toContain(leader);
      for (const other of ["Cerebras", "NVIDIA", "Groq"].filter((x) => x !== leader)) {
        expect(hit.finding).not.toContain(other);
      }
    }
  });
});

// ------------------------------------------------- against never becomes why now

describe("why now carries the case for acting, and only that", () => {
  const BASE = pricePerformanceInsight(
    { models: 42, vendors: 11, ratio: 12, adequate: 9 },
    null,
    "2026-08-20"
  );

  const supporting = [CAP_FRONTIER, PRICE_FRONTIER];
  const contradicting = [
    make("pos", "position", "clear, and leads its market", "tracked-vendor-set", "AIE vendor rankings", {
      subject: "Anthropic",
      members: ["Anthropic"],
    }),
    make("risk", "risk", "carrying 2 open high-severity findings across 1 vendor", "tracked-vendor-set", "AIE risk register", {
      subject: "the tracked set",
      members: ["Anthropic"],
    }),
  ];

  it("lets a supporting, current finding answer why now", () => {
    const { insight, synthesis } = enrichWithSynthesis(BASE, supporting, NOW);
    expect(synthesis.some((s) => s.bearing === "supports")).toBe(true);
    expect(insight.decision!.whyNow).toContain("Across datasets");
  });

  it("never lets a contradicting finding answer why now", () => {
    // THE DEFECT. This filtered on currency alone, so a contradiction current
    // enough to matter was copied verbatim into both halves and the reader was
    // shown one sentence as the reason to move and as the reason not to.
    const { insight, synthesis } = enrichWithSynthesis(BASE, contradicting, NOW);
    const against = synthesis.filter((s) => s.bearing === "against");
    expect(against.length).toBeGreaterThan(0);
    expect(insight.decision!.whyNow).not.toContain("Across datasets");
    expect(insight.decision!.whyNow).toBe(BASE.decision!.whyNow);
  });

  it("puts the contradicting finding in evidence against, where it belongs", () => {
    const { insight } = enrichWithSynthesis(BASE, contradicting, NOW);
    const claims = insight.decision!.evidenceAgainst.map((e) => e.claim);
    expect(claims.some((c) => /risk register/i.test(c))).toBe(true);
  });

  it("never repeats an against finding verbatim in why now", () => {
    // Asserted as text rather than as a flag: whatever route a finding takes,
    // the same sentence must not appear on both sides of the argument.
    const { insight, synthesis } = enrichWithSynthesis(
      BASE,
      [...supporting, ...contradicting],
      NOW
    );
    const whyNow = insight.decision!.whyNow;
    for (const s of synthesis.filter((x) => x.bearing === "against")) {
      expect(whyNow).not.toContain(s.finding);
    }
    // And the supporting one is not silently dropped by the presence of a
    // contradiction: it still answers why now.
    const supports = synthesis.filter((x) => x.bearing === "supports");
    expect(supports.length).toBeGreaterThan(0);
    expect(whyNow).toContain(supports[0].finding);
  });

  it("keeps every finding somewhere, on the side its bearing says", () => {
    const { insight, synthesis } = enrichWithSynthesis(
      BASE,
      [...supporting, ...contradicting],
      NOW
    );
    const forClaims = insight.decision!.evidenceFor.map((e) => e.claim).join("\n");
    const againstClaims = insight.decision!.evidenceAgainst
      .map((e) => e.claim)
      .join("\n");
    for (const s of synthesis) {
      if (s.bearing === "supports") {
        expect(forClaims).toContain(s.finding);
        expect(againstClaims).not.toContain(s.finding);
      } else {
        expect(againstClaims).toContain(s.finding);
        expect(forClaims).not.toContain(s.finding);
      }
    }
  });
});

// ------------------------------------------------ the cohort against real shape

describe("the frontier cohort is taken from the taxonomy", () => {
  const metrics = (composites: MarketMetrics["categoryComposites"]) =>
    ({ categoryComposites: composites }) as MarketMetrics;

  it("reads its membership from the ranking engine's own category", () => {
    const cohort = frontierCohort(
      metrics({
        frontier_model_api: {
          openai: { rank: 1, composite: 3.7 },
          anthropic: { rank: 2, composite: 3.65 },
        },
        ai_silicon: { nvidia: { rank: 1, composite: 4 } },
      } as unknown as MarketMetrics["categoryComposites"])
    );
    expect([...cohort].sort()).toEqual(["anthropic", "openai"]);
    expect(cohort.has("nvidia")).toBe(false);
  });

  it("returns an empty cohort rather than throwing where the category is absent", () => {
    expect(frontierCohort(metrics({} as MarketMetrics["categoryComposites"])).size).toBe(0);
  });

  it("emits no frontier capability signal when the cohort is too thin to judge", () => {
    // Fewer than three scored members is not a spread, and the signal is
    // absent rather than computed off two numbers.
    const m = {
      vendors: [
        { id: "openai", name: "OpenAI", category: "Frontier model/API", maturity: 70, reputation: 80 },
        { id: "anthropic", name: "Anthropic", category: "Frontier model/API", maturity: 60, reputation: 80 },
      ],
      shares: [],
      risks: [],
      gaining: [],
      slipping: [],
      lane: "aie",
      generatedAt: recent,
      reputationAsOf: recent,
      shareAsOf: recent,
      shareMovementPublished: false,
      categoryComposites: {
        frontier_model_api: { openai: { rank: 1, composite: 3.7 }, anthropic: { rank: 2, composite: 3.6 } },
      },
      categoryHeld: {},
      compositesCapturedAt: recent,
    } as unknown as MarketMetrics;
    const ids = signalsFromMetrics(m).map((s) => s.id);
    expect(ids).not.toContain("capability-spread-frontier");
  });
});

// ------------------------------------------------------- the price reading itself

describe("the price reading declares the market it measures", () => {
  it("declares itself a frontier model reading", () => {
    const s = priceSignal(25, 29, recent)!;
    expect(s.population).toBe("frontier-model-providers");
  });

  it("produces nothing where there is no ratio to report", () => {
    expect(priceSignal(null, 0, recent)).toBeNull();
  });
});
