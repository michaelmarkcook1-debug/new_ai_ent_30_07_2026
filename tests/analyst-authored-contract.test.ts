import { describe, it, expect } from "vitest";
import {
  restrictedVocabulary,
  strongestTemporal,
  temporalFromText,
  temporalViolations,
  urgencyViolations,
  claimsFrom,
  reversedClaims,
  type TemporalLicence,
} from "@/lib/analyst/canonical";
import { authoringContract, mergeDecision } from "@/lib/analyst/author";
import { invented, foreignEntities } from "@/lib/analyst/llm";
import { claimsCausality } from "@/lib/analyst/synthesis";
import type { Synthesis } from "@/lib/analyst/synthesis";
import type { Signal } from "@/lib/analyst/signals";
import { signal } from "@/lib/analyst/signals";
import type { AnalystInsightData } from "@/lib/analyst/insight";
import type { Freshness } from "@/lib/analyst/freshness";

// What the model may claim, and what happens when it claims more.
//
// The deterministic layer decides two things about every reading before a word
// is written: how old it is allowed to be to mean "now", and how many
// observations it rests on. Both were enforced on the computed text and on
// nothing else. The model was handed the finished prose in one undifferentiated
// block and could add whatever the data did not carry, and it did, twice:
//
//   a single adoption capture published as "adoption demand keeps climbing"
//   a suppressed 34-day finding restored as the reason to act now
//
// Neither moved a figure, named a vendor off the page, or reversed a direction,
// so every guard in the product passed them. These are the checks that do not.
//
// ATTACK TESTS. Each case below is a model output written specifically to get
// past the guards. The expected result is a rejection, and where a rejection
// would be wrong the case proves the guard leaves sound prose alone: a false
// rejection costs the page its analyst voice, which is a real cost.

// ------------------------------------------------------------------ fixtures

const synth = (
  over: Partial<Synthesis> & { finding: string }
): Synthesis => ({
  id: "capability-price-divergence",
  relation: "reinforces",
  implication: "what it means for the decision",
  signals: [],
  temporal: "state",
  currency: "current",
  freshness: "current",
  bearing: "supports",
  ...over,
});

const packet = (
  over: Partial<AnalystInsightData> = {}
): AnalystInsightData => ({
  headline: "The top tier is being defaulted to rather than chosen.",
  summary: "Of the 330 priced models, 29 clear 80 per cent of the top score.",
  implications: [],
  action: "Renegotiate",
  news: null,
  evidence: { count: 330, sources: ["Artificial Analysis benchmark"], lastUpdated: null, lane: "derived" },
  insufficient: null,
  decision: {
    action: "Renegotiate",
    instruction:
      "Route the workloads that do not need the top model to a cheaper qualifying one before the next renewal.",
    whyNow:
      "29 of the 330 priced and benchmarked models reach 80 per cent of the top score, and the cheapest of them costs 25 times less than the top model.",
    evidenceFor: [
      {
        claim: "29 models reach 80 per cent of the top benchmark score.",
        source: "Artificial Analysis benchmark",
        basis: "measured",
        lane: "derived",
        asOf: null,
      },
    ],
    evidenceAgainst: [
      {
        claim:
          "This prices input tokens only. A real workload's blend moves the multiple.",
        source: "Vendor pricing pages",
        basis: "measured",
        lane: "derived",
        asOf: null,
      },
    ],
    trigger: null,
    doNotDo: null,
    strength: "contested",
  },
  ...over,
});

/** The finding the deterministic layer kept out of the computed why now. */
const AGING_FINDING =
  "Capability across frontier model providers is narrow, while the price separation between the top model and a qualifying alternative is wide, and separated from capability. The two readings come from different datasets, taken over the same set of vendors, and point the same way.";

/** The sentence that actually shipped, built out of that finding. */
const SHIPPED_WHY_NOW =
  "Capability across frontier providers reads narrow on the capability matrix alongside a 25x published input-price separation between the top model and a qualifying alternative.";

const contractFor = (freshness: Freshness, bearing: Synthesis["bearing"] = "supports") =>
  authoringContract(packet(), {
    signals: [],
    synthesis: [synth({ finding: AGING_FINDING, freshness, bearing })],
  });

const obs = (n: number, direction: Signal["direction"] = "up"): Signal =>
  signal({
    id: `s${n}`,
    subject: "the tracked set",
    dimension: "adoption",
    state: "high, and concentrated",
    direction,
    observations: n,
    observedAt: "2026-08-27",
    lane: "aie",
    evidence: {
      claim: "adoption reading",
      source: "AIE uptake model",
      basis: "modelled",
      lane: "aie",
      asOf: "2026-08-27",
    },
  });

// -------------------------------------------- 1 to 4: freshness and urgency

describe("freshness survives authoring", () => {
  // 1.
  it("refuses an authored why now built from AGING evidence", () => {
    const c = contractFor("aging");
    expect(c.barred).toHaveLength(1);
    const bad = urgencyViolations(SHIPPED_WHY_NOW, c.urgency.restricted, c.urgency.allowed);
    expect(bad.length).toBeGreaterThan(0);
    expect(bad).toContain("capability");
    expect(bad).toContain("frontier");
  });

  // 2.
  it("refuses an authored why now built from STALE evidence", () => {
    const c = contractFor("stale");
    expect(c.barred).toHaveLength(1);
    expect(
      urgencyViolations(SHIPPED_WHY_NOW, c.urgency.restricted, c.urgency.allowed).length
    ).toBeGreaterThan(0);
  });

  // 3.
  it("refuses an authored why now built from UNKNOWN-freshness evidence", () => {
    const c = contractFor("unknown");
    expect(c.barred).toHaveLength(1);
    expect(
      urgencyViolations(SHIPPED_WHY_NOW, c.urgency.restricted, c.urgency.allowed).length
    ).toBeGreaterThan(0);
  });

  // 4.
  it("lets CURRENT evidence ground a why now", () => {
    const c = contractFor("current");
    // Nothing is barred, so nothing is restricted and the sentence stands.
    expect(c.barred).toHaveLength(0);
    expect(c.urgency.restricted).toHaveLength(0);
    expect(c.urgency.allowed).toBe(true);
    expect(
      urgencyViolations(SHIPPED_WHY_NOW, c.urgency.restricted, c.urgency.allowed)
    ).toEqual([]);
  });

  // An AGAINST finding may not ground a why now either, whatever its age.
  // That is the P2B rule, applied to the authored layer as well as the
  // computed one.
  it("refuses an authored why now built from a contradicting finding", () => {
    const c = contractFor("current", "against");
    expect(c.barred).toHaveLength(1);
    expect(
      urgencyViolations(SHIPPED_WHY_NOW, c.urgency.restricted, c.urgency.allowed).length
    ).toBeGreaterThan(0);
  });

  // The blunter attack: assert urgency without borrowing the wording.
  it("refuses a bare call to act now when nothing in the packet is current", () => {
    const c = contractFor("aging");
    expect(c.urgency.allowed).toBe(false);
    for (const s of [
      "This divergence means buyers should act now.",
      "Buyers must move immediately.",
      "This is urgent and cannot wait.",
      "Renegotiate this week.",
    ]) {
      expect(urgencyViolations(s, c.urgency.restricted, c.urgency.allowed).length).toBeGreaterThan(0);
    }
  });

  it("leaves a statement of fact alone even when urgency is barred", () => {
    const c = contractFor("aging");
    const ok =
      "Of the 330 priced and benchmarked models, 29 clear 80 per cent of the top score and the cheapest costs 25 times less than the leader.";
    expect(urgencyViolations(ok, c.urgency.restricted, c.urgency.allowed)).toEqual([]);
  });
});

// ------------------------------------------------ 5 to 9: temporal contract

describe("a state does not become a trend", () => {
  const emitted = (o: object) => JSON.stringify(o);

  // 5 and 6.
  it("refuses continuation language on one observation", () => {
    for (const phrase of [
      "Enterprise adoption keeps climbing.",
      "Adoption continues to rise across the set.",
      "The gap is still widening.",
      "Adoption is increasingly concentrated.",
      "The leader is gaining momentum.",
      "Adoption is rising.",
      "The spread has narrowed further.",
      "Share is trending upward.",
      "The decline is reversing.",
    ]) {
      expect(
        temporalViolations(emitted({ summary: phrase }), "state"),
        phrase
      ).not.toEqual([]);
    }
  });

  it("leaves a plain statement of state alone", () => {
    for (const phrase of [
      "Adoption is high and concentrated on one provider.",
      "The spread is narrow across the assessed set.",
      "Twenty-two delivery firms carry the tracked relationships.",
      "The rising tide of enterprise AI has not reached procurement.",
    ]) {
      expect(
        temporalViolations(emitted({ summary: phrase }), "state"),
        phrase
      ).toEqual([]);
    }
  });

  // 7.
  it("refuses acceleration language on two observations", () => {
    for (const phrase of [
      "Adoption is accelerating.",
      "The narrowing is gathering pace.",
      "Share is shifting at an increasing rate.",
      "The gap is closing faster and faster.",
    ]) {
      expect(
        temporalViolations(emitted({ summary: phrase }), "change"),
        phrase
      ).not.toEqual([]);
    }
  });

  // 8.
  it("lets change language pass where two observations support it", () => {
    for (const phrase of [
      "Adoption keeps climbing against the previous reading.",
      "The spread continues to narrow.",
      "Five vendors are gaining and three are slipping.",
    ]) {
      expect(
        temporalViolations(emitted({ summary: phrase }), "change"),
        phrase
      ).toEqual([]);
    }
  });

  // 9.
  it("lets acceleration language pass only at the acceleration licence", () => {
    const phrase = emitted({ summary: "Adoption is accelerating." });
    expect(temporalViolations(phrase, "state")).not.toEqual([]);
    expect(temporalViolations(phrase, "change")).not.toEqual([]);
    expect(temporalViolations(phrase, "acceleration")).toEqual([]);
  });

  it("derives the licence from the findings the model was actually shown", () => {
    // A page can hold a change-carrying signal that fires no rule and never
    // reaches the prompt. Licensing trend words off it would hand the model
    // vocabulary for a claim it cannot cite.
    const c = authoringContract(packet(), {
      signals: [obs(2)],
      synthesis: [synth({ finding: AGING_FINDING, temporal: "state" })],
    });
    expect(c.temporal).toBe("state");
  });

  it("takes the strongest licence across the findings shown", () => {
    const c = authoringContract(packet(), {
      signals: [],
      synthesis: [
        synth({ finding: "a", temporal: "state" }),
        synth({ finding: "b", temporal: "change" }),
      ],
    });
    expect(c.temporal).toBe("change");
  });

  it("falls back to the canonical prose where no finding reached the prompt", () => {
    expect(authoringContract(packet(), null).temporal).toBe("state");
    const moving = packet({ summary: "The spread is narrowing across the set." });
    expect(authoringContract(moving, null).temporal).toBe("change");
  });

  it("reads a licence off text the same way it enforces one", () => {
    expect(temporalFromText("adoption is high")).toBe("state");
    expect(temporalFromText("adoption keeps climbing")).toBe("change");
    expect(temporalFromText("adoption is accelerating")).toBe("acceleration");
    expect(strongestTemporal(["state", "change", "state"] as TemporalLicence[])).toBe("change");
    expect(strongestTemporal([])).toBe("state");
  });
});

// -------------------------------------- 10 to 12: the packet stays canonical

describe("the decision packet survives authoring", () => {
  // 10.
  it("refuses a reversed direction", () => {
    const canonical = "The spread is narrowing across the assessed set.";
    const reversed = JSON.stringify({ summary: "The spread is widening across the set." });
    expect(reversedClaims(reversed, claimsFrom(canonical))).not.toEqual([]);
  });

  // 11.
  it("never lets the model change the canonical action", () => {
    const computed = packet().decision!;
    const merged = mergeDecision(computed, {
      instruction: "Accelerate deployment across every business unit immediately.",
      whyNow: "anything at all",
    });
    // The action is copied, never sourced from the draft.
    expect(merged!.action).toBe("Renegotiate");
    // And an instruction asking for the opposite is refused outright.
    expect(merged!.instruction).toBe(computed.instruction);
  });

  // 12.
  it("never lets counter-evidence disappear", () => {
    const computed = packet().decision!;
    const merged = mergeDecision(computed, { instruction: "x", whyNow: "y" });
    expect(merged!.evidenceAgainst).toEqual(computed.evidenceAgainst);
    expect(merged!.evidenceAgainst.length).toBeGreaterThan(0);
    // The trigger, the do-not and the strength travel around the model too.
    expect(merged!.strength).toBe(computed.strength);
    expect(merged!.trigger).toBe(computed.trigger);
    expect(merged!.doNotDo).toBe(computed.doNotDo);
  });
});

// ------------------------------------------- 13 to 18: the existing guards

describe("the guards that were already there still hold", () => {
  // 13.
  it("refuses unsupported causal language", () => {
    expect(claimsCausality("The price gap caused the capability spread.")).not.toEqual([]);
    expect(claimsCausality("Narrowing capability drove the discount.")).not.toEqual([]);
    // Co-movement stated as co-movement is what the vocabulary is for.
    expect(claimsCausality("The two readings coincide and point the same way.")).toEqual([]);
  });

  // 17.
  it("refuses a vendor the page does not cover", () => {
    expect(
      foreignEntities(
        JSON.stringify({ summary: "Cohere leads here." }),
        "facts naming nobody",
        ["Cohere", "OpenAI"],
        ["OpenAI"]
      )
    ).not.toEqual([]);
  });

  // 18.
  it("refuses a figure the data never supplied", () => {
    expect(invented(JSON.stringify({ s: "the spread is 61.2 points" }), "the spread is 58.7")).not.toEqual([]);
  });

  // 14 and 16.
  it("lets a grounded interpretation through untouched", () => {
    const c = contractFor("current");
    const draft = {
      instruction:
        "Route the workloads that do not need the top model to a cheaper qualifying one before renewal.",
      whyNow:
        "Of the 330 priced and benchmarked models, 29 clear 80 per cent of the top score.",
    };
    const merged = mergeDecision(packet().decision!, draft, c.urgency);
    expect(merged!.whyNow).toBe(draft.whyNow);
    expect(merged!.instruction).toBe(draft.instruction);
  });
});

// ------------------------------------------------ 15: what happens on failure

describe("unsafe output falls back rather than rendering", () => {
  // 15.
  it("falls back to the computed why now when the rewrite is unsafe", () => {
    const computed = packet().decision!;
    const c = contractFor("aging");
    const merged = mergeDecision(computed, { whyNow: SHIPPED_WHY_NOW }, c.urgency);
    expect(merged!.whyNow).toBe(computed.whyNow);
    expect(merged!.whyNow).not.toBe(SHIPPED_WHY_NOW);
  });

  it("keeps the rewrite when it is safe", () => {
    const computed = packet().decision!;
    const c = contractFor("aging");
    const safe =
      "Of the 330 priced and benchmarked models, 29 clear 80 per cent of the top score.";
    expect(mergeDecision(computed, { whyNow: safe }, c.urgency)!.whyNow).toBe(safe);
  });

  it("protects the merge even where the caller declared no contract", () => {
    // The guard in generate() is the first line and this is the second. A
    // caller that passes no contract loses the check, so the check is passed
    // by every caller in this module and the absence is a caller bug rather
    // than a silent hole; asserted here so it stays visible.
    const computed = packet().decision!;
    expect(mergeDecision(computed, { whyNow: SHIPPED_WHY_NOW })!.whyNow).toBe(
      SHIPPED_WHY_NOW
    );
  });
});

// --------------------------------------------------- the vocabulary itself

describe("the restricted vocabulary", () => {
  it("keeps only words the permitted evidence does not already use", () => {
    const r = restrictedVocabulary(
      ["capability across frontier providers is narrow"],
      ["29 models reach 80 per cent of the top benchmark score"]
    );
    expect(r).toContain("capability");
    expect(r).toContain("frontier");
    expect(r).not.toContain("models");
  });

  it("matches on a stem, so one concept spelled three ways is one concept", () => {
    // The failure this prevents: "price" restricted while the permitted
    // evidence says "priced", so a legitimate mention of the price gap is
    // thrown away.
    const r = restrictedVocabulary(
      ["the price separation is wide"],
      ["the cheapest qualifying model costs less on published input pricing"]
    );
    expect(r).not.toContain("price");
    expect(r).toContain("separation");
  });

  it("drops connectives, which appear everywhere and claim nothing", () => {
    const r = restrictedVocabulary(
      ["across the set, while between these vendors, different readings"],
      ["nothing in common"]
    );
    for (const w of ["across", "while", "between", "these", "different"]) {
      expect(r).not.toContain(w);
    }
  });

  it("is empty when nothing is barred", () => {
    expect(restrictedVocabulary([], ["anything"])).toEqual([]);
  });
});

// ------------------------------------------- captured from the live model

describe("real generations, captured from the running product", () => {
  // These are not invented attack strings. Each was produced by Opus 5 against
  // the live fact sheets on 28 August 2026, recorded so the contract keeps
  // being tested against prose a model actually writes rather than only
  // against prose chosen to fail. The live path itself cannot run under vitest
  // (`authoredResult` wraps the call in `unstable_cache`, which throws
  // "incrementalCache missing" outside a Next render), so the generations are
  // captured from the dev server and asserted here.

  // /alliances. The adoption reading is undated, so the finding built on it is
  // barred from grounding a why now. The model reached for it twice and the
  // guard refused it twice; the page rendered the computed sentence.
  it("refuses the why now the model actually wrote for /alliances", () => {
    const barred =
      "Adoption signal is high, and concentrated for OpenAI, while delivery capacity is sole-sourced for 1 vendor. Demand and the ability to implement it are recorded in different datasets and do not agree.";
    const permitted = [
      "One vendor on this page has a single firm able to deliver it, which turns a software decision into a supplier decision.",
      "22 delivery firms carry 51 tracked vendor relationships, 1 of which have a single firm able to deliver them.",
    ];
    const restricted = restrictedVocabulary([barred], permitted);
    // The two rejected attempts, verbatim in substance.
    const attempt1 =
      "Demand is concentrated on one provider while the ability to implement it sits with a single firm.";
    const attempt2 =
      "Adoption signal is concentrated for OpenAI while delivery capacity is sole-sourced.";
    for (const a of [attempt1, attempt2]) {
      expect(urgencyViolations(a, restricted, false), a).not.toEqual([]);
    }
    // And the computed sentence the page fell back to is itself clean, which
    // is what makes the fallback safe rather than merely different.
    expect(urgencyViolations(permitted[0], restricted, false)).toEqual([]);
  });

  // /price-performance. The capability/price finding rests on a 34-day
  // benchmark and is barred; the accepted generation rewrote the computed
  // sentence instead of reaching for the finding.
  it("accepts the why now the model actually wrote for /price-performance", () => {
    const c = contractFor("aging");
    const accepted =
      "29 of the 330 priced and benchmarked models reach 80 per cent of the top score, and the cheapest of them is 25 times cheaper on input than the leader.";
    expect(urgencyViolations(accepted, c.urgency.restricted, c.urgency.allowed)).toEqual([]);
    expect(temporalViolations(JSON.stringify({ whyNow: accepted }), "state")).toEqual([]);
    expect(claimsCausality(accepted)).toEqual([]);
  });

  // /competitive-intel and /reputation-tracker, both accepted with nothing
  // barred. Kept so a future change that starts restricting them is visible.
  it("leaves clean generations on the other wired pages alone", () => {
    for (const s of [
      "Across 14 frontier model and API providers assessed on 10 capabilities, the leader reaches 69.9 against a 59.3 median, a 10.6 point spread well inside the 15 points at which capability still justifies a premium.",
      "All 28 vendors with a reading fall inside 13.7 points around a 75.8 mean, and developer is the weakest pillar of the three at 71.1.",
      "Four vendors currently rank in the top third of a market they compete in while carrying an open high-severity risk that the composite score does not deduct.",
    ]) {
      expect(temporalViolations(JSON.stringify({ whyNow: s }), "state"), s).toEqual([]);
      expect(claimsCausality(s), s).toEqual([]);
      expect(urgencyViolations(s, [], true), s).toEqual([]);
    }
  });
});
