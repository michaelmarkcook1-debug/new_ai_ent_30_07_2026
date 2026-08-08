import { describe, it, expect } from "vitest";
import { buildShortlist, shortlistCategories } from "@/lib/desk/shortlist";
import { shortlistPayload } from "@/lib/desk/shortlist-payload";
import { VENDOR_DIRECTORY } from "@/lib/aie/vendor-directory";

// Step 3 of the Decision Desk: three vendors, a paragraph each, and the
// sequence that tests them.
//
// A shortlist is the most dangerous thing this product prints. Every other
// panel describes a market; this one names companies and puts them in an order,
// which is the output a reader is most likely to act on and least likely to
// interrogate. So these tests are mostly about what it must refuse to do.
//
// The two refusals that matter: it never ranks across market categories, and it
// never pads a short category to reach three.

describe("it ranks inside one market, never across", () => {
  it("draws every card from the chosen category", () => {
    // Capability is assessed relative to peers doing the same job, so a list
    // mixing a frontier lab with a chip maker would order two different scales
    // against each other and mean nothing.
    for (const c of shortlistCategories()) {
      const list = buildShortlist(c.category)!;
      expect(list, c.category).toBeTruthy();
      for (const e of list.entries) {
        const dir = VENDOR_DIRECTORY.find((v) => v.id === e.vendorId)!;
        expect(dir.category, `${e.name} in ${c.category}`).toBe(c.category);
      }
    }
  });

  it("names the category in every reason and every limit", () => {
    const list = buildShortlist("Frontier model/API")!;
    for (const e of list.entries) {
      expect(e.reason).toContain("Frontier model/API");
      expect(e.limit).toContain("Frontier model/API");
    }
  });

  it("returns null for a category nobody is in", () => {
    expect(buildShortlist("Cheese")).toBeNull();
  });

  it("excludes investors, who are not vendors you buy from", () => {
    expect(shortlistCategories().map((c) => c.category)).not.toContain(
      "AI investor"
    );
  });
});

describe("it reports a short category rather than padding it", () => {
  it("returns fewer than three where fewer exist, and says why", () => {
    const short = shortlistCategories().filter((c) => !c.full);
    // If this ever hits zero the fixture changed; the branch still needs a case.
    expect(short.length).toBeGreaterThan(0);
    for (const c of short) {
      const list = buildShortlist(c.category)!;
      expect(list.entries.length, c.category).toBe(c.scored);
      expect(list.entries.length).toBeLessThan(3);
      expect(list.shortfall, c.category).toBeTruthy();
      expect(list.shortfall).toContain("our coverage");
    }
  });

  it("says nothing about a shortfall when there is not one", () => {
    const full = shortlistCategories().filter((c) => c.full);
    for (const c of full) {
      const list = buildShortlist(c.category)!;
      expect(list.entries.length, c.category).toBe(3);
      expect(list.shortfall, c.category).toBeNull();
    }
  });
});

describe("the ranking is the composite, and ties break on evidence", () => {
  it("orders by score, highest first", () => {
    const list = buildShortlist("AI infrastructure")!;
    for (let i = 1; i < list.entries.length; i++) {
      expect(list.entries[i - 1].score).toBeGreaterThanOrEqual(
        list.entries[i].score
      );
    }
  });

  it("never shortlists a vendor with no published input", () => {
    // A null score is an absence, not a zero, and an absence cannot be ranked.
    for (const c of shortlistCategories()) {
      for (const e of buildShortlist(c.category)!.entries) {
        expect(e.result.score).not.toBeNull();
        expect(e.result.inputsPresent).toBeGreaterThan(0);
      }
    }
  });
});

describe("the paragraph says what the score rests on", () => {
  const all = shortlistCategories().flatMap(
    (c) => buildShortlist(c.category)!.entries
  );

  it("gives every card a reason of real length", () => {
    for (const e of all) {
      expect(e.reason.length, e.name).toBeGreaterThan(140);
      expect(e.reason).toContain(e.name);
    }
  });

  it("states the evidence count on every card", () => {
    for (const e of all) {
      expect(e.reason, e.name).toContain(
        `${e.result.inputsPresent} of ${e.result.inputsTotal} published inputs`
      );
    }
  });

  it("names which input is unpublished rather than passing over it", () => {
    // Two phrasings, because a score resting on ONE input is a different claim
    // from one missing a single input, and the sentence says which. What both
    // must do is name the absent input and say the weights were renormalised.
    const NOUN = {
      winning: "capability",
      trust: "reputation",
      durability: "disclosed durability",
    } as const;
    const thin = all.filter((e) => e.result.missing.length > 0);
    expect(thin.length).toBeGreaterThan(0);
    for (const e of thin) {
      expect(e.reason, e.name).toContain("published for");
      expect(e.reason, e.name).toContain("renormalised");
      for (const k of e.result.missing) {
        expect(e.reason, `${e.name} should name ${k}`).toContain(NOUN[k]);
      }
    }
  });

  it("flags a score built on a single input as exactly that", () => {
    const single = all.filter((e) => e.result.inputsPresent === 1);
    expect(single.length).toBeGreaterThan(0);
    for (const e of single) {
      expect(e.reason, e.name).toContain("rests on a single input");
    }
  });

  it("does not print raw float noise", () => {
    // The inputs carry values like 64.9651156889088, which read as precision
    // the measure does not have.
    for (const e of all) {
      const longDecimals = e.reason.match(/\d+\.\d{3,}/g);
      expect(longDecimals, `${e.name}: ${e.reason}`).toBeNull();
    }
  });

  it("never reads as a recommendation to buy", () => {
    for (const e of all) {
      expect(e.limit).toContain("not a recommendation to buy");
      expect(e.reason.toLowerCase()).not.toContain("you should");
      expect(e.reason.toLowerCase()).not.toContain("best choice");
    }
  });

  it("carries no em-dash, in line with the house rule", () => {
    for (const e of all) {
      expect(e.reason.includes("—"), e.name).toBe(false);
      expect(e.limit.includes("—"), e.name).toBe(false);
    }
  });
});

describe("the payload the browser receives", () => {
  const p = shortlistPayload();

  it("carries every rankable category and opens on the deepest", () => {
    expect(p.categories.length).toBeGreaterThan(3);
    expect(Object.keys(p.byCategory).length).toBe(p.categories.length);
    expect(p.defaultCategory).toBe(p.categories[0].category);
    // The deepest category demonstrates a shortlist; a category of three does
    // not, because the list is then everybody in it.
    expect(p.byCategory[p.defaultCategory].entries.length).toBe(3);
    expect(p.byCategory[p.defaultCategory].considered).toBeGreaterThan(3);
  });

  it("carries the next steps in their given order", () => {
    expect(p.steps.length).toBe(7);
    expect(p.steps[0].title).toContain("eval set");
    for (const s of p.steps) {
      expect(s.why.length).toBeGreaterThan(20);
      expect(s.how.length).toBeGreaterThan(20);
    }
  });

  it("states the weighting in words for the derivation", () => {
    expect(p.weightNote).toContain("40 per cent capability");
    expect(p.weightNote).toContain("30 per cent reputation");
  });

  it("stays small enough to send", () => {
    expect(JSON.stringify(p).length).toBeLessThan(40_000);
  });

  it("rounds every score it prints", () => {
    for (const c of Object.values(p.byCategory)) {
      for (const e of c.entries) {
        expect(String(e.score)).toMatch(/^\d+(\.\d)?$/);
      }
    }
  });
});
