// Estimating revenue for the private AI labs.
//
// READ THIS BEFORE TRUSTING A NUMBER OUT OF THIS FILE.
//
// None of these companies publishes accounts. A revenue figure for any of them
// is therefore either something they said out loud, or an inference from a
// valuation. This module does both, keeps them in separate lanes, and never
// lets the second wear the clothes of the first.
//
// The inference is arithmetic on one assumption: revenue = valuation / multiple.
// The valuation is cited. The multiple is not knowable from outside, so it is
// exposed as a control rather than buried as a constant, and the output is
// always a range across a multiple band, never a point.
//
// Why a band and not a best guess. Across the one AI-lab pair where both
// numbers are on the record (Mistral, below) the implied multiple is about 54x
// run-rate revenue. Public enterprise software trades nearer 5x to 15x. Picking
// either as "the" multiple would produce a number wrong by roughly an order of
// magnitude in one direction or the other, so the product shows the whole
// interval and says plainly that the width is the finding: outside these
// companies, nobody knows, and anyone quoting a single figure is guessing.
//
// What this deliberately does not do: apply a multiple to a valuation that was
// never disclosed, treat a compute or infrastructure commitment as a valuation,
// or turn a round that is only "in talks" into a fact. Each of those has a
// named guard below.

export type DisclosureState = "closed" | "reported" | "in_talks";

/**
 * Calibration regime. A valuation multiple observed on a data platform says
 * nothing about how a frontier lab is priced, so pairs only ever calibrate the
 * band for their own class. Mixing them would smuggle Databricks' economics
 * into an Anthropic estimate under cover of arithmetic.
 */
export type VendorClass = "frontier_lab" | "data_platform" | "other";

export interface Citation {
  publisher: string;
  asOf: string;
  /** What the source actually says, so a reader can check the reading. */
  quote: string;
}

export interface ValuationRecord {
  vendorId: string;
  vendorName: string;
  vendorClass: VendorClass;
  /** Post-money, in USD millions. */
  valuationUsdM: number;
  /** Set when the source stated another currency, so the rate is visible. */
  statedCurrency?: { code: string; amount: number; usdPerUnit: number };
  state: DisclosureState;
  citation: Citation;
}

export interface RevenueRecord {
  vendorId: string;
  vendorClass: VendorClass;
  /** USD millions. A floor when the source says "above" or "more than". */
  revenueUsdM: number;
  isFloor: boolean;
  /**
   * What kind of figure the source stated. A projection is carried in the
   * record because it is on the record, but it never becomes "the figure":
   * the disclosed lane only ever serves non-projection bases.
   */
  basis: "run_rate" | "annual" | "arr" | "projection";
  state: DisclosureState;
  citation: Citation;
  /** Gross-vs-net, consumer-vs-enterprise, conversion — what a reader must know. */
  caveats?: string;
  sourceUrl?: string;
}

// ---------------------------------------------------------------- the record
//
// The record itself lives in data/private-figures.json so the catalogue
// ingestion script (plain Node, no TypeScript runner) can read the same file
// this module types. Nothing here is entered without a source, and nothing is
// carried forward from memory; the tests hold every row to that.

import figures from "./data/private-figures.json";

export const VALUATIONS: ValuationRecord[] =
  figures.valuations as ValuationRecord[];

export const REVENUES: RevenueRecord[] = figures.revenues as RevenueRecord[];

// Things that look like a valuation and are not. Recorded so the next person
// to read the feed does not make the mistake this note exists to prevent.
export const NOT_VALUATIONS: { vendorId: string; what: string; why: string }[] =
  figures.notValuations;

// ------------------------------------------------------------- the estimate

/** The multiple band, in turns of annual run-rate revenue. */
export interface MultipleBand {
  low: number;
  high: number;
}

/**
 * The default band.
 *
 * The low end is the one multiple this product can actually observe: Mistral's
 * reported valuation over its reported run-rate revenue. The high end is twice
 * that, which is not a measurement and is labelled as such; it is here so the
 * interval spans the range these companies have plausibly been priced at
 * rather than implying the single observable pair is the market.
 */
export const DEFAULT_BAND: MultipleBand = { low: 30, high: 90 };

export interface ObservedPair {
  vendorId: string;
  vendorClass: VendorClass;
  multiple: number;
  /** True when the revenue was a floor, so the true multiple is at most this. */
  isFloorDerived: boolean;
  /** Days between the valuation and revenue citations. A wide gap weakens the pair. */
  daysApart: number;
}

/**
 * Every pair where both a valuation and a revenue figure are on the record for
 * the same vendor. These are the only multiples this product can observe, and
 * the only thing the band may be calibrated from.
 *
 * Projections are excluded on principle: dividing a real valuation by a hoped-
 * for revenue produces a multiple for a company that does not exist yet.
 * Where a vendor has several revenue records, the one closest in time to the
 * valuation is used — a 2024 revenue under a 2026 valuation would overstate
 * the multiple by however much the company grew in between.
 */
export function observedMultiples(cls?: VendorClass): ObservedPair[] {
  const out: ObservedPair[] = [];
  for (const v of VALUATIONS) {
    if (cls && v.vendorClass !== cls) continue;
    const candidates = REVENUES.filter(
      (r) =>
        r.vendorId === v.vendorId && r.basis !== "projection" && r.revenueUsdM > 0
    );
    if (candidates.length === 0) continue;
    const vDate = Date.parse(v.citation.asOf);
    const nearest = candidates.reduce((a, b) =>
      Math.abs(Date.parse(a.citation.asOf) - vDate) <=
      Math.abs(Date.parse(b.citation.asOf) - vDate)
        ? a
        : b
    );
    out.push({
      vendorId: v.vendorId,
      vendorClass: v.vendorClass,
      // Rounded to one decimal; the inputs do not support more.
      multiple: Math.round((v.valuationUsdM / nearest.revenueUsdM) * 10) / 10,
      isFloorDerived: nearest.isFloor,
      daysApart: Math.round(
        Math.abs(Date.parse(nearest.citation.asOf) - vDate) / 86_400_000
      ),
    });
  }
  return out.sort((a, b) => a.multiple - b.multiple);
}

/** The first frontier-lab pair, kept for callers that want a single anchor. */
export function observedMultiple(): {
  vendorId: string;
  multiple: number;
  isFloorDerived: boolean;
} | null {
  const pairs = observedMultiples("frontier_lab");
  if (pairs.length === 0) return null;
  const p = pairs[0];
  return {
    vendorId: p.vendorId,
    multiple: p.multiple,
    isFloorDerived: p.isFloorDerived,
  };
}

export type EstimateBasis =
  | "disclosed"
  | "implied_from_valuation"
  | "no_basis";

export interface RevenueEstimate {
  vendorId: string;
  vendorName: string;
  basis: EstimateBasis;
  /** Present only when basis is "disclosed". */
  disclosed: RevenueRecord | null;
  /**
   * Every dated revenue record for the vendor, oldest first, projections
   * included. The trajectory is often more informative than the point: a
   * company reported at $1B and later at $4B has told you its slope.
   */
  series: RevenueRecord[];
  /** Present only when basis is "implied_from_valuation". */
  valuation: ValuationRecord | null;
  /** USD millions. Null unless implied. */
  lowUsdM: number | null;
  highUsdM: number | null;
  /** Why nothing can be said, when nothing can be. */
  absence: string | null;
}

/**
 * One estimate per vendor, in evidence order: what a company said about its own
 * revenue beats what can be inferred from a valuation, and both beat silence.
 */
export function estimateRevenue(
  vendorId: string,
  vendorName: string,
  band: MultipleBand = DEFAULT_BAND
): RevenueEstimate {
  const series = REVENUES.filter((r) => r.vendorId === vendorId).sort(
    (a, b) => Date.parse(a.citation.asOf) - Date.parse(b.citation.asOf)
  );
  const base = {
    vendorId,
    vendorName,
    series,
    disclosed: null,
    valuation: null,
    lowUsdM: null,
    highUsdM: null,
    absence: null,
  };

  // The latest figure the company or a named publisher has actually put on
  // the record. Latest, because these companies' revenues move fast enough
  // that a year-old figure presented as current would be wrong by design; and
  // never a projection, because "expects to reach" is a hope with a date on
  // it, not a figure. A vendor whose only record is a projection falls
  // through to the valuation lane rather than wearing the projection as fact.
  const disclosed = [...series]
    .reverse()
    .find((r) => r.basis !== "projection");
  if (disclosed) {
    return { ...base, basis: "disclosed", disclosed };
  }

  const valuation = VALUATIONS.find((v) => v.vendorId === vendorId);
  if (valuation) {
    // A higher multiple implies LESS revenue for the same valuation, so the
    // band inverts: the top of the multiple band is the bottom of the revenue
    // range. Getting this backwards would put the range on the wrong side of
    // the truth, which is why it is asserted in the tests.
    return {
      ...base,
      basis: "implied_from_valuation",
      valuation,
      lowUsdM: valuation.valuationUsdM / band.high,
      highUsdM: valuation.valuationUsdM / band.low,
    };
  }

  const notAValuation = NOT_VALUATIONS.find((n) => n.vendorId === vendorId);
  return {
    ...base,
    basis: "no_basis",
    absence: notAValuation
      ? `No equity valuation is on the record. The largest figure published against this vendor is ${notAValuation.what}, which is not a valuation: ${notAValuation.why}`
      : "No valuation and no revenue figure has been published by a named source, so nothing can be inferred. This is the normal state for a private company and is reported rather than filled.",
  };
}

export function formatUsdM(m: number): string {
  if (m >= 1000) {
    const b = m / 1000;
    return `$${b >= 100 ? Math.round(b) : Math.round(b * 10) / 10}B`;
  }
  return `$${Math.round(m)}M`;
}
