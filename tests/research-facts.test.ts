import { describe, it, expect } from "vitest";
import {
  parseStatedValue,
  parsePeriod,
  incomparableBecause,
  comparability,
  reconcile,
  convertedTo,
  fxRate,
  magnitude,
  usableForRecommendation,
  EVIDENCE_RANK,
  FX,
  type CompanyFact,
  type EvidenceType,
} from "@/lib/research/facts";

// Company figures, and the difference between disagreeing and merely differing.
//
// THE DEFECT THIS REPLACES. A stated figure arrived as a string: "£13.65bn" was
// eleven characters, and nothing could ask what currency it was in or what year
// it covered. So the product could not tell two sources reporting one truth in
// two currencies from two sources contradicting each other, and it could not
// tell a restatement from a different fiscal year. Both look like "the numbers
// are different" to a string.
//
// The rule the whole module turns on: the reported figure is never overwritten.
// A conversion is a separate derived value carrying its rate, that rate's date
// and where the rate came from.

const fact = (over: Partial<CompanyFact> = {}): CompanyFact => ({
  metric: "revenue",
  value: 10,
  unit: "billion",
  currency: "GBP",
  period: { kind: "fiscal_year", year: 2025, index: null, label: "FY2025" },
  scope: "group",
  basis: "reported",
  sourceIndex: 0,
  evidenceType: "annual_report",
  asStated: "£10bn",
  ...over,
});

describe("reading a stated figure into its parts", () => {
  it("reads the symbol, the number and the scale", () => {
    expect(parseStatedValue("£13.65bn")).toEqual({
      value: 13.65,
      unit: "billion",
      currency: "GBP",
    });
    expect(parseStatedValue("$1.2 million")).toEqual({
      value: 1.2,
      unit: "million",
      currency: "USD",
    });
    expect(parseStatedValue("€8.7bn")).toEqual({
      value: 8.7,
      unit: "billion",
      currency: "EUR",
    });
  });

  it("reads a currency code as readily as a symbol", () => {
    expect(parseStatedValue("13.65 GBP billion")?.currency).toBe("GBP");
    expect(parseStatedValue("USD 4.2bn")?.currency).toBe("USD");
  });

  it("reads a count with no currency at all", () => {
    const r = parseStatedValue("52,000");
    expect(r).toEqual({ value: 52000, unit: "unit", currency: null });
  });

  it("refuses a range rather than taking one end of it", () => {
    // "£10bn to £12bn" is not a figure, and silently keeping 10 would make the
    // product the author of a precision the source did not give.
    expect(parseStatedValue("£10bn to £12bn")).toBeNull();
    expect(parseStatedValue("10-12 million")).toBeNull();
  });

  it("returns null rather than half-reading something", () => {
    expect(parseStatedValue("")).toBeNull();
    expect(parseStatedValue("about a third")).toBeNull();
  });

  it("puts millions and billions on one scale", () => {
    expect(magnitude(fact({ value: 13650, unit: "million" }))).toBe(
      magnitude(fact({ value: 13.65, unit: "billion" }))
    );
  });
});

describe("reading a period", () => {
  it("keeps fiscal and calendar years apart", () => {
    expect(parsePeriod("FY2025").kind).toBe("fiscal_year");
    expect(parsePeriod("CY2025").kind).toBe("calendar_year");
  });

  it("reads the ways a source actually writes a fiscal year", () => {
    // Observed live: "fiscal 2025" fell through to the bare-year branch and was
    // compared against a calendar figure as though they covered the same
    // twelve months.
    for (const w of ["fiscal 2025", "fiscal year 2025", "FY 2025", "FY ending September 30, 2023"]) {
      expect(parsePeriod(w).kind, w).toBe("fiscal_year");
    }
    expect(parsePeriod("fiscal 2025").year).toBe(2025);
    expect(parsePeriod("FY ending September 30, 2023").year).toBe(2023);
  });

  it("reads quarters and halves with their index", () => {
    expect(parsePeriod("Q3 FY2025")).toMatchObject({ kind: "quarter", year: 2025, index: 3 });
    expect(parsePeriod("H1 2026")).toMatchObject({ kind: "half", year: 2026, index: 1 });
  });

  // A bare year is genuinely ambiguous, and guessing which it is decides
  // whether two figures compare.
  it("leaves a bare year unclassified rather than assuming fiscal", () => {
    const p = parsePeriod("2025");
    expect(p.year).toBe(2025);
    expect(p.kind).toBe("unknown");
  });

  it("says nothing when there is nothing to read", () => {
    expect(parsePeriod(null)).toMatchObject({ kind: "unknown", year: null });
  });
});

// ------------------------------------------------- PART 19: currency matrix

describe("the currency regression matrix", () => {
  const gbp = fact({ value: 10, currency: "GBP", asStated: "£10bn", evidenceType: "annual_report" });

  it("GBP against its USD equivalent, same period, is COMPATIBLE", () => {
    // 10 GBP at 1.35 is 13.5 USD. The same company reported twice.
    const usd = fact({
      value: 13.5,
      currency: "USD",
      asStated: "$13.5bn",
      sourceIndex: 1,
      evidenceType: "primary_reporting",
    });
    const r = reconcile([gbp, usd]);
    expect(r.verdict).toBe("COMPATIBLE");
    expect(r.why).toMatch(/two currencies/i);
    expect(usableForRecommendation(r)).toBe(true);
  });

  it("EUR against its USD equivalent, same period, is COMPATIBLE", () => {
    const eur = fact({ value: 10, currency: "EUR", asStated: "€10bn" });
    const usd = fact({ value: 11.6, currency: "USD", asStated: "$11.6bn", sourceIndex: 1 });
    expect(reconcile([eur, usd]).verdict).toBe("COMPATIBLE");
  });

  it("the same currency and a materially different value is a CONFLICT", () => {
    const other = fact({ value: 17, asStated: "£17bn", sourceIndex: 1 });
    const r = reconcile([gbp, other]);
    expect(r.verdict).toBe("CONFLICTING");
    // And it is left unresolved rather than settled by preference.
    expect(r.chosen).toBeNull();
    expect(usableForRecommendation(r)).toBe(false);
    expect(r.facts).toHaveLength(2);
  });

  it("different fiscal periods are not a contradiction", () => {
    const prior = fact({
      period: { kind: "fiscal_year", year: 2024, index: null, label: "FY2024" },
      value: 17,
      asStated: "£17bn",
      sourceIndex: 1,
    });
    const r = reconcile([gbp, prior]);
    expect(r.verdict).not.toBe("CONFLICTING");
    expect(r.why).toMatch(/different periods/i);
  });

  // The mirror case: matching numbers in different years are two facts.
  it("the same value in two periods is not a duplicate", () => {
    const same = fact({
      period: { kind: "fiscal_year", year: 2024, index: null, label: "FY2024" },
      sourceIndex: 1,
    });
    expect(incomparableBecause(gbp, same)).toMatch(/different periods/i);
  });

  it("segment revenue against group revenue is not a contradiction", () => {
    const segment = fact({ scope: "segment", value: 3, asStated: "£3bn", sourceIndex: 1 });
    const r = reconcile([gbp, segment]);
    expect(r.verdict).not.toBe("CONFLICTING");
    expect(r.why).toMatch(/group.*segment|segment.*group/i);
  });

  it("reported against adjusted is not a contradiction", () => {
    const adjusted = fact({ basis: "adjusted", value: 11.4, asStated: "£11.4bn", sourceIndex: 1 });
    expect(incomparableBecause(gbp, adjusted)).toMatch(/reported.*adjusted|adjusted.*reported/i);
  });

  it("normalises millions against billions correctly", () => {
    const inMillions = fact({ value: 10000, unit: "million", asStated: "£10,000m", sourceIndex: 1 });
    expect(reconcile([gbp, inMillions]).verdict).toBe("CORROBORATED");
  });

  it("treats a missing currency as UNKNOWN rather than as a contradiction", () => {
    const noCurrency = fact({ currency: null, value: 13.5, asStated: "13.5bn", sourceIndex: 1 });
    const r = reconcile([gbp, noCurrency]);
    expect(r.verdict).toBe("INSUFFICIENT");
    expect(r.chosen).toBeNull();
    expect(r.why).toMatch(/without assuming/i);
  });

  it("refuses to compare a pair it holds no rate for, rather than inventing one", () => {
    const jpy = fact({ currency: "JPY", value: 1500, asStated: "¥1,500bn", sourceIndex: 1 });
    const r = reconcile([gbp, jpy]);
    expect(r.verdict).toBe("INSUFFICIENT");
    expect(r.why).toMatch(/no rate is held|inventing/i);
  });

  it("always preserves the source's own value", () => {
    const converted = convertedTo(gbp, "USD")!;
    // The reported figure is untouched.
    expect(converted.value).toBe(10);
    expect(converted.currency).toBe("GBP");
    expect(converted.asStated).toBe("£10bn");
    // And the conversion is a separate derived value that shows its working.
    expect(converted.converted).toMatchObject({
      currency: "USD",
      rate: 1.35,
      rateDate: FX.date,
    });
    expect(converted.converted!.value).toBeCloseTo(13.5, 5);
    expect(converted.converted!.rateSource.length).toBeGreaterThan(5);
  });

  it("returns no conversion where no rate exists, rather than a plausible one", () => {
    expect(convertedTo(fact({ currency: "JPY" }), "GBP")).toBeNull();
    expect(fxRate("GBP", "JPY")).toBeNull();
    expect(fxRate("GBP", "GBP")).toBe(1);
  });
});

describe("what settles a figure and what does not", () => {
  it("takes a lone filing as settled", () => {
    const r = reconcile([fact({ evidenceType: "regulatory_filing" })]);
    expect(r.verdict).toBe("CONFIRMED");
    expect(usableForRecommendation(r)).toBe(true);
  });

  it("reports a lone aggregator figure rather than relying on it", () => {
    const r = reconcile([fact({ evidenceType: "aggregator" })]);
    expect(r.verdict).toBe("INSUFFICIENT");
    expect(r.chosen).toBeNull();
    expect(usableForRecommendation(r)).toBe(false);
  });

  it("lets a filing supersede an aggregator when they genuinely differ", () => {
    const filing = fact({ evidenceType: "regulatory_filing", value: 10, asStated: "£10bn" });
    const blog = fact({
      evidenceType: "aggregator",
      value: 17,
      asStated: "£17bn",
      sourceIndex: 1,
    });
    const r = reconcile([filing, blog]);
    expect(r.verdict).toBe("SUPERSEDED");
    expect(r.chosen?.asStated).toBe("£10bn");
    // The superseded figure stays visible rather than being discarded.
    expect(r.facts).toHaveLength(2);
  });

  it("does not let a small rank gap settle a real disagreement", () => {
    // Adjacent tiers are not authority enough to declare one wrong. A public
    // dataset against primary reporting is a disagreement between two credible
    // sources, and picking one would be preference dressed as reconciliation.
    //
    // The wider gap IS allowed to settle it, and that is deliberate: a
    // company's own announcement about its own revenue genuinely does outrank
    // a third party's report of it. This test originally asserted the opposite
    // and the implementation was right.
    const a = fact({ evidenceType: "public_dataset", value: 10, asStated: "£10bn" });
    const b = fact({
      evidenceType: "primary_reporting",
      value: 17,
      asStated: "£17bn",
      sourceIndex: 1,
    });
    expect(reconcile([a, b]).verdict).toBe("CONFLICTING");
  });

  it("lets a company's own announcement outrank a report about it", () => {
    const announcement = fact({
      evidenceType: "company_announcement",
      value: 10,
      asStated: "£10bn",
    });
    const report = fact({
      evidenceType: "primary_reporting",
      value: 17,
      asStated: "£17bn",
      sourceIndex: 1,
    });
    const r = reconcile([announcement, report]);
    expect(r.verdict).toBe("SUPERSEDED");
    expect(r.chosen?.asStated).toBe("£10bn");
  });

  it("ranks the hierarchy in the declared order", () => {
    const order: EvidenceType[] = [
      "aggregator",
      "secondary_reporting",
      "primary_reporting",
      "public_dataset",
      "company_announcement",
      "annual_report",
      "regulatory_filing",
    ];
    for (let i = 1; i < order.length; i++) {
      expect(EVIDENCE_RANK[order[i]]).toBeGreaterThan(EVIDENCE_RANK[order[i - 1]]);
    }
  });

  it("says nothing when nothing states the figure", () => {
    const r = reconcile([]);
    expect(r.verdict).toBe("INSUFFICIENT");
    expect(r.chosen).toBeNull();
  });

  // The property the opportunity engine depends on.
  it("never lets a conflicted or insufficient figure become usable", () => {
    const conflicted = reconcile([
      fact({ value: 10, asStated: "£10bn" }),
      fact({ value: 17, asStated: "£17bn", sourceIndex: 1 }),
    ]);
    expect(usableForRecommendation(conflicted)).toBe(false);
    expect(usableForRecommendation(reconcile([]))).toBe(false);
  });
});

// The real case this module was built for.
//
// Observed on a live Boots research run, 29 August 2026. The metric cards came
// back as six strings and three of them were revenue:
//
//   Group sales: $23.6 billion
//   Est. revenue (Owler): $7.6B
//   Revenue (RocketReach): $11 billion
//
// Rendered side by side, each looking as settled as the others. Nothing in the
// product could rank an aggregator's estimate below a group figure, notice that
// "group sales" and "estimated revenue" are different claims, or say that three
// numbers spanning threefold do not agree. A reader was left to assume the
// product had checked. This is what it now does instead.
describe("the Boots run, as observed", () => {
  const group = fact({
    metric: "revenue",
    value: 23.6,
    currency: "USD",
    asStated: "$23.6 billion",
    scope: "group",
    evidenceType: "annual_report",
    period: { kind: "unknown", year: null, index: null, label: "" },
    sourceIndex: 0,
  });
  const owler = fact({
    metric: "revenue",
    value: 7.6,
    currency: "USD",
    asStated: "$7.6B",
    scope: "group",
    evidenceType: "aggregator",
    period: { kind: "unknown", year: null, index: null, label: "" },
    sourceIndex: 1,
  });
  const rocketreach = fact({
    metric: "revenue",
    value: 11,
    currency: "USD",
    asStated: "$11 billion",
    scope: "group",
    evidenceType: "aggregator",
    period: { kind: "unknown", year: null, index: null, label: "" },
    sourceIndex: 2,
  });

  it("does not let three disagreeing figures pass as settled", () => {
    const r = reconcile([group, owler, rocketreach]);
    expect(["CONFLICTING", "SUPERSEDED"]).toContain(r.verdict);
    // Every candidate stays visible whichever way it went.
    expect(r.facts).toHaveLength(3);
  });

  it("lets the reported figure supersede an aggregator estimate", () => {
    const r = reconcile([group, owler]);
    expect(r.verdict).toBe("SUPERSEDED");
    expect(r.chosen?.asStated).toBe("$23.6 billion");
    expect(r.why).toMatch(/aggregator/);
  });

  it("leaves two aggregators disagreeing as an unresolved conflict", () => {
    // Neither outranks the other and they are threefold apart, so there is no
    // defensible winner and the product does not invent one.
    const r = reconcile([owler, rocketreach]);
    expect(r.verdict).toBe("CONFLICTING");
    expect(r.chosen).toBeNull();
    expect(usableForRecommendation(r)).toBe(false);
  });

  it("keeps every figure exactly as its source wrote it", () => {
    for (const f of [group, owler, rocketreach]) {
      const before = f.asStated;
      reconcile([group, owler, rocketreach]);
      expect(f.asStated).toBe(before);
      expect(f.converted).toBeUndefined();
    }
  });
});

// Ignorance is not difference, and the product must not confuse them.
//
// Two live runs surfaced the same mistake in two fields. On Boots a filing's
// group revenue met two aggregator figures that stated no scope, and the
// product reported three numbers spanning threefold as "not a disagreement".
// On Salesforce "2025" met "fiscal 2025" and it said "they cover different
// periods", which asserts two different twelve-month windows when the truth is
// that one source never said which it meant.
//
// A known difference cannot become a disagreement. An unknown one cannot become
// anything at all until somebody states the missing field.
describe("unknown is not the same as different", () => {
  const base = fact({ scope: "group", period: { kind: "fiscal_year", year: 2025, index: null, label: "FY2025" } });

  it("calls an unstated scope unknown, not a different measure", () => {
    const unscoped = fact({ scope: "unknown", value: 17, asStated: "£17bn", sourceIndex: 1 });
    const c = comparability(base, unscoped);
    expect(c.kind).toBe("unknown");
    expect(reconcile([base, unscoped]).verdict).toBe("INSUFFICIENT");
  });

  it("still calls group against segment a genuine difference", () => {
    const segment = fact({ scope: "segment", value: 3, asStated: "£3bn", sourceIndex: 1 });
    expect(comparability(base, segment).kind).toBe("different");
  });

  it("calls a bare year against a fiscal year unknown, not different", () => {
    const bare = fact({
      period: { kind: "unknown", year: 2025, index: null, label: "2025" },
      value: 12,
      asStated: "£12bn",
      sourceIndex: 1,
    });
    const c = comparability(base, bare);
    expect(c.kind).toBe("unknown");
    // Narrowed so the reason is readable: only the two non-comparable shapes
    // carry one.
    expect(c.kind === "comparable" ? "" : c.why).toMatch(/fiscal or a calendar/i);
  });

  it("still calls two stated, different years a difference", () => {
    const prior = fact({
      period: { kind: "fiscal_year", year: 2024, index: null, label: "FY2024" },
      sourceIndex: 1,
    });
    expect(comparability(base, prior).kind).toBe("different");
  });

  it("compares two bare years of the same year", () => {
    const p = { kind: "unknown" as const, year: 2025, index: null, label: "2025" };
    const a = fact({ period: p });
    const b = fact({ period: p, value: 10, sourceIndex: 1 });
    expect(comparability(a, b).kind).toBe("comparable");
  });

  it("lets an unknown basis compare, so a filing can supersede an estimate", () => {
    // An aggregator's estimate OF revenue is a claim about the number the
    // filing reports. Blocking on the missing label meant the audited figure
    // could never settle it.
    const filing = fact({ evidenceType: "regulatory_filing", basis: "reported", value: 23.6, asStated: "$23.6bn", currency: "USD" });
    const estimate = fact({ evidenceType: "aggregator", basis: "unknown", value: 7.6, asStated: "$7.6B", currency: "USD", sourceIndex: 1 });
    expect(comparability(filing, estimate).kind).toBe("comparable");
    expect(reconcile([filing, estimate]).verdict).toBe("SUPERSEDED");
  });

  it("still keeps reported and adjusted apart", () => {
    const adjusted = fact({ basis: "adjusted", value: 11.4, asStated: "£11.4bn", sourceIndex: 1 });
    expect(comparability(base, adjusted).kind).toBe("different");
  });
});

describe("the reason reads as a sentence", () => {
  it("says so plainly when a figure carries no period at all", () => {
    const dated = fact({ period: { kind: "fiscal_year", year: 2025, index: null, label: "FY2025" } });
    const undated = fact({
      period: { kind: "unknown", year: null, index: null, label: "" },
      value: 17,
      asStated: "£17bn",
      sourceIndex: 1,
    });
    const why = reconcile([dated, undated]).why;
    expect(why).toMatch(/states no period at all/i);
    // The empty label used to leave "does not say whether  is a fiscal".
    expect(why).not.toMatch(/whether\s+is a fiscal/i);
  });
});
