import { describe, it, expect } from "vitest";
import { opportunitiesFor } from "@/lib/position/opportunities";
import { alignment, bestAlignment, stem, documentFrequency, isDistinctive } from "@/lib/position/workflow-match";
import { USE_CASES } from "@/lib/aie/use-cases";
import type { SavedPosition } from "@/lib/position/store";
import type { AiClaim } from "@/lib/research/company";

// Can this thing recognise real evidence, and does it still refuse everything
// that only looks like it?
//
// WHY THIS FILE EXISTS. Six live company research runs produced zero EVIDENCED
// workflows. That may be a correct reading of those six runs, and the honest
// position is that it proves only one half of the contract: the engine is
// conservative. A classifier that returns "no" to everything is conservative
// too, and useless. So every positive control below is paired with the nearest
// wrong answer to it, because the distance between "runs fraud detection" and
// "plans to run fraud detection" is the entire product.
//
// The passages are written to read like retrieved source text rather than like
// catalogue labels, so the matcher has to recognise the ACTIVITY and not the
// name of the workflow.

const uc = (id: string) => USE_CASES.find((u) => u.id === id)!;

const position = (
  statements: { text: string; claim?: Partial<AiClaim> }[],
  sectorTag = "financial_services"
): SavedPosition => ({
  key: "co",
  query: "Co",
  name: "Co",
  what: "a company",
  industry: "x",
  sectorTag,
  aiFindings: statements.map((s) => s.text),
  findings: [],
  recommendations: [],
  evidence: {
    sources: [
      { url: "https://www.sec.gov/x", evidenceType: "regulatory_filing" },
      { url: "https://www.reuters.com/x", evidenceType: "primary_reporting" },
    ],
    statements: statements.map((s) => ({
      text: s.text,
      sourceIndex: 0,
      claim: s.claim
        ? { subject: "company", status: "DEPLOYED", capability: "", ...s.claim }
        : undefined,
    })),
    financials: [],
  },
  savedAt: "2026-08-30",
});

/** The classification a passage produces for one named workflow. */
const classOf = (
  id: string,
  text: string,
  claim?: Partial<AiClaim>,
  sectorTag?: string
): string => {
  const opp = opportunitiesFor(
    position([{ text, claim }], sectorTag ?? sectorFor(id))
  );
  return opp?.areas.find((a) => a.id === id)?.basis ?? "absent";
};

/** A sector that actually carries the workflow, so the area is on the list. */
function sectorFor(id: string): string {
  const inds = uc(id).industries ?? [];
  return inds.length === 0 ? "financial_services" : inds[0];
}

// ============================================================ PART 6: positives

describe("A. deployed fraud detection", () => {
  const said =
    "The bank runs machine learning models that score every card payment in real time and hold suspected fraudulent transactions for review.";

  it("recognises the workflow from the activity, not the label", () => {
    // The passage never writes "Transaction Fraud Detection".
    expect(said.toLowerCase()).not.toContain("fraud detection");
    expect(classOf("fraud_detection", said, { status: "DEPLOYED" })).toBe("evidenced");
  });

  it("keeps the passage and its source on the classification", () => {
    const opp = opportunitiesFor(position([{ text: said, claim: { status: "DEPLOYED" } }]))!;
    const area = opp.areas.find((a) => a.id === "fraud_detection")!;
    expect(area.evidence).toBe(said);
    expect(area.evidenceStatus).toBe("deployed");
    expect(area.companyEvidence[0].sourceIndex).toBe(0);
    expect(area.companyEvidence[0].evidenceType).toBe("regulatory_filing");
    expect(area.evidenceWhy).toBeTruthy();
  });
});

describe("B. pilot customer-service AI", () => {
  const said =
    "The retailer is piloting an AI customer service agent that resolves routine queries with human escalation on two of its brands.";

  it("treats a pilot as current practice, because a pilot is running", () => {
    expect(classOf("customer_service_agent", said, { status: "PILOT" })).toBe("evidenced");
  });

  it("records it as a pilot rather than as a full deployment", () => {
    const opp = opportunitiesFor(
      position([{ text: said, claim: { status: "PILOT" } }], "retail_consumer")
    )!;
    expect(opp.areas.find((a) => a.id === "customer_service_agent")!.evidenceStatus).toBe("pilot");
  });
});

describe("C. deployed demand forecasting", () => {
  const said =
    "Demand forecasting models now generate SKU-level forecasts that feed the group's weekly replenishment planning.";

  it("recognises it", () => {
    expect(classOf("demand_forecasting", said, { status: "DEPLOYED" })).toBe("evidenced");
  });
});

describe("D. deployed developer AI", () => {
  const said =
    "Every engineer has an in-IDE code assistant generating completions and refactors against the company's own source code.";

  it("recognises it", () => {
    expect(classOf("code_assistant", said, { status: "DEPLOYED" })).toBe("evidenced");
  });
});

// ============================================== PART 7: near-neighbour negatives
//
// Each of these is one word away from a positive above. That contrast is the
// test; adding more keyword rules is not.

describe("what must never be EVIDENCED", () => {
  const near = (text: string, claim?: Partial<AiClaim>) =>
    classOf("fraud_detection", text, claim);

  it("a plan", () => {
    expect(
      near("The bank plans to deploy models that score card payments for fraud in real time.", {
        status: "PLANNED",
      })
    ).not.toBe("evidenced");
  });

  it("an exploration", () => {
    expect(
      near("The bank is exploring machine learning that would score card payments for fraud.", {
        status: "EXPLORING",
      })
    ).not.toBe("evidenced");
  });

  it("a subject mentioned without the work", () => {
    expect(near("The bank says card payment fraud is a material risk to the group.")).not.toBe(
      "evidenced"
    );
  });

  it("a competitor's deployment", () => {
    expect(
      near("A rival bank runs machine learning models that score card payments for fraud in real time.", {
        subject: "competitor",
      })
    ).not.toBe("evidenced");
  });

  it("a vendor's product", () => {
    // What a supplier sells is not what a buyer runs.
    expect(
      near("The vendor offers a product that scores card payments for fraud in real time.", {
        subject: "vendor",
      })
    ).not.toBe("evidenced");
  });

  it("a denial", () => {
    expect(
      near("The bank has not deployed any model that scores card payments for fraud.", {
        status: "NEGATED",
      })
    ).not.toBe("evidenced");
  });

  it("the industry rather than the company", () => {
    expect(
      near("Many banks run machine learning models that score card payments for fraud in real time.", {
        subject: "sector",
      })
    ).not.toBe("evidenced");
  });

  it("company-wide AI enthusiasm, which evidences no workflow at all", () => {
    const opp = opportunitiesFor(
      position([
        {
          text: "The group has more than 250 artificial intelligence tools and models already in use across every division.",
          claim: { status: "DEPLOYED" },
        },
      ])
    )!;
    expect(opp.evidencedCount).toBe(0);
  });

  it("a vendor partnership, which is a contract and not a capability", () => {
    const opp = opportunitiesFor(
      position([
        {
          text: "The group has signed a three-year agreement with a model vendor giving it full access to that vendor's commercial models.",
          claim: { status: "DEPLOYED" },
        },
      ])
    )!;
    expect(opp.evidencedCount).toBe(0);
  });

  it("a job advert for AI governance", () => {
    const opp = opportunitiesFor(
      position([
        {
          text: "The group is recruiting a Lead Product Manager for AI Governance and Adoption to own safe and compliant use of AI.",
          claim: { status: "DEPLOYED" },
        },
      ])
    )!;
    expect(opp.evidencedCount).toBe(0);
  });
});

// ============================== the model proposes, the sentence disposes

describe("the model is never the final authority", () => {
  const said = "The bank plans to deploy models that score card payments for fraud in real time.";

  it("overrules a model claiming DEPLOYED over a sentence that says plans to", () => {
    // The whole point of validating rather than trusting: the extraction can be
    // wrong, and the sentence is still there to check it against.
    expect(classOf("fraud_detection", said, { status: "DEPLOYED" })).not.toBe("evidenced");
  });

  it("takes the model's word when the model is the stricter of the two", () => {
    const running =
      "The bank runs machine learning models that score every card payment in real time for fraud.";
    expect(classOf("fraud_detection", running, { status: "DEPLOYED" })).toBe("evidenced");
    expect(classOf("fraud_detection", running, { status: "PLANNED" })).not.toBe("evidenced");
  });

  it("refuses a statement with no source to trace it to", () => {
    // Provenance is a condition of the classification, not a decoration on it.
    const p = position([{ text: "The bank runs machine learning models that score every card payment in real time for fraud." }]);
    p.evidence!.statements = p.evidence!.statements.map((s) => ({ ...s, sourceIndex: -1 }));
    const opp = opportunitiesFor(p)!;
    expect(opp.evidencedCount).toBe(0);
  });

  it("evidences from the sentence alone where no structured claim exists", () => {
    // Every position saved before the structured claim existed. The sentence is
    // still the evidence, so it is still judged, and it can still qualify.
    expect(
      classOf(
        "fraud_detection",
        "The bank runs machine learning models that score every card payment in real time for fraud."
      )
    ).toBe("evidenced");
  });
});

// ================================================ PART 8: adjacent workflows

describe("semantically adjacent workflows do not cross-map", () => {
  const only = (text: string, want: string, notThese: string[]) => {
    const best = bestAlignment(text, USE_CASES);
    expect(best?.uc.id, `${text} -> ${best?.uc.id}`).toBe(want);
    for (const other of notThese) {
      expect(alignment(text, uc(other)).aligned, `${want} leaked into ${other}`).toBe(false);
    }
  };

  it("payment fraud is not general cyber threat detection", () => {
    only(
      "The bank runs models that score every card payment in real time and hold suspected fraudulent transactions.",
      "fraud_detection",
      ["endpoint_security_triage", "vulnerability_triage"]
    );
  });

  it("cyber alert triage is not payment fraud", () => {
    const said =
      "The security team uses a model to score EDR and SIEM alerts, suggest containment and draft tickets.";
    expect(alignment(said, uc("fraud_detection")).aligned).toBe(false);
    expect(alignment(said, uc("endpoint_security_triage")).aligned).toBe(true);
  });

  it("demand forecasting is not pricing optimisation", () => {
    only(
      "Demand forecasting models generate SKU-level forecasts feeding weekly replenishment.",
      "demand_forecasting",
      ["pricing_optimisation"]
    );
  });

  it("pricing optimisation is not demand forecasting", () => {
    const said = "A model recommends deal-specific discount levels against margin floors on every quote.";
    expect(alignment(said, uc("pricing_optimisation")).aligned).toBe(true);
    expect(alignment(said, uc("demand_forecasting")).aligned).toBe(false);
  });

  it("a developer copilot is not an enterprise knowledge assistant", () => {
    const said = "Engineers use in-IDE completions and refactors against the source code.";
    expect(alignment(said, uc("code_assistant")).aligned).toBe(true);
    expect(alignment(said, uc("knowledge_assistant")).aligned).toBe(false);
  });

  it("an enterprise knowledge assistant is not a developer copilot", () => {
    const said =
      "Staff query a knowledge assistant that answers over internal wikis and returns citations.";
    expect(alignment(said, uc("knowledge_assistant")).aligned).toBe(true);
    expect(alignment(said, uc("code_assistant")).aligned).toBe(false);
  });

  it("one passage evidences at most the workflow it describes", () => {
    const opp = opportunitiesFor(
      position([
        {
          text: "The bank runs machine learning models that score every card payment in real time and hold suspected fraudulent transactions for review.",
          claim: { status: "DEPLOYED" },
        },
      ])
    )!;
    expect(opp.evidencedCount).toBe(1);
  });
});

// ================================================= how the matcher decides

describe("the matcher's own machinery", () => {
  it("reduces a word only as far as another form of it", () => {
    expect(stem("detection")).toBe(stem("detect"));
    expect(stem("forecasting")).toBe(stem("forecast"));
    expect(stem("pricing")).toBe(stem("price"));
    // And does not collapse words that mean different things.
    expect(stem("audit")).not.toBe(stem("auditor"));
    expect(stem("fraud")).not.toBe(stem("fraudulent"));
  });

  it("measures distinctiveness from the catalogue rather than declaring it", () => {
    // Nobody maintains this and it cannot drift from the library, because it is
    // derived from the library.
    expect(documentFrequency("fraud")).toBeLessThan(documentFrequency("data"));
    expect(isDistinctive("fraud")).toBe(true);
    expect(isDistinctive("data")).toBe(false);
  });

  it("refuses a passage that names the subject but never the work", () => {
    const a = alignment("The company discussed fraud risks in its annual report.", uc("fraud_detection"));
    expect(a.namesActivity).toBe(false);
    expect(a.aligned).toBe(false);
  });

  it("is deterministic", () => {
    const t = "The bank runs models that score card payments for fraud in real time.";
    expect(JSON.stringify(alignment(t, uc("fraud_detection")))).toBe(
      JSON.stringify(alignment(t, uc("fraud_detection")))
    );
  });
});

// ============================================ PART 12: reliability responds

describe("reliability moves with the evidence, not with the badge", () => {
  const running =
    "The bank runs machine learning models that score every card payment in real time for fraud.";

  const scoreOf = (p: SavedPosition) =>
    opportunitiesFor(p)!.areas.find((a) => a.id === "fraud_detection")!.reliability.score;

  const withSource = (
    evidenceType: "regulatory_filing" | "aggregator",
    financials: SavedPosition["evidence"] extends infer E
      ? E extends { financials: infer F }
        ? F
        : never
      : never = [] as never
  ): SavedPosition => {
    const p = position([{ text: running, claim: { status: "DEPLOYED" } }]);
    p.evidence!.sources = [{ url: "https://x.test/a", evidenceType }];
    p.evidence!.financials = financials;
    return p;
  };

  it("rates an evidenced workflow above the same workflow with nothing behind it", () => {
    const evidenced = scoreOf(withSource("regulatory_filing"));
    const bare = opportunitiesFor(position([]))!.areas.find(
      (a) => a.id === "fraud_detection"
    )!.reliability.score;
    expect(evidenced).toBeGreaterThan(bare);
  });

  it("does not hand out 5 of 5 for the fact of being evidenced", () => {
    // Source authority still has to earn the last point.
    expect(scoreOf(withSource("aggregator"))).toBeLessThan(5);
    expect(scoreOf(withSource("regulatory_filing"))).toBe(5);
  });

  it("still takes a point off for a figure the research could not settle", () => {
    const conflicted = [
      {
        metric: "revenue",
        reconciliation: {
          verdict: "CONFLICTING" as const,
          chosen: null,
          why: "two figures far apart",
          facts: [],
        },
        usable: false,
      },
    ];
    const clean = scoreOf(withSource("regulatory_filing"));
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const messy = scoreOf(withSource("regulatory_filing", conflicted as any));
    expect(messy).toBe(clean - 1);
  });

  it("keeps the three classes apart rather than collapsing them", () => {
    // PART 11. Nothing here is allowed to solve a low evidenced count by
    // promoting derived areas: the classes answer different questions.
    const opp = opportunitiesFor(
      position([{ text: running, claim: { status: "DEPLOYED" } }])
    )!;
    const classes = new Set(opp.areas.map((a) => a.basis));
    expect(classes.has("evidenced")).toBe(true);
    for (const a of opp.areas) {
      if (a.basis === "evidenced") {
        expect(a.evidence).toBeTruthy();
        expect(a.whyThisCompany).toBeNull();
      }
      if (a.basis === "derived") {
        expect(a.evidence).toBeNull();
        expect(a.whyThisCompany).toBeTruthy();
      }
      if (a.basis === "sector") {
        expect(a.companyEvidence).toEqual([]);
      }
    }
  });
});
