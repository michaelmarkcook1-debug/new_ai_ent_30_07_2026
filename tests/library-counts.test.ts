import { describe, expect, it } from "vitest";
import {
  MODELS,
  ROLE_INDEX,
  INDUSTRY_GROUPS,
  LIBRARY_ROLE_COUNT,
  LIBRARY_INDUSTRY_COUNT,
} from "@/lib/model-fit";
import { readFileSync } from "node:fs";
import { join } from "node:path";

// Guards against copy that states a library size going stale.
//
// Two user-facing strings claimed "258 roles across 29 industries" for weeks
// after the library grew to 294 across 36. Nothing was broken and no test
// failed: the counts were literals typed into prose, and adding roles never
// touched them. A reader was told a smaller product than the one in front of
// them.
//
// The fix was to derive the counts at the point of render. This test is the
// other half of that fix: it fails if anyone reintroduces a hardcoded count,
// which is the only way the drift can come back.

const ROOT = join(__dirname, "..");

/** Every file that states a library size to a reader. */
const COPY_FILES = [
  "app/(ai-ent)/start/page.tsx",
  "app/(ai-ent)/market-view/components/model-fit.tsx",
];

describe("derived library counts", () => {
  it("counts what is actually in the data", () => {
    expect(LIBRARY_ROLE_COUNT).toBe(ROLE_INDEX.length);
    expect(LIBRARY_INDUSTRY_COUNT).toBe(
      INDUSTRY_GROUPS.reduce((n, g) => n + g.industries.length, 0)
    );
  });

  it("has grown past the counts the stale copy quoted", () => {
    // Not asserting exact values: the library is meant to grow, and a test
    // that pins it would have to be edited every time it does, which is the
    // same failure mode in a different place. These are floors.
    expect(LIBRARY_ROLE_COUNT).toBeGreaterThanOrEqual(294);
    expect(LIBRARY_INDUSTRY_COUNT).toBeGreaterThanOrEqual(36);
    expect(MODELS.length).toBeGreaterThan(0);
  });

  it("states no library size as a literal in user-facing copy", () => {
    // The specific pair that went stale. "258 roles" and "29 industries" are
    // now only allowed to appear as provenance (the 258 that shipped with the
    // package, as distinct from the researched additions) never as the
    // library's current size.
    for (const rel of COPY_FILES) {
      const src = readFileSync(join(ROOT, rel), "utf8");
      expect(src, `${rel} states a role count as a literal`).not.toMatch(
        /\d+\s+roles across/
      );
      expect(src, `${rel} states an industry count as a literal`).not.toMatch(
        /\d+\s+industries/
      );
    }
  });
});
