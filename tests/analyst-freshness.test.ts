import { describe, it, expect } from "vitest";
import {
  DEFAULT_SHELF_LIFE,
  SHELF_LIFE,
  ageDays,
  canCreateUrgency,
  freshnessNote,
  freshnessOf,
  shelfLifeFor,
  speaksToNow,
  worstFreshness,
  type Freshness,
} from "@/lib/analyst/freshness";
import { signal, type Signal } from "@/lib/analyst/signals";
import { synthesise } from "@/lib/analyst/synthesis";
import { enrichWithSynthesis } from "@/lib/analyst/cross";
import { pricePerformanceInsight } from "@/lib/analyst/insight";

// How old a reading is allowed to be before it stops meaning "now".
//
// WHY THIS FILE EXISTS. Freshness decides whether a reading may contribute to
// a claim about the present, and one of its answers decides whether the
// product may tell a buyer to act THIS WEEK. That is the highest-consequence
// branch in the analyst layer and it shipped untested. The specific failure it
// is meant to prevent is recorded in the module's own header: a benchmark
// capture 33 days old feeding a "why now".
//
// EVERY TEST PASSES ITS OWN CLOCK. Not one of these reads the wall clock, so a
// suite that passes today passes in a year, and a boundary asserted here is
// the boundary the code computes rather than the one the calendar allowed.

/** A fixed reference clock. Every assertion below is relative to this. */
const NOW = Date.parse("2026-08-27T12:00:00Z");
const DAY = 24 * 60 * 60 * 1000;

/** A reading of `source`, taken `days` before the reference clock. */
const aged = (source: string, days: number, extra: Partial<Signal> = {}): Signal =>
  signal({
    id: `s-${source}-${days}`,
    subject: "the tracked set",
    dimension: "capability",
    state: "narrow",
    observedAt: new Date(NOW - days * DAY).toISOString(),
    lane: "aie",
    evidence: {
      claim: `a reading from ${source}`,
      source,
      basis: "measured",
      lane: "aie",
      asOf: new Date(NOW - days * DAY).toISOString(),
    },
    ...extra,
  });

/** A reading carrying no usable date at all. */
const undated = (source: string, observedAt: string | null = null): Signal =>
  signal({
    id: `undated-${source}`,
    subject: "the tracked set",
    dimension: "capability",
    state: "narrow",
    observedAt,
    lane: "aie",
    evidence: {
      claim: `an undated reading from ${source}`,
      source,
      basis: "measured",
      lane: "aie",
      asOf: null,
    },
  });

// ------------------------------------------------------------ the four states

describe("the four freshness states", () => {
  it("calls a reading inside its source's refresh window current", () => {
    // News turns over inside a week: current <= 7.
    expect(freshnessOf(aged("AIE news feed", 0), NOW)).toBe("current");
    expect(freshnessOf(aged("AIE news feed", 3), NOW)).toBe("current");
  });

  it("calls a reading past its window but inside its useful life aging", () => {
    expect(freshnessOf(aged("AIE news feed", 10), NOW)).toBe("aging");
    expect(freshnessOf(aged("AIE news feed", 20), NOW)).toBe("aging");
  });

  it("calls a reading past its useful life stale", () => {
    expect(freshnessOf(aged("AIE news feed", 22), NOW)).toBe("stale");
    expect(freshnessOf(aged("AIE news feed", 400), NOW)).toBe("stale");
  });

  it("calls a reading with no usable date unknown", () => {
    expect(freshnessOf(undated("AIE news feed"), NOW)).toBe("unknown");
    expect(freshnessOf(undated("AIE news feed", ""), NOW)).toBe("unknown");
    expect(freshnessOf(undated("AIE news feed", "not a date"), NOW)).toBe("unknown");
  });

  it("never returns anything outside the four states", () => {
    const states: Freshness[] = ["current", "aging", "stale", "unknown"];
    for (const days of [-400, -2, -1, 0, 1, 7, 21, 60, 90, 400, 10_000]) {
      for (const source of [...Object.keys(SHELF_LIFE), "a source nobody declared"]) {
        expect(states).toContain(freshnessOf(aged(source, days), NOW));
      }
    }
  });
});

// --------------------------------------------------------------- boundaries

describe("boundary conditions are deterministic", () => {
  // The comparisons are `age <= current` and `age <= stale`, so the threshold
  // day itself is the better state. Pinned here so a later refactor that flips
  // one to `<` is a failing test rather than a silent day's difference.
  it("treats the current threshold day itself as current", () => {
    const { current } = shelfLifeFor("Artificial Analysis benchmark");
    expect(current).toBe(21);
    expect(freshnessOf(aged("Artificial Analysis benchmark", 21), NOW)).toBe("current");
    expect(freshnessOf(aged("Artificial Analysis benchmark", 21.5), NOW)).toBe("aging");
  });

  it("treats the stale threshold day itself as aging", () => {
    const { stale } = shelfLifeFor("Artificial Analysis benchmark");
    expect(stale).toBe(60);
    expect(freshnessOf(aged("Artificial Analysis benchmark", 60), NOW)).toBe("aging");
    expect(freshnessOf(aged("Artificial Analysis benchmark", 60.5), NOW)).toBe("stale");
  });

  it("is exact at the boundary rather than rounded to whole days", () => {
    // A reading one minute past the window is past it. Nothing rounds a
    // reading back into currency.
    const oneMinutePast = signal({
      ...aged("AIE news feed", 0),
      observedAt: new Date(NOW - 7 * DAY - 60_000).toISOString(),
    });
    expect(freshnessOf(oneMinutePast, NOW)).toBe("aging");
  });

  it("gives the same answer for the same inputs every time", () => {
    const s = aged("AIE capability matrix", 45);
    const answers = new Set(Array.from({ length: 25 }, () => freshnessOf(s, NOW)));
    expect(answers.size).toBe(1);
  });
});

// ----------------------------------------------------------- the clock rule

describe("freshness is judged against the clock it is given", () => {
  it("moves a reading through the states as the reference clock advances", () => {
    // One fixed reading, four different clocks. Nothing here consults Date.now.
    const observedAt = new Date(NOW).toISOString();
    const s = signal({ ...aged("Artificial Analysis benchmark", 0), observedAt });
    expect(freshnessOf(s, NOW + 1 * DAY)).toBe("current");
    expect(freshnessOf(s, NOW + 35 * DAY)).toBe("aging");
    expect(freshnessOf(s, NOW + 90 * DAY)).toBe("stale");
  });

  it("does not consult the wall clock", () => {
    // A reading dated a decade before the real today is current against a
    // clock set beside it. If this ever reads Date.now it fails.
    const longAgo = Date.parse("2016-01-01T00:00:00Z");
    const s = signal({
      ...aged("AIE news feed", 0),
      observedAt: new Date(longAgo).toISOString(),
    });
    expect(freshnessOf(s, longAgo + 2 * DAY)).toBe("current");
  });

  it("computes age from the supplied clock", () => {
    expect(ageDays("2026-08-20T12:00:00Z", NOW)).toBe(7);
    expect(ageDays(null, NOW)).toBeNull();
    expect(ageDays("nonsense", NOW)).toBeNull();
  });
});

// ------------------------------------------------------- future timestamps

describe("a future-dated reading is not the freshest reading", () => {
  // A date ahead of the clock is a defect in the feed. Rewarding it would make
  // the most broken timestamp the most current evidence in the product.
  it("treats a clearly future reading as unknown, never as current", () => {
    for (const days of [-2, -30, -400]) {
      const f = freshnessOf(aged("AIE news feed", days), NOW);
      expect(f).toBe("unknown");
      expect(f).not.toBe("current");
    }
  });

  it("allows a small negative age for clock skew rather than failing on it", () => {
    // Within a day either side is skew between a capture host and this one,
    // not a broken feed. Documented here because it is a deliberate tolerance
    // and not an accident of the comparison.
    expect(freshnessOf(aged("AIE news feed", -0.5), NOW)).toBe("current");
    expect(freshnessOf(aged("AIE news feed", -1), NOW)).toBe("current");
  });

  it("refuses urgency to a future-dated reading", () => {
    expect(canCreateUrgency(freshnessOf(aged("AIE news feed", -30), NOW))).toBe(false);
  });
});

// ---------------------------------------------------- source-specific policy

describe("shelf life is per source, and each one is declared", () => {
  it("gives every declared source a reasoned window", () => {
    for (const [source, policy] of Object.entries(SHELF_LIFE)) {
      expect(policy.current).toBeGreaterThan(0);
      // Aging has to be a real band, or the state is unreachable.
      expect(policy.stale).toBeGreaterThan(policy.current);
      // A written reason rather than a placeholder. Short is allowed where an
      // entry defers to the one above it ("Same library, same cadence."), and
      // a bare word or an empty string is not.
      expect(policy.why.trim().length).toBeGreaterThan(15);
      expect(policy.why.trim()).toMatch(/\.$/);
      expect(shelfLifeFor(source)).toBe(policy);
    }
  });

  it("falls to a conservative default for a source nobody declared", () => {
    expect(shelfLifeFor("a dataset added without thinking")).toBe(DEFAULT_SHELF_LIFE);
    expect(DEFAULT_SHELF_LIFE.current).toBe(30);
    // The default is short on purpose: an undeclared source should need
    // attention rather than be permanently current.
    const declared = Object.values(SHELF_LIFE).map((p) => p.current);
    expect(DEFAULT_SHELF_LIFE.current).toBeLessThanOrEqual(Math.max(...declared));
  });

  it("does not apply one window to every source", () => {
    // The same 45-day-old reading is stale news, an aging benchmark and a
    // current filing. That is the whole reason the table exists.
    expect(freshnessOf(aged("AIE news feed", 45), NOW)).toBe("stale");
    expect(freshnessOf(aged("Artificial Analysis benchmark", 45), NOW)).toBe("aging");
    expect(freshnessOf(aged("SEC filings, full-text search", 45), NOW)).toBe("current");
    expect(freshnessOf(aged("AIE exposure map", 45), NOW)).toBe("current");
  });

  it("keeps movement on the shortest structural window of any source", () => {
    // Movement is a claim about what is happening now, so an old movement
    // reading is the exact thing that must never be presented as current.
    const movement = shelfLifeFor("AIE vendor movement classification");
    const structural = [
      "AIE capability matrix",
      "AIE vendor rankings",
      "AIE market share estimates",
      "AIE reputation pillars",
      "AIE risk register",
      "AIE exposure map",
    ].map((s) => shelfLifeFor(s).stale);
    expect(movement.stale).toBeLessThan(Math.min(...structural));
  });
});

// ---------------------------------------------- what each state may be used for

describe("what a state licenses", () => {
  it("lets current evidence speak to now and create urgency", () => {
    expect(speaksToNow("current")).toBe(true);
    expect(canCreateUrgency("current")).toBe(true);
  });

  it("lets aging evidence speak to now and refuses it urgency", () => {
    // The two questions are different and were once answered by one test:
    // "may this inform the decision" and "may this be why we act this week".
    expect(speaksToNow("aging")).toBe(true);
    expect(canCreateUrgency("aging")).toBe(false);
  });

  it("refuses stale evidence both", () => {
    expect(speaksToNow("stale")).toBe(false);
    expect(canCreateUrgency("stale")).toBe(false);
  });

  it("refuses unknown evidence both, and never treats it as current", () => {
    expect(speaksToNow("unknown")).toBe(false);
    expect(canCreateUrgency("unknown")).toBe(false);
  });

  it("makes urgency strictly stricter than speaking to now", () => {
    const states: Freshness[] = ["current", "aging", "stale", "unknown"];
    for (const f of states) {
      if (canCreateUrgency(f)) expect(speaksToNow(f)).toBe(true);
    }
    // And strictly: there is at least one state that informs without hurrying.
    expect(states.some((f) => speaksToNow(f) && !canCreateUrgency(f))).toBe(true);
  });
});

// ------------------------------------------------------------ worst governs

describe("the least fresh input governs a set", () => {
  it("returns the worst state across the set", () => {
    const current = aged("AIE news feed", 1);
    const aging = aged("AIE news feed", 10);
    const stale = aged("AIE news feed", 30);
    expect(worstFreshness([current, current], NOW)).toBe("current");
    expect(worstFreshness([current, aging], NOW)).toBe("aging");
    expect(worstFreshness([current, aging, stale], NOW)).toBe("stale");
    expect(worstFreshness([current, undated("AIE news feed")], NOW)).toBe("unknown");
  });

  it("treats an empty set as unknown rather than as current", () => {
    expect(worstFreshness([], NOW)).toBe("unknown");
  });

  it("does not let a fresh reading rescue a stale one", () => {
    const fresh = aged("AIE news feed", 0);
    const ancient = aged("AIE news feed", 300);
    expect(worstFreshness([fresh, fresh, fresh, ancient], NOW)).toBe("stale");
  });
});

// ------------------------------------------------------------- how it reads

describe("how age is said out loud", () => {
  it("says nothing beside a current reading", () => {
    expect(freshnessNote(aged("AIE news feed", 1), NOW)).toBeNull();
  });

  it("names the source and the age for a reading past its window", () => {
    const note = freshnessNote(aged("Artificial Analysis benchmark", 35), NOW);
    expect(note).toContain("Artificial Analysis benchmark");
    expect(note).toContain("35 days ago");
    expect(note).toContain("still inside its useful life");
  });

  it("says outright that a stale reading cannot support a claim about now", () => {
    const note = freshnessNote(aged("AIE news feed", 90), NOW);
    expect(note).toContain("past the point it can support a claim about now");
  });

  it("says that an undated reading's currency cannot be established", () => {
    const note = freshnessNote(undated("AIE news feed"), NOW);
    expect(note).toContain("no usable date");
    // It must not imply the reading is fresh.
    expect(note).not.toMatch(/current|up to date/i);
  });
});

// ------------------------------------------ freshness reaching the decision

describe("freshness reaching a decision", () => {
  // The frontier capability and price pair, which is the relationship the
  // whole freshness question was raised against.
  const cap = (days: number) =>
    signal({
      id: "cap",
      subject: "the frontier model cohort",
      population: "frontier-model-providers",
      dimension: "capability",
      state: "narrow",
      magnitude: 10.6,
      observedAt: new Date(NOW - days * DAY).toISOString(),
      lane: "aie",
      evidence: {
        claim: "capability across frontier model providers is narrow",
        source: "AIE capability matrix",
        basis: "measured",
        lane: "aie",
        asOf: new Date(NOW - days * DAY).toISOString(),
      },
    });

  const price = (days: number | null) =>
    signal({
      id: "price",
      subject: "the priced and benchmarked catalogue",
      population: "frontier-model-providers",
      dimension: "price",
      state: "wide, and separated from capability",
      magnitude: 25,
      observedAt: days === null ? null : new Date(NOW - days * DAY).toISOString(),
      lane: "derived",
      evidence: {
        claim: "the cheapest adequate model costs 25 times less than the top model",
        source: "Artificial Analysis benchmark",
        basis: "measured",
        lane: "derived",
        asOf: null,
      },
    });

  const BASE = pricePerformanceInsight(
    { models: 42, vendors: 11, ratio: 12, adequate: 9 },
    null,
    "2026-08-20"
  );

  it("lets current evidence contribute to a current synthesis", () => {
    const found = synthesise([cap(2), price(2)], NOW);
    const hit = found.find((s) => s.id === "capability-price-divergence");
    expect(hit).toBeDefined();
    expect(hit!.freshness).toBe("current");
    expect(hit!.currency).toBe("current");
  });

  it("lets aging evidence produce the finding as evidence", () => {
    // The intended source policy: an aging benchmark is past its refresh
    // window and still inside its useful life, so the finding stands.
    const found = synthesise([cap(2), price(35)], NOW);
    const hit = found.find((s) => s.id === "capability-price-divergence");
    expect(hit).toBeDefined();
    expect(hit!.freshness).toBe("aging");
  });

  it("suppresses a currency-dependent rule outright on stale evidence", () => {
    // Not downgraded. A claim about the market now, resting on a reading past
    // its useful life, is a different and false claim rather than a weaker one.
    const found = synthesise([cap(2), price(120)], NOW);
    expect(found.find((s) => s.id === "capability-price-divergence")).toBeUndefined();
  });

  it("suppresses a currency-dependent rule on undated evidence", () => {
    const found = synthesise([cap(2), price(null)], NOW);
    expect(found.find((s) => s.id === "capability-price-divergence")).toBeUndefined();
  });

  it("lets current evidence answer why now", () => {
    const { insight } = enrichWithSynthesis(BASE, [cap(2), price(2)], NOW);
    expect(insight.decision!.whyNow).toContain("Across datasets");
  });

  it("refuses an aging reading a why now, while keeping it as evidence", () => {
    // THE DEFECT THIS FILE EXISTS FOR. A benchmark past its refresh window is
    // evidence about the decision and is not news, and the product shipped it
    // as news once already.
    const { insight, synthesis } = enrichWithSynthesis(BASE, [cap(2), price(35)], NOW);
    expect(synthesis.length).toBeGreaterThan(0);
    expect(insight.decision!.whyNow).not.toContain("Across datasets");
    expect(insight.decision!.whyNow).toBe(BASE.decision!.whyNow);
    // Still carried, on the supporting side, so nothing is thrown away.
    const claims = insight.decision!.evidenceFor.map((e) => e.claim).join(" ");
    expect(claims).toContain("Capability across");
  });

  it("refuses stale evidence any route to a why now", () => {
    const { insight } = enrichWithSynthesis(BASE, [cap(2), price(120)], NOW);
    expect(insight.decision!.whyNow).toBe(BASE.decision!.whyNow);
    expect(insight.decision!.whyNow).not.toContain("Across datasets");
  });

  it("refuses undated evidence any route to a why now", () => {
    // An undated reading cannot manufacture urgency, which is the same class
    // of error as inventing the date.
    const { insight } = enrichWithSynthesis(BASE, [cap(2), price(null)], NOW);
    expect(insight.decision!.whyNow).toBe(BASE.decision!.whyNow);
  });

  it("keeps a structural rule firing on evidence past its refresh window", () => {
    // The other half of the policy: a rule whose conclusion is structural does
    // not depend on currency, and must not be quietly suppressed by it.
    const pos = signal({
      id: "pos",
      subject: "Anthropic",
      population: "tracked-vendor-set",
      members: ["Anthropic"],
      dimension: "position",
      state: "clear, and leads its market",
      observedAt: new Date(NOW - 80 * DAY).toISOString(),
      lane: "aie",
      evidence: {
        claim: "Anthropic leads its market",
        source: "AIE vendor rankings",
        basis: "measured",
        lane: "aie",
        asOf: null,
      },
    });
    const risk = signal({
      id: "risk",
      subject: "the tracked set",
      population: "tracked-vendor-set",
      members: ["Anthropic"],
      dimension: "risk",
      state: "carrying 2 open high-severity findings across 1 vendor",
      observedAt: new Date(NOW - 80 * DAY).toISOString(),
      lane: "aie",
      evidence: {
        claim: "2 open high-severity findings",
        source: "AIE risk register",
        basis: "measured",
        lane: "aie",
        asOf: null,
      },
    });
    const found = synthesise([pos, risk], NOW);
    const hit = found.find((s) => s.id === "strength-risk-divergence");
    expect(hit).toBeDefined();
    // It fires, and it still may not create urgency on an aging reading.
    expect(hit!.freshness).toBe("aging");
    expect(canCreateUrgency(hit!.freshness)).toBe(false);
  });
});
