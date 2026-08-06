import { readFileSync } from "node:fs";
import path from "node:path";
import { describe, expect, it } from "vitest";
import {
  SHIELD,
  SHIELD_VERSION,
  shieldScore,
  shieldCoverage,
  shieldScoreWeighted,
  rankedShieldWeighted,
  DEFAULT_SHIELD_WEIGHTS,
} from "@/lib/shield/data";

// The Privacy & IP Shield's whole value is that each mark is the vendor's own
// wording, quoted rather than summarised. A paraphrased legal term is a term
// that will drift, and the pod will act on this without re-deriving it.
//
// The editorial sentences around each quotation were repunctuated when the
// ledger was ported from The Security Desk (house no-em-dash rule). That is
// precisely the kind of edit that can walk into a quotation unnoticed, so the
// quoted spans were extracted from the source at port time and pinned in
// tests/fixtures/shield-quotes.json. Regenerate that fixture only when the
// source ledger is re-verified: scripts/extract-shield-quotes.mjs.

interface QuoteFixture {
  shieldVersion: string;
  count: number;
  quotes: string[];
}

const fixture = JSON.parse(
  readFileSync(
    path.join(process.cwd(), "tests", "fixtures", "shield-quotes.json"),
    "utf8"
  )
) as QuoteFixture;

/** Every note on the ledger, as one searchable corpus. */
const NOTES = SHIELD.flatMap((v) => [
  v.marks.training.note,
  v.marks.retention.note,
  v.marks.indemnity.note,
  v.marks.residency.note,
]).join("\n");

describe("Privacy & IP Shield: the quotes are the vendors' own", () => {
  it("carries every quoted span from the source, byte-identical", () => {
    for (const quote of fixture.quotes) {
      expect(
        NOTES.includes(quote),
        `Quoted span missing or altered: “${quote}”`
      ).toBe(true);
    }
  });

  it("pins the fixture to the ledger version it was extracted from", () => {
    expect(fixture.shieldVersion).toBe(SHIELD_VERSION);
  });

  it("introduces no quotation the source did not carry", () => {
    const ours = [...NOTES.matchAll(/“([^”]+)”/g)].map((m) => m[1]);
    for (const quote of ours) {
      expect(
        fixture.quotes.includes(quote),
        `Quotation not present in the source ledger: “${quote}”`
      ).toBe(true);
    }
  });
});

describe("Privacy & IP Shield: the receipts hold", () => {
  it("gives every determined mark a resolvable source", () => {
    for (const v of SHIELD) {
      for (const [dim, mark] of Object.entries(v.marks)) {
        if (mark.state === "unverified") continue;
        expect(
          mark.source?.url,
          `${v.slug}/${dim} is determined but carries no source URL`
        ).toMatch(/^https:\/\//);
        expect(
          mark.source?.name,
          `${v.slug}/${dim} is determined but carries no source name`
        ).toMatch(/verified \d{4}-\d{2}-\d{2}/);
      }
    }
  });

  it("leaves an unverified mark unsourced rather than half-cited", () => {
    for (const v of SHIELD) {
      for (const [dim, mark] of Object.entries(v.marks)) {
        if (mark.state !== "unverified") continue;
        expect(
          mark.source,
          `${v.slug}/${dim} is unverified but carries a source, which reads as a receipt that does not exist`
        ).toBeUndefined();
        expect(
          mark.note.length,
          `${v.slug}/${dim} is unverified and does not say why`
        ).toBeGreaterThan(20);
      }
    }
  });

  it("holds the house no-em-dash rule across the ported ledger", () => {
    // Built from the codepoint rather than typed, so this file does not trip
    // the rule it enforces. Same move CLAUDE.md makes where it defines it.
    const EM_DASH = String.fromCharCode(0x2014);
    for (const v of SHIELD) {
      for (const [dim, mark] of Object.entries(v.marks)) {
        expect(
          mark.note.includes(EM_DASH),
          `${v.slug}/${dim} contains an em-dash`
        ).toBe(false);
      }
    }
  });

  it("keeps slugs unique", () => {
    const slugs = SHIELD.map((v) => v.slug);
    expect(new Set(slugs).size).toBe(slugs.length);
  });
});

describe("Privacy & IP Shield: the scoring is the stated scoring", () => {
  it("scores unverified as zero, so a missing receipt never flatters", () => {
    const xai = SHIELD.find((v) => v.slug === "xai-grok")!;
    // Two protective, two unverified.
    expect(shieldScore(xai)).toBe(2);
    expect(shieldCoverage(xai)).toBe(2);
  });

  it("separates a low score built on receipts from one built on gaps", () => {
    const moonshot = SHIELD.find((v) => v.slug === "moonshot-kimi")!;
    // Three adverse and one conditional: every mark determined.
    expect(shieldCoverage(moonshot)).toBe(4);
    const ibm = SHIELD.find((v) => v.slug === "ibm-granite")!;
    expect(shieldCoverage(ibm)).toBe(2);
  });

  it("reproduces the fixed ranking exactly at equal weights", () => {
    const weighted = rankedShieldWeighted(DEFAULT_SHIELD_WEIGHTS);
    for (const row of weighted) {
      expect(row.score).toBe(shieldScore(row));
      expect(row.max).toBe(4);
    }
  });

  it("changes only priority, never a fact, when the buyer re-weights", () => {
    const deepseek = SHIELD.find((v) => v.slug === "deepseek")!;
    // Every DeepSeek mark is adverse, so no weighting can lift it off zero.
    expect(
      shieldScoreWeighted(deepseek, {
        training: 3,
        retention: 3,
        indemnity: 3,
        residency: 3,
      })
    ).toBe(0);
  });
});
