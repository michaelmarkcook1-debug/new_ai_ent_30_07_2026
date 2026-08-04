import { describe, it, expect } from "vitest";
import { readFileSync } from "node:fs";
import path from "node:path";
import {
  ADOPTION_SOURCES,
  SEC_EDGAR,
  TRACKED_VENDORS,
  sicLabel,
} from "@/lib/adoption/sources";
import { edgarHealth } from "@/lib/adoption/edgar";
import { federalRegisterHealth } from "@/lib/adoption/federal-register";
import type { DisclosureSnapshot } from "@/lib/adoption/types";

// The adoption layer's contract, held without touching the network.
//
// The ingestion script (scripts/ingest-adoption.mjs) deliberately duplicates a
// little of lib/adoption, because this repo has no TypeScript runner and
// adding one to run an eight-request script would be the wrong trade. That
// duplication is only safe if something notices when the two drift, which is
// what the snapshot-shape tests below are for: the committed snapshot is
// parsed as the TypeScript type the app consumes, so a script that starts
// emitting a different shape fails here rather than in a browser.

const snapshotPath = path.join(
  process.cwd(),
  "data",
  "adoption",
  "disclosure-10-K.json"
);
const snapshot = JSON.parse(readFileSync(snapshotPath, "utf8")) as DisclosureSnapshot;

describe("source registry", () => {
  it("registers only sources that can actually run", () => {
    // The ranking engine registers thirteen connectors, eight of which need a
    // key this machine does not hold. Registering those here would produce a
    // list that mostly cannot run, which tells an operator nothing.
    for (const s of ADOPTION_SOURCES) {
      expect(s.requiresKey).toBe(false);
    }
  });

  it("makes every source declare what it cannot support", () => {
    // The half that stops a figure being over-read.
    for (const s of ADOPTION_SOURCES) {
      expect(s.measures.length).toBeGreaterThan(20);
      expect(s.cannotSupport.length).toBeGreaterThan(20);
      expect(s.licence.length).toBeGreaterThan(10);
    }
  });

  it("reports both connectors as runnable without configuration", () => {
    for (const h of [edgarHealth(), federalRegisterHealth()]) {
      expect(h.status).toBe("ok");
      expect(h.configured).toBe(true);
    }
  });

  it("tracks only search terms that cannot collide with ordinary English", () => {
    // "Google" would match nearly every technology filing ever written and
    // measure nothing; "Google Cloud" is the product being adopted.
    const terms = TRACKED_VENDORS.map((v) => v.term);
    expect(terms).not.toContain("Google");
    expect(terms).not.toContain("Microsoft");
    expect(terms).not.toContain("Mistral");
    expect(terms).toContain("Google Cloud");
    expect(terms).toContain("Microsoft Azure");
  });

  it("labels SIC codes it knows and admits the ones it does not", () => {
    expect(sicLabel("7372")).toBe("Prepackaged software");
    expect(sicLabel("0000")).toBe("SIC 0000");
  });
});

describe("committed snapshot", () => {
  it("carries what it measures, with the window", () => {
    expect(snapshot.measures).toMatch(/not market share/i);
    expect(snapshot.formType).toBe("10-K");
    expect(snapshot.window).toMatch(/last \d+ days/);
    expect(Number.isFinite(Date.parse(snapshot.fetchedAt))).toBe(true);
  });

  it("holds a row per tracked vendor, or records why not", () => {
    const seen = new Set([
      ...snapshot.rows.map((r) => r.vendor),
      ...snapshot.failed.map((f) => f.vendor),
    ]);
    for (const v of TRACKED_VENDORS) {
      expect(seen.has(v.vendor)).toBe(true);
    }
  });

  it("never shows a vendor it could not resolve as a zero", () => {
    // A failed lookup is listed in `failed`, not rendered as no adoption.
    for (const r of snapshot.rows) {
      expect(r.filings).toBeGreaterThan(0);
    }
  });

  it("makes every count checkable", () => {
    for (const r of snapshot.rows) {
      expect(r.examples.length).toBeGreaterThan(0);
      expect(r.query).toContain(r.query.includes("filed") ? "filed" : "in");
      for (const e of r.examples) {
        expect(e.url).toMatch(/^https:\/\/www\.sec\.gov\/Archives\/edgar\/data\//);
        expect(e.filedOn).toMatch(/^\d{4}-\d{2}-\d{2}$/);
      }
    }
  });

  it("bounds every example to the stated window", () => {
    // The window is the difference between "ever mentioned since 2001" and
    // "named in a current annual report". A stale example would mean the
    // date bounds silently stopped being applied.
    const days = Number(snapshot.window.match(/\d+/)?.[0] ?? 365);
    const floor = Date.now() - days * 86_400_000;
    // One week of slack: the snapshot is committed and ages between runs.
    const slack = 7 * 86_400_000;
    for (const r of snapshot.rows) {
      for (const e of r.examples) {
        expect(Date.parse(e.filedOn)).toBeGreaterThan(floor - slack);
      }
    }
  });

  it("attributes itself to SEC EDGAR", () => {
    expect(snapshot.source.id).toBe(SEC_EDGAR.id);
    expect(snapshot.source.evidenceClass).toBe("A");
  });

  it("keeps the industry split as EDGAR's own aggregation", () => {
    for (const r of snapshot.rows) {
      const summed = r.bySic.reduce((a, b) => a + b.filings, 0);
      // Buckets are the top eight, so they sum to at most the total.
      expect(summed).toBeLessThanOrEqual(r.filings);
      for (const b of r.bySic) expect(b.label.length).toBeGreaterThan(0);
    }
  });
});
