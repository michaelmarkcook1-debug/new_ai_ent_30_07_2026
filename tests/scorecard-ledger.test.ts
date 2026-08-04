import { describe, it, expect } from "vitest";
import { readFileSync, writeFileSync, mkdirSync, existsSync } from "node:fs";
import path from "node:path";
import { scorecardSet } from "@/lib/vendor/composite-data";
import { INPUT_KEYS } from "@/lib/vendor/composite";

// The Scorecard Ledger: vendor x three inputs x composite x confidence.
//
// Internal only, and deliberately not a page. It exists to drive the data
// backlog, so it is a committed artefact a person can diff between syncs
// rather than a view a buyer could stumble into and read as a product claim.
//
// It is generated from the same scorecardSet() the product renders, not from
// a second copy of the rules, and this test fails when the committed file
// drifts from what the code now produces. Regenerate with:
//
//   WRITE_LEDGER=1 npx vitest run tests/scorecard-ledger.test.ts

const OUT = path.join(process.cwd(), "reports", "scorecard-ledger.json");

function build() {
  const set = scorecardSet();
  return {
    note: "Internal. Vendor coverage of the three composite inputs, for the data backlog. Not shipped to users.",
    coverage: set.coverage,
    total: set.total,
    byInputCount: [0, 1, 2, 3].map((n) => ({
      inputs: n,
      vendors: set.vendors.filter((v) => v.result.inputsPresent === n).length,
    })),
    thresholds: set.thresholds,
    vendors: set.vendors
      .map((v) => ({
        vendorId: v.vendorId,
        name: v.name,
        winning: v.inputs.winning,
        trust: v.inputs.trust,
        durability: v.inputs.durability,
        composite: v.result.score,
        confidence: `${v.result.inputsPresent} of ${v.result.inputsTotal}`,
        missing: v.result.missing,
      }))
      // Thinnest coverage first: this is a backlog, so the gaps lead.
      .sort(
        (a, b) =>
          a.missing.length * -1 - b.missing.length * -1 ||
          a.vendorId.localeCompare(b.vendorId)
      ),
  };
}

describe("the scorecard ledger", () => {
  it("matches the committed report", () => {
    const fresh = build();
    if (process.env.WRITE_LEDGER) {
      mkdirSync(path.dirname(OUT), { recursive: true });
      writeFileSync(OUT, `${JSON.stringify(fresh, null, 2)}\n`);
    }
    expect(existsSync(OUT)).toBe(true);
    const committed = JSON.parse(readFileSync(OUT, "utf8"));
    expect(committed).toEqual(fresh);
  });

  it("carries a confidence column on every row", () => {
    const l = build();
    expect(l.vendors.length).toBe(43);
    for (const v of l.vendors) {
      expect(v.confidence).toMatch(/^[0-3] of 3$/);
      // The acceptance rule, enforced on the internal artefact too: a
      // composite never appears without the count behind it.
      if (v.composite !== null) {
        expect(v.confidence).toBeTruthy();
      }
    }
  });

  it("leads with the vendors that need data most", () => {
    const l = build();
    const missingCounts = l.vendors.map((v) => v.missing.length);
    for (let i = 1; i < missingCounts.length; i++) {
      expect(missingCounts[i]).toBeLessThanOrEqual(missingCounts[i - 1]);
    }
  });

  it("reports coverage for all three inputs", () => {
    const l = build();
    for (const k of INPUT_KEYS) {
      expect(typeof l.coverage[k]).toBe("number");
    }
  });
});
