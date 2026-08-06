import { describe, expect, it } from "vitest";
import {
  CONSTRAINTS,
  DIMS,
  USE_CASES,
  rankVendors,
  topPriorities,
  type Constraint,
} from "@/lib/desk/sourcing";
import { DEFAULT_SHIELD_WEIGHTS, SHIELD } from "@/lib/shield/data";
import { buildPack } from "@/lib/desk/pack";
import { packToHtml } from "@/lib/desk/pack-html";
import { PILOT_STEPS, USE_CASE_PROBES, pilotProbesFor } from "@/lib/desk/pilot";

// The sourcing engine, the pilot and the Decision Pack.
//
// These assertions are about the promises the screen makes to a buyer, not
// about the ranking being "right": there is no external truth to check a
// weighted preference against. What can be checked is that the tool cannot
// quietly break the four things it tells a procurement committee it does.

const DATE = "6 August 2026";

describe("sourcing: constraints are hard, and always explain themselves", () => {
  it("gives every dropped vendor a stated reason", () => {
    for (const c of CONSTRAINTS) {
      const ranked = rankVendors(DEFAULT_SHIELD_WEIGHTS, [c.key]);
      for (const r of ranked.filter((x) => !x.passes)) {
        expect(
          r.failReason,
          `${r.vendor.slug} dropped by ${c.key} with no reason`
        ).toBeTruthy();
      }
    }
  });

  it("drops an unverified indemnity rather than treating it as a pass", () => {
    const ranked = rankVendors(DEFAULT_SHIELD_WEIGHTS, ["require_indemnity"]);
    // xAI's indemnity is unverified: no receipt is not the same as a yes.
    const xai = ranked.find((r) => r.vendor.slug === "xai-grok")!;
    expect(xai.passes).toBe(false);
    expect(xai.failReason).toMatch(/not verified/);
  });

  it("treats the two weight-kind constraints as mutually exclusive", () => {
    const both: Constraint[] = ["exclude_open_weights", "open_weights_only"];
    const ranked = rankVendors(DEFAULT_SHIELD_WEIGHTS, both);
    expect(ranked.every((r) => !r.passes)).toBe(true);
  });

  it("passes everything when nothing is required", () => {
    const ranked = rankVendors(DEFAULT_SHIELD_WEIGHTS, []);
    expect(ranked.length).toBe(SHIELD.length);
    expect(ranked.every((r) => r.passes)).toBe(true);
  });

  it("sorts passing vendors above dropped ones", () => {
    const ranked = rankVendors(DEFAULT_SHIELD_WEIGHTS, ["require_no_train"]);
    const firstFail = ranked.findIndex((r) => !r.passes);
    if (firstFail !== -1) {
      expect(ranked.slice(firstFail).every((r) => !r.passes)).toBe(true);
    }
  });
});

describe("sourcing: weighting changes priority, never a fact", () => {
  it("cannot lift an all-adverse vendor off zero at any weight", () => {
    const ranked = rankVendors(
      { training: 3, retention: 3, indemnity: 3, residency: 3 },
      []
    );
    const deepseek = ranked.find((r) => r.vendor.slug === "deepseek")!;
    expect(deepseek.weightedScore).toBe(0);
  });

  it("says nothing was prioritised when the weights are equal", () => {
    // Naming two dimensions here would tell a board they were prioritised
    // when the buyer expressed no preference at all.
    expect(topPriorities(DEFAULT_SHIELD_WEIGHTS)).toBeNull();
    expect(
      topPriorities({ training: 2, retention: 2, indemnity: 2, residency: 2 })
    ).toBeNull();
    expect(topPriorities({ training: 0, retention: 0, indemnity: 0, residency: 0 })).toBeNull();
  });

  it("names only what the buyer actually raised", () => {
    const raised = topPriorities({
      training: 3,
      retention: 1,
      indemnity: 1,
      residency: 1,
    });
    expect(raised).toBe("will not train on our data");
  });

  it("keeps max relative to the weights in force", () => {
    const ranked = rankVendors(
      { training: 2, retention: 1, indemnity: 0, residency: 1 },
      []
    );
    expect(ranked.every((r) => r.maxScore === 4)).toBe(true);
    expect(ranked.every((r) => r.weightedScore <= r.maxScore)).toBe(true);
  });
});

describe("the pilot is methodology, never results", () => {
  it("names no vendor anywhere in it", () => {
    const names = SHIELD.map((v) => v.vendor.split(" (")[0]);
    const corpus = [
      ...PILOT_STEPS.flatMap((s) => [s.title, s.why, s.how]),
      ...Object.values(USE_CASE_PROBES),
    ].join(" ");
    for (const n of names) {
      // "Meta" and "Google" appear in ordinary prose; check the distinctive ones.
      if (["Meta", "Google", "Reka"].includes(n)) continue;
      expect(corpus.includes(n), `pilot text names ${n}`).toBe(false);
    }
  });

  it("carries a probe for every use case the flow offers", () => {
    for (const u of USE_CASES) {
      expect(USE_CASE_PROBES[u], `no probe for ${u}`).toBeTruthy();
    }
  });

  it("returns probes only for what was selected, deduped", () => {
    const picked = pilotProbesFor([
      "HR & recruiting",
      "HR & recruiting",
      "Not a real use case",
    ]);
    expect(picked.length).toBe(1);
    expect(picked[0].useCase).toBe("HR & recruiting");
  });
});

describe("the Decision Pack cannot disagree with the page", () => {
  it("carries the same passing set the ranking produced", () => {
    const ranked = rankVendors(DEFAULT_SHIELD_WEIGHTS, ["require_no_train"]);
    const pack = buildPack(["Legal & contract review"], DEFAULT_SHIELD_WEIGHTS, ranked, DATE);
    const table = pack.sections.find((s) => s.kind === "shortlist")!.table!;
    expect(table.rows.length).toBe(ranked.filter((r) => r.passes).length);
  });

  it("names every rejection and its reason", () => {
    const ranked = rankVendors(DEFAULT_SHIELD_WEIGHTS, ["require_residency"]);
    const rejected = ranked.filter((r) => !r.passes);
    const pack = buildPack([], DEFAULT_SHIELD_WEIGHTS, ranked, DATE);
    const section = pack.sections.find((s) => s.kind === "rejected");
    expect(section?.lines?.length).toBe(rejected.length);
    for (const r of rejected) {
      expect(
        section!.lines!.some((l) => l.text.startsWith(`${r.vendor.vendor}:`))
      ).toBe(true);
    }
  });

  it("states that it does not rank capability", () => {
    const ranked = rankVendors(DEFAULT_SHIELD_WEIGHTS, []);
    const pack = buildPack(["Coding & developer tooling"], DEFAULT_SHIELD_WEIGHTS, ranked, DATE);
    const scope = pack.sections.find((s) => s.kind === "scope")!;
    expect(scope.lines!.some((l) => /does not rank them on capability/i.test(l.text))).toBe(true);
  });

  it("says so plainly when nothing clears the constraints", () => {
    const ranked = rankVendors(DEFAULT_SHIELD_WEIGHTS, [
      "exclude_open_weights",
      "open_weights_only",
    ]);
    const pack = buildPack([], DEFAULT_SHIELD_WEIGHTS, ranked, DATE);
    const rec = pack.sections.find((s) => s.kind === "recommendation")!;
    expect(rec.title).toMatch(/No vendor clears/);
  });

  it("lists every source behind every mark shown, deduplicated", () => {
    const ranked = rankVendors(DEFAULT_SHIELD_WEIGHTS, []);
    const pack = buildPack([], DEFAULT_SHIELD_WEIGHTS, ranked, DATE);
    const names = pack.sources.map((s) => s.name);
    expect(new Set(names).size).toBe(names.length);
    expect(pack.sources.every((s) => /^https:\/\//.test(s.url))).toBe(true);
    expect(pack.sources.length).toBeGreaterThan(10);
  });
});

describe("the exported document is safe and self-contained", () => {
  it("escapes vendor text rather than emitting it raw", () => {
    const ranked = rankVendors(DEFAULT_SHIELD_WEIGHTS, []);
    const html = packToHtml(buildPack([], DEFAULT_SHIELD_WEIGHTS, ranked, DATE));
    // Cohere's directory name and several quoted terms carry ampersands.
    expect(html).not.toMatch(/<script/i);
    // No unescaped angle bracket from content: every < in the body opens a tag
    // we wrote, and quoted legal text contains none.
    const body = html.slice(html.indexOf("<body>"));
    expect(body).not.toMatch(/&(?!amp;|lt;|gt;|quot;|#39;)/);
  });

  it("references nothing external", () => {
    const ranked = rankVendors(DEFAULT_SHIELD_WEIGHTS, []);
    const html = packToHtml(buildPack([], DEFAULT_SHIELD_WEIGHTS, ranked, DATE));
    expect(html).not.toMatch(/<link[^>]+stylesheet/i);
    expect(html).not.toMatch(/<script[^>]+src=/i);
    expect(html).not.toMatch(/@import/);
  });
});

describe("the dimensions the flow offers are the Shield's own", () => {
  it("offers exactly the four Shield questions", () => {
    expect(DIMS.map((d) => d.key).sort()).toEqual([
      "indemnity",
      "residency",
      "retention",
      "training",
    ]);
  });
});
