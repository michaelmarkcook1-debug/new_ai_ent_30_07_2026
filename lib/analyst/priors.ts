// Analyst priors: what the voice is allowed to know without being told.
//
// THE PROBLEM. The system prompt carried five market claims as permanent
// truths. Three of them are structural, describe how this kind of market
// behaves, and will be as true next year as they were last year. Two of them
// are claims about the state of the market RIGHT NOW, and the product measures
// both of them on its own pages:
//
//   "Capability has commoditised faster than price"   Competitive Intel
//                                                     measures the capability
//                                                     spread; Price/Performance
//                                                     measures the price ratio.
//   "Very few vendors quantify AI revenue"            Financial Snapshot counts
//                                                     exactly this.
//
// A claim the product can check has no business being asserted from a prompt.
// If the capability spread widens back out, every page in this product would
// keep telling readers it had narrowed, because the sentence lived somewhere
// nothing measures. That is a temporary observation that became a permanent
// truth by sitting in a system prompt, which is the thing this module exists
// to stop.
//
// NOT A CMS. There is no editor, no storage, no admin surface and no workflow.
// It is a small typed list with a validator attached to the checkable ones, and
// the validators read the same signals everything else reads.

import type { Signal } from "./signals";

/**
 *   durable       structural. How this kind of market works. No expiry, and
 *                 no validator, because there is nothing to check it against.
 *   validated     checkable, and the current signals agree with it.
 *   unvalidated   checkable, and the signals to check it are not on this page.
 *   contradicted  checkable, and the current signals disagree with it.
 */
export type ThesisStatus =
  | "durable"
  | "validated"
  | "unvalidated"
  | "contradicted";

export interface AnalystThesis {
  id: string;
  /** The claim, as the voice would state it. */
  thesis: string;
  /** What it rests on. For a durable one, why it is structural. */
  basis: string;
  /** When a human last confirmed the wording. Not when it was last validated. */
  reviewedAt: string;
  /**
   * How to check it against live signals. Absent means durable.
   *
   * Returns true when the signals support it, false when they contradict it,
   * and null when the signals needed are not present, which is different from
   * both and must not be collapsed into either.
   */
  validate?: (signals: readonly Signal[]) => boolean | null;
}

export interface ResolvedThesis extends AnalystThesis {
  status: ThesisStatus;
  /** When this status was established. Null for durable. */
  validatedAt: string | null;
}

const find = (signals: readonly Signal[], dimension: string) =>
  signals.find((s) => s.dimension === dimension) ?? null;

const stateHas = (s: Signal | null, ...words: string[]) =>
  s === null ? null : words.some((w) => s.state.toLowerCase().includes(w));

export const THESES: readonly AnalystThesis[] = [
  // ---------------------------------------------------------------- durable
  {
    id: "layers-differ",
    thesis:
      "The layers behave differently. Frontier labs, application vendors, infrastructure and the delivery channel are four different businesses with four different economics, and a figure from one says nothing about another.",
    basis:
      "Structural. It follows from the cost bases and the buyers being different, not from any current reading, and it is the reason this product refuses to rank across market categories at all.",
    reviewedAt: "2026-08-26",
  },
  {
    id: "delivery-is-the-constraint",
    thesis:
      "Concentration risk in this market is a delivery problem as much as a commercial one. Who can actually stand a system up is a smaller set than who can sell one.",
    basis:
      "Structural. Implementation capacity grows with trained people rather than with software licences, so it lags demand in every enterprise software cycle, not only this one.",
    reviewedAt: "2026-08-26",
  },
  {
    id: "cycles-outlast-generations",
    thesis:
      "Procurement cycles outlast model generations. A three-year commitment signed against today's capability leaders is a bet on a leaderboard that reorders in months.",
    basis:
      "Structural. It is a statement about the relative length of two clocks, and holds while enterprise procurement runs in years and model releases run in months.",
    reviewedAt: "2026-08-26",
  },

  // ------------------------------------------------------------- checkable
  {
    id: "capability-commoditised-faster-than-price",
    thesis:
      "Capability has commoditised faster than price. The gap between the best model and an adequate one has narrowed while the price gap has not, which is where most of the available saving in an AI budget sits.",
    basis:
      "Checked against the capability spread on the assessment and the price multiple between the top model and the cheapest one reaching 80 per cent of its benchmark score. Both are measured on this product's own pages, which is exactly why this must not be asserted from a prompt.",
    reviewedAt: "2026-08-26",
    validate(signals) {
      const cap = stateHas(find(signals, "capability"), "narrow", "converged");
      const price = stateHas(find(signals, "price"), "wide", "separated");
      // Either half missing and nothing is established. A page holding only
      // one of the two cannot confirm or deny a claim about both.
      if (cap === null || price === null) return null;
      return cap && price;
    },
  },
  {
    id: "disclosure-is-thin",
    thesis:
      "Disclosure is thin by construction. Very few vendors quantify AI revenue, most private valuations are not revenue multiples, and a confident market figure is usually a modelled one wearing a measurement's clothes.",
    basis:
      "Checked against the count of tracked public vendors stating a quantified AI revenue figure in a filing. Financial Snapshot measures this directly.",
    reviewedAt: "2026-08-26",
    validate(signals) {
      const d = find(signals, "disclosure");
      if (!d) return null;
      // "mostly" is deliberately not in this list. It matches both "mostly
      // undisclosed" and "mostly disclosed", so including it validated the
      // thesis against data that contradicts it. Caught by test.
      return /undisclosed|thin|minority/i.test(d.state);
    },
  },
];

/**
 * Every thesis with its status against the signals in hand.
 *
 * A page supplying no signals gets the durable three and nothing else, which
 * is the correct default and is strictly better than the previous behaviour of
 * asserting all five everywhere regardless of what the page could see.
 */
export function resolveTheses(
  signals: readonly Signal[],
  now: string
): ResolvedThesis[] {
  return THESES.map((t) => {
    if (!t.validate) return { ...t, status: "durable" as const, validatedAt: null };
    const verdict = t.validate(signals);
    if (verdict === null) {
      return { ...t, status: "unvalidated" as const, validatedAt: now };
    }
    return {
      ...t,
      status: verdict ? ("validated" as const) : ("contradicted" as const),
      validatedAt: now,
    };
  });
}

/**
 * The priors block for a page's prompt.
 *
 * Durable theses go in unconditionally. A checkable one goes in only when this
 * page's own signals confirm it, and a contradicted one is stated as
 * contradicted rather than dropped: a page whose data disagrees with the house
 * view has found something, and hiding it would leave the voice quietly
 * hedging around a claim it has just disproved.
 *
 * Unvalidated ones are omitted entirely. Nothing on this page can speak to
 * them, so mentioning them would be inviting the model to.
 */
export function priorsBlock(theses: readonly ResolvedThesis[]): string {
  const durable = theses.filter((t) => t.status === "durable");
  const validated = theses.filter((t) => t.status === "validated");
  const contradicted = theses.filter((t) => t.status === "contradicted");
  if (durable.length === 0 && validated.length === 0 && contradicted.length === 0) {
    return "";
  }

  const parts: string[] = [
    `WHAT YOU KNOW ABOUT HOW THIS MARKET WORKS (structural, not a reading of today):`,
    ...durable.map((t) => `- ${t.thesis}`),
  ];

  if (validated.length > 0) {
    parts.push(
      "",
      `CONFIRMED BY THIS PAGE'S OWN DATA (checked ${validated[0].validatedAt}, so you may state it):`,
      ...validated.map((t) => `- ${t.thesis}`)
    );
  }

  if (contradicted.length > 0) {
    parts.push(
      "",
      `CONTRADICTED BY THIS PAGE'S OWN DATA (checked ${contradicted[0].validatedAt}). Do NOT state these. Where the reading bears on one, say what this page actually shows:`,
      ...contradicted.map((t) => `- ${t.thesis}`)
    );
  }

  return parts.join("\n");
}
