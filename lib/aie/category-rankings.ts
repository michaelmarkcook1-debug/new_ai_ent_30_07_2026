import { readFileSync } from "node:fs";
import path from "node:path";

// The category rankings as AI Enterprise v1 computes them.
//
// WHY THIS EXISTS ALONGSIDE overallScore. v1 publishes two scores for the same
// vendor and they name different leaders. In frontier models, overallScore puts
// OpenAI first at 69.4 and this composite puts Anthropic first at 3.65. Both
// are v1's numbers; neither is ours. The difference is not noise:
//
//   overallScore        one global formula over every vendor, 0 to 100. A
//                       foundry and a service desk are scored the same way.
//   this composite      0 to 5, weights specific to each category, each
//                       domain's score capped by its evidence grade, and any
//                       vendor under 60% domain coverage HELD rather than
//                       ranked on a default.
//
// The second is the better answer and it is the one v1's own front page shows,
// which is why the two products appeared to disagree when they were in fact
// showing two different numbers from the same engine.
//
// The domain count varies by category, 7 for AI silicon up to 14 for frontier
// models, because a bare accelerator has no identity or governance surface to
// assess and those domains are excluded rather than scored as insufficient.
//
// SERVER ONLY. It reads the filesystem, so importing it into a client component
// fails the build with UnhandledSchemeError. Pass a payload, import type only.
//
// The fixture is refreshed by scripts/sync-category-rankings.mjs, which parses
// v1's published pages because v1 does not expose this on its API and is
// read-only from this side. That script fails loudly rather than writing an
// empty ranking, so a stale fixture here means the sync was not run, never that
// it ran and silently found nothing.

export interface RankedVendor {
  rank: number;
  vendorId: string;
  /** Weighted composite, 0 to 5. */
  composite: number;
  /** v1's own band: Leader, Strong, Emerging leader and so on. */
  position: string | null;
}

export interface CategoryRanking {
  categoryId: string;
  label: string;
  /** How many assessment domains this category weights. Varies by category. */
  domains: number;
  /** Withheld for under 60% domain coverage. Not "no vendors", "not shown". */
  held: number;
  ranked: RankedVendor[];
}

interface Payload {
  source: string;
  note: string;
  capturedAt: string;
  categories: CategoryRanking[];
}

let cache: Payload | null = null;

function load(): Payload {
  if (cache) return cache;
  const file = path.join(
    process.cwd(),
    "fixtures",
    "aie-live",
    "category-rankings.json"
  );
  cache = JSON.parse(readFileSync(file, "utf8")) as Payload;
  return cache;
}

/** Every category, in the order v1 ranks them. */
export function categoryRankings(): CategoryRanking[] {
  return load().categories;
}

export function categoryRanking(categoryId: string): CategoryRanking | null {
  return load().categories.find((c) => c.categoryId === categoryId) ?? null;
}

/** When these numbers were read from v1. */
export function rankingsCapturedAt(): string {
  return load().capturedAt;
}

/**
 * The leader of each category, which is what v1's front page shows.
 *
 * Returns the held count alongside, because "4 ranked, 1 held" and "5 ranked"
 * are different statements about the same category and dropping the held count
 * would present our coverage gap as a complete market.
 */
export function categoryLeaders(): {
  categoryId: string;
  label: string;
  leader: RankedVendor;
  ranked: number;
  held: number;
}[] {
  return load()
    .categories.filter((c) => c.ranked.length > 0)
    .map((c) => ({
      categoryId: c.categoryId,
      label: c.label,
      leader: c.ranked[0],
      ranked: c.ranked.length,
      held: c.held,
    }));
}
