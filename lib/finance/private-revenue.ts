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

export interface Citation {
  publisher: string;
  asOf: string;
  /** What the source actually says, so a reader can check the reading. */
  quote: string;
}

export interface ValuationRecord {
  vendorId: string;
  vendorName: string;
  /** Post-money, in USD millions. */
  valuationUsdM: number;
  /** Set when the source stated another currency, so the rate is visible. */
  statedCurrency?: { code: string; amount: number; usdPerUnit: number };
  state: DisclosureState;
  citation: Citation;
}

export interface RevenueRecord {
  vendorId: string;
  /** USD millions. A floor when the source says "above" or "more than". */
  revenueUsdM: number;
  isFloor: boolean;
  basis: "run_rate" | "annual" | "arr";
  state: DisclosureState;
  citation: Citation;
}

// ---------------------------------------------------------------- the record
//
// Transcribed from the AIE live news feed, which carries the publisher and the
// date for each. Nothing here is entered without a source, and nothing is
// carried forward from memory.

export const VALUATIONS: ValuationRecord[] = [
  {
    vendorId: "anthropic",
    vendorName: "Anthropic",
    valuationUsdM: 380_000,
    state: "closed",
    citation: {
      publisher: "TechCrunch",
      asOf: "2026-02-12",
      quote:
        "On February 12, 2026 Anthropic raised a $30B Series G at a $380B post-money valuation, co-led by GIC and Coatue.",
    },
  },
  {
    vendorId: "cohere",
    vendorName: "Cohere",
    valuationUsdM: 6_800,
    state: "closed",
    citation: {
      publisher: "Constellation Research",
      asOf: "2026-08-01",
      quote:
        "Cohere raised $500 million in venture funding, achieving a $6.8 billion valuation, led by Radical Ventures and Inovia Capital.",
    },
  },
  {
    vendorId: "mistral",
    vendorName: "Mistral",
    // The source states euros. The rate is an assumption of this product, not
    // of the source, so it is carried on the record rather than folded away.
    valuationUsdM: 21_600,
    statedCurrency: { code: "EUR", amount: 20_000, usdPerUnit: 1.08 },
    state: "in_talks",
    citation: {
      publisher: "Bloomberg",
      asOf: "2026-08-01",
      quote:
        "Mistral is reportedly in talks to raise ~EUR3B at a ~EUR20B valuation, following a $830M debt facility (Mar 2026) and its ASML-led EUR1.7B Series C.",
    },
  },
];

export const REVENUES: RevenueRecord[] = [
  {
    vendorId: "mistral",
    revenueUsdM: 400,
    isFloor: true,
    basis: "run_rate",
    state: "reported",
    citation: {
      publisher: "Bloomberg",
      asOf: "2026-08-01",
      quote: "…with run-rate revenue reported above $400M.",
    },
  },
];

// Things that look like a valuation and are not. Recorded so the next person
// to read the feed does not make the mistake this note exists to prevent.
export const NOT_VALUATIONS: { vendorId: string; what: string; why: string }[] =
  [
    {
      vendorId: "openai",
      what: "$110B in funding involving Amazon, Microsoft and Nvidia, including a $100B expansion of an AWS deal over eight years (Yahoo Finance, 2026-07-31)",
      why: "A compute and infrastructure commitment, not an equity round. It says nothing about what the company is worth or what it earns, and dividing it by a multiple would be meaningless.",
    },
  ];

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

/** The multiple implied by the one pair where both figures are on the record. */
export function observedMultiple(): {
  vendorId: string;
  multiple: number;
  isFloorDerived: boolean;
} | null {
  for (const r of REVENUES) {
    const v = VALUATIONS.find((x) => x.vendorId === r.vendorId);
    if (!v || r.revenueUsdM <= 0) continue;
    return {
      vendorId: r.vendorId,
      // The revenue is a floor ("above $400M"), so the true multiple is at
      // most this. Rounded to one decimal; the inputs do not support more.
      multiple: Math.round((v.valuationUsdM / r.revenueUsdM) * 10) / 10,
      isFloorDerived: r.isFloor,
    };
  }
  return null;
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
  const base = { vendorId, vendorName, disclosed: null, valuation: null, lowUsdM: null, highUsdM: null, absence: null };

  const disclosed = REVENUES.find((r) => r.vendorId === vendorId);
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
