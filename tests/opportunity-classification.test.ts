import { describe, it, expect } from "vitest";
import { opportunitiesFor } from "@/lib/position/opportunities";
import { reliabilityOf, RELIABILITY_MEANING } from "@/lib/position/reliability";
import { rolesFor } from "@/lib/position/role-fit";
import { modelEngineHandoff } from "@/lib/position/handoff";
import type { SavedPosition } from "@/lib/position/store";
import type { ReconciledMetric } from "@/lib/research/ingest";
import type { CompanyFact, Reconciliation } from "@/lib/research/facts";

// EVIDENCED, DERIVED and SECTOR, and the gate between the middle and the last.
//
// The middle class is the one carrying judgement, so it is the one policed
// hardest. A derived area asserts that something the sources established about
// THIS company makes a workflow relevant that no source named. If that
// assertion cannot be traced back to a quote, it is a sector guess wearing a
// better badge, and a reader would have no way to tell.

const evidence = (
  statements: { text: string; sourceIndex: number }[],
  financials: ReconciledMetric[] = []
): SavedPosition["evidence"] => ({
  sources: [
    { url: "https://www.sec.gov/x", evidenceType: "regulatory_filing" },
    { url: "https://www.reuters.com/x", evidenceType: "primary_reporting" },
    { url: "https://www.owler.com/x", evidenceType: "aggregator" },
  ],
  statements,
  financials,
});

const pos = (over: Partial<SavedPosition> = {}): SavedPosition => ({
  key: "co",
  query: "Co",
  name: "Co",
  what: "a company",
  industry: "x",
  sectorTag: "retail_consumer",
  aiFindings: [],
  findings: [],
  recommendations: [],
  savedAt: "2026-08-30",
  ...over,
});

const fact = (over: Partial<CompanyFact> = {}): CompanyFact => ({
  metric: "revenue",
  value: 10,
  unit: "billion",
  currency: "GBP",
  period: { kind: "fiscal_year", year: 2025, index: null, label: "FY2025" },
  scope: "group",
  basis: "reported",
  sourceIndex: 0,
  evidenceType: "regulatory_filing",
  asStated: "£10bn",
  ...over,
});

const conflicted: ReconciledMetric = {
  metric: "revenue",
  reconciliation: {
    verdict: "CONFLICTING",
    chosen: null,
    why: "two figures far apart",
    facts: [fact(), fact({ value: 17, asStated: "£17bn" })],
  } as Reconciliation,
  usable: false,
};

// ------------------------------------------------------ the three classes

describe("the three classes are distinct and deterministic", () => {
  it("classes everything sector when the sources said nothing", () => {
    const opp = opportunitiesFor(pos())!;
    expect(opp.areas.every((a) => a.basis === "sector")).toBe(true);
    expect(opp.evidencedCount).toBe(0);
    expect(opp.derivedCount).toBe(0);
  });

  it("promotes to derived only where a signal argues for the area", () => {
    const opp = opportunitiesFor(
      pos({
        evidence: evidence([
          { text: "The retailer runs a large contact centre handling customer enquiries.", sourceIndex: 0 },
          { text: "Customer service teams answer complaints daily.", sourceIndex: 1 },
        ]),
      })
    )!;
    const derived = opp.areas.filter((a) => a.basis === "derived");
    expect(derived.length).toBeGreaterThan(0);
    // And only in the category the signal actually bears on.
    expect(derived.every((a) => a.category === "Customer")).toBe(true);
  });

  it("returns the same classification for the same evidence, every time", () => {
    const p = pos({
      evidence: evidence([
        { text: "The retailer runs a large contact centre.", sourceIndex: 0 },
      ]),
    });
    const a = opportunitiesFor(p)!.areas.map((x) => `${x.id}:${x.basis}:${x.priority}`);
    const b = opportunitiesFor(p)!.areas.map((x) => `${x.id}:${x.basis}:${x.priority}`);
    expect(a).toEqual(b);
  });
});

// ----------------------------------------------- PART 9: specificity gate

describe("the company-specificity gate", () => {
  it("gives every derived area a quote from this company's own sources", () => {
    // The gate, stated as the property it guarantees: swap the company for a
    // competitor and the quote no longer applies, so the rationale cannot.
    const opp = opportunitiesFor(
      pos({
        evidence: evidence([
          { text: "The retailer runs a large contact centre handling customer enquiries.", sourceIndex: 0 },
        ]),
      })
    )!;
    for (const a of opp.areas.filter((x) => x.basis === "derived")) {
      expect(a.companyEvidence.length, a.label).toBeGreaterThan(0);
      expect(a.derivedSignals.length, a.label).toBeGreaterThan(0);
      expect(a.whyThisCompany, a.label).toBeTruthy();
      expect(a.valueMechanism, a.label).toBeTruthy();
      expect(a.keyConstraint, a.label).toBeTruthy();
      expect(a.reliability.basis, a.label).toBeTruthy();
    }
  });

  it("leaves a sector area carrying no company evidence at all", () => {
    const opp = opportunitiesFor(pos())!;
    for (const a of opp.areas) {
      expect(a.companyEvidence).toEqual([]);
      expect(a.derivedSignals).toEqual([]);
      expect(a.whyThisCompany).toBeNull();
    }
  });

  it("keeps a sector-only rationale out of the derived class entirely", () => {
    // A statement about the industry establishes nothing about this company, so
    // it must not promote anything. This is the exact swap test: the sentence
    // is equally true of every competitor.
    const opp = opportunitiesFor(
      pos({
        evidence: evidence([
          { text: "Many retailers have deployed AI-powered demand forecasting.", sourceIndex: 0 },
          { text: "Adoption is rising across the sector.", sourceIndex: 1 },
        ]),
      })
    )!;
    expect(opp.derivedCount).toBe(0);
    expect(opp.evidencedCount).toBe(0);
  });
});

// ------------------------------------------- PART 5: evidenced means running

describe("only current practice may be evidenced", () => {
  const withStatement = (text: string) =>
    opportunitiesFor(pos({ evidence: evidence([{ text, sourceIndex: 0 }]) }))!;

  it("refuses an intention", () => {
    const opp = withStatement(
      "The retailer plans to deploy demand forecasting across its stores."
    );
    expect(opp.areas.every((a) => a.basis !== "evidenced")).toBe(true);
  });

  it("refuses a denial, and never turns it into evidence", () => {
    const opp = withStatement(
      "The retailer has no demand forecasting capability in place."
    );
    expect(opp.areas.every((a) => a.basis !== "evidenced")).toBe(true);
    for (const a of opp.areas) {
      expect(a.evidence ?? "", a.label).not.toMatch(/no demand forecasting/i);
    }
  });

  it("refuses a sentence about the industry", () => {
    const opp = withStatement(
      "Many retailers are using demand forecasting to manage stock."
    );
    expect(opp.areas.every((a) => a.basis !== "evidenced")).toBe(true);
  });

  it("matches a label word as a word, not as a run of letters", () => {
    // Live Siemens, 30 August 2026: "report" matched inside "vendor-reported"
    // and "audit" inside "independently audited", and a sentence about whether
    // a vendor's claim had been checked was published as evidence that Siemens
    // runs Expense Report Audit. Live Salesforce: "agent" inside "Agentforce".
    const opp = opportunitiesFor(
      pos({
        sectorTag: "manufacturing",
        evidence: evidence([
          {
            text: "A digital-twin factory is cited as delivering a productivity gain, a vendor-reported proof point rather than an independently audited customer outcome.",
            sourceIndex: 0,
          },
        ]),
      })
    )!;
    const audit = opp.areas.find((a) => /expense report audit/i.test(a.label));
    if (audit) expect(audit.basis).not.toBe("evidenced");
    expect(opp.evidencedCount).toBe(0);
  });

  it("needs the sentence to name the thing, not only its adjectives", () => {
    // Live Boots, 30 August 2026: "Third-party revenue estimates for Boots
    // range from $7.6B..." matched "third" and "party" against Third-Party
    // Vendor Risk Assessment. Both came from one hyphenated compound modifying
    // "revenue estimates"; the sentence is about aggregators disagreeing.
    const opp = opportunitiesFor(
      pos({
        evidence: evidence([
          {
            text: "Third-party revenue estimates for Boots range from $7.6B and $11 billion up to the $23.6 billion group figure.",
            sourceIndex: 0,
          },
        ]),
      })
    )!;
    expect(opp.evidencedCount).toBe(0);
  });

  it("judges a negation by the clause it sits in, not the sentence around it", () => {
    // Live Barclays, 30 August 2026. The trailing "not first adoption" was
    // being read as negating the clause that says 250 tools are already in use,
    // so a bank running a large AI estate was recorded as having none, which
    // then marked down every serious workflow on its list.
    const p = pos({
      sectorTag: "financial_services",
      evidence: evidence([
        {
          text: "More than 250 AI tools and models are already in use across the group, so the buying question here is consolidation and governance of an existing estate, not first adoption.",
          sourceIndex: 0,
        },
      ]),
    });
    const ai = opportunitiesFor(p)!.signals.find(
      (s) => s.dimension === "ai_adoption_maturity"
    );
    expect(ai?.state).not.toBe("LOW");
    expect(ai?.state).toBe("MEDIUM");
  });

  it("still reads a negation that belongs to the matched clause", () => {
    const p = pos({
      sectorTag: "financial_services",
      evidence: evidence([
        {
          text: "The bank has not deployed generative AI anywhere in production, although the board has discussed it.",
          sourceIndex: 0,
        },
      ]),
    });
    const ai = opportunitiesFor(p)!.signals.find(
      (s) => s.dimension === "ai_adoption_maturity"
    );
    expect(ai?.state).toBe("LOW");
  });

  it("allows a plural, because a store and stores are the same word here", () => {
    const opp = opportunitiesFor(
      pos({
        evidence: evidence([
          {
            text: "The retailer runs demand forecasting models across its stores today.",
            sourceIndex: 0,
          },
        ]),
      })
    )!;
    const forecasting = opp.areas.find((a) => /demand forecasting/i.test(a.label));
    expect(forecasting?.basis).toBe("evidenced");
  });

  it("records how the sources described anything it does evidence", () => {
    const opp = opportunitiesFor(
      pos({
        sectorTag: "financial_services",
        evidence: evidence([
          { text: "The bank is piloting transaction fraud detection on card payments.", sourceIndex: 0 },
        ]),
      })
    )!;
    const hit = opp.areas.find((a) => a.basis === "evidenced");
    if (hit) expect(["deployed", "pilot"]).toContain(hit.evidenceStatus);
    for (const a of opp.areas) {
      if (a.basis !== "evidenced") expect(a.evidenceStatus).toBeNull();
    }
  });
});

// ------------------------------------------------------- PART 6: priority

describe("priority is ordinal and every step is named", () => {
  it("uses only the three steps, never a score", () => {
    const opp = opportunitiesFor(
      pos({
        evidence: evidence([
          { text: "The retailer runs a large contact centre.", sourceIndex: 0 },
        ]),
      })
    )!;
    for (const a of opp.areas) {
      expect(["HIGH", "MEDIUM", "LOW"]).toContain(a.priority);
      expect(a.priorityWhy).toMatch(/priority:/);
      // No invented precision anywhere in the reasoning.
      expect(a.priorityWhy).not.toMatch(/\d+\s*(?:\/\s*100|per cent|%)/);
    }
  });

  it("ranks a derived area above a bare sector one", () => {
    const opp = opportunitiesFor(
      pos({
        evidence: evidence([
          { text: "The retailer runs a large contact centre handling enquiries.", sourceIndex: 0 },
          { text: "Customer service teams answer complaints daily.", sourceIndex: 1 },
        ]),
      })
    )!;
    const firstSector = opp.areas.findIndex((a) => a.basis === "sector");
    const lastDerived = opp.areas.map((a) => a.basis).lastIndexOf("derived");
    if (lastDerived >= 0 && firstSector >= 0) expect(lastDerived).toBeLessThan(firstSector);
  });

  it("marks down a workflow the company has no AI maturity to attempt", () => {
    // "Existing AI maturity" and "implementation feasibility", doing real work
    // rather than being listed as considerations.
    const base = pos({
      sectorTag: "financial_services",
      evidence: evidence([
        { text: "The bank is regulated by the FCA under licence conditions.", sourceIndex: 0 },
      ]),
    });
    const unproven = pos({
      sectorTag: "financial_services",
      evidence: evidence([
        { text: "The bank is regulated by the FCA under licence conditions.", sourceIndex: 0 },
        { text: "The bank has not deployed any generative AI in production.", sourceIndex: 1 },
      ]),
    });
    const hard = (p: SavedPosition) =>
      opportunitiesFor(p)!.areas.filter(
        (a) => a.reliabilityRequirement >= 4 || a.autonomyDefault !== "advisory_only"
      );
    const before = hard(base);
    const after = hard(unproven);
    const rank = { HIGH: 3, MEDIUM: 2, LOW: 1 } as const;
    const sum = (list: typeof before) =>
      list.reduce((t, a) => t + rank[a.priority], 0);
    expect(after.length).toBeGreaterThan(0);
    expect(sum(after)).toBeLessThan(sum(before));
  });

  it("marks down a horizontal workflow, which argues no more here than anywhere", () => {
    const opp = opportunitiesFor(pos())!;
    const withReason = opp.areas.filter((a) =>
      a.priorityWhy.includes("every sector")
    );
    for (const a of withReason) expect(a.priority).toBe("LOW");
  });
});

// ---------------------------------------------------- PART 7: reliability

describe("reliability reflects evidence, not the catalogue", () => {
  it("gives every point on the scale an explicit meaning", () => {
    for (const n of [1, 2, 3, 4, 5]) {
      expect(RELIABILITY_MEANING[n], String(n)).toBeTruthy();
    }
  });

  it("caps a sector area low however good the other sources were", () => {
    const r = reliabilityOf({
      classification: "sector",
      sourceTypes: ["regulatory_filing", "annual_report"],
      sourceIndices: [0, 1],
      signals: [],
      unresolvedConflict: false,
    });
    expect(r.score).toBe(2);
    expect(r.basis).toMatch(/capped at 2/);
  });

  it("rewards the company's own official record", () => {
    const withFiling = reliabilityOf({
      classification: "evidenced",
      sourceTypes: ["regulatory_filing"],
      sourceIndices: [0],
      signals: [],
      unresolvedConflict: false,
    });
    const withAggregator = reliabilityOf({
      classification: "evidenced",
      sourceTypes: ["aggregator"],
      sourceIndices: [0],
      signals: [],
      unresolvedConflict: false,
    });
    expect(withFiling.score).toBe(5);
    expect(withAggregator.score).toBe(4);
  });

  it("lowers reliability when a figure about this company is unresolved", () => {
    const clean = reliabilityOf({
      classification: "evidenced",
      sourceTypes: ["primary_reporting"],
      sourceIndices: [0],
      signals: [],
      unresolvedConflict: false,
    });
    const conflictedRun = reliabilityOf({
      classification: "evidenced",
      sourceTypes: ["primary_reporting"],
      sourceIndices: [0],
      signals: [],
      unresolvedConflict: true,
    });
    expect(conflictedRun.score).toBe(clean.score - 1);
    expect(conflictedRun.basis).toMatch(/could not settle a figure/);
  });

  it("carries an unresolved conflict all the way to the rows", () => {
    const clean = opportunitiesFor(
      pos({
        evidence: evidence([
          { text: "The retailer runs a large contact centre.", sourceIndex: 0 },
        ]),
      })
    )!;
    const messy = opportunitiesFor(
      pos({
        evidence: evidence(
          [{ text: "The retailer runs a large contact centre.", sourceIndex: 0 }],
          [conflicted]
        ),
      })
    )!;
    const derivedScore = (o: typeof clean) =>
      o.areas.find((a) => a.basis === "derived")?.reliability.score ?? 0;
    expect(derivedScore(messy)).toBeLessThan(derivedScore(clean));
  });

  it("no longer reports the catalogue's assurance bar as reliability", () => {
    // THE DEFECT THIS REPLACES. The two were the same number, so reliability
    // could not vary with the evidence and never did.
    const opp = opportunitiesFor(
      pos({
        evidence: evidence([
          { text: "The retailer runs a large contact centre handling enquiries.", sourceIndex: 0 },
          { text: "Customer service teams answer complaints daily.", sourceIndex: 1 },
        ]),
      })
    )!;
    const differs = opp.areas.some(
      (a) => a.reliability.score !== a.reliabilityRequirement
    );
    expect(differs).toBe(true);
    // And the same workflow moves when the evidence moves, which the catalogue
    // number by definition cannot do.
    const bare = opportunitiesFor(pos())!;
    const byId = new Map(bare.areas.map((a) => [a.id, a]));
    const moved = opp.areas.filter((a) => {
      const before = byId.get(a.id);
      return before && before.reliability.score !== a.reliability.score;
    });
    expect(moved.length).toBeGreaterThan(0);
    for (const a of moved) {
      expect(byId.get(a.id)!.reliabilityRequirement).toBe(a.reliabilityRequirement);
    }
  });
});

// ---------------------------- PARTS 10 & 11: one object, no second reasoning

describe("everything downstream reads the same object", () => {
  const p = pos({
    evidence: evidence([
      { text: "The retailer runs a large contact centre handling enquiries.", sourceIndex: 0 },
    ]),
  });

  it("hands the Decision Desk the enriched areas rather than raw research", () => {
    const opp = opportunitiesFor(p)!;
    // The Desk's own inputs are computed from `lead`, which is a slice of the
    // classified, prioritised list. Nothing re-derives a class from statements.
    expect(opp.lead.every((a) => Boolean(a.priorityWhy) && Boolean(a.reliability))).toBe(true);
    expect(opp.lead).toEqual(opp.areas.slice(0, opp.lead.length));
  });

  it("carries the signals themselves, so nothing has to re-derive them", () => {
    const opp = opportunitiesFor(p)!;
    expect(opp.signals.length).toBeGreaterThan(0);
  });

  it("hands ModelEngine an area off the same ranked list", () => {
    const opp = opportunitiesFor(p)!;
    const h = modelEngineHandoff(opp);
    if (h?.fromArea) {
      expect(opp.areas.map((a) => a.label)).toContain(h.fromArea);
    }
  });

  it("keeps role profiling from implying an area is evidenced when it is not", () => {
    // Roles are ranked from the WORKFLOW: its category, its regulator, its risk
    // and its assurance bar. None of those change with the classification, so a
    // sector area and an evidenced one get the same owners, and the badge stays
    // the only thing saying how well founded the area is.
    const opp = opportunitiesFor(p)!;
    const derived = opp.areas.find((a) => a.basis === "derived");
    if (!derived) return;
    const asSector = { ...derived, basis: "sector" as const, companyEvidence: [], derivedSignals: [] };
    expect(JSON.stringify(rolesFor(derived))).toBe(JSON.stringify(rolesFor(asSector)));
  });
});
