import { describe, it, expect, afterEach } from "vitest";
import {
  decide,
  resolveAction,
  strengthOf,
  type DecisionEvidence,
} from "@/lib/analyst/decision";
import {
  financialInsight,
  peerInsight,
  pricePerformanceInsight,
  supplyMapInsight,
  workflowInsight,
  type AnalystInsightData,
} from "@/lib/analyst/insight";
import { authorInsight, isSpecific, mergeDecision } from "@/lib/analyst/author";
import { invented } from "@/lib/analyst/llm";

// The decision packet.
//
// Every insight in this product ends in one of eight canonical actions.
// "Investigate" is defensible and it is a direction of travel, not something a
// reader can do on Tuesday. The packet says what to do, why now, what argues
// against it, and what should change their mind.
//
// These pin the rules, not the sentences. Which words a builder reaches for
// changes with the data; what must not change is that an actionable page
// carries an instruction saying more than its own action label, that
// contradictory evidence survives to the reader, and that thin evidence
// cannot produce a confident recommendation.

// Real builders over real inputs. Every one of these takes primitives rather
// than MarketMetrics, so the packets under test are the shipped ones and not
// a fixture written to pass.
const PRICE_WIDE = pricePerformanceInsight(
  { models: 42, vendors: 11, ratio: 12, adequate: 9 },
  null,
  "2026-08-20"
);
const PRICE_NARROW = pricePerformanceInsight(
  { models: 42, vendors: 11, ratio: 2, adequate: 9 },
  null,
  "2026-08-20"
);
const WORKFLOW_LOW_RISK = workflowInsight(
  { workflows: 75, categories: 12, highRisk: 9, mapped: 10 },
  null,
  "2026-08-20"
);
const WORKFLOW_HIGH_RISK = workflowInsight(
  { workflows: 75, categories: 12, highRisk: 44, mapped: 10 },
  null,
  "2026-08-20"
);
const SUPPLY_NARROW = supplyMapInsight(
  {
    edges: 60,
    verified: 12,
    seed: 0,
    nodes: 14,
    label: "alliance",
    breadth: [
      { vendor: "Anthropic", partners: 5 },
      { vendor: "Cohere", partners: 1 },
    ],
    busiest: { partner: "Accenture", vendors: 9 },
  },
  null,
  "2026-08-20"
);
const FINANCIAL = financialInsight(
  null,
  { disclosing: 6, total: 28 },
  4,
  28,
  "2026-08-20"
);
const PEER = peerInsight(
  {
    segments: 15,
    workflows: 75,
    horizontal: 48,
    categories: 12,
    segmentsWithSpecific: 11,
  },
  null,
  "2026-08-20"
);

const ACTIONABLE: [string, AnalystInsightData][] = [
  ["price/performance, wide", PRICE_WIDE],
  ["price/performance, narrow", PRICE_NARROW],
  ["workflow, low risk", WORKFLOW_LOW_RISK],
  ["workflow, high risk", WORKFLOW_HIGH_RISK],
  ["supply map, sole sourced", SUPPLY_NARROW],
  ["financial, mostly undisclosed", FINANCIAL],
  ["peer insights", PEER],
];

// ------------------------------------------------------------ specificity

describe("every actionable decision says what to do", () => {
  // 1.
  it("carries a packet with an instruction and a why now", () => {
    for (const [name, insight] of ACTIONABLE) {
      expect(insight.insufficient, name).toBeNull();
      expect(insight.decision, name).not.toBeNull();
      expect(insight.decision!.instruction.trim().length, name).toBeGreaterThan(0);
      expect(insight.decision!.whyNow.trim().length, name).toBeGreaterThan(0);
    }
  });

  // 2. The failure this whole packet exists to fix. "Investigate alternatives"
  // is the action label with a noun stuck on it and tells a reader nothing.
  it("says materially more than the action label does", () => {
    for (const [name, insight] of ACTIONABLE) {
      const d = insight.decision!;
      expect(isSpecific(d.instruction, d.action), `${name}: ${d.instruction}`).toBe(
        true
      );
      // Not merely the label, and not the label plus a word.
      expect(d.instruction.toLowerCase().trim(), name).not.toBe(
        d.action.toLowerCase()
      );
      expect(d.instruction.trim().split(/\s+/).length, name).toBeGreaterThanOrEqual(8);
    }
  });

  it("names something concrete rather than a direction of travel", () => {
    // A figure, a named thing or a deadline. An instruction with none of the
    // three has not said anything the action did not.
    for (const [name, insight] of ACTIONABLE) {
      const d = insight.decision!;
      const concrete =
        /\d/.test(d.instruction) ||
        /\b(before|after|until|per cent|renewal|shortlist|quote|filing|reference)\b/i.test(
          d.instruction
        );
      expect(concrete, `${name}: ${d.instruction}`).toBe(true);
    }
  });
});

// ---------------------------------------------------------- grounded prose

describe("why now and the trigger stay inside the evidence", () => {
  /** The facts a packet is entitled to draw a figure from. */
  const supplied = (insight: AnalystInsightData) => {
    const d = insight.decision!;
    return [
      ...d.evidenceFor.map((e) => e.claim),
      ...d.evidenceAgainst.map((e) => e.claim),
      d.instruction,
      insight.summary,
    ].join(" ");
  };

  // 3.
  it("derives why now from the evidence rather than introducing figures", () => {
    for (const [name, insight] of ACTIONABLE) {
      expect(invented(insight.decision!.whyNow, supplied(insight)), name).toEqual(
        []
      );
    }
  });

  // 8.
  it("does not let the trigger introduce an unsupported fact", () => {
    for (const [name, insight] of ACTIONABLE) {
      const trigger = insight.decision!.trigger;
      if (!trigger) continue;
      expect(invented(trigger, supplied(insight)), `${name}: ${trigger}`).toEqual(
        []
      );
    }
  });

  it("does not let the do-not introduce an unsupported fact", () => {
    for (const [name, insight] of ACTIONABLE) {
      const doNot = insight.decision!.doNotDo;
      if (!doNot) continue;
      expect(invented(doNot, supplied(insight)), `${name}: ${doNot}`).toEqual([]);
    }
  });
});

// -------------------------------------------------------------- contradiction

describe("contradictory evidence", () => {
  // 4. Price/performance prices input tokens only, and the catalogue holds no
  // output prices. That limit argues against the tiering recommendation and
  // has to reach the reader rather than being smoothed away.
  it("is retained on the packet rather than dropped", () => {
    expect(PRICE_WIDE.decision!.evidenceAgainst.length).toBeGreaterThan(0);
    expect(
      PRICE_WIDE.decision!.evidenceAgainst.some((e) =>
        /input tokens only/i.test(e.claim)
      )
    ).toBe(true);
    expect(SUPPLY_NARROW.decision!.evidenceAgainst.length).toBeGreaterThan(0);
  });

  it("moves the recommendation to contested", () => {
    expect(PRICE_WIDE.decision!.strength).toBe("contested");
    expect(WORKFLOW_LOW_RISK.decision!.strength).toBe("corroborated");
  });

  // 5. The prompt's own example: one signal supports the move, another shows
  // the risk, so the answer is to look rather than to go.
  it("prevents an inappropriate escalation", () => {
    const supportsSwitching: DecisionEvidence[] = [
      {
        claim: "The cheapest qualifying model costs 12 times less than the top model.",
        source: "Vendor pricing pages",
        basis: "disclosed",
        lane: "derived",
      },
      {
        claim: "9 models reach 80 per cent of the top benchmark score.",
        source: "Artificial Analysis benchmark",
        basis: "measured",
        lane: "derived",
      },
    ];
    const implementationRisk: DecisionEvidence[] = [
      {
        claim: "Only one delivery firm carries this vendor.",
        source: "AIE exposure map",
        basis: "measured",
        lane: "aie",
      },
    ];

    const uncontested = decide({
      action: "Accelerate",
      instruction: "Move the workloads that do not need the top model down a tier.",
      whyNow: "The cheapest qualifying model costs 12 times less.",
      evidenceFor: supportsSwitching,
    });
    expect(uncontested.action).toBe("Accelerate");

    const contested = decide({
      action: "Accelerate",
      instruction: "Move the workloads that do not need the top model down a tier.",
      whyNow: "The cheapest qualifying model costs 12 times less.",
      evidenceFor: supportsSwitching,
      evidenceAgainst: implementationRisk,
    });
    expect(contested.strength).toBe("contested");
    expect(contested.action).toBe("Investigate");
    // And the contradiction is still on the packet, not consumed by the guard.
    expect(contested.evidenceAgainst).toEqual(implementationRisk);
  });

  // Caution is not downgraded by a mixed picture. Weakening a Pause because
  // the evidence is contested pushes a reader toward action on exactly the
  // evidence saying be careful.
  it("does not weaken a restraining action on contested evidence", () => {
    expect(resolveAction("Pause", "contested")).toBe("Pause");
    expect(resolveAction("Reduce exposure", "contested")).toBe("Reduce exposure");
    expect(resolveAction("Investigate", "single signal")).toBe("Investigate");
    expect(resolveAction("Renegotiate", "single signal")).toBe("Renegotiate");
  });
});

// ------------------------------------------------------------- strength

describe("evidence strength is a state, never a score", () => {
  const one: DecisionEvidence = {
    claim: "a",
    source: "AIE workflow catalogue",
    basis: "measured",
    lane: "aie",
  };
  const alsoOne: DecisionEvidence = { ...one, claim: "b" };
  const other: DecisionEvidence = { ...one, claim: "c", source: "SEC filings" };

  it("counts independence by distinct source, not by number of readings", () => {
    // Three figures out of one dataset is one signal read three ways.
    expect(strengthOf([one, alsoOne], [])).toBe("single signal");
    expect(strengthOf([one, other], [])).toBe("corroborated");
  });

  it("treats any countervailing evidence as contested", () => {
    expect(strengthOf([one, other], [alsoOne])).toBe("contested");
  });

  it("reports insufficient when nothing supports a recommendation", () => {
    expect(strengthOf([], [])).toBe("insufficient");
    expect(strengthOf([], [one])).toBe("insufficient");
  });

  // 6.
  it("cannot produce a committing action on thin evidence", () => {
    expect(resolveAction("Accelerate", "single signal")).toBe("Investigate");
    expect(resolveAction("Expand", "single signal")).toBe("Investigate");
    expect(resolveAction("Accelerate", "contested")).toBe("Investigate");
    expect(resolveAction("Accelerate", "insufficient")).toBe("Monitor");
    expect(resolveAction("Accelerate", "corroborated")).toBe("Accelerate");
  });

  it("holds a shipped builder to it", () => {
    // The low-risk workflow branch proposes Accelerate. It survives only
    // because the catalogue and the vendor mapping are two sources; on one it
    // would have been downgraded, which is the intended behaviour.
    expect(WORKFLOW_LOW_RISK.decision!.strength).toBe("corroborated");
    expect(WORKFLOW_LOW_RISK.decision!.action).toBe("Accelerate");
    const thin = decide({
      action: "Accelerate",
      instruction: WORKFLOW_LOW_RISK.decision!.instruction,
      whyNow: WORKFLOW_LOW_RISK.decision!.whyNow,
      evidenceFor: [WORKFLOW_LOW_RISK.decision!.evidenceFor[0]],
    });
    expect(thin.action).toBe("Investigate");
  });

  it("never publishes a numeric confidence anywhere on a packet", () => {
    for (const [name, insight] of ACTIONABLE) {
      const d = insight.decision!;
      const text = `${d.instruction} ${d.whyNow} ${d.trigger ?? ""} ${d.doNotDo ?? ""}`;
      expect(text, name).not.toMatch(/\b\d{1,3}\s*%\s*(confiden|certain)/i);
      expect(text, name).not.toMatch(/confidence (score|level|of)/i);
    }
  });
});

// ------------------------------------------------------ insufficient state

describe("insufficient evidence", () => {
  // 7.
  it("still produces the insufficient state and no packet", () => {
    const noRatio = pricePerformanceInsight(
      { models: 0, vendors: 0, ratio: null, adequate: 0 },
      null,
      null
    );
    expect(noRatio.insufficient).not.toBeNull();
    expect(noRatio.decision).toBeNull();

    const noEdges = supplyMapInsight(
      { edges: 0, verified: 0, seed: 0, nodes: 0, label: "alliance" },
      null,
      null
    );
    expect(noEdges.insufficient).not.toBeNull();
    expect(noEdges.decision).toBeNull();
  });

  it("does not invent a recommendation to fill the panel", () => {
    const empty = peerInsight(
      {
        segments: 0,
        workflows: 0,
        horizontal: 0,
        categories: 0,
        segmentsWithSpecific: 0,
      },
      null,
      null
    );
    expect(empty.decision).toBeNull();
    expect(empty.action).toBe("Monitor");
  });
});

// -------------------------------------------------------------- authoring

describe("the model is the pen, not the decision engine", () => {
  const KEY = process.env.ANTHROPIC_API_KEY;
  afterEach(() => {
    if (KEY === undefined) delete process.env.ANTHROPIC_API_KEY;
    else process.env.ANTHROPIC_API_KEY = KEY;
  });

  const CANONICAL = PRICE_WIDE.decision!;

  // 9. Structural: the action is read off the computed packet and the draft
  // has nowhere to put one.
  it("cannot change the canonical action", () => {
    const merged = mergeDecision(CANONICAL, {
      instruction: "Accelerate the rollout across every workload immediately.",
      whyNow: "anything",
    } as { instruction: string; whyNow: string });
    expect(merged!.action).toBe(CANONICAL.action);
  });

  it("refuses an instruction that contradicts the canonical action", () => {
    // Renegotiate is provisional; committing is a strengthening of it.
    const merged = mergeDecision(CANONICAL, {
      instruction: "Expand the deployment across every team this quarter now.",
      whyNow: "x",
    });
    expect(merged!.instruction).toBe(CANONICAL.instruction);
  });

  it("refuses an instruction that collapses back into the action label", () => {
    const merged = mergeDecision(CANONICAL, { instruction: "Renegotiate." });
    expect(merged!.instruction).toBe(CANONICAL.instruction);
    expect(isSpecific("Renegotiate.", "Renegotiate")).toBe(false);
  });

  it("accepts a rewrite that keeps the instruction and says it better", () => {
    const better =
      "Take the 12x input-price gap to the incumbent before the renewal date and move the undemanding workloads down a tier.";
    const merged = mergeDecision(CANONICAL, { instruction: better });
    expect(merged!.instruction).toBe(better);
  });

  // 10. The model never holds the evidence, so there is no path by which it
  // can drop it. Asserted rather than assumed.
  it("cannot remove or alter contradictory evidence", () => {
    const merged = mergeDecision(CANONICAL, {
      instruction: "Move the undemanding workloads down a tier before renewal.",
      whyNow: "x",
    });
    expect(merged!.evidenceAgainst).toEqual(CANONICAL.evidenceAgainst);
    expect(merged!.evidenceFor).toEqual(CANONICAL.evidenceFor);
    expect(merged!.strength).toBe(CANONICAL.strength);
    expect(merged!.trigger).toBe(CANONICAL.trigger);
    expect(merged!.doNotDo).toBe(CANONICAL.doNotDo);
  });

  // 11.
  it("retains a complete usable packet when the model is unavailable", async () => {
    delete process.env.ANTHROPIC_API_KEY;
    const out = await authorInsight(PRICE_WIDE, "price-performance", []);
    expect(out.authorship).toBe("computed");
    expect(out.value.decision).toEqual(CANONICAL);
    expect(out.value.decision!.instruction).toBe(CANONICAL.instruction);
    expect(out.value.decision!.trigger).toBe(CANONICAL.trigger);
  });

  it("retains the packet when the draft returns nothing usable", () => {
    expect(mergeDecision(CANONICAL, null)).toEqual(CANONICAL);
    expect(mergeDecision(CANONICAL, {})).toEqual(CANONICAL);
    expect(mergeDecision(CANONICAL, { instruction: "   " })).toEqual(CANONICAL);
    expect(mergeDecision(null, { instruction: "anything at all here" })).toBeNull();
  });

  // 12.
  it("leaves provenance untouched", async () => {
    delete process.env.ANTHROPIC_API_KEY;
    const out = await authorInsight(PRICE_WIDE, "price-performance", []);
    expect(out.value.evidence).toEqual(PRICE_WIDE.evidence);
    expect(out.value.evidence.lane).toBe("derived");
    expect(out.value.evidence.sources).toEqual(PRICE_WIDE.evidence.sources);
    // And every packet's evidence carries its own source, basis and lane.
    for (const [name, insight] of ACTIONABLE) {
      for (const e of [
        ...insight.decision!.evidenceFor,
        ...insight.decision!.evidenceAgainst,
      ]) {
        expect(e.source.length, name).toBeGreaterThan(0);
        expect(["measured", "modelled", "disclosed", "absent"], name).toContain(
          e.basis
        );
        expect(e.lane.length, name).toBeGreaterThan(0);
      }
    }
  });
});
