import { describe, it, expect } from "vitest";
import {
  lensRole,
  baseDrift,
  danglingSources,
  coverage,
  verticalsCovered,
  pilotRoleIds,
  PILOT_META,
  PILOT_SOURCES,
  type EvidenceClass,
} from "@/lib/exposure/role-vertical";
import { TAG_LABEL } from "@/lib/exposure/vertical";

// The Customer Operations & Service pilot.
//
// The question it was run to answer: does lensing a shared role by sector
// produce a difference that evidence supports, or only one that sounds
// plausible? These tests pin the answer so a later change cannot quietly turn
// the second into the first.
//
// The dataset is deltas against the role library. Its single largest risk is
// drift: the library gets re-scored, the deltas keep applying, and a reading
// derived from a profile that no longer exists goes on looking authoritative.
// The first block is the guard against exactly that and should be read as the
// most important test in the file.

describe("the dataset cannot drift away from the library it annotates", () => {
  it("agrees with every base score it was authored against", () => {
    // Each delta records the value it was scored from. If the library moves,
    // this fails and the research is redone rather than silently reapplied.
    expect(baseDrift()).toEqual([]);
  });

  it("resolves every source it cites", () => {
    expect(danglingSources()).toEqual([]);
  });

  it("gives every source a citation and a class", () => {
    for (const [id, s] of Object.entries(PILOT_SOURCES)) {
      expect(s.title, id).toBeTruthy();
      expect(s.cite, id).toBeTruthy();
      expect(["A", "B", "D", "E"], id).toContain(s.class);
      // A class A or B source is a published rule and must be reachable. The
      // one source without a URL is the retail baseline, which records an
      // absence and is classed E for exactly that reason.
      if (s.class === "A" || s.class === "B") expect(s.url, id).toBeTruthy();
    }
  });

  it("explains every delta it asserts", () => {
    for (const v of verticalsCovered()) {
      for (const roleId of pilotRoleIds()) {
        const lens = lensRole(roleId, v);
        if (!lens) continue;
        for (const r of lens.movedRequirements) {
          expect(r.why.length, `${v}/${roleId}/${r.cap}`).toBeGreaterThan(40);
          // Class A and B assert a published rule, so they must name it.
          if (r.class === "A" || r.class === "B") {
            expect(r.source, `${v}/${roleId}/${r.cap}`).not.toBeNull();
          }
        }
      }
    }
  });
});

describe("the lens produces a real difference, not a plausible one", () => {
  it("separates a front-line advisor in banking from one in retail", () => {
    // The user's own example: a customer care agent from retail is not a
    // customer care agent from investment banking. Before this dataset the
    // product could not see any difference at all.
    const bank = lensRole("ROLE-0045", "financial_services")!;
    const shop = lensRole("ROLE-0045", "retail_consumer")!;
    expect(bank).toBeTruthy();
    expect(shop).toBeTruthy();

    expect(bank.movedRequirements.length).toBeGreaterThan(0);
    expect(shop.movedRequirements.length).toBe(0);

    const cap10Bank = bank.requirements.find((r) => r.cap === "CAP-10")!;
    const cap10Shop = shop.requirements.find((r) => r.cap === "CAP-10")!;
    expect(cap10Bank.lensed).toBeGreaterThan(cap10Shop.lensed);
    // Same base, so the difference is entirely the sector.
    expect(cap10Bank.base).toBe(cap10Shop.base);
  });

  it("keeps retail as the baseline it is documented to be", () => {
    for (const roleId of pilotRoleIds()) {
      const lens = lensRole(roleId, "retail_consumer")!;
      expect(lens.movedRequirements, roleId).toEqual([]);
      expect(lens.confidence, roleId).toBeNull();
      for (const r of lens.requirements) expect(r.lensed).toBe(r.base);
    }
  });

  it("moves a minority of requirements, not all eighteen", () => {
    // A lens that moved everything would be a rewrite wearing a lens's
    // clothing. The honest result is that a sector governs a handful of
    // requirements and leaves the rest of the job alone.
    const bank = lensRole("ROLE-0045", "financial_services")!;
    expect(bank.requirements.length).toBe(18);
    expect(bank.movedRequirements.length).toBeLessThan(9);
    expect(bank.movedRequirements.length).toBeGreaterThan(0);
  });

  it("puts healthcare above retail on data sensitivity", () => {
    const health = lensRole("ROLE-0045", "healthcare")!;
    const shop = lensRole("ROLE-0045", "retail_consumer")!;
    const hs = health.requirements.find((r) => r.cap === "CAP-14")!;
    const ss = shop.requirements.find((r) => r.cap === "CAP-14")!;
    expect(hs.lensed).toBe(90);
    expect(ss.lensed).toBe(70);
  });

  it("finds the senior complaints role already near its ceiling", () => {
    // A genuine and slightly counterintuitive result: the roles a sector moves
    // most are the front-line ones. A Complaints Manager is already scored for
    // strict procedure and heavy assurance whatever the sector, so financial
    // services has less left to add.
    const advisor = lensRole("ROLE-0045", "financial_services")!;
    const manager = lensRole("ROLE-0047", "financial_services")!;
    expect(manager.movedRequirements.length).toBeLessThan(
      advisor.movedRequirements.length
    );
  });
});

describe("a recorded rule change survives even when the band does not move", () => {
  it("keeps Ofcom's eight-to-six week change visible", () => {
    // The band stays at 90 and the deadline still changed on 8 April 2026. If
    // the dataset only carried band movements this would vanish, and a reader
    // would keep working to a deadline that expired.
    const lens = lensRole("ROLE-0045", "telecom_media")!;
    const latency = lens.movedRequirements.find((r) => r.cap === "CAP-13");
    expect(latency).toBeTruthy();
    expect(latency!.moved).toBe(false);
    expect(latency!.lensed).toBe(latency!.base);
    expect(latency!.source?.cite).toContain("six weeks");
  });
});

describe("confidence is the worst evidence behind the reading", () => {
  it("takes the weakest class among the deltas that moved it", () => {
    // Same principle as the lane badging everywhere else: worst wins.
    const bank = lensRole("ROLE-0045", "financial_services")!;
    const classes = bank.movedRequirements.map((r) => r.class);
    expect(classes).toContain("D"); // the CAP-08 drafting delta
    expect(bank.confidence).toBe("D");
  });

  it("reports class A where every delta rests on a published rule", () => {
    const health = lensRole("ROLE-0045", "healthcare")!;
    expect(health.movedRequirements.every((r) => r.class === "A")).toBe(true);
    expect(health.confidence).toBe("A");
  });
});

describe("the lens keys off the vocabulary the classifier actually emits", () => {
  // The first cut of this dataset invented its own sector names. Every one of
  // them was reasonable and four of six were wrong, so the lens would have
  // silently never fired: no error, no empty state, just a sector reading that
  // never appeared for any company.
  it("uses only tags the company classifier can produce", () => {
    for (const v of verticalsCovered()) {
      expect(Object.keys(TAG_LABEL), v).toContain(v);
    }
    for (const v of PILOT_META.verticalsUnresearched) {
      expect(Object.keys(TAG_LABEL), v).toContain(v);
    }
  });

  it("accounts for every sector the classifier knows", () => {
    const known = Object.keys(TAG_LABEL).sort();
    const accounted = [
      ...verticalsCovered(),
      ...PILOT_META.verticalsUnresearched,
    ].sort();
    expect(accounted).toEqual(known);
  });

  it("labels each sector the way the rest of the product does", () => {
    for (const v of verticalsCovered()) {
      const lens = lensRole("ROLE-0045", v)!;
      expect(lens.verticalLabel, v).toBe(TAG_LABEL[v]);
    }
  });
});

describe("evidence narrower than its sector bucket says so", () => {
  it("caveats aviation evidence filed under transport and logistics", () => {
    // UK261 confers rights on air passengers. The bucket also holds freight and
    // shipping, which have no equivalent regime, so without this note the lens
    // would over-claim for a haulier.
    const lens = lensRole("ROLE-0045", "transport_logistics")!;
    expect(lens.scopeNote).toBeTruthy();
    expect(lens.scopeNote).toContain("passenger aviation");
  });

  it("caveats telecoms evidence filed under telecoms and media", () => {
    const lens = lensRole("ROLE-0045", "telecom_media")!;
    expect(lens.scopeNote).toBeTruthy();
    expect(lens.scopeNote).toContain("communications providers");
  });

  it("leaves sectors whose evidence fits the bucket uncaveated", () => {
    expect(lensRole("ROLE-0045", "healthcare")!.scopeNote).toBeNull();
    expect(lensRole("ROLE-0045", "financial_services")!.scopeNote).toBeNull();
  });
});

describe("absence is reported rather than filled", () => {
  it("returns null for a sector the pilot did not research", () => {
    // Insurance and manufacturing were the examples until 17 August 2026, when
    // the nine researched sectors merged and the pilot reached all fifteen the
    // classifier knows. The rule is unchanged and still has to hold, so it is
    // asserted against a sector that is not in the taxonomy at all rather than
    // against whichever one happens to be unresearched today.
    expect(lensRole("ROLE-0045", "not_a_sector")).toBeNull();
    for (const v of PILOT_META.verticalsUnresearched) {
      expect(lensRole("ROLE-0045", v), v).toBeNull();
    }
  });

  it("returns null for a role outside the pilot", () => {
    // A Chief Financial Officer is in the library and not in this pilot.
    expect(lensRole("ROLE-0001", "financial_services")).toBeNull();
  });

  it("names the sectors it has not reached", () => {
    // No longer required to be non-empty: the pilot now covers all fifteen. The
    // list must still be honest whenever it has entries, and an empty list must
    // mean genuinely complete coverage rather than a stale field, which the
    // classifier-accounting test above enforces.
    for (const v of PILOT_META.verticalsUnresearched) {
      expect(verticalsCovered()).not.toContain(v);
    }
  });
});

describe("what the pilot actually produced", () => {
  const rows = coverage();

  it("covers every sector the classifier knows, across six roles", () => {
    // Six sectors on 6 August 2026, fifteen on 17 August when the researched
    // nine merged. Pinned to the taxonomy rather than to a number, so this
    // tracks the classifier instead of needing an edit each time coverage moves.
    expect(rows.length).toBe(Object.keys(TAG_LABEL).length);
    expect(pilotRoleIds().length).toBe(6);
  });

  it("rests mostly on statute and regulator rules", () => {
    const total: Record<EvidenceClass, number> = { A: 0, B: 0, D: 0, E: 0 };
    for (const r of rows)
      for (const c of ["A", "B", "D", "E"] as EvidenceClass[])
        total[c] += r.byClass[c];
    const all = total.A + total.B + total.D + total.E;
    expect(all).toBeGreaterThan(20);
    // The point of the exercise. If class A ever stops being the majority,
    // the dataset has drifted towards reasoned judgement and needs re-reading.
    expect(total.A / all).toBeGreaterThan(0.6);
    // And nothing rests on judgement alone.
    expect(total.E).toBe(0);
  });
});
