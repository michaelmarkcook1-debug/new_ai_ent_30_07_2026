import { describe, it, expect, afterEach } from "vitest";
import {
  actionIntent,
  claimsFrom,
  countClaims,
  intentViolation,
  reversedClaims,
  unsupportedCounts,
  type ActionIntent,
} from "@/lib/analyst/canonical";
import { foreignEntities, guard, invented } from "@/lib/analyst/llm";
import { authorActions, authorInsight } from "@/lib/analyst/author";
import type { AnalystAction, AnalystInsightData } from "@/lib/analyst/insight";

// The canonical contract: what the model may not contradict.
//
// The numeric guard was never the whole job. It answers "did you invent a
// figure" and cannot see three other ways an authored reading goes wrong
// while quoting every number correctly: the action reverses, the direction
// reverses, or a small count is asserted that nothing supplied.
//
// These pin the rules rather than any particular sentence. Which words the
// model reaches for changes; what must never change is that a canonical Pause
// cannot leave this layer as an Accelerate.

// ------------------------------------------------------------ action intent

describe("canonical action intent", () => {
  // A Record over the union, so adding a ninth AnalystAction to insight.ts
  // fails to compile here rather than silently arriving unclassified and
  // therefore unguarded.
  const TAXONOMY: Record<AnalystAction, ActionIntent> = {
    Accelerate: "advance",
    Expand: "advance",
    Pause: "restrain",
    "Reduce exposure": "restrain",
    Monitor: "examine",
    Investigate: "examine",
    Shortlist: "select",
    Renegotiate: "press",
  };

  it("classifies every action in the shipped taxonomy", () => {
    for (const [action, intent] of Object.entries(TAXONOMY)) {
      expect(actionIntent(action), action).toBe(intent);
    }
  });

  // 1. The general rule.
  it("refuses a rewrite that reverses the canonical direction", () => {
    expect(intentViolation("restrain", "Accelerate deployment")).toBe("reversal");
    expect(intentViolation("advance", "Pause the rollout")).toBe("reversal");
  });

  // 2. The named case.
  it("cannot turn Pause into Accelerate", () => {
    const canonical = actionIntent("Pause");
    expect(canonical).toBe("restrain");
    expect(intentViolation(canonical, "Accelerate deployment")).toBe("reversal");
  });

  // 3. The other named case.
  it("cannot turn Reduce exposure into Expand", () => {
    const canonical = actionIntent("Reduce exposure");
    expect(canonical).toBe("restrain");
    expect(intentViolation(canonical, "Expand the rollout now")).toBe("reversal");
  });

  // 14. Strengthening is the quieter half of the same failure: the
  // deterministic layer said look first, the model said go.
  it("cannot upgrade a provisional action into a commitment", () => {
    expect(intentViolation("examine", "Accelerate deployment")).toBe(
      "strengthening"
    );
    expect(intentViolation("select", "Expand across the estate")).toBe(
      "strengthening"
    );
    expect(intentViolation("press", "Pause every renewal")).toBe(
      "strengthening"
    );
  });

  it("allows a rewrite that keeps the intent, which is the point of authoring", () => {
    expect(intentViolation("restrain", "Hold scope until risks close")).toBeNull();
    expect(intentViolation("advance", "Scale the pilot to production")).toBeNull();
    expect(intentViolation("examine", "Review the shortlist this quarter")).toBeNull();
  });

  // Softening understates the evidence, which is a worse product and not a
  // safety failure. Rejecting it would discard sound prose for nothing.
  it("allows a commitment to be softened", () => {
    expect(intentViolation("advance", "Review before scaling")).toBeNull();
  });

  it("allows a neutral rewrite that carries no direction at all", () => {
    expect(intentViolation("restrain", "Governance first")).toBeNull();
  });

  // The case that proves the intent has to be declared rather than inferred.
  it("reads an ambiguous imperative as the committed one, which fails safe", () => {
    // "Clear open risks before widening" is restraint and contains the word
    // widening. A classifier cannot know that, so it takes the cautious
    // reading and the builder declares the true one.
    expect(actionIntent("Clear open risks before widening")).toBe("advance");
  });
});

// -------------------------------------------------------- semantic direction

describe("semantic direction", () => {
  // 8.
  it("cannot turn falling into rising", () => {
    const claims = claimsFrom("Prices are falling across the tracked set.");
    expect(claims).toEqual([{ family: "trend", pole: "down" }]);
    expect(reversedClaims("Prices are rising across the set.", claims)).toHaveLength(1);
    expect(reversedClaims("Prices are still falling.", claims)).toHaveLength(0);
  });

  // 9.
  it("cannot turn narrowing into widening", () => {
    const claims = claimsFrom("The capability spread is narrowing.");
    expect(claims).toEqual([{ family: "spread", pole: "narrowing" }]);
    expect(reversedClaims("The gap is widening.", claims)).toHaveLength(1);
    expect(reversedClaims("The gap keeps narrowing.", claims)).toHaveLength(0);
  });

  // 10.
  it("cannot turn gaining into slipping", () => {
    const claims = claimsFrom("Four vendors are gaining position.");
    expect(claims).toEqual([{ family: "position", pole: "gaining" }]);
    expect(reversedClaims("Four vendors are slipping.", claims)).toHaveLength(1);
  });

  it("cannot turn concentrating into fragmenting", () => {
    const claims = claimsFrom("Supply is concentrating in three vendors.");
    expect(reversedClaims("Supply is fragmenting.", claims)).toHaveLength(1);
  });

  it("cannot reverse the direction of travel the judgement states", () => {
    // How pulseJudgement() actually writes it: "up 1.2 on the previous reading".
    const claims = claimsFrom("Capability averages 58.7, up 1.2 on the previous reading.");
    expect(claims).toContainEqual({ family: "trend", pole: "up" });
    expect(reversedClaims("Capability is declining.", claims)).toHaveLength(1);
  });

  // Without this the check would reject every honest rewrite of a mixed
  // picture, which is most of them.
  it("claims no direction where the canonical text names both ends", () => {
    expect(claimsFrom("Three vendors gaining, two slipping.")).toEqual([]);
    expect(
      reversedClaims("Two are slipping.", claimsFrom("Three gaining, two slipping."))
    ).toHaveLength(0);
  });

  it("leaves a sentence that names both ends alone", () => {
    const claims = claimsFrom("The capability spread is narrowing.");
    expect(
      reversedClaims(
        "The capability gap is narrowing even as the price gap widens.",
        claims
      )
    ).toHaveLength(0);
  });

  it("does not fire on a bare up or down in ordinary prose", () => {
    expect(claimsFrom("Up to three vendors are affected.")).toEqual([]);
    expect(claimsFrom("Scroll down for the detail.")).toEqual([]);
  });

  it("says nothing about text carrying no direction at all", () => {
    expect(claimsFrom("Forty-seven vendors are tracked in this category.")).toEqual([]);
  });
});

// ------------------------------------------------------------- count claims

describe("small-integer data claims", () => {
  const FACTS =
    "Mean 75.8 across 28 vendors, spread 13.7. 3 vendors clear the threshold.";

  // 4.
  it("rejects a vendor count the data never supplied", () => {
    expect(unsupportedCounts("7 vendors meet the threshold.", FACTS)).toEqual([
      "7 vendors",
    ]);
    expect(guard("7 vendors meet the threshold.", FACTS)).toBe(false);
  });

  // 5.
  it("passes a vendor count the data did supply", () => {
    expect(unsupportedCounts("3 vendors clear it.", FACTS)).toEqual([]);
    expect(guard("3 vendors clear it.", FACTS)).toBe(true);
  });

  // 7.
  it("rejects unsupported counts of models, providers and workloads", () => {
    expect(guard("5 models are affected.", FACTS)).toBe(false);
    expect(guard("2 providers hold the market.", FACTS)).toBe(false);
    expect(guard("9 workloads are in scope.", FACTS)).toBe(false);
    expect(invented("4 integrators can deliver.", FACTS)).toContain(
      "4 integrators"
    );
  });

  it("catches a count separated from its noun by a describing word", () => {
    expect(guard("6 tracked vendors clear it.", FACTS)).toBe(false);
    expect(guard("8 frontier model providers lead.", FACTS)).toBe(false);
  });

  // 6. The exemption that keeps the copy usable.
  it("does not fire on structural list numbering", () => {
    expect(guard("1. Tier your spend. 2. Re-open shortlists. 3. Clear risks.", FACTS)).toBe(true);
    expect(countClaims("1. Tier your spend. 2. Re-open shortlists.").size).toBe(0);
  });

  it("does not fire on counts of things the datasets do not hold", () => {
    // The two shipped tests that depend on this: "do these 3 things" and
    // "2 of 3 inputs" are prose, not claims about the data.
    expect(guard("There are 3 things to do.", FACTS)).toBe(true);
    expect(guard("2 of 3 inputs are present.", FACTS)).toBe(true);
    expect(guard("Three steps, in 2 stages.", FACTS)).toBe(true);
  });

  it("leaves larger counts to the existing numeric guard, without double reporting", () => {
    // 28 is in the facts and above the small-integer window either way.
    expect(unsupportedCounts("28 vendors are tracked.", FACTS)).toEqual([]);
    expect(guard("28 vendors are tracked.", FACTS)).toBe(true);
    // 40 is not in the facts, and must be reported once, by numbersIn.
    expect(invented("40 vendors are tracked.", FACTS)).toEqual(["40"]);
  });

  it("does not read a decimal's digits as a count", () => {
    expect(countClaims("Spread 13.7 across the vendors").size).toBe(0);
  });
});

// -------------------------------------------------------- entity grounding

describe("entity grounding is packet-scoped", () => {
  const roster = ["OpenAI", "Anthropic", "Harvey", "Meta", "Cohere"];
  const facts =
    "Vendors this page covers: Harvey, Cohere. Unlike Anthropic, Harvey is vertical.";

  // 11. The strengthening. Anthropic appears in the fact prose incidentally,
  // and the page never claimed to cover it.
  it("refuses a vendor outside the packet even when the prose mentions it", () => {
    expect(
      foreignEntities("Anthropic leads on capability.", facts, roster, [
        "Harvey",
        "Cohere",
      ])
    ).toEqual(["Anthropic"]);
  });

  it("allows the vendors the packet declared", () => {
    expect(
      foreignEntities("Harvey leads, with Cohere behind.", facts, roster, [
        "Harvey",
        "Cohere",
      ])
    ).toEqual([]);
  });

  // Several pages declare no covered set. Treating that as an empty allow-list
  // would reject every vendor name on them, which is a worse product and not a
  // safer one.
  it("falls back to fact grounding when the packet declares nothing", () => {
    expect(foreignEntities("Anthropic is vertical.", facts, roster, [])).toEqual([]);
    expect(foreignEntities("Anthropic is vertical.", facts, roster)).toEqual([]);
    expect(foreignEntities("OpenAI leads.", facts, roster, null)).toEqual(["OpenAI"]);
  });
});

// ------------------------------------------------------------- fallbacks

describe("the deterministic layer owns the decision", () => {
  const KEY = process.env.ANTHROPIC_API_KEY;
  afterEach(() => {
    if (KEY === undefined) delete process.env.ANTHROPIC_API_KEY;
    else process.env.ANTHROPIC_API_KEY = KEY;
  });

  const COMPUTED = [
    {
      action: "Clear open risks before widening",
      detail: "Two high-severity risks are open. Get a dated position on each.",
      intent: "restrain" as ActionIntent,
    },
  ];

  // 13.
  it("returns the deterministic actions when the model is unavailable", async () => {
    delete process.env.ANTHROPIC_API_KEY;
    const out = await authorActions(COMPUTED, "risks open");
    expect(out.authorship).toBe("computed");
    expect(out.value[0].action).toBe("Clear open risks before widening");
  });

  const INSUFFICIENT: AnalystInsightData = {
    headline: "Not enough evidence to draw a conclusion",
    summary: "The dataset does not reach this question.",
    implications: [],
    action: "Monitor",
    news: null,
    evidence: { count: 0, sources: [], lastUpdated: null, lane: "derived" },
    insufficient: "No vendor in this category carries enough evidence.",
  };

  // 14, at the surface rather than the classifier. The model is never given an
  // insufficient page to write, so it cannot upgrade one.
  it("never sends an insufficient-evidence reading to the model", async () => {
    process.env.ANTHROPIC_API_KEY = "not-a-real-key";
    const out = await authorInsight(INSUFFICIENT, "test", []);
    expect(out.authorship).toBe("computed");
    expect(out.value.action).toBe("Monitor");
    expect(out.value.headline).toBe(INSUFFICIENT.headline);
  });

  // 13, for the insight surface.
  it("returns the deterministic reading when no model is configured", async () => {
    delete process.env.ANTHROPIC_API_KEY;
    const sound: AnalystInsightData = { ...INSUFFICIENT, insufficient: null };
    const out = await authorInsight(sound, "test", []);
    expect(out.authorship).toBe("computed");
    expect(out.value.action).toBe("Monitor");
  });
});

// 12. The whole point of failing safe is that it must not fire on sound work.
describe("grounded output still passes", () => {
  const FACTS =
    "Capability averages 58.7 across 47 vendors. Reputation 76.3. Spread 14.8. 3 vendors lead.";

  it("passes a realistic grounded reading untouched", () => {
    const written =
      "Capability averages 58.7 across the 47 vendors tracked, and the 14.8 spread is the number that matters: the gap between the best model and an adequate one is narrower than the price gap between them. 3 vendors lead on reputation at 76.3.";
    expect(guard(written, FACTS)).toBe(true);
    expect(invented(written, FACTS)).toEqual([]);
  });

  it("passes a reading that carries no figures at all", () => {
    expect(
      guard("Capability has commoditised faster than price, and procurement has not caught up.", FACTS)
    ).toBe(true);
  });

  it("does not treat an honest interpretation as a reversal", () => {
    const claims = claimsFrom("The capability spread is narrowing.");
    expect(
      reversedClaims(
        "A narrowing spread means the buying decision has moved to governance and unit economics.",
        claims
      )
    ).toHaveLength(0);
  });
});
