import { describe, it, expect } from "vitest";
import { supplyMapInsight } from "@/lib/analyst/insight";

// The analyst voice, guarded against the failure it actually had.
//
// An Analyst Insight is meant to tell a buyer what a page means for their
// decision and where it sits in the wider market. The supply map instead
// reported our own evidence quality: "Of 51 edges between 22 organisations, 23
// are verified and 28 are seed. At 45 per cent verified, this is a map of where
// to send procurement questions, not an answer to them."
//
// Every figure in that sentence was true. It is still the wrong paragraph: a
// reader came to find out who can deliver the vendor they are about to buy, and
// was told how much data we hold. The model could not have done better, because
// the only facts the builder handed it were counts of our own records.
//
// These tests pin the fix at the builder, which is where it has to hold. The
// model rewrites this prose, so a builder that computes coverage statistics
// produces a coverage paragraph however the prompt is worded.

const NEWS = null;

// Two vendors carried by several firms, one carried by a single firm.
const BREADTH = [
  { vendor: "Vendor A", partners: 6 },
  { vendor: "Vendor B", partners: 3 },
  { vendor: "Vendor C", partners: 1 },
];

describe("the supply map reads as market analysis, not a data audit", () => {
  const insight = supplyMapInsight(
    {
      edges: 51,
      verified: 23,
      seed: 28,
      nodes: 22,
      label: "alliance",
      breadth: BREADTH,
      busiest: { partner: "Partner X", vendors: 9 },
    },
    NEWS,
    null
  );

  it("does not make our own evidence quality the headline", () => {
    const h = insight.headline.toLowerCase();
    for (const tell of ["verified", "seed", "per cent verified", "evidence"]) {
      expect(h).not.toContain(tell);
    }
  });

  it("leads on what the channel does to a buyer's options", () => {
    // The finding on this page: choosing a vendor can also choose the only
    // firm able to deliver it.
    expect(insight.headline.toLowerCase()).toContain("deliver");
  });

  it("names the widest channel and the single-firm risk", () => {
    expect(insight.summary).toContain("Vendor A");
    expect(insight.summary).toContain("6");
    // One vendor is sole-sourced, and that is the consequence worth stating.
    expect(insight.summary.toLowerCase()).toContain("single firm");
  });

  it("keeps coverage as a caveat rather than the subject", () => {
    // Still said, because 45 per cent confirmed genuinely limits the claim.
    // Said last, in one clause, rather than as the finding.
    const s = insight.summary;
    const caution = s.toLowerCase().indexOf("under half");
    expect(caution).toBeGreaterThan(-1);
    expect(caution).toBeGreaterThan(s.length / 2);
  });

  it("routes the reader to the decision, not to more research about us", () => {
    expect(insight.action).toBe("Investigate");
    expect(insight.implications.join(" ").toLowerCase()).toContain("negotiate");
  });
});

describe("a fully second-sourced channel reads differently", () => {
  const insight = supplyMapInsight(
    {
      edges: 40,
      verified: 34,
      seed: 6,
      nodes: 15,
      label: "alliance",
      breadth: [
        { vendor: "Vendor A", partners: 5 },
        { vendor: "Vendor B", partners: 2 },
      ],
      busiest: { partner: "Partner X", vendors: 7 },
    },
    NEWS,
    null
  );

  it("says delivery is not the constraint when nothing is sole-sourced", () => {
    expect(insight.headline.toLowerCase()).toContain("not the constraint");
    expect(insight.action).toBe("Monitor");
  });

  it("still warns that a capability shortlist can converge on one team", () => {
    expect(insight.summary).toContain("Partner X");
    expect(insight.implications.join(" ").toLowerCase()).toContain(
      "one delivery team"
    );
  });
});

describe("an empty map says so rather than inventing a channel", () => {
  it("returns the insufficient state", () => {
    const insight = supplyMapInsight(
      { edges: 0, verified: 0, seed: 0, nodes: 0, label: "alliance" },
      NEWS,
      null
    );
    expect(insight.insufficient).not.toBeNull();
  });
});

describe("no em-dashes reach a reader", () => {
  // The standing rule, checked where the prose is actually generated rather
  // than only in the documentation.
  it("keeps the supply map clean", () => {
    const insight = supplyMapInsight(
      {
        edges: 51,
        verified: 23,
        seed: 28,
        nodes: 22,
        label: "alliance",
        breadth: BREADTH,
        busiest: { partner: "Partner X", vendors: 9 },
      },
      NEWS,
      null
    );
    const all = [
      insight.headline,
      insight.summary,
      ...insight.implications,
    ].join(" ");
    expect(all).not.toContain(String.fromCharCode(0x2014));
  });
});
