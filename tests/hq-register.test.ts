import { describe, it, expect } from "vitest";
import { HQ_REGISTER } from "@/lib/shield/hq-register";
import { SHIELD } from "@/lib/shield/data";
import { vendorIdForSlug } from "@/lib/shield/vendor-map";
import {
  jurisdictionFor,
  jurisdictionCoverage,
  buildShortlist,
  shortlistCategories,
} from "@/lib/desk/shortlist";
import { scorecardSet } from "@/lib/vendor/composite-data";
import { DEFAULT_WEIGHTS } from "@/lib/vendor/composite";

describe("the public-record register", () => {
  it("names only real vendors", () => {
    const ids = new Set(scorecardSet().vendors.map((v) => v.vendorId));
    for (const id of Object.keys(HQ_REGISTER)) {
      expect(ids.has(id), `${id} is not a scored vendor`).toBe(true);
    }
  });

  it("does not restate a vendor the Shield already fetched", () => {
    // Not an error if it did, since the Shield wins in jurisdictions(), but a
    // duplicate means two files hold the same fact and one will rot.
    for (const v of SHIELD) {
      const id = vendorIdForSlug(v.slug);
      if (!id) continue;
      expect(HQ_REGISTER[id], `${id} is in both the Shield and the register`)
        .toBeUndefined();
    }
  });

  it("carries a note on every entry, and a reason on every flag", () => {
    for (const [id, r] of Object.entries(HQ_REGISTER)) {
      expect(r.flagNote.length, `${id} has no note`).toBeGreaterThan(20);
      expect(r.hqJurisdiction.length, `${id} has no jurisdiction`).toBeGreaterThan(1);
      if (r.flag !== "none") {
        // A flag excludes a vendor from a reader's shortlist. It has to say why
        // in terms the reader can check, not assert a conclusion.
        expect(r.flagNote.length, `${id} is flagged on a thin note`).toBeGreaterThan(80);
      }
    }
  });
});

describe("what the register was built to fix", () => {
  it("reaches MiniMax, which the Shield did not", () => {
    // The bug: a Shanghai-headquartered frontier lab sat in the unassessed two
    // thirds, so a reader asking to exclude Chinese providers was shown it.
    const j = jurisdictionFor("minimax");
    expect(j, "MiniMax has no jurisdiction record").toBeTruthy();
    expect(j!.flag).not.toBe("none");
    expect(j!.hqJurisdiction).toContain("China");
  });

  it("excludes MiniMax from a cleared-only shortlist", () => {
    // The behaviour, not just the datum. This is the thing the reader asked for.
    const cat = shortlistCategories().find((c) => c.category === "frontier_model_api");
    expect(cat, "the category MiniMax sits in has gone").toBeTruthy();

    const all = buildShortlist("frontier_model_api", DEFAULT_WEIGHTS, 40, "all");
    const cleared = buildShortlist("frontier_model_api", DEFAULT_WEIGHTS, 40, "cleared");
    expect(all!.entries.some((e) => e.vendorId === "minimax")).toBe(true);
    expect(cleared!.entries.some((e) => e.vendorId === "minimax")).toBe(false);
    expect(cleared!.excluded.some((e) => e.vendorId === "minimax")).toBe(true);
  });

  it("leaves the two Gulf state-owned vendors flagged, with the ownership named", () => {
    for (const id of ["g42", "humain"]) {
      const j = jurisdictionFor(id)!;
      expect(j.flag, `${id} should carry a consideration`).toBe("consideration");
      expect(j.flagNote.toLowerCase()).toMatch(/adequacy/);
    }
  });
});

describe("the two evidence classes stay apart", () => {
  it("labels every jurisdiction with how we know it", () => {
    for (const v of scorecardSet().vendors) {
      const j = jurisdictionFor(v.vendorId);
      if (!j) continue;
      expect(["vendor-document", "public-record"]).toContain(j.basis);
    }
  });

  it("reports a Shield vendor as a fetched document, not public record", () => {
    expect(jurisdictionFor("deepseek")?.basis).toBe("vendor-document");
    expect(jurisdictionFor("minimax")?.basis).toBe("public-record");
  });

  it("splits the coverage figure rather than totalling it", () => {
    // A single number would let a reader take thirty public-record entries for
    // thirty fetched policies, which is the whole reason the split exists.
    const c = jurisdictionCoverage();
    expect(c.fromDocument + c.fromPublicRecord).toBe(c.assessed);
    expect(c.fromDocument).toBeGreaterThan(0);
    expect(c.fromPublicRecord).toBeGreaterThan(0);
    expect(c.assessed).toBeLessThanOrEqual(c.total);
  });

  it("now covers the scored set", () => {
    const c = jurisdictionCoverage();
    expect(c.assessed).toBe(c.total);
  });
});
