import { VENDOR_DIRECTORY } from "@/lib/aie/vendor-directory";

// Who is not a vendor you could buy from.
//
// The ranking engine tracks four investment firms alongside the vendors:
// Andreessen Horowitz, MGX, Sequoia Capital and SoftBank. They belong in a
// market map and they do not belong in anything a buyer is meant to act on.
// The composite has excluded them since it was written, on the grounds that
// "is it winning, do people trust it, will it still exist in three years" are
// questions about a supplier, and asking them of Sequoia Capital is a category
// error.
//
// This exists because that rule was enforced in one place and the same
// judgement was needed in others. On 8 August 2026 the "Since you last looked"
// panel filled all six of its rows with MGX and wrote a paragraph advising
// shorter commitments and priced exit terms, drawn entirely from an investment
// fund's capability scores. MGX had 12 recorded moves, the joint highest of any
// entity in the set, because it is thinly assessed: with little evidence
// underneath it, small revisions swing its numbers hard and it wins any ranking
// sorted by size of movement.
//
// Kept as a predicate over the directory rather than a hardcoded list of four
// ids, so a fifth investor added upstream is excluded without anybody
// remembering to come back here.

const INVESTOR_CATEGORY = "AI investor";

const INVESTOR_IDS: Set<string> = new Set(
  VENDOR_DIRECTORY.filter((v) => v.category === INVESTOR_CATEGORY).map(
    (v) => v.id
  )
);

/** True for a firm that invests in AI rather than sells it. */
export function isInvestor(vendorId: string): boolean {
  return INVESTOR_IDS.has(vendorId);
}

/** The ids, for a caller that needs to say who was left out. */
export function investorIds(): string[] {
  return [...INVESTOR_IDS].sort();
}

export { INVESTOR_CATEGORY };
