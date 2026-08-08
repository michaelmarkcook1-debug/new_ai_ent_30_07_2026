import {
  buildShortlist,
  shortlistCategories,
  type ShortlistCategory,
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
}

export interface ShortlistCategoryPayload {
  category: string;
  considered: number;
  shortfall: string | null;
  entries: ShortlistCardPayload[];
}

export interface ShortlistPayload {
  categories: ShortlistCategory[];
  byCategory: Record<string, ShortlistCategoryPayload>;
  /** Opened on first render: the category that can rank the most vendors. */
  defaultCategory: string;
  steps: PilotStep[];
  /** The weighting, in words, for the derivation drawer. */
  weightNote: string;
}

export function shortlistPayload(): ShortlistPayload {
  const categories = shortlistCategories();
  const byCategory: Record<string, ShortlistCategoryPayload> = {};

  for (const c of categories) {
    const list = buildShortlist(c.category);
    if (!list) continue;
    byCategory[c.category] = {
      category: list.category,
      considered: list.considered,
      shortfall: list.shortfall,
      entries: list.entries.map((e) => ({
        rank: e.rank,
        vendorId: e.vendorId,
        name: e.name,
        marketPosition: e.marketPosition,
        score: Math.round(e.score * 10) / 10,
        inputsPresent: e.result.inputsPresent,
        reason: e.reason,
        limit: e.limit,
      })),
    };
  }

  const w = DEFAULT_WEIGHTS;
  const pct = (n: number) => `${Math.round(n * 100)} per cent`;

  return {
    categories,
    byCategory,
    // The most populous category, because a shortlist of three out of twelve
    // demonstrates the idea and one of three out of three does not.
    defaultCategory: categories[0]?.category ?? "",
    steps: PILOT_STEPS,
    weightNote: `${pct(w.winning)} capability, ${pct(w.trust)} reputation and ${pct(w.durability)} disclosed durability`,
  };
}
