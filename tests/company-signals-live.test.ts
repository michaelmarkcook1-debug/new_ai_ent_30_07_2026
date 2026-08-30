import { describe, it, expect } from "vitest";
import live from "./fixtures/company-research-live.json";
import { toPosition } from "@/lib/position/store";
import { opportunitiesFor, situationFrom } from "@/lib/position/opportunities";
import type { CompanyResearch } from "@/lib/research/company";

// Two real research runs, captured live on 30 August 2026, held as the shape
// the engine actually has to survive.
//
// WHY A FIXTURE AND NOT A HAND-WRITTEN CASE. Every hand-written statement in
// the other files is one I wrote to exercise a rule, which means it is written
// in the vocabulary the rule already recognises. These two are what the model
// actually returned about two real companies, in its own words, and they are
// the only test here that can fail because the world does not look like my
// assumptions about it.
//
// The pair is chosen for contrast. Boots retrieved four findings and NO AI
// findings at all: it is the case where the honest answer is that nothing was
// found, and where the temptation to manufacture something is strongest. Tesco
// retrieved a signed Mistral agreement and a joint AI lab: real, current,
// company-specific AI evidence.

const research = live as unknown as Record<string, CompanyResearch>;
const opp = (name: string) => {
  const p = toPosition(research[name]);
  expect(p, name).not.toBeNull();
  const o = opportunitiesFor(p!);
  expect(o, name).not.toBeNull();
  return { position: p!, opp: o! };
};

// ------------------------------------------------------ PART 14: Boots

describe("Boots, where the sources found no AI at all", () => {
  const { opp: boots } = opp("Boots");

  it("retrieved nothing evidencing AI, which is the premise of the rest", () => {
    // Guards the guard. If a future capture DID contain AI findings, the
    // assertions below would pass for the wrong reason.
    expect(research.Boots.aiFindings).toHaveLength(0);
    expect(research.Boots.findings.length).toBeGreaterThan(0);
  });

  it("manufactures no evidenced opportunity", () => {
    expect(boots.evidencedCount).toBe(0);
    expect(boots.areas.every((a) => a.basis !== "evidenced")).toBe(true);
    expect(boots.areas.every((a) => a.evidence === null)).toBe(true);
  });

  it("promotes nothing it cannot answer 'why this company' for", () => {
    for (const a of boots.areas) {
      if (a.basis === "derived") {
        expect(a.companyEvidence.length, a.label).toBeGreaterThan(0);
        expect(a.whyThisCompany, a.label).toBeTruthy();
      } else {
        expect(a.whyThisCompany, a.label).toBeNull();
      }
    }
  });

  it("refuses to read three unsettled revenue figures as anything", () => {
    // The live run returned $7.6B, $11 billion and $23.6 billion for one
    // measure. Not one of them may become a claim about scale or pressure.
    const revenue = research.Boots.financials.find((f) => f.metric === "revenue");
    expect(revenue?.usable).toBe(false);
    for (const s of boots.signals) {
      if (s.state === "UNKNOWN") continue;
      for (const b of s.basis) expect(b.kind).not.toBe("reconciled_fact");
    }
  });

  it("lets the unresolved figure lower reliability rather than being ignored", () => {
    // Every area is capped by its class AND marked down by the conflict, which
    // is the honest reading of a company whose own revenue cannot be settled.
    expect(boots.areas.every((a) => a.reliability.score <= 2)).toBe(true);
    expect(boots.areas.some((a) => a.reliability.basis.includes("could not settle"))).toBe(
      true
    );
  });
});

// ------------------------------------------- Tesco, where there is evidence

describe("Tesco, where the sources do evidence AI", () => {
  const { position, opp: tesco } = opp("Tesco");

  it("reads the signed agreement as current AI maturity, not an intention", () => {
    const ai = tesco.signals.find((s) => s.dimension === "ai_adoption_maturity");
    expect(ai?.state).toBe("HIGH");
    expect(ai?.evidenceState).toBe("company_stated");
    expect(ai!.basis.length).toBeGreaterThan(1);
  });

  it("derives areas nothing named, each carrying the quote that argues for it", () => {
    const derived = tesco.areas.filter((a) => a.basis === "derived");
    expect(derived.length).toBeGreaterThan(0);
    for (const a of derived) {
      expect(a.companyEvidence.length, a.label).toBeGreaterThan(0);
      expect(a.derivedSignals.length, a.label).toBeGreaterThan(0);
      expect(a.whyThisCompany, a.label).toContain("Your own sources establish");
      expect(a.valueMechanism, a.label).toBeTruthy();
      expect(a.keyConstraint, a.label).toBeTruthy();
    }
  });

  it("does not evidence a workflow merely because the company evidences AI", () => {
    // The sources establish that Tesco is deploying AI. They do not say it runs
    // any of the catalogue's specific workflows, and the distance between those
    // two claims is the whole point of the classification.
    expect(tesco.evidencedCount).toBe(0);
  });

  it("ranks what it derived above what it only inherited from the sector", () => {
    const firstSector = tesco.areas.findIndex((a) => a.basis === "sector");
    const lastDerived = tesco.areas.map((a) => a.basis).lastIndexOf("derived");
    expect(lastDerived).toBeGreaterThanOrEqual(0);
    expect(firstSector).toBeGreaterThan(lastDerived);
    for (const a of tesco.areas) {
      if (a.basis === "derived") expect(a.priority).not.toBe("LOW");
    }
  });

  it("writes a situation that names the derived areas", () => {
    // The bug this pins: with three classes and a two-class sentence builder,
    // a company whose lead areas were all derived matched neither branch and
    // the Decision Desk was prefilled with a stray double stop and no areas.
    const line = situationFrom(position, tesco);
    expect(line).not.toMatch(/\.\s*\.\s*$/);
    expect(line).toMatch(/argues for/);
    expect(line).toMatch(/We are Tesco/);
    // And the description is joined mid-sentence in lower case.
    expect(line).not.toMatch(/, A /);
  });
});

// ------------------------------------------------------- they must differ

describe("two retailers in one sector do not get one answer", () => {
  it("differs on classification, ranking and what it says", () => {
    const b = opp("Boots");
    const t = opp("Tesco");
    expect(b.opp.sectorTag).toBe(t.opp.sectorTag);

    // Same sector, same catalogue, materially different reading.
    expect(t.opp.derivedCount).toBeGreaterThan(b.opp.derivedCount);
    expect(b.opp.areas.map((a) => a.id)).not.toEqual(t.opp.areas.map((a) => a.id));
    expect(situationFrom(b.position, b.opp)).not.toBe(
      situationFrom(t.position, t.opp)
    );
    expect(b.opp.signals.map((s) => s.dimension)).not.toEqual(
      t.opp.signals.map((s) => s.dimension)
    );
  });
});
