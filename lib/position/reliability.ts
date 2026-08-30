import type { EvidenceType } from "@/lib/research/facts";
import type { CompanySignal } from "./company-signals";

// How far a reader should trust that this opportunity applies to THIS company.
//
// THE DEFECT THIS REPLACES. The row read "reliability 3/5" beside the risk
// tier, and a reader takes a number in that position as confidence in the
// recommendation. It was nothing of the kind: `reliabilityRequirement` is a
// property of the WORKFLOW in the catalogue, the assurance bar a system has to
// clear before that work can be trusted to it. It is identical for every
// company the catalogue offers that workflow to, so it could not vary with the
// evidence and it never did. Two companies, one with a filing evidencing the
// area and one with nothing retrieved at all, showed the same 3/5.
//
// Both numbers are real and they answer different questions, so both are kept
// and neither is asked to do the other's job:
//
//   assurance bar   what this WORKFLOW needs before you can trust it. From the
//                   catalogue. Same for everyone. Drives role fit and weighting
//   reliability     how well THIS COMPANY's evidence supports putting this
//                   workflow to them. Computed here. Varies per company
//
// EVERY POINT MEANS SOMETHING, which is the test the old number failed. The
// ladder below is stated in full, is deterministic, and is shown on screen
// beside the number so a reader can disagree with the reasoning rather than
// only with the result.

export type OpportunityClass = "evidenced" | "derived" | "sector";

/** Sources that are the company's own record rather than a report about it. */
const OWN_RECORD: ReadonlySet<EvidenceType> = new Set([
  "regulatory_filing",
  "annual_report",
  "company_announcement",
]);

/**
 * What each point on the scale asserts.
 *
 * Written out because a scale whose points cannot be stated is a scale nobody
 * can argue with, and the previous one could not be stated.
 */
export const RELIABILITY_MEANING: Readonly<Record<number, string>> = {
  1: "Nothing retrieved about this company supports it, and what was retrieved left a figure unresolved.",
  2: "The sector runs this. Nothing retrieved about this company speaks to it.",
  3: "Company signals make it relevant, from a single line of evidence.",
  4: "The company's own sources speak to this area, or several company signals converge on it.",
  5: "The company's own official record evidences it.",
};

export interface EvidenceReliability {
  /** 1 to 5. What RELIABILITY_MEANING says at that point, and nothing more. */
  score: number;
  /** The claim that number makes, in the reader's language. */
  meaning: string;
  /** How it got there, step by step, so it can be interrogated. */
  basis: string;
}

export interface ReliabilityInput {
  classification: OpportunityClass;
  /** The authority of each source under the evidence, deduplicated by caller. */
  sourceTypes: readonly (EvidenceType | null)[];
  /** Distinct source indices under the evidence, for diversity. */
  sourceIndices: readonly number[];
  /** The signals that argued for it. Empty for evidenced and sector. */
  signals: readonly CompanySignal[];
  /**
   * True where the research left a figure about this company unresolved.
   *
   * A company whose own revenue cannot be settled across three sources is a
   * company whose retrieved record is in worse shape than it looks, and that
   * is a fact about every recommendation drawn from that record, not only
   * about the figure.
   */
  unresolvedConflict: boolean;
}

/**
 * The reliability of an opportunity, and the working behind it.
 *
 * THE RULES, IN ORDER. Nothing here is weighted or averaged; each step is a
 * whole point and each one is named on screen.
 *
 *   base            evidenced 4, derived 3, sector 2
 *   +1 own record   a filing, an annual report or the company's own
 *                   announcement sits under it
 *   +1 converging   two or more distinct signals argue for it, or the
 *                   evidence spans two or more distinct sources
 *   -1 conflict     the research left a figure about this company unresolved
 *   cap             sector never exceeds 2, whatever else is true, because
 *                   nothing retrieved about this company supports it
 *   clamp           1 to 5
 */
export function reliabilityOf(input: ReliabilityInput): EvidenceReliability {
  const steps: string[] = [];
  const base =
    input.classification === "evidenced"
      ? 4
      : input.classification === "derived"
        ? 3
        : 2;
  steps.push(
    input.classification === "evidenced"
      ? "starts at 4 because this company's own sources speak to the area"
      : input.classification === "derived"
        ? "starts at 3 because company signals argue for it rather than a source naming it"
        : "starts at 2 because it is what the sector runs and nothing retrieved speaks to it"
  );

  let score = base;

  const ownRecord = input.sourceTypes.some((t) => t !== null && OWN_RECORD.has(t));
  if (ownRecord) {
    score += 1;
    steps.push("adds 1 for the company's own record sitting underneath it");
  }

  const distinctSignals = new Set(input.signals.map((s) => s.dimension)).size;
  const distinctSources = new Set(input.sourceIndices).size;
  if (distinctSignals >= 2 || distinctSources >= 2) {
    score += 1;
    steps.push(
      distinctSignals >= 2
        ? `adds 1 because ${distinctSignals} separate signals converge on it`
        : `adds 1 because the evidence spans ${distinctSources} sources`
    );
  }

  if (input.unresolvedConflict) {
    score -= 1;
    steps.push(
      "takes 1 away because the research could not settle a figure about this company"
    );
  }

  // The cap is not a tie-breaker, it is the point of the classification: an
  // area no retrieved source connects to this company cannot be well evidenced
  // however authoritative the sources behind other areas were.
  if (input.classification === "sector" && score > 2) {
    score = 2;
    steps.push("capped at 2, because nothing retrieved connects it to this company");
  }

  score = Math.max(1, Math.min(5, score));

  return {
    score,
    meaning: RELIABILITY_MEANING[score],
    basis: `Reliability ${score} of 5: ${steps.join("; ")}.`,
  };
}
