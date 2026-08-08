import { VENDOR_DIRECTORY } from "@/lib/aie/vendor-directory";
import { scorecardSet } from "@/lib/vendor/composite-data";
import { sovereigntyRows, type SovereigntyFlag } from "@/lib/shield/sovereignty";
import { vendorIdForSlug } from "@/lib/shield/vendor-map";
import {
  DEFAULT_WEIGHTS,
  INPUT_KEYS,
  type InputKey,
  type Verdict,
  type Weights,
  type CompositeResult,
} from "@/lib/vendor/composite";

// The three vendors, and why each one.
//
// The Decision Desk answered "what is my situation" and "how do I score the
// call" and stopped one step short of the thing a buyer came for, which is a
// name. This produces the names, the reason beside each, and what to do next.
//
// THE RANKING IS WITHIN ONE CATEGORY, NEVER ACROSS. The composite rests on
// capability scores the product states are comparable only inside a market
// category, so a list mixing a frontier lab with a chip maker would be a
// ranking of nothing. The reader picks the category; every card names it.
//
// IT WILL RETURN FEWER THAN THREE, AND SAYS SO. Six of the ten categories hold
// one or two scored vendors. Padding those to three from a neighbouring
// category would produce exactly the false comparison the paragraph above
// exists to prevent, so a category with two vendors returns two and the
// interface reports the shortfall as a fact about our coverage.
//
// THE REASON IS COMPUTED, NOT WRITTEN. Every clause is a restatement of a
// number already on the vendor's own page: its composite, which of the three
// questions it answers, and which are unpublished. Nothing is generated, so
// the paragraph cannot drift from the score it explains, costs nothing, and is
// still there when the analyst API is not, which on 8 August 2026 it was not.

export interface ShortlistCategory {
  category: string;
  /** Vendors in it carrying at least one published input. */
  scored: number;
  /** True when three can be named without leaving the category. */
  full: boolean;
}

export interface ShortlistEntry {
  rank: number;
  vendorId: string;
  name: string;
  category: string;
  marketPosition: string;
  score: number;
  result: CompositeResult;
  verdicts: Record<InputKey, Verdict>;
  inputs: Record<InputKey, number | null>;
  /** The one-paragraph reason, assembled from the figures above. */
  reason: string;
  /** What this ranking cannot see, stated per card rather than once per page. */
  limit: string;
  /** Null when the Sovereignty Lens has not assessed this vendor. */
  jurisdiction: Jurisdiction | null;
}

export interface Shortlist {
  category: string;
  entries: ShortlistEntry[];
  /** Vendors in the category that were considered. */
  considered: number;
  /** Set when the category could not yield three. */
  shortfall: string | null;
  weights: Weights;
  filter: JurisdictionFilter;
  /** Vendors the filter removed, named so the list never shortens silently. */
  excluded: {
    vendorId: string;
    name: string;
    hqJurisdiction: string;
    flag: SovereigntyFlag;
    why: string;
  }[];
}

const INVESTOR_CATEGORY = "AI investor";

/**
 * Where each vendor sits in law, for the jurisdiction filter.
 *
 * Read from the Sovereignty Lens rather than restated, so the shortlist and
 * Trust Rank can never give different answers about the same vendor. That lens
 * derives from the Shield's own fetched quotes: Alibaba, Z.ai and Moonshot are
 * flagged because the Shield fetched their Chinese parentage alongside their
 * documented Singapore hosting, and DeepSeek is a hard stop on its own
 * admission that it stores in the PRC.
 *
 * IT COVERS 13 OF THE 43 SCORED VENDORS. The Shield holds 14 entries and one
 * of them maps to no scored vendor, so the figure on screen is computed by
 * jurisdictionCoverage() rather than written down here where it would rot. That is the fact the filter has to carry with
 * it. A vendor absent from the Shield has not been cleared, it has not been
 * looked at, and a filter that silently passed it would convert our own gap
 * into a clean bill of health, which is the worst thing a control like this can
 * do.
 */
export type Jurisdiction = {
  flag: SovereigntyFlag;
  hqJurisdiction: string;
  flagNote: string;
};

let jurisdictionCache: Map<string, Jurisdiction> | null = null;

function jurisdictions(): Map<string, Jurisdiction> {
  if (jurisdictionCache) return jurisdictionCache;
  const m = new Map<string, Jurisdiction>();
  for (const r of sovereigntyRows()) {
    const id = vendorIdForSlug(r.slug);
    if (!id) continue;
    m.set(id, {
      flag: r.flag,
      hqJurisdiction: r.hqJurisdiction,
      flagNote: r.flagNote,
    });
  }
  jurisdictionCache = m;
  return m;
}

export function jurisdictionFor(vendorId: string): Jurisdiction | null {
  return jurisdictions().get(vendorId) ?? null;
}

/** How many of the scored vendors the lens actually reaches. */
export function jurisdictionCoverage(): { assessed: number; total: number } {
  const set = scorecardSet();
  const j = jurisdictions();
  return {
    assessed: set.vendors.filter((v) => j.has(v.vendorId)).length,
    total: set.vendors.length,
  };
}

/** Categories the product can rank inside, most populous first. */
export function shortlistCategories(): ShortlistCategory[] {
  const set = scorecardSet();
  const byId = new Map(set.vendors.map((v) => [v.vendorId, v]));
  const counts = new Map<string, number>();

  for (const v of VENDOR_DIRECTORY) {
    // A vendor with no category cannot be ranked inside one. Skipped rather
    // than bucketed under "Other", which would invite exactly the
    // cross-category comparison this whole module refuses to make.
    if (!v.category || v.category === INVESTOR_CATEGORY) continue;
    const sc = byId.get(v.id);
    if (!sc || sc.result.score === null) continue;
    counts.set(v.category, (counts.get(v.category) ?? 0) + 1);
  }

  return [...counts.entries()]
    .map(([category, scored]) => ({ category, scored, full: scored >= 3 }))
    .sort((a, b) => b.scored - a.scored || a.category.localeCompare(b.category));
}

/** Plain-language band for a verdict, so the paragraph never prints "yes". */
const VERDICT_WORD: Record<Verdict, string> = {
  yes: "in the top third of the set",
  mixed: "mid-table",
  no: "in the bottom third",
  unknown: "unpublished",
};

/**
 * The three inputs as noun phrases.
 *
 * QUESTIONS holds them as questions, which is right on a scorecard where each
 * heads its own column and wrong inside a sentence: "top third on is it
 * winning at 64.9" is not English. These read as the thing being measured.
 */
const INPUT_NOUN: Record<InputKey, string> = {
  winning: "capability",
  trust: "reputation",
  durability: "disclosed durability",
};

/** One decimal. The raw values carry float noise (64.9651156889088) that reads
 *  as precision the measure does not have. */
const fig = (n: number | null): string =>
  n === null ? "unpublished" : String(Math.round(n * 10) / 10);

/**
 * The reason paragraph.
 *
 * Written as clauses joined into prose rather than as a template with holes,
 * because the number of true things varies: a vendor with one published input
 * has less to say about it than one with three, and a sentence padded to a
 * fixed shape would have to invent the difference.
 */
function reasonFor(
  name: string,
  rank: number,
  category: string,
  considered: number,
  inputs: Record<InputKey, number | null>,
  verdicts: Record<InputKey, Verdict>,
  result: CompositeResult
): string {
  const place = rank === 1 ? "first" : rank === 2 ? "second" : "third";
  const parts: string[] = [
    `${name} ranks ${place} of the ${considered} scored vendors in ${category}, on a composite of ${fig(result.score)} drawn from ${result.inputsPresent} of ${result.inputsTotal} published inputs.`,
  ];

  // What it is actually good at, in the product's own three questions.
  const strong = INPUT_KEYS.filter((k) => verdicts[k] === "yes");
  const weak = INPUT_KEYS.filter((k) => verdicts[k] === "no");

  const list = (keys: InputKey[]) =>
    keys
      .map((k) => `${INPUT_NOUN[k]} at ${fig(inputs[k])}`)
      .join(keys.length === 2 ? " and " : ", ");

  if (strong.length > 0) {
    parts.push(
      `It sits ${VERDICT_WORD.yes} on ${list(strong)}, measured against the other vendors in this category rather than an absolute bar.`
    );
  }
  if (weak.length > 0) {
    parts.push(
      `It is ${VERDICT_WORD.no} on ${list(weak)}, which is the case against it and is why this is a shortlist rather than a choice.`
    );
  }
  if (strong.length === 0 && weak.length === 0) {
    parts.push(
      `It is mid-table on every input it publishes, so it earns a place by consistency rather than by leading on anything.`
    );
  }

  // The absence, named. A composite from one input is a different kind of
  // claim from one built on three, and the card has to say which it is.
  if (result.missing.length > 0) {
    // The noun, not UNKNOWN_COPY, whose phrasing already ends in "published"
    // and reads as "Not published for this vendor: no reputation data
    // published" when nested inside this sentence.
    const missing = result.missing.map((k) => INPUT_NOUN[k]);
    parts.push(
      `${result.inputsPresent === 1 ? "The score rests on a single input, with nothing published for " : "Nothing is published for "}${missing.join(" or ")}, and the weights were renormalised over what exists rather than treating an absence as a zero.`
    );
  } else {
    parts.push(
      `All three inputs are published, so this is the most complete comparison the product can make.`
    );
  }

  return parts.join(" ");
}

/** What the composite cannot see. The same for every vendor, so it is stated
 *  per card rather than buried in a footnote the reader scrolls past. */
function limitFor(category: string): string {
  return `Ranks capability, reputation and disclosed durability inside ${category}. It does not price the work, does not know your stack, and is not a recommendation to buy.`;
}

/**
 * How much foreign-jurisdiction exposure the reader will accept.
 *
 *   all       rank everybody, flags shown on the card
 *   no-stop   drop only a hard stop
 *   cleared   drop anything flagged at all
 *
 * Applied BEFORE the top three are taken, not after. Filtering afterwards
 * would hand back one or two cards and call it a shortlist, when the honest
 * answer is the next-best vendors that pass.
 */
export type JurisdictionFilter = "all" | "no-stop" | "cleared";

function passesFilter(vendorId: string, f: JurisdictionFilter): boolean {
  if (f === "all") return true;
  const j = jurisdictionFor(vendorId);
  // Unassessed vendors are NOT dropped. The lens covers 13 of the 43, and treating
  // silence as a flag would remove two thirds of the market on no evidence.
  // The interface says this rather than the filter guessing.
  if (!j) return true;
  if (f === "no-stop") return j.flag !== "hard-stop";
  return j.flag === "none";
}

export function buildShortlist(
  category: string,
  weights: Weights = DEFAULT_WEIGHTS,
  size = 3,
  filter: JurisdictionFilter = "all"
): Shortlist | null {
  const set = scorecardSet(weights);
  const inCategory = new Set(
    VENDOR_DIRECTORY.filter((v) => v.category === category).map((v) => v.id)
  );
  if (inCategory.size === 0) return null;

  const position = new Map(
    VENDOR_DIRECTORY.map((v) => [v.id, v.marketPosition ?? ""])
  );

  // Named before filtering, so the interface can say who was dropped and why
  // rather than a list quietly getting shorter.
  const excluded = set.vendors
    .filter(
      (v) =>
        inCategory.has(v.vendorId) &&
        v.result.score !== null &&
        !passesFilter(v.vendorId, filter)
    )
    .map((v) => {
      const j = jurisdictionFor(v.vendorId)!;
      return {
        vendorId: v.vendorId,
        name: v.name,
        hqJurisdiction: j.hqJurisdiction,
        flag: j.flag,
        why: j.flagNote,
      };
    });

  const ranked = set.vendors
    .filter(
      (v) =>
        inCategory.has(v.vendorId) &&
        v.result.score !== null &&
        passesFilter(v.vendorId, filter)
    )
    // Score first. Where two tie, the one resting on more published inputs
    // wins, because it is the better-evidenced of two equal claims.
    .sort(
      (a, b) =>
        (b.result.score ?? 0) - (a.result.score ?? 0) ||
        b.result.inputsPresent - a.result.inputsPresent ||
        a.name.localeCompare(b.name)
    );

  if (ranked.length === 0) return null;

  const considered = ranked.length;
  const entries: ShortlistEntry[] = ranked.slice(0, size).map((v, i) => ({
    rank: i + 1,
    vendorId: v.vendorId,
    name: v.name,
    category,
    marketPosition: position.get(v.vendorId) ?? "",
    score: v.result.score as number,
    result: v.result,
    verdicts: v.verdicts,
    inputs: v.inputs,
    reason: reasonFor(
      v.name,
      i + 1,
      category,
      considered,
      v.inputs,
      v.verdicts,
      v.result
    ),
    limit: limitFor(category),
    jurisdiction: jurisdictionFor(v.vendorId),
  }));

  return {
    category,
    entries,
    considered,
    shortfall:
      entries.length < size
        ? `${category} holds ${considered} scored ${considered === 1 ? "vendor" : "vendors"}, so this is ${entries.length} rather than ${size}. The gap is our coverage, not the market: naming a vendor from another category would compare scores the product states are only comparable within one.`
        : null,
    weights,
    filter,
    excluded,
  };
}
