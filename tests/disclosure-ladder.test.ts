import { describe, it, expect } from "vitest";
import segmentRevenue from "@/fixtures/sec/segment-revenue.json";
import aiDisclosures from "@/fixtures/sec/ai-revenue-disclosures.json";
import {
  publicLadder,
  privateLadder,
  publicCoverage,
  RUNG_LABEL,
} from "@/lib/finance/disclosure-ladder";

const PUB = publicLadder();
const PRIV = privateLadder();
const at = (k: string) => PUB.find((r) => r.key === k)!;
const priv = (k: string) => PRIV.find((r) => r.key === k)!;

describe("every stated figure is really in the filing", () => {
  // The rung's whole claim is "the company said this". If the phrase is not
  // in the filing text we hold, the claim is ours and not theirs.
  it("quotes a phrase that appears verbatim in the source", () => {
    const vendors = (aiDisclosures as { vendors: { ticker: string; statements?: { statement: string }[] | null }[] })
      .vendors;
    for (const row of PUB.filter((r) => r.rung === "stated")) {
      const texts = (
        vendors.find((v) => v.ticker === row.key)?.statements ?? []
      ).map((s) => s.statement);
      expect(
        texts.some((t) => t.includes(row.stated!.phrase)),
        `${row.key}: phrase not found in any filing statement`
      ).toBe(true);
    }
  });

  it("carries the filing link and form for each", () => {
    for (const row of PUB.filter((r) => r.rung === "stated")) {
      expect(row.stated!.url).toMatch(/^https:\/\/www\.sec\.gov\//);
      expect(row.stated!.form).toBeTruthy();
    }
  });

  // The figures a reader will quote back at us.
  it("reads the right numbers", () => {
    expect(at("AMZN").stated!.valueUsd).toBe(15_000_000_000);
    expect(at("AMZN").stated!.isFloor).toBe(true);
    expect(at("IBM").stated!.valueUsd).toBe(2_000_000_000);
    expect(at("NVDA").stated!.valueUsd).toBe(22_600_000_000);
  });

  // The distinction that stops this rung from overclaiming: two of the three
  // filers did not state AI revenue at all, and the label says what they did
  // state instead.
  it("does not relabel bookings or a segment line as AI revenue", () => {
    expect(at("IBM").stated!.measures).toContain("bookings, not revenue");
    expect(at("NVDA").stated!.measures).toContain("no isolated AI figure");
    expect(at("AMZN").stated!.measures).toContain("AWS AI revenue run rate");
  });
});

describe("bounded rungs are capped by a real audited segment", () => {
  it("uses the named segment's own figure", () => {
    const companies = (segmentRevenue as {
      companies: { ticker: string; segments?: { segment: string; revenueUsd: number }[] | null }[];
    }).companies;
    for (const row of PUB.filter((r) => r.rung === "bounded")) {
      const segs = companies.find((c) => c.ticker === row.key)?.segments ?? [];
      const hit = segs.find((s) => s.segment === row.bounded!.segment);
      expect(hit, `${row.key}: named segment missing`).toBeDefined();
      expect(row.bounded!.ceilingUsd).toBe(hit!.revenueUsd);
    }
  });

  it("brackets Alphabet at the Google Cloud segment", () => {
    const g = at("GOOGL");
    expect(g.rung).toBe("bounded");
    expect(g.bounded!.segment).toBe("Google Cloud");
    expect(g.bounded!.ceilingUsd).toBe(58_705_000_000);
  });

  it("says so when a bound is too wide to be worth much", () => {
    // Meta sells no AI product line, so its bracket is close to the whole
    // company and should not be read as a measurement.
    expect(at("META").bounded!.looseNote).toBeTruthy();
    expect(at("GOOGL").bounded!.looseNote).toBeUndefined();
  });

  it("names why each segment is the ceiling", () => {
    for (const row of PUB.filter((r) => r.rung === "bounded")) {
      expect(row.bounded!.because.length).toBeGreaterThan(20);
    }
  });
});

describe("the ingestion gap is not blamed on the filer", () => {
  // Salesforce and ServiceNow both file segment data. We have not ingested
  // it. Saying "not estimable" without that distinction would report our
  // backlog as their silence.
  it("says the gap is ours for CRM and NOW", () => {
    for (const k of ["CRM", "NOW"]) {
      const row = at(k);
      expect(row.rung).toBe("not_estimable");
      expect(row.notEstimable).toContain("gap in our pipeline");
    }
  });
});

describe("coverage improves without inventing anything", () => {
  it("takes 7 of 9 ingested filers to a stated figure or a hard bound", () => {
    const c = publicCoverage();
    expect(c.ingested).toBe(9);
    expect(c.withFigure).toBe(7);
    expect(PUB.filter((r) => r.rung === "stated").length).toBe(3);
    expect(PUB.filter((r) => r.rung === "bounded").length).toBe(4);
  });

  // The selector offers 14 tickers. Five had no card at all, so picking one
  // led to an empty page rather than to a stated gap.
  it("lists every ticker in the selector, ingested or not", () => {
    const roster = [
      { ticker: "MSFT", name: "Microsoft" },
      { ticker: "SAP", name: "SAP" },
      { ticker: "ADBE", name: "Adobe" },
      { ticker: "CSCO", name: "Cisco" },
      { ticker: "DELL", name: "Dell" },
      { ticker: "BABA", name: "Alibaba" },
    ];
    const rows = publicLadder(roster);
    const c = publicCoverage(roster);
    expect(c.listed).toBe(14);
    for (const t of ["SAP", "ADBE", "CSCO", "DELL", "BABA"]) {
      const row = rows.find((r) => r.key === t);
      expect(row, `${t} missing from the ladder`).toBeDefined();
      expect(row!.rung).toBe("not_estimable");
      expect(row!.notEstimable).toContain("our gap, not the filer");
    }
    // A ticker already in the segment fixture is not duplicated.
    expect(rows.filter((r) => r.key === "MSFT").length).toBe(1);
  });
});

describe("the private ladder", () => {
  it("puts a reported revenue above a valuation-implied range", () => {
    expect(priv("mistral").rung).toBe("stated");
    expect(priv("mistral").stated!.isFloor).toBe(true);
  });

  it("derives Anthropic and Cohere from their disclosed rounds", () => {
    for (const id of ["anthropic", "cohere"]) {
      const row = priv(id);
      expect(row.rung).toBe("derived");
      expect(row.derived!.lowUsd).toBeGreaterThan(0);
      expect(row.derived!.highUsd).toBeGreaterThan(row.derived!.lowUsd);
      expect(row.derived!.basis).toContain("multiple band");
    }
  });

  it("refuses to score OpenAI off a compute commitment", () => {
    const o = priv("openai");
    expect(o.rung).toBe("not_estimable");
    expect(o.notEstimable).toMatch(/not a valuation/i);
  });

  it("leaves the rest not estimable rather than guessing", () => {
    for (const id of ["xai", "databricks", "together"]) {
      expect(priv(id).rung).toBe("not_estimable");
      expect(priv(id).derived).toBeUndefined();
      expect(priv(id).stated).toBeUndefined();
    }
  });

  it("names every private vendor rather than showing an id", () => {
    for (const row of PRIV) {
      expect(row.name).not.toBe(row.key);
    }
  });
});

describe("rung labels", () => {
  it("calls an override the reader's figure, not ours", () => {
    expect(RUNG_LABEL.override).toBe("YOUR FIGURE");
  });
});
