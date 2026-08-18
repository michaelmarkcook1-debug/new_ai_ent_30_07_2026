import { describe, it, expect } from "vitest";
import { readFileSync } from "node:fs";
import {
  modelEngineHandoff,
  SECTOR_TO_INDUSTRIES,
  CATEGORY_TO_FUNCTION,
} from "@/lib/position/handoff";
import { opportunitiesFor } from "@/lib/position/opportunities";
import { TAG_LABEL } from "@/lib/exposure/vertical";
import type { SavedPosition } from "@/lib/position/store";

// The bridge from the workflow catalogue's fifteen sector tags to the role
// library's thirty-seven industries. The two were authored independently, so
// the only thing keeping this map honest is a test that reads both.

const roles = JSON.parse(
  readFileSync("lib/model-fit/data/roles.json", "utf8")
) as Record<string, { industry: string; function: string }>;
const INDUSTRIES = new Set(Object.values(roles).map((r) => r.industry));
const FUNCTIONS = new Set(Object.values(roles).map((r) => r.function));

const pos = (sectorTag: string | null): SavedPosition => ({
  key: "co", query: "Co", name: "Co", what: "a company", industry: "x",
  sectorTag, aiFindings: [], findings: [], recommendations: [],
  savedAt: "2026-08-18",
});

describe("the sector to industry bridge", () => {
  it("only names industries the role library actually holds", () => {
    // A typo here would preselect an industry whose dropdown entry does not
    // exist, and the menu would silently show nothing.
    for (const [tag, list] of Object.entries(SECTOR_TO_INDUSTRIES)) {
      expect(list.length, `${tag} maps to nothing`).toBeGreaterThan(0);
      for (const i of list) {
        expect(INDUSTRIES.has(i), `${tag} -> "${i}" is not in the role library`).toBe(true);
      }
    }
  });

  it("only names functions the role library actually holds", () => {
    for (const [cat, fn] of Object.entries(CATEGORY_TO_FUNCTION)) {
      expect(FUNCTIONS.has(fn), `${cat} -> "${fn}" is not in the role library`).toBe(true);
    }
  });

  it("covers every sector the research classifier can return", () => {
    // placeSector() returns one of TAG_LABEL's keys or null, so an unmapped
    // key means a reader who researched that sector gets no handoff at all.
    for (const tag of Object.keys(TAG_LABEL)) {
      expect(SECTOR_TO_INDUSTRIES[tag], `${tag} has no industries`).toBeDefined();
      const h = modelEngineHandoff(opportunitiesFor(pos(tag)));
      expect(h, `${tag} produced no handoff`).not.toBeNull();
      expect(INDUSTRIES.has(h!.industry)).toBe(true);
    }
  });

  it("never preselects a role, only the context above it", () => {
    // The rule ModelEngine states about itself: a role sitting there by
    // default is one the tool answered on its own. Industry and function are
    // context the reader established; the role is the question they are asking.
    const h = modelEngineHandoff(opportunitiesFor(pos("financial_services")))!;
    expect(Object.keys(h)).not.toContain("roleId");
    expect(Object.keys(h)).not.toContain("role");
  });

  it("returns null rather than guessing when nothing was established", () => {
    expect(modelEngineHandoff(null)).toBeNull();
    expect(modelEngineHandoff(opportunitiesFor(pos(null)))).toBeNull();
  });

  it("hands over the alternatives rather than pretending one industry fits", () => {
    // financial_services covers retail banking, investment banking, payments
    // and asset management. Picking one silently would be a guess.
    const h = modelEngineHandoff(opportunitiesFor(pos("financial_services")))!;
    expect(h.alternatives.length).toBeGreaterThan(0);
    for (const a of h.alternatives) expect(INDUSTRIES.has(a)).toBe(true);
    expect(h.alternatives).not.toContain(h.industry);
  });

  it("says which area a preselected function came from", () => {
    for (const tag of Object.keys(TAG_LABEL)) {
      const h = modelEngineHandoff(opportunitiesFor(pos(tag)))!;
      // A function without the area that produced it is an unexplained
      // preselection, which is what the page refuses to do.
      if (h.fn) expect(h.fromArea).toBeTruthy();
    }
  });
});
