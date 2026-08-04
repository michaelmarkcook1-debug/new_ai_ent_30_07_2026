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
// Why a band and not a best guess. Across the pairs where both numbers are on
// the record, fresh frontier-lab multiples run from about 20x to 54x run-rate
// revenue — and the 54x divides a revenue floor, so it is itself a ceiling.
// Public enterprise software trades nearer 5x to 15x. Picking any point in
// that spread as "the" multiple would produce a number wrong by a large
// factor in one direction or the other, so the product shows the whole
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
  /** A URL, or "aie-news-feed" when the feed itself is the citation. */
  sourceUrl?: string;
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
  /** Set when the source stated another currency, so the rate is visible. */
  statedCurrency?: { code: string; amount: number; usdPerUnit: number };
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

// ---------------------------------------------------------- the cross-check

export interface CrossCheck {
  vendorId: string;
  sharePct: number;
  marketUsdM: number;
  marketMeasure: string;
  citation: Citation;
}

export const CROSS_CHECKS: CrossCheck[] = (figures as { crossChecks?: CrossCheck[] })
  .crossChecks ?? [];

/**
 * What an independently measured market implies for ONE SLICE of a vendor's
 * revenue: share x measured market. A separate lane, never blended into the
 * reported figure, because the two measure different things — and when they
 * differ by an order of magnitude, that gap is the finding. Menlo's measure
 * covers enterprise model-API spend; a vendor whose reported total towers
 * over its implied API slice earns most of its revenue somewhere that
 * measure cannot see (consumer subscriptions, coding tools, compute resale),
 * and the display's job is to say so rather than reconcile it away.
 */
export function marketSlice(
  vendorId: string
): { sliceUsdM: number; check: CrossCheck } | null {
  const check = CROSS_CHECKS.find((c) => c.vendorId === vendorId);
  if (!check) return null;
  return { sliceUsdM: (check.marketUsdM * check.sharePct) / 100, check };
}

// ------------------------------------------------------------- the estimate

/** The multiple band, in turns of annual run-rate revenue. */
export interface MultipleBand {
  low: number;
  high: number;
}

/**
 * A pair whose two citations are more than a quarter apart is measuring two
 * different companies: these vendors' revenues move fast enough that a
 * February valuation over a June revenue understates the multiple by however
 * much the company grew in between. Stale pairs are kept and shown — dropping
 * them silently would hide evidence — but they are flagged, and they do not
 * anchor the default band.
 */
export const STALE_PAIR_DAYS = 90;

/**
 * The default band.
 *
 * Anchored by the fresh frontier-lab pairs on the record (each valuation over
 * the nearest-in-time reported revenue, within a quarter): roughly 20x to 54x
 * at the time of writing, with the top pair derived from a revenue floor and
 * therefore itself a ceiling. The band extends beyond the observed span on
 * both sides because a handful of pairs is not the market; the width is the
 * finding, and the tests assert every fresh frontier pair sits inside it.
 */
export const DEFAULT_BAND: MultipleBand = { low: 15, high: 90 };

export interface ObservedPair {
  vendorId: string;
  vendorClass: VendorClass;
  multiple: number;
  /** True when the revenue was a floor, so the true multiple is at most this. */
  isFloorDerived: boolean;
  /** Days between the valuation and revenue citations. A wide gap weakens the pair. */
  daysApart: number;
  /** True when the citations are more than STALE_PAIR_DAYS apart. */
  stale: boolean;
  /** The valuation the pair divides, so the display can name it. */
  valuationUsdM: number;
  revenueUsdM: number;
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
    const daysApart = Math.round(
      Math.abs(Date.parse(nearest.citation.asOf) - vDate) / 86_400_000
    );
    out.push({
      vendorId: v.vendorId,
      vendorClass: v.vendorClass,
      // Rounded to one decimal; the inputs do not support more.
      multiple: Math.round((v.valuationUsdM / nearest.revenueUsdM) * 10) / 10,
      isFloorDerived: nearest.isFloor,
      daysApart,
      stale: daysApart > STALE_PAIR_DAYS,
      valuationUsdM: v.valuationUsdM,
      revenueUsdM: nearest.revenueUsdM,
    });
  }
  return out.sort((a, b) => a.multiple - b.multiple);
}

/**
 * The implied-range arithmetic, extracted so it stays testable while no live
 * vendor exercises it: every vendor with a valuation currently also has a
 * reported revenue, so the disclosed lane wins everywhere. The lane stays,
 * because the next vendor to raise before reporting revenue will need it.
 *
 * The band inverts on purpose: a higher multiple implies less revenue for the
 * same valuation, so the top of the multiple band produces the bottom of the
 * revenue range.
 */
export function impliedRange(
  valuationUsdM: number,
  band: MultipleBand
): { lowUsdM: number; highUsdM: number } {
  return { lowUsdM: valuationUsdM / band.high, highUsdM: valuationUsdM / band.low };
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

  // Latest valuation wins, for the same reason the latest revenue does:
  // these companies re-price within months, and an old round presented as
  // current would be wrong by design.
  const valuation = VALUATIONS.filter((v) => v.vendorId === vendorId).sort(
    (a, b) => Date.parse(b.citation.asOf) - Date.parse(a.citation.asOf)
  )[0];
  if (valuation) {
    const range = impliedRange(valuation.valuationUsdM, band);
    return {
      ...base,
      basis: "implied_from_valuation",
      valuation,
      lowUsdM: range.lowUsdM,
      highUsdM: range.highUsdM,
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
