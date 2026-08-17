import {
  buildShortlist,
  shortlistCategories,
  jurisdictionCoverage,
  type ShortlistCategory,
  type JurisdictionFilter,
  type JurisdictionBasis,
} from "./shortlist";
import { PILOT_STEPS, type PilotStep } from "./pilot";
import { DEFAULT_WEIGHTS } from "@/lib/vendor/composite";

// The shortlist, flattened for the browser.
//
// Same pattern as lib/exposure/payload.ts and for the same reason: the step is
// a client component, and scorecardSet() reaches the vendor directory and three
// scoring modules behind it. Computing every category here costs one pass at
// render and means switching category is instant and offline, rather than a
// round trip per click.
//
// Only what a card draws travels. The full CompositeResult carries applied
// weights and per-input verdicts that the paragraph has already expressed in
// words, so sending them again would double the payload to say it twice.

export interface ShortlistCardPayload {
  rank: number;
  vendorId: string;
  name: string;
  marketPosition: string;
  score: number;
  inputsPresent: number;
  reason: string;
  limit: string;
  /** Null where the Sovereignty Lens has not reached this vendor. */
  jurisdiction: {
    flag: string;
    hq: string;
    why: string;
    /** How we know: a fetched policy, or country of incorporation. */
    basis: JurisdictionBasis;
  } | null;
}

export interface ShortlistCategoryPayload {
  category: string;
  considered: number;
  shortfall: string | null;
  entries: ShortlistCardPayload[];
  /** Named, so a filtered list never just gets shorter without saying why. */
  excluded: { name: string; hq: string; why: string }[];
}

export interface ShortlistPayload {
  categories: ShortlistCategory[];
  /** Keyed by filter, then by category.
   *
   *  The reason text genuinely differs between filters, because "first of 12"
   *  becomes "first of 9" once three are excluded, so the variants cannot be
   *  derived client-side from one list.
   *
   *  SPARSE. A variant is stored only where it differs from `all`, because 18
   *  of 20 were byte-identical: only two categories hold a flagged vendor, and
   *  carrying three copies of the other eighteen cost 40 KB to say the same
   *  thing three times. Read it through `shortlistFor()`, never directly. */
  byFilter: Record<JurisdictionFilter, Record<string, ShortlistCategoryPayload>>;
  /** How many scored vendors we reach, split by strength of evidence. */
  jurisdictionCoverage: {
    assessed: number;
    total: number;
    fromDocument: number;
    fromPublicRecord: number;
  };
  /** Opened on first render: the category that can rank the most vendors. */
  defaultCategory: string;
  steps: PilotStep[];
  /** The weighting, in words, for the derivation drawer. */
  weightNote: string;
}

export function shortlistPayload(): ShortlistPayload {
  const categories = shortlistCategories();
  const FILTERS: JurisdictionFilter[] = ["all", "no-stop", "cleared"];

  const byFilter = {} as Record<
    JurisdictionFilter,
    Record<string, ShortlistCategoryPayload>
  >;

  for (const f of FILTERS) {
    const byCategory: Record<string, ShortlistCategoryPayload> = {};
    for (const c of categories) {
      const list = buildShortlist(c.category, DEFAULT_WEIGHTS, 3, f);
      if (!list) continue;
      byCategory[c.category] = {
        category: list.category,
        considered: list.considered,
        shortfall: list.shortfall,
        excluded: list.excluded.map((e) => ({
          name: e.name,
          hq: e.hqJurisdiction,
          why: e.why,
        })),
        entries: list.entries.map((e) => ({
          rank: e.rank,
          vendorId: e.vendorId,
          name: e.name,
          marketPosition: e.marketPosition,
          score: Math.round(e.score * 10) / 10,
          inputsPresent: e.result.inputsPresent,
          reason: e.reason,
          limit: e.limit,
          jurisdiction: e.jurisdiction
            ? {
                flag: e.jurisdiction.flag,
                hq: e.jurisdiction.hqJurisdiction,
                why: e.jurisdiction.flagNote,
                basis: e.jurisdiction.basis,
              }
            : null,
        })),
      };
    }
    if (f === "all") {
      byFilter[f] = byCategory;
      continue;
    }
    // Only what the filter actually changed.
    const diff: Record<string, ShortlistCategoryPayload> = {};
    for (const [cat, v] of Object.entries(byCategory)) {
      if (JSON.stringify(v) !== JSON.stringify(byFilter.all[cat])) diff[cat] = v;
    }
    byFilter[f] = diff;
  }

  const w = DEFAULT_WEIGHTS;
  const pct = (n: number) => `${Math.round(n * 100)} per cent`;

  return {
    categories,
    byFilter,
    jurisdictionCoverage: jurisdictionCoverage(),
    // The most populous category, because a shortlist of three out of twelve
    // demonstrates the idea and one of three out of three does not.
    defaultCategory: categories[0]?.category ?? "",
    steps: PILOT_STEPS,
    weightNote: `${pct(w.winning)} capability, ${pct(w.trust)} reputation and ${pct(w.durability)} disclosed durability`,
  };
}

/**
 * The list for one filter and category, falling back to the unfiltered one.
 *
 * `byFilter` is sparse, so a missing entry means "this filter changed nothing
 * here", not "no list". Reading the record directly would blank most of the
 * categories the moment a filter was selected.
 */
// Lives in ./shortlist-select so a client component can import it without
// dragging this module, and the filesystem read behind it, into the browser
// bundle. Re-exported here so server callers and tests keep one import site.
export { shortlistFor } from "./shortlist-select";
