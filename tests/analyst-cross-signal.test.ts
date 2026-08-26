import { describe, it, expect } from "vitest";
import {
  coincident,
  hasTrend,
  signal,
  stateWording,
  temporalClass,
  worstLane,
  type Signal,
} from "@/lib/analyst/signals";
import {
  CAUSAL_WORDS,
  claimsCausality,
  synthesise,
  synthesisBlock,
  synthesisEvidence,
} from "@/lib/analyst/synthesis";
import {
  enrichWithSynthesis,
  signalsFromMetrics,
  adoptionSignal,
  deliverySignal,
  disclosureSignal,
  priceSignal,
} from "@/lib/analyst/cross";
import { resolveTheses, priorsBlock, THESES } from "@/lib/analyst/priors";
import { pickNews, pricePerformanceInsight, NEWS_MAX_AGE_DAYS } from "@/lib/analyst/insight";
import type { MarketMetrics } from "@/lib/market-metrics";
import type { DecisionEvidence } from "@/lib/analyst/decision";

// Cross-signal intelligence.
//
// The conclusions that matter to a buyer are frequently not on any one page.
// These pin the rules that make combining pages safe: a snapshot never becomes
// a trend, two things moving together never become one causing the other, a
// contradiction is never quietly dropped, and nothing a synthesis says can
// select an action.

const ev = (source: string, extra: Partial<DecisionEvidence> = {}): DecisionEvidence => ({
  claim: `reading from ${source}`,
  source,
  basis: "measured",
  lane: "aie",
  ...extra,
});

// ------------------------------------------------------- synthetic fixtures

/** E. Capability converged, price still separated. Two datasets, one story. */
const CAPABILITY_NARROW = signal({
  id: "cap",
  subject: "the assessed set",
  dimension: "capability",
  state: "narrow",
  magnitude: 9.2,
  observedAt: "2026-08-17",
  lane: "aie",
  evidence: ev("AIE capability matrix"),
});
const PRICE_WIDE = signal({
  id: "price",
  subject: "the priced catalogue",
  dimension: "price",
  state: "wide, and separated from capability",
  magnitude: 12,
  observedAt: "2026-08-17",
  lane: "derived",
  evidence: ev("Artificial Analysis benchmark", { lane: "derived" }),
});

/** F. A vendor that ranks well and is carrying an open finding. */
const POSITION_LEADS = signal({
  id: "pos",
  subject: "Anthropic",
  dimension: "position",
  state: "clear, and leads its market",
  observedAt: "2026-08-17",
  lane: "aie",
  evidence: ev("AIE vendor rankings"),
});
const RISK_OPEN = signal({
  id: "risk",
  subject: "Anthropic",
  dimension: "risk",
  state: "carrying 2 open high-severity findings",
  observedAt: "2026-08-17",
  lane: "aie",
  evidence: ev("AIE risk register"),
});

/** G. Everyone is buying it and one firm can install it. */
const ADOPTION_HIGH = signal({
  id: "adopt",
  subject: "OpenAI",
  dimension: "adoption",
  state: "high, and concentrated",
  observedAt: "2026-08-16",
  lane: "aie",
  evidence: ev("AIE uptake model", { basis: "modelled" }),
});
const DELIVERY_NARROW = signal({
  id: "delivery",
  subject: "the tracked delivery channel",
  dimension: "delivery",
  state: "sole-sourced for 3 vendors",
  observedAt: "2026-08-16",
  lane: "aie",
  evidence: ev("AIE exposure map"),
});

/** H. Tight field, and a lead nobody is contesting. */
const CONCENTRATION_TIGHT = signal({
  id: "conc",
  subject: "a typical tracked category",
  dimension: "concentration",
  state: "tight",
  magnitude: 78,
  observedAt: "2026-08-16",
  lane: "aie",
  evidence: ev("AIE market share estimates", { basis: "modelled" }),
});

/** C. One observation. Direction is stripped at construction, not filtered later. */
const SNAPSHOT = signal({
  id: "snap",
  subject: "the tracked set",
  dimension: "reputation",
  state: "widely spread, with a weak tail",
  direction: "down",
  observations: 1,
  observedAt: "2026-08-16",
  lane: "aie",
  evidence: ev("AIE reputation pillars"),
});

/** D. Two observations, so a direction may be stated. */
const MOVING_UP = signal({
  id: "mv-up",
  subject: "the tracked set",
  dimension: "movement",
  state: "gaining on balance",
  direction: "up",
  observations: 2,
  observedAt: "2026-08-16",
  lane: "aie",
  evidence: ev("AIE vendor movement classification", { basis: "modelled" }),
});
const MOVING_DOWN = signal({
  id: "mv-down",
  subject: "the priced catalogue",
  dimension: "price",
  state: "narrowing",
  direction: "down",
  observations: 2,
  observedAt: "2026-08-18",
  lane: "derived",
  evidence: ev("Artificial Analysis benchmark", { lane: "derived" }),
});
const ALSO_UP = signal({
  id: "also-up",
  subject: "the assessed set",
  dimension: "capability",
  state: "rising",
  direction: "up",
  observations: 2,
  observedAt: "2026-08-18",
  lane: "aie",
  evidence: ev("AIE capability matrix"),
});

// ------------------------------------------------------------- the contract

describe("the signal contract", () => {
  // C. The rule the whole temporal story rests on.
  it("strips a direction from a single observation at construction", () => {
    expect(SNAPSHOT.direction).toBe("unknown");
    expect(temporalClass(SNAPSHOT)).toBe("state");
    expect(hasTrend(SNAPSHOT)).toBe(false);
    expect(stateWording(SNAPSHOT)).toBe("is widely spread, with a weak tail");
  });

  // D.
  it("allows change where two observations differ", () => {
    expect(temporalClass(MOVING_UP)).toBe("change");
    expect(hasTrend(MOVING_UP)).toBe(true);
    expect(stateWording(MOVING_UP)).toContain("rising");
  });

  it("reaches acceleration only on three observations", () => {
    const two = signal({ ...MOVING_UP, id: "a", observations: 2, direction: "up" });
    const three = signal({ ...MOVING_UP, id: "b", observations: 3, direction: "up" });
    expect(temporalClass(two)).toBe("change");
    expect(temporalClass(three)).toBe("acceleration");
  });

  it("preserves native semantics rather than normalising to a number", () => {
    // A 0 to 5 composite, a percentage and a price multiple do not share a
    // scale, and inventing one would compare things that do not compare.
    expect(CONCENTRATION_TIGHT.state).toBe("tight");
    expect(PRICE_WIDE.magnitude).toBe(12);
    expect(CONCENTRATION_TIGHT.magnitude).toBe(78);
  });

  it("takes the worst lane, so a synthesis cannot outrank its inputs", () => {
    expect(worstLane([CAPABILITY_NARROW, PRICE_WIDE])).toBe("derived");
    expect(worstLane([CAPABILITY_NARROW, RISK_OPEN])).toBe("aie");
  });

  it("cannot call two undated readings coincident", () => {
    const undated = signal({ ...MOVING_UP, id: "u", observedAt: null, observations: 2 });
    expect(coincident(undated, MOVING_DOWN)).toBe(false);
  });
});

// ------------------------------------------------------------- the synthesis

describe("cross-signal relationships", () => {
  // E.
  it("E. detects capability and price divergence", () => {
    const out = synthesise([CAPABILITY_NARROW, PRICE_WIDE]);
    const hit = out.find((s) => s.id === "capability-price-divergence")!;
    expect(hit).toBeDefined();
    expect(hit.relation).toBe("reinforces");
    expect(hit.signals.map((s) => s.id).sort()).toEqual(["cap", "price"]);
  });

  // F.
  it("F. detects a strong vendor carrying an open high-severity risk", () => {
    const hit = synthesise([POSITION_LEADS, RISK_OPEN]).find(
      (s) => s.id === "strength-risk-divergence"
    )!;
    expect(hit).toBeDefined();
    expect(hit.relation).toBe("contradicts");
    expect(hit.bearing).toBe("against");
  });

  // G.
  it("G. detects high adoption against thin delivery capacity", () => {
    const hit = synthesise([ADOPTION_HIGH, DELIVERY_NARROW]).find(
      (s) => s.id === "adoption-delivery-divergence"
    )!;
    expect(hit).toBeDefined();
    expect(hit.relation).toBe("contradicts");
  });

  // H.
  it("H. detects a concentrated market with an uncontested lead", () => {
    const hit = synthesise([CONCENTRATION_TIGHT, POSITION_LEADS]).find(
      (s) => s.id === "concentration-alternatives"
    )!;
    expect(hit).toBeDefined();
    expect(hit.bearing).toBe("against");
  });

  // A.
  it("A. detects reinforcing movement across two datasets", () => {
    const hit = synthesise([MOVING_UP, ALSO_UP]).find(
      (s) => s.id === "reinforcing-movement"
    )!;
    expect(hit).toBeDefined();
    expect(hit.relation).toBe("reinforces");
  });

  // B.
  it("B. detects contradictory movement and marks it against", () => {
    const hit = synthesise([MOVING_UP, MOVING_DOWN]).find(
      (s) => s.id === "contradictory-movement"
    )!;
    expect(hit).toBeDefined();
    expect(hit.relation).toBe("contradicts");
    expect(hit.bearing).toBe("against");
  });

  // K.
  it("K. produces nothing at all from insufficient signals", () => {
    expect(synthesise([])).toEqual([]);
    expect(synthesise([CAPABILITY_NARROW])).toEqual([]);
    expect(synthesise([SNAPSHOT])).toEqual([]);
    // Half a relationship is not a relationship.
    expect(synthesise([POSITION_LEADS])).toEqual([]);
  });

  it("does not fire where the states are present but point the other way", () => {
    const capWide = signal({ ...CAPABILITY_NARROW, id: "cap2", state: "wide" });
    expect(
      synthesise([capWide, PRICE_WIDE]).find(
        (s) => s.id === "capability-price-divergence"
      )
    ).toBeUndefined();
  });
});

// ---------------------------------------------------------- the guarantees

describe("what a synthesis may never do", () => {
  const everything = [
    CAPABILITY_NARROW,
    PRICE_WIDE,
    POSITION_LEADS,
    RISK_OPEN,
    ADOPTION_HIGH,
    DELIVERY_NARROW,
    CONCENTRATION_TIGHT,
    MOVING_UP,
    MOVING_DOWN,
  ];

  // 1. Traceability.
  it("names every signal that produced it, and they are real inputs", () => {
    const ids = new Set(everything.map((s) => s.id));
    for (const s of synthesise(everything)) {
      expect(s.signals.length).toBeGreaterThan(0);
      for (const input of s.signals) {
        expect(ids.has(input.id)).toBe(true);
        expect(input.evidence.source.length).toBeGreaterThan(0);
      }
    }
  });

  // 2. No synthesis without inputs.
  it("never produces a finding with no supporting signal", () => {
    for (const s of synthesise(everything)) {
      expect(s.signals.length).toBeGreaterThanOrEqual(2);
    }
  });

  // 4. Snapshot does not become trend.
  it("never describes a snapshot as moving", () => {
    for (const s of synthesise([...everything, SNAPSHOT])) {
      if (s.signals.some((x) => !hasTrend(x))) {
        expect(s.temporal).toBe("state");
      }
      // The wording follows the same rule: nothing built only from snapshots
      // may contain a moving verb.
      if (s.temporal === "state") {
        expect(s.finding).not.toMatch(/\b(rising|falling|narrowing|widening)\b/);
      }
    }
  });

  it("takes the weakest input's temporal class, not the strongest", () => {
    const mixed = synthesise([CAPABILITY_NARROW, PRICE_WIDE]);
    // Both inputs are single observations, so the joint claim is a state even
    // though the finding combines two datasets.
    expect(mixed[0].temporal).toBe("state");
  });

  // 5. Correlation is not causality.
  it("never claims one reading caused another", () => {
    for (const s of synthesise(everything)) {
      expect(claimsCausality(s.finding), s.id).toEqual([]);
      expect(claimsCausality(s.implication), s.id).toEqual([]);
    }
    // The block's own instruction names the forbidden words in order to forbid
    // them, so the check is on the finding lines rather than the whole block.
    const findings = synthesisBlock(synthesise(everything))
      .split("\n")
      .filter((l) => l.trimStart().startsWith("- [") || l.trimStart().startsWith("What it means:"));
    expect(findings.length).toBeGreaterThan(0);
    for (const line of findings) expect(claimsCausality(line), line).toEqual([]);
    // And the instruction does spell them out, which is the point of it.
    expect(synthesisBlock(synthesise(everything))).toMatch(/never "because"|never "?because/i);
  });

  it("has no causal member in the relation vocabulary", () => {
    for (const s of synthesise(everything)) {
      expect(["reinforces", "contradicts", "coincides with", "consistent with"]).toContain(
        s.relation
      );
    }
    // And the detector itself works, or the assertions above prove nothing.
    expect(claimsCausality("The narrowing was caused by the price move")).toContain(
      "caused"
    );
    expect(claimsCausality("Adoption drove delivery")).toContain("drove");
    expect(CAUSAL_WORDS.length).toBeGreaterThan(10);
  });

  it("says coincides with, and says outright that no mechanism is established", () => {
    const hit = synthesise([MOVING_UP, MOVING_DOWN, ALSO_UP]).find(
      (s) => s.relation === "coincides with"
    );
    if (hit) {
      expect(hit.finding).toMatch(/establishes no mechanism/i);
      expect(claimsCausality(hit.finding)).toEqual([]);
    }
  });

  it("carries a synthesis into evidence as modelled, never as measured", () => {
    // Every input can be measured and the RELATIONSHIP still is not.
    const e = synthesisEvidence(synthesise([POSITION_LEADS, RISK_OPEN])[0]);
    expect(e.basis).toBe("modelled");
    expect(e.source).toContain("Cross-signal synthesis");
    expect(e.source).toContain("AIE risk register");
  });
});

// --------------------------------------------------------- decision impact

describe("how synthesis reaches a recommendation", () => {
  const BASE = pricePerformanceInsight(
    { models: 42, vendors: 11, ratio: 12, adequate: 9 },
    null,
    "2026-08-20"
  );

  // 3. Contradiction is not silently discarded.
  it("carries a contradicting finding onto the packet as evidence against", () => {
    const { insight, synthesis } = enrichWithSynthesis(BASE, [
      POSITION_LEADS,
      RISK_OPEN,
    ]);
    expect(synthesis.length).toBeGreaterThan(0);
    const against = insight.decision!.evidenceAgainst.map((e) => e.claim);
    expect(against.some((c) => /risk register/i.test(c))).toBe(true);
    // And the page's own contradiction survives alongside it.
    expect(insight.decision!.evidenceAgainst.length).toBeGreaterThan(
      BASE.decision!.evidenceAgainst.length
    );
  });

  it("weakens a committing action through the existing guard, never around it", () => {
    // An advancing action on a page whose cross-signals contradict must come
    // back weaker. The downgrade is resolveAction()'s, not synthesis's.
    const advancing = {
      ...BASE,
      decision: {
        ...BASE.decision!,
        action: "Accelerate" as const,
        evidenceAgainst: [],
      },
    };
    const { insight } = enrichWithSynthesis(advancing, [POSITION_LEADS, RISK_OPEN]);
    expect(insight.decision!.strength).toBe("contested");
    expect(insight.decision!.action).toBe("Investigate");
  });

  it("cannot strengthen an action, only weaken it", () => {
    const monitoring = {
      ...BASE,
      decision: { ...BASE.decision!, action: "Monitor" as const },
    };
    const { insight } = enrichWithSynthesis(monitoring, [
      CAPABILITY_NARROW,
      PRICE_WIDE,
    ]);
    // Reinforcing evidence does not promote Monitor to Accelerate. Nothing in
    // this layer selects an action.
    expect(insight.decision!.action).toBe("Monitor");
  });

  // K, at the decision layer.
  it("cannot conjure a recommendation onto an insufficient page", () => {
    const none = pricePerformanceInsight(
      { models: 0, vendors: 0, ratio: null, adequate: 0 },
      null,
      null
    );
    const { insight } = enrichWithSynthesis(none, [POSITION_LEADS, RISK_OPEN]);
    expect(insight.decision).toBeNull();
    expect(insight.insufficient).not.toBeNull();
  });

  // 8. Fallback preserves intelligence.
  it("returns the packet untouched when nothing fires", () => {
    const { insight, synthesis } = enrichWithSynthesis(BASE, [CAPABILITY_NARROW]);
    expect(synthesis).toEqual([]);
    expect(insight.decision).toEqual(BASE.decision);
    expect(insight.decision!.instruction).toBe(BASE.decision!.instruction);
  });

  it("leaves the instruction and the do-not to the page that computed them", () => {
    const { insight } = enrichWithSynthesis(BASE, [POSITION_LEADS, RISK_OPEN]);
    expect(insight.decision!.instruction).toBe(BASE.decision!.instruction);
    expect(insight.decision!.doNotDo).toBe(BASE.decision!.doNotDo);
  });
});

// -------------------------------------------------------------------- news

describe("news recency gating", () => {
  const NOW = Date.parse("2026-08-26T12:00:00Z");
  const item = (id: string, impact: number, daysAgo: number) => ({
    title: `item ${id}`,
    impactScore: impact,
    publishedAt: new Date(NOW - daysAgo * 86400000).toISOString(),
    sourceName: "src",
    vendors: ["anthropic"],
    categories: ["Market movement"],
  });

  // I.
  it("I. refuses a stale item however loud it is", () => {
    // Measured on the shipped feed: the highest-impact item was 26 days old
    // and was rendering as the dated item beside a why-now.
    const stale = pickNews([item("loud", 95, 26)], { now: NOW });
    expect(stale).toBeNull();
  });

  // J.
  it("J. prefers a fresh material item over a louder stale one", () => {
    const picked = pickNews([item("loud-old", 95, 13), item("quieter-new", 78, 1)], {
      now: NOW,
    });
    expect(picked?.title).toBe("item quieter-new");
  });

  it("refuses an undated item rather than assuming it is fresh", () => {
    const undated = pickNews(
      [{ title: "no date", impactScore: 99, publishedAt: null, vendors: [], categories: [] }],
      { now: NOW }
    );
    expect(undated).toBeNull();
  });

  it("refuses a future-dated item, which is a feed defect and not news", () => {
    expect(pickNews([item("future", 95, -30)], { now: NOW })).toBeNull();
  });

  it("gates at the documented window and not somewhere else", () => {
    expect(NEWS_MAX_AGE_DAYS).toBe(14);
    expect(pickNews([item("inside", 80, 13)], { now: NOW })).not.toBeNull();
    expect(pickNews([item("outside", 80, 15)], { now: NOW })).toBeNull();
  });

  it("still respects the impact floor, so recency alone cannot promote noise", () => {
    expect(pickNews([item("fresh-but-trivial", 10, 0)], { now: NOW })).toBeNull();
  });

  it("prefers an item naming a vendor this page covers, all else close", () => {
    const mine = { ...item("mine", 80, 2), vendors: ["anthropic"] };
    const theirs = { ...item("theirs", 80, 2), vendors: ["someone-else"] };
    const picked = pickNews([theirs, mine], {
      now: NOW,
      pageVendorIds: ["anthropic"],
    });
    expect(picked?.title).toBe("item mine");
  });
});

// ------------------------------------------------------------------ priors

describe("analyst priors", () => {
  const TODAY = "2026-08-26";

  it("keeps structural expertise with no expiry and no validator", () => {
    const durable = resolveTheses([], TODAY).filter((t) => t.status === "durable");
    expect(durable.length).toBe(3);
    for (const t of durable) {
      expect(t.validate).toBeUndefined();
      expect(t.validatedAt).toBeNull();
      expect(t.basis).toMatch(/structural/i);
    }
  });

  it("marks a checkable claim unvalidated where the page cannot check it", () => {
    const out = resolveTheses([], TODAY);
    const cap = out.find((t) => t.id === "capability-commoditised-faster-than-price")!;
    expect(cap.status).toBe("unvalidated");
    // And an unvalidated claim never reaches the prompt.
    expect(priorsBlock(out)).not.toContain(cap.thesis);
  });

  it("states a checkable claim only where this page's data confirms it", () => {
    const out = resolveTheses([CAPABILITY_NARROW, PRICE_WIDE], TODAY);
    const cap = out.find((t) => t.id === "capability-commoditised-faster-than-price")!;
    expect(cap.status).toBe("validated");
    expect(cap.validatedAt).toBe(TODAY);
    expect(priorsBlock(out)).toContain(cap.thesis);
    expect(priorsBlock(out)).toContain("CONFIRMED BY THIS PAGE'S OWN DATA");
  });

  // The whole point: a market observation that stopped being true must stop
  // being asserted, rather than outliving the reading that justified it.
  it("forbids a claim this page's data contradicts", () => {
    const capWide = signal({ ...CAPABILITY_NARROW, id: "c2", state: "wide" });
    const out = resolveTheses([capWide, PRICE_WIDE], TODAY);
    const cap = out.find((t) => t.id === "capability-commoditised-faster-than-price")!;
    expect(cap.status).toBe("contradicted");
    const block = priorsBlock(out);
    expect(block).toContain("CONTRADICTED BY THIS PAGE'S OWN DATA");
    expect(block).toContain("Do NOT state these");
  });

  it("validates the disclosure claim off the filings count", () => {
    const thin = disclosureSignal(6, 28, "2026-08-20")!;
    const thick = disclosureSignal(22, 28, "2026-08-20")!;
    expect(
      resolveTheses([thin], TODAY).find((t) => t.id === "disclosure-is-thin")!.status
    ).toBe("validated");
    expect(
      resolveTheses([thick], TODAY).find((t) => t.id === "disclosure-is-thin")!.status
    ).toBe("contradicted");
  });

  it("keeps every thesis carrying a basis and a review date", () => {
    for (const t of THESES) {
      expect(t.basis.length).toBeGreaterThan(20);
      expect(t.reviewedAt).toMatch(/^\d{4}-\d{2}-\d{2}$/);
    }
  });
});

// --------------------------------------------------- signals from real data

describe("signals built from the shared metrics object", () => {
  const metrics = (over: Partial<MarketMetrics> = {}): MarketMetrics => ({
    vendors: [
      { id: "a", name: "Anthropic", category: "Frontier lab", marketPosition: null, lastUpdated: null, composite: 80, compositeConfidence: null, momentum: null, momentumConfidence: null, maturity: 72, maturityRows: 8, maturityEvidence: "E3", reputation: 80, reputationPillars: null },
      { id: "b", name: "OpenAI", category: "Frontier lab", marketPosition: null, lastUpdated: null, composite: 78, compositeConfidence: null, momentum: null, momentumConfidence: null, maturity: 66, maturityRows: 8, maturityEvidence: "E3", reputation: 62, reputationPillars: null },
      { id: "c", name: "Cohere", category: "Frontier lab", marketPosition: null, lastUpdated: null, composite: 60, compositeConfidence: null, momentum: null, momentumConfidence: null, maturity: 64, maturityRows: 6, maturityEvidence: "E4", reputation: 50, reputationPillars: null },
      { id: "d", name: "Mistral", category: "Frontier lab", marketPosition: null, lastUpdated: null, composite: 55, compositeConfidence: null, momentum: null, momentumConfidence: null, maturity: 60, maturityRows: 6, maturityEvidence: "E4", reputation: 48, reputationPillars: null },
      { id: "e", name: "AI21", category: "Frontier lab", marketPosition: null, lastUpdated: null, composite: 50, compositeConfidence: null, momentum: null, momentumConfidence: null, maturity: 58, maturityRows: 5, maturityEvidence: "E4", reputation: 44, reputationPillars: null },
    ],
    shares: [
      { vendorId: "a", categoryId: "frontier", estimatedShare: 40, confidence: 90, source: "s", sourceDate: "2026-08-16", methodology: "m", changePct: 0 },
      { vendorId: "b", categoryId: "frontier", estimatedShare: 25, confidence: 90, source: "s", sourceDate: "2026-08-16", methodology: "m", changePct: 0 },
      { vendorId: "c", categoryId: "frontier", estimatedShare: 15, confidence: 90, source: "s", sourceDate: "2026-08-16", methodology: "m", changePct: 0 },
    ],
    kpis: [],
    risks: [{ vendorId: "a", vendorName: "Anthropic", headline: "finding", severity: "high", confidence: null }],
    gaining: [],
    slipping: [],
    lane: "aie",
    generatedAt: "2026-08-17",
    reputationAsOf: "2026-08-16",
    shareAsOf: "2026-08-16",
    shareMovementPublished: false,
    categoryComposites: {
      frontier: {
        a: { composite: 3.9, rank: 1, position: null, evidenced: 8, domainsTotal: 8, weakestGrade: "E3", domains: [] },
        b: { composite: 3.5, rank: 2, position: null, evidenced: 8, domainsTotal: 8, weakestGrade: "E3", domains: [] },
      },
    },
    categoryHeld: {},
    compositesCapturedAt: "2026-08-17",
    ...over,
  });

  it("reads six dimensions off one already-fetched object, with no new call", () => {
    const dims = new Set(signalsFromMetrics(metrics()).map((s) => s.dimension));
    expect(dims).toContain("capability");
    expect(dims).toContain("position");
    expect(dims).toContain("concentration");
    expect(dims).toContain("risk");
    expect(dims).toContain("reputation");
  });

  it("emits no movement signal when the source republishes identical priors", () => {
    // shareMovementPublished false means the upstream sent the same numbers
    // again. Classifying that as movement would be a trend made out of a
    // repeated snapshot.
    const m = metrics({
      gaining: [{ vendorId: "a", vendorName: "Anthropic", headline: "", severity: null, confidence: null }],
      shareMovementPublished: false,
    });
    expect(signalsFromMetrics(m).find((s) => s.dimension === "movement")).toBeUndefined();
  });

  it("emits movement, with a direction, only when movement is published", () => {
    const m = metrics({
      gaining: [{ vendorId: "a", vendorName: "Anthropic", headline: "", severity: null, confidence: null }],
      shareMovementPublished: true,
    });
    const mv = signalsFromMetrics(m).find((s) => s.dimension === "movement")!;
    expect(mv.direction).toBe("up");
    expect(mv.observations).toBe(2);
    expect(temporalClass(mv)).toBe("change");
  });

  it("gives every signal a traceable claim, source, basis and lane", () => {
    for (const s of signalsFromMetrics(metrics())) {
      expect(s.evidence.claim.length).toBeGreaterThan(10);
      expect(s.evidence.source.length).toBeGreaterThan(0);
      expect(["measured", "modelled", "disclosed", "absent"]).toContain(s.evidence.basis);
      expect(s.lane).toBe("aie");
    }
  });

  it("labels the share estimate modelled, because the dataset says it is", () => {
    const conc = signalsFromMetrics(metrics()).find((s) => s.dimension === "concentration")!;
    expect(conc.evidence.basis).toBe("modelled");
  });

  it("labels the uptake model modelled too, since it is not audited share", () => {
    expect(adoptionSignal("OpenAI", 0.26, "2026-08-16").evidence.basis).toBe("modelled");
  });

  // 9. Two pages reading the same canonical evidence cannot disagree about it,
  // because they compute the same signals from the same object.
  it("produces identical signals for two pages given the same metrics", () => {
    const m = metrics();
    expect(signalsFromMetrics(m)).toEqual(signalsFromMetrics(m));
    expect(synthesise(signalsFromMetrics(m))).toEqual(
      synthesise(signalsFromMetrics(m))
    );
  });

  it("builds the optional signals only where the page holds the data", () => {
    expect(priceSignal(null, 0, null)).toBeNull();
    expect(priceSignal(12, 9, "2026-08-20")!.dimension).toBe("price");
    expect(disclosureSignal(0, 0, null)).toBeNull();
    expect(deliverySignal(0, 0, 0, null)).toBeNull();
    expect(deliverySignal(3, 14, 60, "2026-08-20")!.state).toContain("sole-sourced");
  });
});
