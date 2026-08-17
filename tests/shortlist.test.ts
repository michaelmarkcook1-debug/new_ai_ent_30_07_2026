import { describe, it, expect } from "vitest";
import {
  buildShortlist,
  shortlistCategories,
  jurisdictionCoverage,
  passesFilter,
} from "@/lib/desk/shortlist";
import { shortlistPayload, shortlistFor } from "@/lib/desk/shortlist-payload";
import { VENDOR_DIRECTORY } from "@/lib/aie/vendor-directory";
import { vendorIdsInCategory } from "@/lib/comparability";
import { isInvestor } from "@/lib/vendor/is-investor";

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
      // Membership is the taxonomy's, not the vendor record's own single
      // label. Anthropic is ranked as a coding agent and an agent platform
      // while its record says only "Frontier model/API", so asserting the two
      // agree would forbid exactly the multi-market ranking v1 does.
      const members = new Set(vendorIdsInCategory(c.category));
      for (const e of list.entries) {
        expect(members.has(e.vendorId), `${e.name} in ${c.category}`).toBe(true);
      }
    }
  });

  it("names the category in every reason and every limit", () => {
    const list = buildShortlist("frontier_model_api")!;
    for (const e of list.entries) {
      expect(e.reason).toContain("Frontier model/API");
      expect(e.limit).toContain("Frontier model/API");
    }
  });

  it("returns null for a category nobody is in", () => {
    expect(buildShortlist("Cheese")).toBeNull();
  });

  it("excludes investors, who are not vendors you buy from", () => {
    // "AI investor" is not one of the thirteen markets, so the old check on
    // category names now passes vacuously. Assert on the vendors instead.
    for (const c of shortlistCategories()) {
      for (const e of buildShortlist(c.category)!.entries) {
        expect(isInvestor(e.vendorId), `${e.name} in ${c.category}`).toBe(false);
      }
    }
  });
});

describe("it reports a short category rather than padding it", () => {
  it("returns fewer than three where fewer exist, and says why", () => {
    const short = shortlistCategories().filter((c) => !c.full);
    // No longer guaranteed to be non-empty. Under the thirteen-market taxonomy
    // every market currently holds at least three scored vendors, where the old
    // one-bucket-per-vendor split left several with one or two. The branch is
    // still reachable and still tested if a category thins out, but asserting a
    // case exists would fail on data that has simply got better.
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
    const list = buildShortlist("ai_silicon")!;
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
    expect(Object.keys(p.byFilter.all).length).toBe(p.categories.length);
    expect(p.defaultCategory).toBe(p.categories[0].category);
    // The deepest category demonstrates a shortlist; a category of three does
    // not, because the list is then everybody in it.
    expect(p.byFilter.all[p.defaultCategory].entries.length).toBe(3);
    expect(p.byFilter.all[p.defaultCategory].considered).toBeGreaterThan(3);
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
    // Raised from 40 KB on 17 August 2026. The taxonomy moved from ten buckets
    // holding each vendor once to the thirteen markets AI Enterprise ranks in,
    // where a vendor appears in every market it competes in. Microsoft is in
    // seven of them. More markets and more placements is more payload, and it
    // is the correct payload: the old figure was small because the taxonomy was
    // wrong. Still a real ceiling, because this is sent to every reader.
    expect(JSON.stringify(p).length).toBeLessThan(70_000);
  });

  it("rounds every score it prints, to the assessment's own precision", () => {
    // Two decimals. The assessment is published to two on a 0 to 5 scale, and
    // rounding to one would print 3.7 where AI Enterprise prints 3.65, which
    // is our number disagreeing with the source it came from.
    for (const c of Object.values(p.byFilter.all)) {
      for (const e of c.entries) {
        expect(String(e.score)).toMatch(/^\d+(\.\d{1,2})?$/);
        expect(e.score).toBeLessThanOrEqual(5);
      }
    }
  });
});

describe("the jurisdiction filter", () => {
  // A real buyer constraint, answered from the Sovereignty Lens rather than
  // from a list of countries we decided we disliked. The lens derives from the
  // Shield's own fetched quotes, so the shortlist and Trust Rank can never give
  // different answers about the same vendor.

  it("drops a hard stop, and names it", () => {
    const all = buildShortlist("frontier_model_api", undefined, 3, "all")!;
    const filtered = buildShortlist("frontier_model_api", undefined, 3, "no-stop")!;
    const stops = all.entries.concat().filter((e) => e.jurisdiction?.flag === "hard-stop");
    expect(filtered.entries.every((e) => e.jurisdiction?.flag !== "hard-stop")).toBe(true);
    // Whatever was removed is reported rather than silently absent.
    for (const x of filtered.excluded) {
      expect(x.name).toBeTruthy();
      expect(x.why.length).toBeGreaterThan(10);
      expect(x.hqJurisdiction).toBeTruthy();
    }
    expect(stops.length + filtered.excluded.length).toBeGreaterThan(0);
  });

  it("drops anything flagged when asked for cleared only", () => {
    const cleared = buildShortlist("frontier_model_api", undefined, 3, "cleared")!;
    for (const e of cleared.entries) {
      expect(e.jurisdiction === null || e.jurisdiction.flag === "none").toBe(true);
    }
  });

  it("still returns three by promoting the next vendor, not by shortening", () => {
    // Filtering after taking the top three would hand back one or two cards and
    // call it a shortlist. The filter runs before the cut.
    const cleared = buildShortlist("frontier_model_api", undefined, 3, "cleared")!;
    expect(cleared.entries.length).toBe(3);
    expect(cleared.shortfall).toBeNull();
  });

  it("renumbers the reason to the filtered field", () => {
    // "first of 12" has to become "first of N" once vendors are excluded, or
    // the paragraph describes a ranking that was not run.
    const cleared = buildShortlist("frontier_model_api", undefined, 3, "cleared")!;
    expect(cleared.entries[0].reason).toContain(
      `of the ${cleared.considered} scored vendors`
    );
    expect(cleared.considered).toBeLessThan(12);
  });

  it("keeps an unassessed vendor rather than excluding it on silence", () => {
    // Treating silence as a flag would exclude on no evidence, which is the
    // opposite of what a sovereignty control is for.
    //
    // Pinned on the rule, not on the coverage. This test used to assert that
    // some scored vendor had no record, which was true at 13 of 43 and stopped
    // being true when the register closed the gap. Coverage moving is not the
    // rule being removed, and a test should not confuse the two.
    for (const f of ["all", "no-stop", "cleared"] as const) {
      expect(passesFilter("no-such-vendor", f), f).toBe(true);
    }
  });

  it("covers every scored vendor, so the rule above is a guard and not a crutch", () => {
    // Stated separately and as its own fact. If this ever fails, coverage has
    // regressed and the vendors it dropped are being ranked unflagged.
    const { assessed, total } = jurisdictionCoverage();
    expect(assessed).toBe(total);
  });

  it("changes nothing in a category with no flagged vendor", () => {
    const a = buildShortlist("cloud_ai_platform", undefined, 3, "all")!;
    const c = buildShortlist("cloud_ai_platform", undefined, 3, "cleared")!;
    expect(c.entries.map((e) => e.vendorId)).toEqual(a.entries.map((e) => e.vendorId));
    expect(c.excluded).toEqual([]);
  });
});

describe("the sparse payload", () => {
  const p = shortlistPayload();

  it("stores a variant only where the filter changed something", () => {
    // 18 of 20 were byte-identical to "all"; carrying all three cost 40 KB to
    // say the same thing three times.
    expect(Object.keys(p.byFilter.cleared).length).toBeLessThan(
      Object.keys(p.byFilter.all).length
    );
  });

  it("falls back to the unfiltered list for an untouched category", () => {
    // Reading byFilter directly would blank most categories the moment a
    // filter was selected.
    for (const c of Object.keys(p.byFilter.all)) {
      expect(shortlistFor(p, "cleared", c), c).toBeTruthy();
      expect(shortlistFor(p, "no-stop", c), c).toBeTruthy();
    }
  });
});
