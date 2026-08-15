import { describe, it, expect } from "vitest";
import { readFileSync } from "node:fs";
import path from "node:path";
import { isInvestor, investorIds } from "@/lib/vendor/is-investor";
import { changesSince, type ChangeLog } from "@/lib/changes/snapshot";
import { scorecardSet } from "@/lib/vendor/composite-data";
import { buildShortlist, shortlistCategories } from "@/lib/desk/shortlist";
import { VENDOR_DIRECTORY } from "@/lib/aie/vendor-directory";

// Who is not a vendor, and where that has to be enforced.
//
// The ranking engine tracks four investment firms beside the vendors. The
// composite has excluded them since it was written, on the grounds that "is it
// winning, do people trust it, will it still exist in three years" are
// questions about a supplier and asking them of Sequoia Capital is a category
// error. That rule was enforced in exactly one place.
//
// On 8 August 2026 the "Since you last looked" panel filled all six of its rows
// with MGX and wrote a paragraph advising shorter commitments and priced exit
// terms, drawn entirely from an investment fund's capability scores. MGX had 12
// recorded moves, the joint highest of any entity tracked, because it is thinly
// assessed: with little evidence underneath it, small revisions swing its
// numbers hard and it wins any ranking sorted by size of movement.
//
// So the rule now lives in one module and these tests hold every reader of it
// to the same line.

describe("the four investors are known, and known as a group", () => {
  it("identifies them from the directory rather than a hardcoded list", () => {
    expect(investorIds()).toEqual(["a16z", "mgx", "sequoia", "softbank"]);
    for (const id of investorIds()) expect(isInvestor(id)).toBe(true);
  });

  it("does not catch an actual vendor", () => {
    for (const id of ["openai", "anthropic", "google", "meta", "alibaba"]) {
      expect(isInvestor(id), id).toBe(false);
    }
  });

  it("stays in step with the directory as it changes", () => {
    // A fifth investor added upstream is excluded without anybody editing this.
    const fromDirectory = VENDOR_DIRECTORY.filter(
      (v) => v.category === "AI investor"
    ).map((v) => v.id);
    expect(investorIds().sort()).toEqual(fromDirectory.sort());
  });
});

describe("the movement feed never reports an investor", () => {
  // This is the surface that broke. Every reader of changesSince is
  // buyer-facing, so the filter sits there rather than in one panel.
  const log: ChangeLog = JSON.parse(
    readFileSync(
      path.join(process.cwd(), "fixtures", "signal-changes.json"),
      "utf8"
    )
  );

  it("has investor movement in the raw log", () => {
    // If this fails the fixture changed and the test below proves nothing.
    expect(log.changes.some((c) => isInvestor(c.vendorId))).toBe(true);
  });

  it("filters every one of them out on read", () => {
    for (const c of changesSince(log, null, null)) {
      expect(isInvestor(c.vendorId), `${c.vendorId} ${c.label}`).toBe(false);
    }
  });

  it("filters them out even when a reader watches one", () => {
    // Watching MGX cannot smuggle it back in: it is still not a supplier.
    const watched = changesSince(log, null, ["mgx", "openai"]);
    expect(watched.every((c) => c.vendorId !== "mgx")).toBe(true);
  });

  it("leaves the rest of the log intact", () => {
    const all = changesSince(log, null, null);
    expect(all.length).toBeGreaterThan(50);
    expect(new Set(all.map((c) => c.vendorId)).size).toBeGreaterThan(5);
  });

  it("no longer lets one entity dominate the panel", () => {
    // The panel shows six rows. MGX supplied all six.
    const top6 = changesSince(log, null, null).slice(0, 6);
    const byVendor = new Map<string, number>();
    for (const c of top6)
      byVendor.set(c.vendorId, (byVendor.get(c.vendorId) ?? 0) + 1);
    expect(Math.max(...byVendor.values())).toBeLessThan(6);
  });
});

describe("the other buyer-facing surfaces hold the same line", () => {
  it("keeps investors out of the composite", () => {
    const ids = scorecardSet().vendors.map((v) => v.vendorId);
    for (const id of investorIds()) expect(ids).not.toContain(id);
  });

  it("keeps investors out of every shortlist category", () => {
    expect(shortlistCategories().map((c) => c.category)).not.toContain(
      "AI investor"
    );
    for (const c of shortlistCategories()) {
      for (const e of buildShortlist(c.category)!.entries) {
        expect(isInvestor(e.vendorId), e.name).toBe(false);
      }
    }
  });
});
