import { describe, it, expect } from "vitest";
import { readFileSync } from "node:fs";
import { foreignEntities } from "@/lib/analyst/llm";

// What a page says it covers has to be what it covers.
//
// THE DEFECT THIS PINS. `authorInsight` takes the entities a page covers and
// uses them as the boundary for factual naming: a name outside the list is
// treated as the model reaching past its data. Five pages declared that list as
// an arbitrary prefix of what they hold, `m.vendors.slice(0, 12)` on pages
// covering 43 vendors and `models.slice(0, 14)` on a page plotting 330.
//
// Measured on the running product: Vendor View's own computed reading names
// SAP, Google, Groq and Lambda, all four outside its first twelve, so the model
// quoting the page back to itself was rejected with "a vendor this page's data
// does not cover" and the reader got the enumerated computed text on every
// render. The guard was right; the declaration was wrong.
//
// It cost nothing to be wrong about: the full list of 43 vendor names is 410
// characters. The truncation saved no prompt and removed the page's ability to
// name the vendor its own recommendation is about.

const PAGES = [
  "app/(ai-ent)/vendor-view/page.tsx",
  "app/(ai-ent)/competitive-intel/page.tsx",
  "app/(ai-ent)/market-watch/page.tsx",
  "app/(ai-ent)/reputation-tracker/page.tsx",
  "app/(ai-ent)/price-performance/page.tsx",
  "app/(ai-ent)/alliances/page.tsx",
  "app/(ai-ent)/financial-snapshot/page.tsx",
];

/** The authorInsight() call, which is where the entity list is declared. */
function authorCall(src: string): string {
  const i = src.indexOf("authorInsight(");
  if (i < 0) return "";
  return src.slice(i, i + 900);
}

describe("a page declares the entities it actually covers", () => {
  it("never truncates its entity list to an arbitrary prefix", () => {
    for (const p of PAGES) {
      const call = authorCall(readFileSync(p, "utf8"));
      expect(call.length, `${p} has no authorInsight call`).toBeGreaterThan(0);
      // `.slice(0, N)` over the covered set is the defect signature: it bars
      // the model from naming entities the page renders and discusses.
      const truncation = call.match(/\.slice\(0,\s*\d+\)\s*\.?\s*map/);
      expect(
        truncation?.[0] ?? null,
        `${p} declares only a prefix of the entities it covers, so the reading cannot name the rest`
      ).toBeNull();
    }
  });

  it("declares a non-empty list wherever the page carries named entities", () => {
    // Peer Insights is deliberately absent from PAGES: it reads the workflow
    // catalogue and carries no vendor roster, so an empty list is the honest
    // declaration there and its reading correctly names nobody.
    for (const p of PAGES) {
      const call = authorCall(readFileSync(p, "utf8"));
      expect(
        /authorInsight\(\s*\w+,\s*"[^"]*",\s*\[\]\s*\)/.test(call),
        `${p} declares no entities at all despite carrying a roster`
      ).toBe(false);
    }
  });
});

describe("the guard the declaration feeds", () => {
  const roster = ["SAP", "Google", "Groq", "Lambda", "Anthropic"];

  it("refuses a vendor outside the declared list", () => {
    // The behaviour that made the truncation expensive, asserted directly.
    expect(
      foreignEntities(
        JSON.stringify({ s: "SAP holds the clearest position." }),
        "facts naming nobody",
        roster,
        ["Anthropic"]
      )
    ).not.toEqual([]);
  });

  it("accepts it once the page declares what it covers", () => {
    expect(
      foreignEntities(
        JSON.stringify({ s: "SAP holds the clearest position." }),
        "facts naming nobody",
        roster,
        ["Anthropic", "SAP"]
      )
    ).toEqual([]);
  });
});
