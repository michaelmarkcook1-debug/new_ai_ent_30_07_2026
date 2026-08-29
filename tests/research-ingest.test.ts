import { describe, it, expect } from "vitest";
import {
  factsFrom,
  reconcileFacts,
  evidenceTypeFor,
  verdictNote,
  type RawMetric,
} from "@/lib/research/ingest";
import type { SearchHit } from "@/lib/research/search";

// What the model reported, turned into facts the product may reason over.
//
// THE RULE THIS FILE ENFORCES. Model JSON parsing is not model JSON being true.
// The research call now returns a period, a scope and a reported-or-estimated
// status beside every figure, and each of those is a field a model can fill in
// plausibly when the passage never said. So nothing is taken on trust: a value
// that cannot be read produces no fact, and a period, scope or basis that
// cannot be classified becomes `unknown` rather than a default.
//
// Unknown is load-bearing rather than a gap. Two facts whose periods differ are
// not comparable, and an unknown period differs from every stated one, so a
// figure the model could not date can never be used to contradict a dated one.

const hit = (url: string): SearchHit =>
  ({ url, title: "t", snippet: "s" }) as SearchHit;

const SOURCES = [
  hit("https://www.sec.gov/Archives/edgar/data/123/10-K.htm"),
  hit("https://www.owler.com/company/boots"),
  hit("https://rocketreach.co/boots-profile"),
  hit("https://www.reuters.com/business/boots-results"),
];

const raw = (over: Partial<RawMetric> = {}): RawMetric => ({
  label: "Revenue",
  value: "£10bn",
  sourceIndex: 0,
  metric: "revenue",
  period: "FY2025",
  scope: "group",
  basis: "reported",
  ...over,
});

describe("ranking a source by what it is", () => {
  it("recognises filings, aggregators and reporting", () => {
    expect(evidenceTypeFor("https://www.sec.gov/edgar/x")).toBe("regulatory_filing");
    expect(evidenceTypeFor("https://www.owler.com/company/x")).toBe("aggregator");
    expect(evidenceTypeFor("https://rocketreach.co/x")).toBe("aggregator");
    expect(evidenceTypeFor("https://www.reuters.com/x")).toBe("primary_reporting");
  });

  it("puts anything it cannot place mid-table rather than guessing", () => {
    // Mid-table neither promotes nor demotes on a guess.
    expect(evidenceTypeFor("https://some-blog.example/x")).toBe("secondary_reporting");
    expect(evidenceTypeFor(undefined)).toBe("secondary_reporting");
  });
});

describe("refusing to coerce ambiguity into certainty", () => {
  it("drops a figure whose value cannot be read", () => {
    // The card still renders the string; it simply is not reasoned over.
    expect(factsFrom([raw({ value: "about a third" })], SOURCES)).toHaveLength(0);
    expect(factsFrom([raw({ value: "£10bn to £12bn" })], SOURCES)).toHaveLength(0);
  });

  it("treats an unclassifiable period as unknown, never as this year", () => {
    for (const period of [undefined, "", "recently", "last year"]) {
      const [f] = factsFrom([raw({ period })], SOURCES);
      expect(f.period.kind, String(period)).toBe("unknown");
    }
  });

  it("treats an unclassifiable scope as unknown, never as group", () => {
    // "A figure that simply says revenue without saying whose is not group by
    // default" is the rule the prompt states and this is where it is kept.
    for (const scope of [undefined, "", "whole business", "consolidated-ish"]) {
      const [f] = factsFrom([raw({ scope })], SOURCES);
      expect(f.scope, String(scope)).toBe("unknown");
    }
    expect(factsFrom([raw({ scope: "segment" })], SOURCES)[0].scope).toBe("segment");
  });

  it("never lets an estimate be recorded as reported", () => {
    const [f] = factsFrom([raw({ basis: "estimated" })], SOURCES);
    expect(f.basis).toBe("unknown");
    expect(f.basis).not.toBe("reported");
  });

  it("falls back to the label when the metric name is unusable", () => {
    // So an unclassified figure still groups with its own kind rather than
    // becoming a singleton that escapes reconciliation entirely.
    const [f] = factsFrom([raw({ metric: "!!!", label: "Group Sales" })], SOURCES);
    expect(f.metric).toBe("group_sales");
  });

  it("keeps the figure exactly as the source wrote it", () => {
    const [f] = factsFrom([raw({ value: "  £13.65bn  " })], SOURCES);
    expect(f.asStated).toBe("£13.65bn");
    expect(f.value).toBe(13.65);
    expect(f.currency).toBe("GBP");
    expect(f.converted).toBeUndefined();
  });

  it("takes the source rank from what was actually retrieved", () => {
    const [f] = factsFrom([raw({ sourceIndex: 1 })], SOURCES);
    expect(f.evidenceType).toBe("aggregator");
  });
});

// --------------------------------------------------- PART 6: Boots, live

describe("the Boots case, through the live ingest path", () => {
  // Exactly what the live run returned on 29 August 2026, with the
  // classification the updated prompt now asks for.
  const BOOTS: RawMetric[] = [
    {
      label: "Group sales",
      value: "$23.6 billion",
      sourceIndex: 0,
      metric: "revenue",
      scope: "group",
      basis: "reported",
    },
    {
      label: "Est. revenue (Owler)",
      value: "$7.6B",
      sourceIndex: 1,
      metric: "revenue",
      basis: "estimated",
    },
    {
      label: "Revenue (RocketReach)",
      value: "$11 billion",
      sourceIndex: 2,
      metric: "revenue",
      basis: "estimated",
    },
    {
      label: "Employees",
      value: "66,400",
      sourceIndex: 0,
      metric: "employees",
      period: "2025",
    },
  ];

  const facts = factsFrom(BOOTS, SOURCES);
  const reconciled = reconcileFacts(facts);
  const revenue = reconciled.find((r) => r.metric === "revenue")!;

  it("groups three differently labelled figures as one measure", () => {
    // "Group sales", "Est. revenue (Owler)" and "Revenue (RocketReach)" sat on
    // the page as three unrelated cards. They are three candidates for one
    // number and now meet as such.
    expect(revenue.reconciliation.facts).toHaveLength(3);
  });

  it("no longer presents all three as equally settled", () => {
    // INSUFFICIENT, and that is the honest answer rather than a weaker one.
    // The filing states group scope; neither aggregator says what its figure
    // covers, so whether they even describe the same quantity cannot be
    // established. Calling that COMPATIBLE would assert agreement the evidence
    // does not support, and calling it CONFLICTING would assert they are the
    // same claim. The product says it cannot tell, and uses none of them.
    expect(["CONFLICTING", "SUPERSEDED", "INSUFFICIENT"]).toContain(
      revenue.reconciliation.verdict
    );
    expect(revenue.reconciliation.verdict).not.toBe("COMPATIBLE");
    expect(revenue.reconciliation.verdict).not.toBe("CORROBORATED");
    expect(verdictNote(revenue)).toBeTruthy();
  });

  it("says the figures are far apart rather than only that scope is unstated", () => {
    // A reader looking at $23.6bn beside $7.6bn needs to be told the product
    // noticed, not just that a field was missing.
    expect(revenue.reconciliation.why).toMatch(/far apart/i);
  });

  it("identifies the reporting-grade figure and labels the estimates", () => {
    const byStated = new Map(revenue.reconciliation.facts.map((f) => [f.asStated, f]));
    expect(byStated.get("$23.6 billion")!.evidenceType).toBe("regulatory_filing");
    expect(byStated.get("$7.6B")!.evidenceType).toBe("aggregator");
    expect(byStated.get("$11 billion")!.evidenceType).toBe("aggregator");
    // And neither aggregator figure was allowed to call itself reported.
    expect(byStated.get("$7.6B")!.basis).toBe("unknown");
  });

  it("keeps the disagreement visible rather than hiding it", () => {
    expect(revenue.reconciliation.facts).toHaveLength(3);
    for (const f of revenue.reconciliation.facts) {
      expect(f.asStated).toMatch(/\$/);
    }
  });

  it("invents no reconciled midpoint", () => {
    const values = revenue.reconciliation.facts.map((f) => f.value).sort((x, y) => x - y);
    expect(values).toEqual([7.6, 11, 23.6]);
    // Nothing averaged, nothing rewritten.
    const chosen = revenue.reconciliation.chosen;
    if (chosen) expect([7.6, 11, 23.6]).toContain(chosen.value);
  });

  it("does not let the unresolved figure drive a recommendation", () => {
    // Nothing is chosen, so nothing downstream can lean on it.
    expect(revenue.usable).toBe(false);
    expect(revenue.reconciliation.chosen).toBeNull();
  });

  it("resolves it once the aggregators say what their figure covers", () => {
    // The same three numbers, with scope stated, become a real comparison: the
    // filing outranks both aggregators and supersedes them. The missing field
    // was the whole reason it could not be settled.
    const scoped = BOOTS.map((m) =>
      m.metric === "revenue" ? { ...m, scope: "group" } : m
    );
    const r = reconcileFacts(factsFrom(scoped, SOURCES)).find(
      (x) => x.metric === "revenue"
    )!;
    expect(r.reconciliation.verdict).toBe("SUPERSEDED");
    expect(r.reconciliation.chosen?.asStated).toBe("$23.6 billion");
    expect(r.usable).toBe(true);
  });

  it("leaves the employee count alone, having nothing to compare it with", () => {
    const employees = reconciled.find((r) => r.metric === "employees")!;
    expect(employees.reconciliation.facts).toHaveLength(1);
    expect(employees.reconciliation.facts[0].value).toBe(66400);
  });
});

describe("what the page is told to say", () => {
  it("says nothing about a single settled figure", () => {
    const facts = factsFrom([raw({ sourceIndex: 0 })], SOURCES);
    const [r] = reconcileFacts(facts);
    // A filing on its own is CONFIRMED, and a note beside every figure would
    // be noise rather than information.
    expect(verdictNote(r)).toBeNull();
  });

  it("speaks up about a lone aggregator estimate", () => {
    const facts = factsFrom([raw({ sourceIndex: 1 })], SOURCES);
    const [r] = reconcileFacts(facts);
    expect(r.usable).toBe(false);
    expect(verdictNote(r)).toMatch(/aggregator|rather than a filing/i);
  });

  it("speaks up whenever two sources spoke to one measure", () => {
    const facts = factsFrom(
      [raw({ sourceIndex: 0 }), raw({ sourceIndex: 3, value: "£17bn" })],
      SOURCES
    );
    const [r] = reconcileFacts(facts);
    expect(verdictNote(r)).toBeTruthy();
  });
});
