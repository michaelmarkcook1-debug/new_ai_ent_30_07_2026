import { describe, it, expect } from "vitest";
import live from "./fixtures/company-research-live.json";
import { toPosition } from "@/lib/position/store";
import { opportunitiesFor, situationFrom } from "@/lib/position/opportunities";
import { rolesFor } from "@/lib/position/role-fit";
import type { CompanyResearch } from "@/lib/research/company";

// Four real research runs, captured live on 30 August 2026, held as the shape
// the engine actually has to survive.
//
// WHY FIXTURES AND NOT ONLY HAND-WRITTEN CASES. Every statement in the control
// files is one I wrote to exercise a rule, which means it is written in the
// vocabulary the rule already recognises. These four are what the model
// actually returned about four real companies, in its own words, and they are
// the only tests here that can fail because the world does not look like my
// assumptions about it.
//
// The four are chosen to cover both halves of the contract:
//
//   Mastercard  a genuine EVIDENCED workflow. Its sources say it has used AI
//               in fraud protection for years, and the engine has to see it
//   Ocado       a genuine EVIDENCED workflow the catalogue files under another
//               sector, which the sector prior used to hide
//   Boots       AI findings that map to no catalogue workflow at all. The
//               honest answer is nothing, and the temptation is to find
//               something
//   Tesco       a signed model agreement, a joint lab and a job advert, none of
//               which is a running workflow

const research = live as unknown as Record<string, CompanyResearch>;
const opp = (name: string) => {
  const p = toPosition(research[name]);
  expect(p, name).not.toBeNull();
  const o = opportunitiesFor(p!);
  expect(o, name).not.toBeNull();
  return { position: p!, opp: o! };
};

// ------------------------------- PART 10: live positive, end to end

describe("Mastercard, where the sources do document a workflow", () => {
  const { opp: mc } = opp("Mastercard");
  const fraud = mc.areas.find((a) => a.id === "fraud_detection");

  it("retrieved a statement describing the workflow, which is the premise", () => {
    const said = research.Mastercard.aiFindings.map((f) => f.statement).join(" ");
    expect(said).toMatch(/fraud/i);
  });

  it("classifies it EVIDENCED off live research", () => {
    expect(fraud?.basis).toBe("evidenced");
    expect(fraud?.evidenceStatus).toBe("deployed");
  });

  it("keeps the passage, the source and the reason on it", () => {
    expect(fraud!.evidence).toBeTruthy();
    expect(fraud!.evidenceWhy).toMatch(/own sources describe/i);
    expect(fraud!.companyEvidence).toHaveLength(1);
    expect(fraud!.companyEvidence[0].sourceIndex).toBeGreaterThanOrEqual(0);
    expect(
      research.Mastercard.sources[fraud!.companyEvidence[0].sourceIndex]
    ).toBeTruthy();
  });

  it("ranks it top and rates it above an unevidenced area", () => {
    expect(fraud!.priority).toBe("HIGH");
    expect(mc.areas[0].id).toBe("fraud_detection");
    const others = mc.areas.filter((a) => a.basis !== "evidenced");
    for (const a of others) {
      expect(a.reliability.score).toBeLessThan(fraud!.reliability.score);
    }
  });

  it("does not hand it 5 of 5 for being evidenced at all", () => {
    // The retrieved source is reporting rather than Mastercard's own filing,
    // and the last point has to be earned by source authority.
    expect(fraud!.reliability.score).toBeLessThan(5);
    expect(fraud!.reliability.score).toBeGreaterThanOrEqual(4);
  });

  it("evidences that workflow and no other", () => {
    expect(mc.evidencedCount).toBe(1);
  });
});

// ------------------- the sector prior must not hide company evidence

describe("Ocado, whose evidenced workflow the catalogue files elsewhere", () => {
  const { opp: ocado } = opp("Ocado");

  it("shows a workflow this company evidences even though its sector does not run it", () => {
    // Predictive Maintenance is catalogued for manufacturing, energy and
    // transport. Ocado is retail. Its own sources say machine learning already
    // schedules predictive maintenance in the fulfilment centres, and evidence
    // outranks a prior about what a sector typically does.
    const pm = ocado.areas.find((a) => a.id === "predictive_maintenance");
    expect(pm?.basis).toBe("evidenced");
    expect(ocado.sectorTag).toBe("retail_consumer");
  });
});

// ------------------------------------------------ PART 19: no inflation

describe("Boots, where the AI findings map to no catalogue workflow", () => {
  const { opp: boots } = opp("Boots");

  it("did retrieve AI findings this time, which is the premise of the rest", () => {
    // Guards the guard. The earlier capture had none; this one does, and the
    // engine still has to decline them.
    expect(research.Boots.aiFindings.length).toBeGreaterThan(0);
  });

  it("evidences nothing, because none of them is a catalogued workflow", () => {
    // Making itself discoverable to AI shopping assistants is real and is not
    // one of the 75 workflows. Nothing is promoted to fill the gap.
    expect(boots.evidencedCount).toBe(0);
    expect(boots.areas.every((a) => a.evidence === null)).toBe(true);
  });

  it("promotes nothing it cannot answer 'why this company' for", () => {
    for (const a of boots.areas) {
      if (a.basis === "derived") expect(a.companyEvidence.length).toBeGreaterThan(0);
      else expect(a.whyThisCompany).toBeNull();
    }
  });
});

describe("Tesco, where the AI evidence is contracts and intentions", () => {
  const { position, opp: tesco } = opp("Tesco");

  it("refuses a signed model agreement as evidence of a running workflow", () => {
    const said = research.Tesco.aiFindings.map((f) => f.statement).join(" ");
    expect(said).toMatch(/agreement with Mistral/i);
    expect(tesco.evidencedCount).toBe(0);
  });

  it("still derives areas from what those sources establish", () => {
    expect(tesco.derivedCount).toBeGreaterThan(0);
    for (const a of tesco.areas.filter((x) => x.basis === "derived")) {
      expect(a.whyThisCompany).toContain("Your own sources establish");
      expect(a.priority).not.toBe("LOW");
    }
  });

  it("writes a situation that names them", () => {
    const line = situationFrom(position, tesco);
    expect(line).not.toMatch(/\.\s*\.\s*$/);
    expect(line).toMatch(/argues for/);
  });
});

// -------------------------------------------------- they must still differ

describe("four companies, four different readings", () => {
  it("does not hand two of them the same answer", () => {
    const shapes = ["Boots", "Tesco", "Mastercard", "Ocado"].map((n) => {
      const o = opp(n).opp;
      return `${o.evidencedCount}/${o.derivedCount}/${o.sectorCount}:${o.areas[0].id}`;
    });
    expect(new Set(shapes).size).toBe(4);
  });

  it("gives every area on every one of them three distinct owners", () => {
    for (const n of ["Boots", "Tesco", "Mastercard", "Ocado"]) {
      for (const a of opp(n).opp.areas) {
        const r = rolesFor(a);
        const three = [
          r.businessOwner.recommended.role,
          r.deliveryOwner.recommended.role,
          r.governanceOwner.recommended.role,
        ];
        expect(new Set(three).size, `${n} / ${a.label}: ${three.join(" / ")}`).toBe(3);
      }
    }
  });
});
