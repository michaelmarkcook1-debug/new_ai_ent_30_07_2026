import { describe, it, expect } from "vitest";
import { createElement } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { AnalystInsight } from "@/lib/ui/analyst-insight";
import {
  pricePerformanceInsight,
  workflowInsight,
} from "@/lib/analyst/insight";

// What the reader actually sees.
//
// The packet is worthless if it stops at the data layer, and the panel is the
// only place it becomes an answer. These render the real component over real
// builder output and read the markup, which is repeatable in a way a
// screenshot is not, and does not need the demo shell's basic auth.
//
// Written with createElement rather than JSX because vitest.config.mts
// includes tests/**/*.test.ts only, and adding .tsx to that glob to get syntax
// sugar would be a config change in service of nothing.

/**
 * The rendered markup as a reader would read it.
 *
 * Entities are decoded because React escapes an apostrophe to &#x27;, so an
 * assertion comparing against the builder's own string fails on prose that is
 * rendering perfectly. Tags are left in place: several assertions below depend
 * on where a line sits relative to the derivation control.
 */
const decode = (html: string) =>
  html
    .replace(/&#x27;/g, "'")
    .replace(/&quot;/g, '"')
    .replace(/&#x2F;/g, "/")
    .replace(/&lt;/g, "<")
    .replace(/&gt;/g, ">")
    .replace(/&amp;/g, "&");

const render = (insight: Parameters<typeof AnalystInsight>[0]["insight"]) =>
  decode(
    renderToStaticMarkup(
      createElement(AnalystInsight, {
        insight,
        context: "price and performance",
        authorship: "computed",
      })
    )
  );

const WIDE = pricePerformanceInsight(
  { models: 42, vendors: 11, ratio: 12, adequate: 9 },
  null,
  "2026-08-20"
);
const NO_RATIO = pricePerformanceInsight(
  { models: 0, vendors: 0, ratio: null, adequate: 0 },
  null,
  null
);
const LOW_RISK = workflowInsight(
  { workflows: 75, categories: 12, highRisk: 9, mapped: 10 },
  null,
  "2026-08-20"
);

describe("the recommendation panel answers the five questions", () => {
  const html = render(WIDE);

  it("WHAT SHOULD I DO: the action, and the instruction under it", () => {
    expect(html).toContain(WIDE.decision!.action);
    expect(html).toContain(WIDE.decision!.instruction);
  });

  it("WHY NOW: labelled, and carrying the computed reason", () => {
    expect(html).toContain("Why now:");
    expect(html).toContain(WIDE.decision!.whyNow);
  });

  // Behind the existing derivation control, which is where the brief puts it:
  // available without overwhelming the recommendation. A static render shows
  // the closed drawer, so what is asserted here is that the control is there
  // and that the packet handed to it carries a traceable source and basis for
  // every claim. The claims themselves are pinned in analyst-decision.test.ts.
  it("WHY SHOULD I BELIEVE IT: the evidence is reachable and traceable", () => {
    expect(html).toContain("What this rests on");
    expect(WIDE.decision!.evidenceFor.length).toBeGreaterThan(0);
    for (const e of WIDE.decision!.evidenceFor) {
      expect(e.source.length).toBeGreaterThan(0);
      expect(e.basis.length).toBeGreaterThan(0);
    }
  });

  it("WHAT ARGUES AGAINST IT: inline, not hidden behind a disclosure control", () => {
    expect(html).toContain("Against this:");
    for (const e of WIDE.decision!.evidenceAgainst) {
      expect(html).toContain(e.claim);
    }
    // Above the derivation control, so a reader meets the contradiction with
    // the recommendation rather than after deciding to go looking for it.
    const against = html.indexOf("Against this:");
    const drawer = html.indexOf("What this rests on");
    expect(against).toBeGreaterThan(-1);
    expect(drawer).toBeGreaterThan(-1);
    expect(against).toBeLessThan(drawer);
  });

  it("WHEN SHOULD I CHANGE MY MIND: the trigger, labelled", () => {
    expect(html).toContain("Watch for:");
    expect(html).toContain(WIDE.decision!.trigger!);
  });

  it("renders the do-not where one is supportable", () => {
    expect(html).toContain("Do not:");
    expect(html).toContain(WIDE.decision!.doNotDo!);
  });

  // The strength sits with the evidence in the derivation control rather than
  // as a badge beside the action. Confidence labels were removed from this
  // platform on request, and a state that reads as one is what that decision
  // was about, so it is stated where the evidence backing it is.
  it("never publishes a confidence score anywhere in the panel", () => {
    expect(WIDE.decision!.strength).toBe("contested");
    expect(html).not.toMatch(/\d{1,3}\s*%\s*confiden/i);
    expect(html).not.toMatch(/confidence (score|level)/i);
  });
});

describe("the panel degrades honestly", () => {
  it("omits the do-not where the builder supports none", () => {
    // The low-risk workflow branch has no over-reach to warn against, and the
    // brief is explicit that one must not be manufactured.
    expect(LOW_RISK.decision!.doNotDo).toBeNull();
    expect(render(LOW_RISK)).not.toContain("Do not:");
  });

  it("omits the against line where nothing argues against", () => {
    expect(LOW_RISK.decision!.evidenceAgainst).toEqual([]);
    expect(render(LOW_RISK)).not.toContain("Against this:");
  });

  it("renders the insufficient state with no recommendation at all", () => {
    const html = render(NO_RATIO);
    expect(NO_RATIO.decision).toBeNull();
    expect(html).toContain("insufficient");
    expect(html).not.toContain("Why now:");
    expect(html).not.toContain("Watch for:");
  });

  it("keeps the lane badge and the authorship, which are provenance", () => {
    const html = render(WIDE);
    // The lane badge and the as-of date sit in the header, not the drawer.
    expect(html).toContain("DERIVED");
    expect(html).toContain("computed");
    expect(html).toContain("2026-08-20");
    // And the ceiling the builder declared still reaches the reader.
    expect(html).toContain("Ask your AG Analyst");
    expect(html).toContain(WIDE.thin!);
  });
});
