import type { MarketMetrics } from "@/lib/market-metrics";
import {
  marketStructure,
  type MarketStructure,
} from "./insight";

// The market a page's finding sits inside, and the only history it may cite.
//
// THE PROBLEM. An Analyst Insight that reports only what is on the page reads
// like a caption. What makes an analyst worth reading is that they know where
// this reading sits in the development of the market, so a narrow score spread
// is not merely narrow, it is the normal end state of a layer that has
// commoditised, and the buyer should act accordingly.
//
// THE OBVIOUS WAY TO GET THAT IS THE WRONG ONE. Letting the model recall market
// history produces confident, dateless, unfalsifiable sentences, and this
// product's whole claim is that it does not do that. So context comes from two
// places and neither is recall:
//
//   STRUCTURE   computed from the data on this page, right now. How many
//               categories have a real leader, how concentrated they are, how
//               many leaders carry an open risk. Facts, dated by their capture
//   THESES      analytical patterns, written down, each one carrying the basis
//               in OUR OWN DATA that would make it apply
//
// THE RULE THAT KEEPS THESES HONEST. A thesis is never simply supplied. Each
// carries a predicate over the computed structure, and it is offered to the
// prompt ONLY when this page's own data satisfies it. So "capability is
// converging into commodity" cannot be used to decorate a page where the scores
// are widely spread: the precondition is false, so the sentence is not
// available. Context has to explain the current reading or it does not appear.
//
// None of this adds a fetch, a dataset or a model call. It is a second read of
// the MarketMetrics the page already loaded.

/**
 * An analytical pattern, and what in our data would make it apply here.
 *
 * `basis` is not decoration. It is the sentence the prompt renders alongside
 * the thesis so the model has to attach the claim to the reading rather than
 * assert it freestanding, and it is what a reader disagreeing with the thesis
 * would argue with.
 */
export interface AnalystThesis {
  id: string;
  /** The pattern, in one sentence. Never a dated event, never a recalled fact. */
  thesis: string;
  /** Why it applies to THIS reading, filled from the computed structure. */
  basis: (s: MarketStructure) => string;
  /** Only offered when this is true of the data in front of us. */
  appliesWhen: (s: MarketStructure) => boolean;
}

/**
 * The theses this product is prepared to stand behind.
 *
 * DELIBERATELY SMALL, AND DELIBERATELY NOT HISTORY. Every one is a pattern
 * about how enterprise software markets behave, stated as an analyst's reading
 * and labelled as one in the prompt. None of them asserts that a named thing
 * happened on a named date, because this product holds no evidence for that and
 * a model's recollection of it is exactly what the guards exist to refuse.
 *
 * Adding one is a deliberate act with a cost: it needs a predicate that can be
 * false, or it is not a thesis, it is filler.
 */
export const THESES: readonly AnalystThesis[] = [
  {
    id: "capability-commoditising",
    thesis:
      "Capability converging into commodity, with the decision migrating to commercial and governance terms, is the normal end state of a maturing software layer rather than a temporary crowding.",
    appliesWhen: (s) => s.judged >= 4 && s.contested / s.judged >= 0.3,
    basis: (s) =>
      `${s.contested} of ${s.judged} judged categories have leads inside the margin the evidence carries.`,
  },
  {
    id: "differentiation-narrow",
    thesis:
      "A market where differentiation survives in only a few places is one where the shortlist matters less than the contract, and where effort spent separating equivalent vendors is effort not spent on terms.",
    appliesWhen: (s) => s.judged >= 4 && s.separated / s.judged <= 0.4,
    basis: (s) =>
      `${s.separated} of ${s.judged} judged categories carry a lead wide enough to decide anything.`,
  },
  {
    id: "incumbency-pockets",
    thesis:
      "Where one vendor is clear of the field, the buying problem is incumbency rather than selection, and leverage moves from price to exit and portability.",
    appliesWhen: (s) => s.separated >= 1 && s.widest !== null,
    basis: (s) =>
      s.widest
        ? `${s.widest.leader} leads ${s.widest.category.toLowerCase()} by ${s.widest.gap.toFixed(2)} on a 0 to 5 scale.`
        : "",
  },
  {
    id: "governance-lags-capability",
    thesis:
      "Evidenced capability outrunning governance is the recurring shape of this market, and it is why a high assessment score is a starting point for diligence rather than a substitute for it.",
    appliesWhen: (s) => s.riskContradictions >= 1,
    basis: (s) =>
      `${s.riskContradictions} vendors rank in the top third of a category they compete in while carrying an open high-severity finding.`,
  },
  {
    id: "concentration-limits-choice",
    thesis:
      "A category can present a long shortlist and still be concentrated; what decides buyer leverage is whether the alternatives are credible at the size of the deal, not how many are listed.",
    appliesWhen: (s) => s.topThreeShare !== null && s.topThreeShare >= 60,
    basis: (s) =>
      `the three largest vendors hold about ${s.topThreeShare} per cent of estimated share in a typical category.`,
  },
  {
    id: "no-trend-without-sequence",
    thesis:
      "A market read from a single capture can be described but not extrapolated, and treating one observation as a direction of travel is the most common way a buying committee gets ahead of its evidence.",
    appliesWhen: (s) => s.scored > 0 && s.withMovement / s.scored < 0.25,
    basis: (s) =>
      `${s.withMovement} of ${s.scored} scored vendors publish any direction of travel.`,
  },
];

export interface GroundedContext {
  structure: MarketStructure;
  /** Only the theses this reading actually instantiates, with their basis. */
  applicable: { thesis: string; basis: string }[];
}

/**
 * The market context this page has earned.
 *
 * Returns the structure and only the theses whose preconditions the data
 * satisfies. A page whose data supports nothing gets an empty list and its
 * reading stays local, which is the correct outcome and not a gap.
 */
export function groundedContext(m: MarketMetrics): GroundedContext {
  const structure = marketStructure(m);
  return {
    structure,
    applicable: THESES.filter((t) => t.appliesWhen(structure)).map((t) => ({
      thesis: t.thesis,
      basis: t.basis(structure),
    })),
  };
}
