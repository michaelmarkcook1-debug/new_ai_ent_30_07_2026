import { describe, expect, it } from "vitest";
import {
  OBLIGATIONS,
  inForce,
  upcoming,
  daysUntil,
  forWatchlist,
} from "@/lib/aie/regulation/obligations";

// The regulatory set behind the daily brief.
//
// These assertions are deliberately about structure and internal consistency
// rather than about the law itself: a test cannot verify that a statute says
// what a law firm reported it says. What it can do is stop the set drifting
// into the failure modes this product actually has — an undated row, a claim
// with no source, or a date that moved without saying so.

const AS_OF = new Date("2026-08-05T00:00:00Z");

describe("regulatory obligations", () => {
  it("carries a real, resolvable source on every row", () => {
    for (const o of OBLIGATIONS) {
      expect(o.source.url, `${o.id} has no source URL`).toMatch(/^https:\/\//);
      expect(o.source.name.length, `${o.id} has no source name`).toBeGreaterThan(0);
      expect(o.source.published, `${o.id} source is undated`).toMatch(
        /^\d{4}-\d{2}-\d{2}$/
      );
    }
  });

  it("dates every obligation", () => {
    for (const o of OBLIGATIONS) {
      expect(o.effectiveDate, `${o.id} is undated`).toMatch(/^\d{4}-\d{2}-\d{2}$/);
    }
  });

  it("says who each obligation binds", () => {
    // The field the trackers omit and a buyer needs first: is this my problem
    // or my vendor's.
    for (const o of OBLIGATIONS) {
      expect(["provider", "deployer", "both"]).toContain(o.binds);
    }
  });

  it("gives every obligation a reader-facing consequence", () => {
    for (const o of OBLIGATIONS) {
      expect(o.soWhat.length, `${o.id} states no consequence`).toBeGreaterThan(40);
    }
  });

  it("explains any date that moved", () => {
    // A deadline that silently changes is the thing most likely to burn a
    // reader who planned against the old one.
    for (const o of OBLIGATIONS) {
      if (!o.moved) continue;
      expect(o.moved.from).toMatch(/^\d{4}-\d{2}-\d{2}$/);
      expect(o.moved.by.length, `${o.id} moved with no reason`).toBeGreaterThan(10);
      expect(o.moved.from, `${o.id} did not actually move`).not.toBe(
        o.effectiveDate
      );
    }
  });

  it("uses unique ids", () => {
    const ids = OBLIGATIONS.map((o) => o.id);
    expect(new Set(ids).size).toBe(ids.length);
  });

  it("splits in-force from upcoming without losing or duplicating a row", () => {
    const a = inForce(AS_OF);
    const b = upcoming(AS_OF);
    expect(a.length + b.length).toBe(OBLIGATIONS.length);
    expect(a.some((o) => b.includes(o))).toBe(false);
  });

  it("holds enough upcoming obligations to fill a forward view", () => {
    // Two events was the state that made the old page useless, and both were
    // already in force. The floor is what stops that recurring.
    expect(upcoming(AS_OF).length).toBeGreaterThanOrEqual(6);
  });

  it("counts days to a deadline from a supplied date, not the clock", () => {
    const annexIII = OBLIGATIONS.find(
      (o) => o.id === "eu_ai_act_high_risk_annex_iii"
    )!;
    // 5 Aug 2026 → 2 Dec 2027.
    expect(daysUntil(annexIII, AS_OF)).toBe(484);
    // Already in force reads negative rather than being hidden.
    const transparency = OBLIGATIONS.find(
      (o) => o.id === "eu_ai_act_transparency"
    )!;
    expect(daysUntil(transparency, AS_OF)).toBeLessThan(0);
  });

  it("returns nothing for an empty watchlist rather than everything", () => {
    // The failure that would make the personalised view silently wrong.
    expect(forWatchlist([])).toEqual([]);
    expect(forWatchlist(["anthropic"]).length).toBeGreaterThan(0);
  });
});
