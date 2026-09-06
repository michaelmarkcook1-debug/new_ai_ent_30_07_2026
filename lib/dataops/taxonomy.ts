import { CATEGORY_TO_LAYER, INVESTOR_CATEGORY } from "@/lib/aie/vendors";

// The categories that exist, and the one thing this file will never do.
//
// The taxonomy is the seed-category map in lib/aie/vendors.ts, which the
// vendor roster is built through and which throws on anything it does not
// know. That throw is the product's own rule: an unmapped category is a
// human decision. So a suggestion here can only ever name a category that
// already exists. When the upstream arrives with one that does not, the
// answer is "stop, a person decides", stated as such, and the record is
// blocked until they do. No model is consulted and none could add a category.

export const SEED_CATEGORIES: readonly string[] = Object.freeze([
  ...Object.keys(CATEGORY_TO_LAYER),
  INVESTOR_CATEGORY,
]);

export function isKnownCategory(c: string | null | undefined): c is string {
  return typeof c === "string" && SEED_CATEGORIES.includes(c);
}

export interface CategorySuggestion {
  /** An existing category, or null. A suggestion is never an assignment. */
  suggested: string | null;
  reason: string;
  evidence: string;
  state: "evidenced" | "unmapped";
  /** True when the only honest answer is a new top-level category, which this code will not create. */
  requiresNewTopLevel: boolean;
}

export function suggestCategory(v: { id: string; name: string; category?: string | null }): CategorySuggestion {
  const upstream = typeof v.category === "string" ? v.category.trim() : "";
  if (isKnownCategory(upstream)) {
    return {
      suggested: upstream,
      reason: "the upstream seed category is already a category this product tracks",
      evidence: `vendors.json category "${upstream}" for ${v.name} (${v.id})`,
      state: "evidenced",
      requiresNewTopLevel: false,
    };
  }
  return {
    suggested: null,
    reason: upstream
      ? `upstream category "${upstream}" has no mapping in lib/aie/vendors.ts; adding a top-level category is a human decision and is not done here`
      : "the upstream record carries no category; a person must assign one of the existing categories",
    evidence: upstream ? `vendors.json category "${upstream}" for ${v.name} (${v.id})` : `no category on the upstream record for ${v.name} (${v.id})`,
    state: "unmapped",
    requiresNewTopLevel: Boolean(upstream),
  };
}
