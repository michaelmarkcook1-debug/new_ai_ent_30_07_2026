import { describe, it, expect } from "vitest";
import {
  opportunitiesFor,
  weightingFrom,
  situationFrom,
  flagLabel,
} from "@/lib/position/opportunities";
import { TAG_LABEL } from "@/lib/exposure/vertical";
import { MARKET_CATEGORY_LIST } from "@/lib/comparability";
import type { SavedPosition } from "@/lib/position/store";

// Where AI could go in a researched company.
//
// The stand is taken from OUR workflow catalogue, keyed on the sector the
// research placed the company in, never from the model's impression of the
// company. These pin that boundary.

const pos = (sectorTag: string | null, ai: string[] = []): SavedPosition => ({
  key: "co",
  query: "Co",
  name: "Co",
  what: "a company",
  industry: "x",
  sectorTag,
  aiFindings: ai,
  findings: [],
  recommendations: [],
  savedAt: "2026-08-18",
});

const SECTORS = Object.keys(TAG_LABEL);

describe("opportunity areas", () => {
  it("returns null rather than inventing a sector", () => {
    expect(opportunitiesFor(pos(null))).toBeNull();
    expect(opportunitiesFor(pos("not_a_sector"))).toBeNull();
  });

  it("produces areas for every sector the classifier can return", () => {
    for (const tag of SECTORS) {
      const o = opportunitiesFor(pos(tag));
      expect(o, `${tag} produced nothing`).not.toBeNull();
      expect(o!.areas.length).toBeGreaterThan(0);
    }
  });

  it("marks a sector area as sector, never as evidence about the company", () => {
    // The company said nothing, so nothing may be labelled evidenced.
    const o = opportunitiesFor(pos("healthcare"))!;
    expect(o.evidencedCount).toBe(0);
    for (const a of o.areas) {
      expect(a.basis).toBe("sector");
      expect(a.evidence).toBeNull();
    }
  });

  it("labels an area the sources actually spoke to as evidenced, quoting them", () => {
    const said = "The bank is piloting a knowledge assistant for advisers.";
    const o = opportunitiesFor(pos("financial_services", [said]))!;
    const hit = o.areas.find((a) => a.basis === "evidenced");
    expect(hit).toBeDefined();
    // Quoted, never paraphrased.
    expect(hit!.evidence).toBe(said);
    expect(o.areas[0].basis).toBe("evidenced");
  });

  it("only claims regulatory flags carried by the three areas actually put forward", () => {
    // Aggregated over all eight this told a retail bank that HIPAA applied,
    // carried by a workflow far down the list it would never run.
    for (const tag of SECTORS) {
      const o = opportunitiesFor(pos(tag))!;
      const leadFlags = new Set(o.lead.flatMap((a) => a.regulatoryFlags));
      for (const f of o.regulatoryFlags) expect(leadFlags.has(f)).toBe(true);
    }
  });

  it("points only at markets the taxonomy holds", () => {
    const known = new Set(MARKET_CATEGORY_LIST.map((c) => c.id));
    for (const tag of SECTORS) {
      const o = opportunitiesFor(pos(tag))!;
      for (const m of o.marketIds) expect(known.has(m)).toBe(true);
      if (o.leadMarketId) expect(known.has(o.leadMarketId)).toBe(true);
    }
  });
});

describe("the starting weights", () => {
  it("covers the four dimensions the Decision Desk renders sliders for", () => {
    const w = weightingFrom(opportunitiesFor(pos("healthcare")));
    for (const k of ["strategic_fit", "execution_readiness", "governance_trust", "economics"]) {
      expect(typeof (w as unknown as Record<string, number>)[k]).toBe("number");
    }
  });

  it("sums to one, so the Desk renders the percentages it was given", () => {
    for (const tag of SECTORS) {
      const w = weightingFrom(opportunitiesFor(pos(tag)));
      const sum = w.strategic_fit + w.execution_readiness + w.governance_trust + w.economics;
      expect(sum).toBeGreaterThan(0.97);
      expect(sum).toBeLessThan(1.03);
    }
  });

  it("actually varies by sector", () => {
    // A first cut took maxima and returned the same weighting for a bank, a
    // hospital, a retailer and a software company. A weighting that never
    // varies is not a weighting.
    const gov = SECTORS.map((t) => weightingFrom(opportunitiesFor(pos(t))).governance_trust);
    expect(new Set(gov).size).toBeGreaterThan(2);
  });

  it("weights governance higher for a regulated sector than for software", () => {
    const bank = weightingFrom(opportunitiesFor(pos("financial_services")));
    const soft = weightingFrom(opportunitiesFor(pos("technology_software")));
    expect(bank.governance_trust).toBeGreaterThan(soft.governance_trust);
  });

  it("falls back to the Desk's own balanced preset when there is no sector", () => {
    const w = weightingFrom(null);
    expect(w.strategic_fit).toBe(0.3);
    expect(w.governance_trust).toBe(0.25);
  });
});

describe("the prefilled situation", () => {
  it("still stops before the part only the reader knows", () => {
    const p = pos("healthcare");
    const line = situationFrom(p, opportunitiesFor(p));
    expect(line).toContain("We are Co");
    // No question, no decision: the reader supplies that.
    expect(line).not.toMatch(/should we|which vendor|\?/i);
  });

  it("says whose claim it is, sources or sector", () => {
    const withEv = pos("financial_services", [
      "The bank is piloting a knowledge assistant for advisers.",
    ]);
    expect(situationFrom(withEv, opportunitiesFor(withEv))).toContain("Our own sources");
    const bare = pos("healthcare");
    expect(situationFrom(bare, opportunitiesFor(bare))).toContain("For healthcare");
  });

  it("attributes only the evidenced areas to the reader's own sources", () => {
    // A first cut said "our own sources point at" and then listed all three
    // lead areas when only one was evidenced, putting a claim about the
    // company into the reader's own opening sentence.
    const p = pos("healthcare", [
      "The trust is piloting patient intake and symptom triage in A&E.",
    ]);
    const o = opportunitiesFor(p)!;
    const line = situationFrom(p, o);
    const evidenced = o.lead.filter((a) => a.basis === "evidenced");
    const sector = o.lead.filter((a) => a.basis === "sector");
    expect(evidenced.length).toBeGreaterThan(0);
    expect(sector.length).toBeGreaterThan(0);

    const claimed = line.slice(
      line.indexOf("Our own sources"),
      line.indexOf("typically also runs")
    );
    for (const a of sector) {
      expect(claimed).not.toContain(a.label.toLowerCase());
    }
    for (const a of evidenced) {
      expect(claimed).toContain(a.label.toLowerCase());
    }
  });

  it("carries no em-dash", () => {
    for (const tag of SECTORS) {
      const p = pos(tag);
      expect(situationFrom(p, opportunitiesFor(p))).not.toContain("—");
      expect(weightingFrom(opportunitiesFor(p)).why).not.toContain("—");
    }
  });
});

describe("regulatory flag labels", () => {
  it("never puts a raw identifier into prose", () => {
    // Shipped twice before with taxonomy ids: "frontier_model_api" on a
    // button and "workflow_automation_ai" in a sentence.
    for (const tag of SECTORS) {
      const why = weightingFrom(opportunitiesFor(pos(tag))).why;
      expect(why, `${tag}: ${why}`).not.toMatch(/[A-Za-z]_[A-Za-z0-9]/);
    }
  });

  it("degrades readably for a flag it has no label for", () => {
    expect(flagLabel("SOME_NEW_RULE")).toBe("SOME NEW RULE");
    expect(flagLabel("EU_AI_Act")).toBe("the EU AI Act");
  });
});
