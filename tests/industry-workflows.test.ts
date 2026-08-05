import { describe, expect, it } from "vitest";
import { readFileSync } from "node:fs";
import { USE_CASES } from "@/lib/aie";
import {
  SEGMENT_TO_INDUSTRY,
  WORKFLOW_LIBRARY_SIZE,
  workflowsForSegment,
} from "@/lib/peer/industry-workflows";
import { ADOPTION_SEGMENTS } from "@/app/(ai-ent)/peer-insights/data";

// The industry-first read of the workflow library, and the guard that stopped
// a stale count being quoted at readers.

describe("segment to industry mapping", () => {
  it("covers every segment the explorer can select", () => {
    // A segment with no mapping would silently show only horizontal
    // workflows while the heading named the industry — the same class of
    // bug that killed the old archetype menu.
    for (const s of ADOPTION_SEGMENTS) {
      expect(
        SEGMENT_TO_INDUSTRY[s.apiValue],
        `${s.apiValue} has no industry mapping`
      ).toBeDefined();
      expect(SEGMENT_TO_INDUSTRY[s.apiValue].length).toBeGreaterThan(0);
    }
  });

  it("maps only to tags the library declares", () => {
    // Held against the declared IndustryTag union rather than the tags that
    // happen to have records. "Professional services / consulting" maps to
    // professional_services, which is the right tag and which no record
    // currently carries — a gap in the library, not an error in the mapping,
    // and the panel says exactly that on screen rather than showing an empty
    // list under an industry heading.
    const declared = new Set(
      (readFileSync("lib/aie/use-cases.ts", "utf8")
        .match(/export type IndustryTag\s*=([\s\S]*?);/)?.[1] ?? "")
        .match(/"([a-z_]+)"/g)
        ?.map((x) => x.replace(/"/g, "")) ?? []
    );
    expect(declared.size).toBeGreaterThan(0);
    for (const [segment, tags] of Object.entries(SEGMENT_TO_INDUSTRY)) {
      for (const t of tags) {
        expect(declared.has(t), `${segment} maps to undeclared tag ${t}`).toBe(
          true
        );
      }
    }
  });

  it("reports which mapped segments the library has no records for", () => {
    // Information, not failure. A segment with no tagged records still gets
    // the horizontal list and an explicit note; silently passing would hide
    // that the library is thin in places.
    const used = new Set(USE_CASES.flatMap((u) => u.industries ?? []));
    const thin = Object.entries(SEGMENT_TO_INDUSTRY)
      .filter(([, tags]) => !tags.some((t) => used.has(t)))
      .map(([s]) => s);
    // Currently: professional services. If this grows, the library needs work.
    expect(thin.length).toBeLessThanOrEqual(1);
  });
});

describe("workflowsForSegment", () => {
  it("returns industry-specific workflows for a mapped segment", () => {
    const legal = workflowsForSegment("Legal");
    expect(legal.specific.length).toBeGreaterThan(0);
    for (const w of legal.specific) expect(w.industrySpecific).toBe(true);
  });

  it("never counts a workflow as both specific and horizontal", () => {
    for (const s of ADOPTION_SEGMENTS) {
      const set = workflowsForSegment(s.apiValue);
      const ids = new Set(set.specific.map((w) => w.id));
      for (const h of set.horizontal) expect(ids.has(h.id)).toBe(false);
    }
  });

  it("treats an untagged or empty industry list as horizontal, not as missing", () => {
    const set = workflowsForSegment("Legal");
    const horizontalIds = new Set(set.horizontal.map((w) => w.id));
    const expected = USE_CASES.filter(
      (u) => !u.industries || u.industries.length === 0
    );
    expect(expected.length).toBeGreaterThan(0);
    for (const u of expected) expect(horizontalIds.has(u.id)).toBe(true);
  });

  it("orders riskiest first", () => {
    const rank = { critical: 0, high: 1, medium: 2, low: 3 } as const;
    for (const list of [
      workflowsForSegment("Financial services").specific,
      workflowsForSegment("Financial services").horizontal,
    ]) {
      for (let i = 1; i < list.length; i++) {
        expect(rank[list[i].riskTier]).toBeGreaterThanOrEqual(
          rank[list[i - 1].riskTier]
        );
      }
    }
  });

  it("carries the library's own fields through unchanged", () => {
    const set = workflowsForSegment("Healthcare / life sciences");
    const all = [...set.specific, ...set.horizontal];
    for (const w of all) {
      const src = USE_CASES.find((u) => u.id === w.id)!;
      expect(w.riskTier).toBe(src.riskTier);
      expect(w.reliabilityRequirement).toBe(src.reliabilityRequirement);
      expect(w.regulatoryFlags).toEqual(src.regulatoryFlags ?? []);
    }
  });

  it("returns everything as horizontal when no segment is chosen", () => {
    const set = workflowsForSegment("");
    expect(set.specific).toEqual([]);
    expect(set.horizontal.length).toBeGreaterThan(0);
  });
});

describe("the library size quoted to readers", () => {
  // Regression. The copy claimed 146 granular entries in three places while
  // the array held 85 — an overstatement of 72% quoted at buyers as a
  // measure of coverage. Any file naming a count must name the real one.
  it("matches the array in every file that quotes it", () => {
    expect(WORKFLOW_LIBRARY_SIZE).toBe(USE_CASES.length);
    const files = [
      "app/(ai-ent)/start/page.tsx",
      "lib/workflow-vendors.ts",
      "app/(ai-ent)/workflow-shortlist/shortlist-panel.tsx",
    ];
    for (const f of files) {
      const text = readFileSync(f, "utf8");
      const quoted = text.match(/(\d+)\s+(?:tracked workflows|granular entries)/);
      if (!quoted) continue;
      expect(Number(quoted[1]), `${f} quotes a stale workflow count`).toBe(
        USE_CASES.length
      );
    }
  });
});
