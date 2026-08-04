import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";
import {
  canonicalVendorId,
  liveVendor,
  liveVendors,
  VENDOR_ID_ALIASES,
} from "@/lib/aie/live-vendors";
import {
  VENDOR_DIRECTORY,
  directoryVendor,
  vendorName,
} from "@/lib/aie/vendor-directory";
import { buildRankingRows } from "@/app/(ai-ent)/vendor-view/data";

// The regression this exists to prevent.
//
// lib/aie/intelligence/ was a copy of the AI Enterprise source taken on 8 July
// 2026 and frozen into TypeScript. It drifted, silently, until Vendor View was
// printing 88 for Anthropic under the field name overallScore while the source
// published 68.3. Every one of the 37 overlapping vendors was higher in the
// copy, by 18 points on average and 46 at worst.
//
// Nothing failed when that happened, which is why it survived. These tests
// fail.

const fixture = JSON.parse(
  readFileSync("fixtures/aie-live/vendors.json", "utf8")
) as { vendors: { id: string; name: string; overallScore?: number; confidenceScore?: number }[] };

describe("the app's vendor figures are the source's vendor figures", () => {
  it("reads every vendor the source publishes", () => {
    expect(liveVendors()).toHaveLength(fixture.vendors.length);
  });

  it("matches overallScore and confidenceScore on every vendor", () => {
    const mismatches: string[] = [];
    for (const v of fixture.vendors) {
      const mine = liveVendor(v.id);
      if (!mine) {
        mismatches.push(`${v.id}: not resolved`);
        continue;
      }
      if (mine.overallScore !== (v.overallScore ?? null)) {
        mismatches.push(`${v.id}: overall ${mine.overallScore} vs ${v.overallScore}`);
      }
      if (mine.confidenceScore !== (v.confidenceScore ?? null)) {
        mismatches.push(
          `${v.id}: confidence ${mine.confidenceScore} vs ${v.confidenceScore}`
        );
      }
    }
    expect(mismatches).toEqual([]);
  });

  it("matches the source's names, so no vendor is renamed in transit", () => {
    // The frozen copy called it "Mistral AI" where the source says "Mistral".
    for (const v of fixture.vendors) {
      expect(vendorName(v.id)).toBe(v.name);
    }
  });
});

describe("the generated directory tracks the fixture", () => {
  it("holds the same roster", () => {
    expect(VENDOR_DIRECTORY.map((v) => v.id).sort()).toEqual(
      fixture.vendors.map((v) => v.id).sort()
    );
  });

  it("carries the same scores as the fixture it was generated from", () => {
    // A stale directory is the exact failure this whole change was about, and
    // it is a generated file, so it goes stale by someone forgetting to run
    // the generator rather than by anyone deciding anything.
    for (const v of fixture.vendors) {
      expect(directoryVendor(v.id)?.overallScore).toBe(v.overallScore ?? null);
    }
  });
});

describe("vendor id aliases", () => {
  it("resolves every renamed id to something the source actually has", () => {
    const ids = new Set(fixture.vendors.map((v) => v.id));
    for (const [oldId, newId] of Object.entries(VENDOR_ID_ALIASES)) {
      expect(ids.has(newId)).toBe(true);
      // The old id must not also exist, or the alias is hiding a real vendor.
      expect(ids.has(oldId)).toBe(false);
      expect(liveVendor(oldId)?.id).toBe(newId);
    }
  });

  it("leaves an unknown id alone rather than guessing", () => {
    expect(canonicalVendorId("not-a-vendor")).toBe("not-a-vendor");
    expect(liveVendor("not-a-vendor")).toBeNull();
  });
});

describe("the rankings table", () => {
  const rows = buildRankingRows();

  it("publishes a score for every row it shows", () => {
    expect(rows.length).toBeGreaterThan(0);
    for (const r of rows) expect(typeof r.overallScore).toBe("number");
  });

  it("shows the source's figure for each vendor", () => {
    const src = new Map(fixture.vendors.map((v) => [v.id, v]));
    for (const r of rows) {
      const v = src.get(canonicalVendorId(r.id));
      expect(v, `${r.id} is not in the source`).toBeDefined();
      expect(r.overallScore).toBe(v!.overallScore);
    }
  });

  it("drops a vendor the source no longer scores rather than showing a stale one", () => {
    const scored = new Set(
      fixture.vendors.filter((v) => typeof v.overallScore === "number").map((v) => v.id)
    );
    for (const r of rows) expect(scored.has(canonicalVendorId(r.id))).toBe(true);
  });
});
