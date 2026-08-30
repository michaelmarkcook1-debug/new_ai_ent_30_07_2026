import { describe, it, expect } from "vitest";
import {
  classifyStatement,
  deriveSignals,
  isCurrentPractice,
  signalsFor,
  allDimensions,
  argues,
  SIGNAL_RELEVANCE,
  VALUE_MECHANISM,
  DIMENSION_LABEL,
  LARGE_WORKFORCE,
  type CompanyEvidence,
} from "@/lib/position/company-signals";
import type { ReconciledMetric } from "@/lib/research/ingest";
import type { CompanyFact, Reconciliation, Verdict } from "@/lib/research/facts";

// What the sources establish about THIS company, and the line between that and
// what is true of everyone in its sector.
//
// THE ONE THING THESE TESTS EXIST TO HOLD. A signal may only come from evidence
// about this company. The module cannot see the sector tag, so no rationale it
// produces can survive swapping the company for a competitor. Every other rule
// here is downstream of that one.

const src = (evidenceType: CompanyEvidence["sources"][number]["evidenceType"]) => ({
  url: "https://example.test/x",
  evidenceType,
});

const ev = (
  statements: { text: string; sourceIndex: number }[],
  financials: ReconciledMetric[] = []
): CompanyEvidence => ({
  sources: [
    src("regulatory_filing"),
    src("primary_reporting"),
    src("aggregator"),
    src("secondary_reporting"),
  ],
  statements,
  financials,
});

const fact = (over: Partial<CompanyFact> = {}): CompanyFact => ({
  metric: "employees",
  value: 66_400,
  unit: "unit",
  currency: null,
  period: { kind: "fiscal_year", year: 2025, index: null, label: "FY2025" },
  scope: "group",
  basis: "reported",
  sourceIndex: 0,
  evidenceType: "regulatory_filing",
  asStated: "66,400",
  ...over,
});

const metric = (
  verdict: Verdict,
  chosen: CompanyFact | null,
  facts: CompanyFact[] = chosen ? [chosen] : []
): ReconciledMetric => ({
  metric: "employees",
  reconciliation: { verdict, chosen, why: "because", facts } as Reconciliation,
  usable: chosen !== null && verdict !== "CONFLICTING" && verdict !== "INSUFFICIENT",
});

const find = (e: CompanyEvidence, d: string) =>
  deriveSignals(e).find((s) => s.dimension === d);

// ------------------------------------------------------ PART 5: five states

describe("what a sentence is actually saying about this company", () => {
  it("reads something running as current practice", () => {
    expect(classifyStatement("The group runs a cloud data platform for stock.")).toBe(
      "deployed"
    );
  });

  it("reads a pilot as practice, because a pilot is running", () => {
    // Learned by getting it wrong: rejecting pilots threw away exactly the
    // findings this product exists to surface.
    expect(classifyStatement("The bank is piloting a knowledge assistant.")).toBe(
      "pilot"
    );
    expect(isCurrentPractice("pilot")).toBe(true);
  });

  it("reads an intention as an intention", () => {
    expect(classifyStatement("Boots plans to deploy AI in stores.")).toBe("planned");
    expect(isCurrentPractice("planned")).toBe(false);
  });

  it("puts a plan to pilot on the plan side, not the pilot side", () => {
    expect(classifyStatement("It plans to pilot a chatbot next year.")).toBe("planned");
  });

  it("reads a denial as a denial", () => {
    expect(
      classifyStatement("The company has no fraud detection capability in place.")
    ).toBe("negated");
    expect(isCurrentPractice("negated")).toBe(false);
  });

  it("reads a sentence about the industry as being about the industry", () => {
    for (const s of [
      "Retailers are increasingly using AI for demand forecasting.",
      "Many banks have deployed chatbots.",
      "Adoption is rising across the sector.",
    ]) {
      expect(classifyStatement(s), s).toBe("sector_example");
    }
    expect(isCurrentPractice("sector_example")).toBe(false);
  });

  it("does not read work described as automatable as work already automated", () => {
    // Live Barclays, 30 August 2026: "a large back-office population exposed to
    // automation" was reading as evidence that the automation exists. The
    // sentence says there is work available to automate, which is the opposite.
    expect(
      classifyStatement(
        "There is a large back-office population exposed to automation."
      )
    ).toBe("planned");
    expect(
      classifyStatement("Much of the claims process is a candidate for automation.")
    ).toBe("planned");
  });

  it("leaves the ordinary present-tense sense of exposure alone", () => {
    // "Exposed to" is scoped to the automation sense on purpose: a company
    // exposed to a regulator is describing something true of it right now.
    expect(
      classifyStatement("The bank is exposed to FCA supervision and licence conditions.")
    ).toBe("deployed");
  });

  // THE OVER-READ THE FIRST CUT COMMITTED. Matching a bare plural rejected a
  // sentence describing this company by its category.
  it("does not mistake a company describing itself for a statement about peers", () => {
    expect(
      classifyStatement(
        "Boots is one of the largest pharmacy-led health and beauty retailers in the UK."
      )
    ).not.toBe("sector_example");
  });
});

// --------------------------------------------- PART 1/2: derivation and state

describe("deriving a signal from company evidence", () => {
  it("derives nothing at all from nothing", () => {
    expect(deriveSignals(null)).toEqual([]);
    expect(deriveSignals(undefined)).toEqual([]);
    expect(deriveSignals(ev([]))).toEqual([]);
  });

  it("does not force a signal onto a dimension nothing touched", () => {
    const out = deriveSignals(
      ev([{ text: "The group runs a cloud data platform.", sourceIndex: 0 }])
    );
    // Two dimensions share that vocabulary; the other twelve produce nothing
    // rather than an empty UNKNOWN each.
    expect(out.length).toBeLessThan(allDimensions().length);
    expect(out.every((s) => s.basis.length > 0 || s.state === "UNKNOWN")).toBe(true);
  });

  it("calls one statement MEDIUM and two HIGH", () => {
    const one = find(
      ev([{ text: "It operates a large contact centre in Nottingham.", sourceIndex: 0 }]),
      "customer_service_intensity"
    );
    expect(one?.state).toBe("MEDIUM");

    const two = find(
      ev([
        { text: "It operates a large contact centre in Nottingham.", sourceIndex: 0 },
        { text: "Customer service teams handle enquiries daily.", sourceIndex: 1 },
      ]),
      "customer_service_intensity"
    );
    expect(two?.state).toBe("HIGH");
  });

  it("records a denial as LOW rather than leaving it unknown", () => {
    const s = find(
      ev([{ text: "The retailer has not deployed generative AI in any store.", sourceIndex: 0 }]),
      "ai_adoption_maturity"
    );
    expect(s?.state).toBe("LOW");
    expect(s?.basis).toHaveLength(1);
  });

  it("carries the quote and the source under every state it claims", () => {
    const s = find(
      ev([{ text: "It operates a large contact centre in Nottingham.", sourceIndex: 1 }]),
      "customer_service_intensity"
    );
    expect(s?.basis[0].quote).toContain("contact centre");
    expect(s?.basis[0].sourceIndex).toBe(1);
    expect(s?.basis[0].evidenceType).toBe("primary_reporting");
  });

  it("is deterministic", () => {
    const e = ev([
      { text: "It operates a large contact centre.", sourceIndex: 0 },
      { text: "A cost reduction programme is under way.", sourceIndex: 1 },
    ]);
    expect(JSON.stringify(deriveSignals(e))).toBe(JSON.stringify(deriveSignals(e)));
  });
});

// ------------------------------------------------------- PART 2: what it refuses

describe("a condition is not the same as a mention of it", () => {
  // Live Tesco, 30 August 2026. "The company profile withholds EPS, net income
  // and net profit margin behind placeholders" was raising MARGIN PRESSURE and
  // then arguing for a pricing workflow off it. The sentence is about a data
  // source withholding a figure. It says nothing about margins being under
  // strain, and the dimension is named for the strain, not the noun.
  it("does not read a mention of margins as margins under pressure", () => {
    const s = find(
      ev([
        {
          text: "The company profile withholds EPS, net income and net profit margin behind placeholders while still publishing percentage movements.",
          sourceIndex: 0,
        },
      ]),
      "margin_pressure"
    );
    expect(s).toBeUndefined();
  });

  it("still reads margins that are actually described as under pressure", () => {
    for (const text of [
      "Operating margins fell for the third consecutive half.",
      "The grocer is facing squeezed margins from price competition.",
      "Margin compression continued through the year.",
    ]) {
      const s = find(ev([{ text, sourceIndex: 0 }]), "margin_pressure");
      expect(s?.state, text).toBe("MEDIUM");
    }
  });

  it("does not read procurement of AI as corporate acquisition", () => {
    // Live Tesco, 30 August 2026: "ethical, safe and compliant development,
    // acquisition and use of AI" was raising GROWTH PRESSURE off the bare word.
    const s = find(
      ev([
        {
          text: "Tesco is recruiting a Lead Product Manager to own ethical, safe and compliant development, acquisition and use of AI.",
          sourceIndex: 0,
        },
      ]),
      "growth_pressure"
    );
    expect(s).toBeUndefined();
  });

  it("still reads a real acquisition", () => {
    const s = find(
      ev([{ text: "The group acquired a regional logistics operator last year.", sourceIndex: 0 }]),
      "growth_pressure"
    );
    expect(s?.state).toBe("MEDIUM");
  });

  it("does not read a mention of growth as growth pressure", () => {
    const s = find(
      ev([{ text: "Revenue growth was reported in the annual filing.", sourceIndex: 0 }]),
      "growth_pressure"
    );
    expect(s).toBeUndefined();
  });
});

describe("what may never become a signal", () => {
  it("refuses an intention, and says that is what happened", () => {
    const s = find(
      ev([{ text: "The group plans to deploy AI assistants in stores.", sourceIndex: 0 }]),
      "ai_adoption_maturity"
    );
    expect(s?.state).toBe("UNKNOWN");
    expect(s?.evidenceState).toBe("unresolved");
    expect(s?.basis).toEqual([]);
    expect(s?.reason).toMatch(/intention rather than something running/i);
  });

  it("refuses a sentence about the industry, and says so", () => {
    const s = find(
      ev([{ text: "Many retailers have deployed AI-powered forecasting.", sourceIndex: 0 }]),
      "ai_adoption_maturity"
    );
    expect(s?.state).toBe("UNKNOWN");
    expect(s?.reason).toMatch(/industry rather than this company/i);
  });

  // PART 9, AS A MECHANICAL PROPERTY RATHER THAN A JUDGEMENT. Nothing in this
  // module takes a sector, so no rationale it produces can be built from one.
  it("cannot build a signal from anything but this company's own evidence", () => {
    expect(deriveSignals(ev([]))).toEqual([]);
    // The signature carries no sector, no industry and no peer set: the only
    // way to add one would be to change the type.
    const keys = Object.keys(ev([]));
    expect(keys.sort()).toEqual(["financials", "sources", "statements"]);
  });
});

// ------------------------------------- PART 8: conflicted facts drive nothing

describe("an unsettled figure raises nothing", () => {
  it("uses a settled headcount as evidence of scale", () => {
    const s = find(
      ev([], [metric("CORROBORATED", fact())]),
      "labour_intensity"
    );
    expect(s?.state).toBe("HIGH");
    expect(s?.evidenceState).toBe("company_reported");
    expect(s?.basis[0].kind).toBe("reconciled_fact");
  });

  it("refuses a CONFLICTING headcount, however large the numbers are", () => {
    const s = find(
      ev([], [metric("CONFLICTING", null, [fact(), fact({ value: 120_000 })])]),
      "labour_intensity"
    );
    expect(s?.state).toBe("UNKNOWN");
    expect(s?.evidenceState).toBe("unresolved");
    expect(s?.basis).toEqual([]);
    expect(s?.reason).toMatch(/did not settle on one figure/i);
  });

  it("refuses an INSUFFICIENT headcount the same way", () => {
    const s = find(ev([], [metric("INSUFFICIENT", null, [fact()])]), "labour_intensity");
    expect(s?.state).toBe("UNKNOWN");
    expect(s?.basis).toEqual([]);
  });

  // The Boots shape exactly: three unresolved revenue figures spanning
  // threefold. None of them may become a claim about scale or pressure.
  it("lets three unresolved revenue figures raise nothing anywhere", () => {
    const revenue: ReconciledMetric = {
      metric: "revenue",
      reconciliation: {
        verdict: "INSUFFICIENT",
        chosen: null,
        why: "far apart and scope unstated",
        facts: [
          fact({ metric: "revenue", value: 23.6, currency: "USD", unit: "billion" }),
          fact({ metric: "revenue", value: 7.6, currency: "USD", unit: "billion" }),
          fact({ metric: "revenue", value: 11, currency: "USD", unit: "billion" }),
        ],
      } as Reconciliation,
      usable: false,
    };
    const out = deriveSignals(ev([], [revenue]));
    expect(out.filter((s) => s.state !== "UNKNOWN")).toEqual([]);
    for (const s of out) expect(s.basis).toEqual([]);
  });

  it("will not read a money figure as a headcount", () => {
    // A revenue figure filed under an employees-shaped metric name must not
    // become a workforce of 23.6.
    const s = find(
      ev([], [metric("CONFIRMED", fact({ value: 40_000, currency: "USD", unit: "million" }))]),
      "labour_intensity"
    );
    expect(s).toBeUndefined();
  });

  it("claims nothing from a headcount below the stated threshold", () => {
    const s = find(
      ev([], [metric("CONFIRMED", fact({ value: LARGE_WORKFORCE - 1 }))]),
      "labour_intensity"
    );
    expect(s).toBeUndefined();
  });
});

// ------------------------------------------------- the join to a workflow

describe("what a signal argues for", () => {
  it("never lets an UNKNOWN or LOW signal argue for anything", () => {
    const unknown = find(
      ev([{ text: "It plans to open new distribution centres.", sourceIndex: 0 }]),
      "supply_chain_complexity"
    )!;
    expect(argues(unknown)).toBe(false);
  });

  it("matches a signal to the categories it actually bears on", () => {
    const signals = deriveSignals(
      ev([{ text: "It operates a large contact centre.", sourceIndex: 0 }])
    );
    const customer = signalsFor(signals, { category: "Customer", regulatoryFlags: [] });
    const engineering = signalsFor(signals, { category: "Engineering", regulatoryFlags: [] });
    expect(customer.map((s) => s.dimension)).toContain("customer_service_intensity");
    expect(engineering.map((s) => s.dimension)).not.toContain("customer_service_intensity");
  });

  it("lets regulatory exposure reach any workflow a regulator touches", () => {
    const signals = deriveSignals(
      ev([{ text: "The group is regulated by the FCA and holds licence conditions.", sourceIndex: 0 }])
    );
    const flagged = signalsFor(signals, { category: "Operations", regulatoryFlags: ["GDPR"] });
    const unflagged = signalsFor(signals, { category: "Operations", regulatoryFlags: [] });
    expect(flagged.map((s) => s.dimension)).toContain("regulatory_exposure");
    expect(unflagged.map((s) => s.dimension)).not.toContain("regulatory_exposure");
  });

  it("deliberately lets AI maturity argue for no category at all", () => {
    // It changes how feasible everything is, which is the priority ladder's
    // job. Forcing it here would attach a rationale to areas it does not argue.
    expect(SIGNAL_RELEVANCE.ai_adoption_maturity.categories).toEqual([]);
  });

  it("puts the strongest signal first, so it leads the explanation", () => {
    const signals = deriveSignals(
      ev([
        { text: "A cost reduction programme is under way.", sourceIndex: 0 },
        { text: "Overheads were cut through store closures.", sourceIndex: 1 },
        { text: "It has centralised back-office processing.", sourceIndex: 2 },
      ])
    );
    const ranked = signalsFor(signals, { category: "Operations", regulatoryFlags: [] });
    expect(ranked[0].state).toBe("HIGH");
  });
});

describe("every dimension is fully described", () => {
  it("gives each one a label, a relevance and a value mechanism", () => {
    for (const d of allDimensions()) {
      expect(DIMENSION_LABEL[d], d).toBeTruthy();
      expect(SIGNAL_RELEVANCE[d], d).toBeDefined();
      expect(VALUE_MECHANISM[d], d).toBeTruthy();
    }
  });

  it("puts no figure in any value mechanism", () => {
    // A mechanism says what the work would do. A return is what this product
    // cannot know, and one invented number here would be worth more damage
    // than the whole feature is worth.
    for (const d of allDimensions()) {
      expect(VALUE_MECHANISM[d], d).not.toMatch(/\d/);
      expect(VALUE_MECHANISM[d], d).not.toMatch(/per cent|%|ROI|saving of/i);
    }
  });
});
