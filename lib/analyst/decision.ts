// The decision packet: what to do, why now, and what would change it.
//
// THE PROBLEM THIS SOLVES. Every insight in this product ends in one of eight
// canonical actions. Those actions are defensible, derived from thresholds we
// can point at, and too broad to act on. "Investigate" is a direction of
// travel, not an instruction. A reader accountable for a purchase gets told
// which way to lean and is left to work out what that means on Tuesday.
//
// So each builder now also states the specific thing to do, the change that
// makes it relevant now, the evidence on both sides, and the observable event
// that should make them think again.
//
// WHAT HAS NOT CHANGED. The action is still chosen by the same deterministic
// thresholds. Nothing here lets a model pick one, and nothing here invents a
// figure: every packet is filled from values its own builder already computed.
//
// TWO THINGS THIS DELIBERATELY DOES NOT DO:
//
//   No confidence percentage. A 0 to 100 score over evidence of mixed
//   provenance is a number with no methodology behind it, and this product's
//   whole position is that a figure without a derivation is worthless. The
//   strength of a recommendation is a named state instead.
//
//   No conclusions hard-coded per page. "Concentration means keep a second
//   source warm" is a reasoning pattern, not a finding. Where the data does
//   not support it, the builder does not write it.

import type { DataLane } from "@/lib/provenance";
import { actionIntent, type ActionIntent } from "./canonical";

/** The eight canonical actions. Kept in step with AnalystAction by typecheck. */
type Action =
  | "Accelerate"
  | "Monitor"
  | "Investigate"
  | "Pause"
  | "Renegotiate"
  | "Shortlist"
  | "Expand"
  | "Reduce exposure";

/**
 * How a single piece of evidence was obtained.
 *
 * This is the distinction that stops a modelled estimate reading like a
 * measurement. Market share in this product is modelled; SEC disclosure is
 * measured; a vendor's own revenue statement is disclosed; and the absence of
 * a filing is itself evidence, of a different kind from all three.
 */
export type EvidenceBasis = "measured" | "modelled" | "disclosed" | "absent";

export interface DecisionEvidence {
  /**
   * What this evidence says, in one clause, carrying its own figure. Written
   * by the builder from values it computed, never summarised afterwards.
   */
  claim: string;
  /** The dataset it came from. Matches the naming in InsightEvidence.sources. */
  source: string;
  basis: EvidenceBasis;
  lane: DataLane;
  /** When it was last true, where the builder knows. */
  asOf?: string | null;
}

/**
 * How much weight the recommendation can carry, as a state rather than a score.
 *
 *   corroborated    two or more independent sources point the same way
 *   single signal   one source, or several readings of one source
 *   contested       something in the evidence argues the other way
 *   insufficient    nothing supports a recommendation at all
 *
 * Read off the evidence arrays rather than declared, so a builder cannot claim
 * a strength its own evidence does not carry.
 */
export type EvidenceStrength =
  | "corroborated"
  | "single signal"
  | "contested"
  | "insufficient";

export interface Decision {
  /** The canonical action, after the escalation guard below has run. */
  action: Action;
  /**
   * The specific thing to do. Must say more than the action label does:
   * "Re-run the shortlist against current price and performance before the
   * incumbent renews", not "Investigate alternatives".
   */
  instruction: string;
  /** The change, or combination, that makes this relevant now. */
  whyNow: string;
  evidenceFor: DecisionEvidence[];
  /**
   * Evidence that argues against, or limits, the recommendation.
   *
   * This exists to stop a threshold crossing producing a confident answer on
   * its own. A page where one signal says switch and another says the
   * implementation risk is high has not found a reason to accelerate; it has
   * found a reason to look properly.
   */
  evidenceAgainst: DecisionEvidence[];
  /** The observable change that should reopen this. Null when none is supportable. */
  trigger: string | null;
  /** The specific over-reach this evidence does not license. Null when none applies. */
  doNotDo: string | null;
  strength: EvidenceStrength;
}

/**
 * The strength the evidence actually carries.
 *
 * Contested outranks corroborated on purpose. Three readings pointing one way
 * and one pointing the other is a contested picture, not a strong one, and
 * presenting it as strong is exactly the false confidence this is here to
 * prevent.
 *
 * Independence is counted by distinct source, because three figures pulled
 * from one dataset are one signal read three ways. That is the difference
 * between corroboration and repetition.
 */
export function strengthOf(
  evidenceFor: readonly DecisionEvidence[],
  evidenceAgainst: readonly DecisionEvidence[]
): EvidenceStrength {
  if (evidenceFor.length === 0) return "insufficient";
  if (evidenceAgainst.length > 0) return "contested";
  const sources = new Set(evidenceFor.map((e) => e.source));
  return sources.size >= 2 ? "corroborated" : "single signal";
}

/**
 * The action the evidence will actually support, which may be weaker than the
 * one the threshold proposed. Never stronger.
 *
 * Only `advance` is guarded. An action that tells a reader to commit more
 * budget or scope is the one where over-confidence does damage, and it is the
 * one the prompt's own example is about: a signal supporting a switch and a
 * signal showing high implementation risk together justify looking, not going.
 *
 * `restrain` is deliberately NOT downgraded on contested evidence. Weakening a
 * Pause because the picture is mixed would push a reader toward action on
 * exactly the evidence that says be careful, which is the wrong direction to
 * fail in.
 */
export function resolveAction(
  proposed: Action,
  strength: EvidenceStrength
): Action {
  const intent: ActionIntent | null = actionIntent(proposed);
  if (intent !== "advance") return proposed;
  if (strength === "corroborated") return proposed;
  // Nothing supports a recommendation, so there is nothing to act on yet.
  if (strength === "insufficient") return "Monitor";
  // One signal, or a contested picture. Both justify looking, not committing.
  return "Investigate";
}

/**
 * Assemble a packet, deriving the two things that must not be asserted.
 *
 * `strength` is computed from the evidence and `action` is passed through the
 * escalation guard, so a builder cannot declare a strong recommendation on
 * thin evidence even by mistake.
 */
export function decide(input: {
  action: Action;
  instruction: string;
  whyNow: string;
  evidenceFor: DecisionEvidence[];
  evidenceAgainst?: DecisionEvidence[];
  trigger?: string | null;
  doNotDo?: string | null;
}): Decision {
  const evidenceAgainst = input.evidenceAgainst ?? [];
  const strength = strengthOf(input.evidenceFor, evidenceAgainst);
  return {
    action: resolveAction(input.action, strength),
    instruction: input.instruction,
    whyNow: input.whyNow,
    evidenceFor: input.evidenceFor,
    evidenceAgainst,
    trigger: input.trigger ?? null,
    doNotDo: input.doNotDo ?? null,
    strength,
  };
}

/**
 * How the strength should be said out loud, once, beside the recommendation.
 *
 * A reader has to be able to tell a recommendation resting on one modelled
 * estimate from one that three independent datasets agree on, without reading
 * the derivation. These are the words for that, and there are only four of
 * them because there are only four states.
 */
export const STRENGTH_LABEL: Record<EvidenceStrength, string> = {
  corroborated: "Corroborated by independent sources",
  "single signal": "Rests on a single signal",
  contested: "Evidence is contested",
  insufficient: "Not enough evidence to recommend",
};
