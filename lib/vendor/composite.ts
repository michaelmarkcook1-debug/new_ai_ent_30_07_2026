// The three questions a CIO actually asks, and the one number some views need.
//
// Is it winning? Do people trust it? Will it still exist in three years?
//
// The blocker on fusing these into a score is that the third has data for 19
// of 47 tracked vendors and the second for 28. A mean over "whatever happened
// to be available" is the false precision this product exists to replace, so
// two rules run through everything here.
//
// One: a composite always carries the count of inputs it was built from. There
// is no code path that returns a score without one, because the count is part
// of the number rather than a footnote on it.
//
// Two: weights are renormalised over the inputs that are present. Scoring a
// missing input as zero would punish a vendor for not disclosing, which turns
// an absence in our data into a verdict about their business.
//
// The verdicts are cut against the tracked set rather than an absolute scale.
// Measured 4 August 2026, capability means run 47.7 to 75.5 and reputation
// means run 68.3 to 82.0: two different scales that no single fixed threshold
// reads correctly. A flat "Yes at 70" would mark almost every vendor trusted
// and almost none winning, which says more about the scales than the vendors.

export type Verdict = "yes" | "mixed" | "no" | "unknown";

export type InputKey = "winning" | "trust" | "durability";

export const INPUT_KEYS: InputKey[] = ["winning", "trust", "durability"];

export const QUESTIONS: Record<InputKey, { question: string; source: string }> =
  {
    winning: {
      question: "Is it winning?",
      source: "Assessed capability across ten dimensions",
    },
    trust: {
      question: "Do people trust it?",
      source: "Customer, developer and employee reputation",
    },
    durability: {
      question: "Will it still exist in 3 years?",
      source: "What the company discloses about its finances",
    },
  };

/** Copy for an Unknown, per input. An absence has to say what is absent. */
export const UNKNOWN_COPY: Record<InputKey, string> = {
  winning: "Not assessed on any capability",
  trust: "No reputation data published",
  durability: "No AI revenue disclosed",
};

export type Weights = Record<InputKey, number>;

export const DEFAULT_WEIGHTS: Weights = {
  winning: 0.4,
  trust: 0.3,
  durability: 0.3,
};

export type CompositeInputs = Record<InputKey, number | null>;

/** Tercile cut points per input, computed over the tracked set. */
export type Thresholds = Record<InputKey, { low: number; high: number }>;

/**
 * Durability does not get tercile cuts, and this is the reason.
 *
 * It is a four-rung ordinal read off disclosure, and 15 of its 18 values are
 * the same rung (a listed company filing accounts). Terciles over that put
 * both cut points at 85, which would have read Anthropic, a company with a
 * closed $380B round, as "No" on whether it will exist in three years. A
 * statistical artefact of a lopsided distribution is not a finding about a
 * business.
 *
 * The low cut is 0 on purpose. "No" should mean there is evidence a vendor is
 * in trouble, and this product holds none for any tracked vendor: nobody
 * publishes runway, and non-disclosure is already carried by Unknown. So this
 * input can return Yes, Mixed and Unknown, and cannot return No. That is a
 * limit of the evidence, stated rather than papered over with a threshold
 * that would manufacture the verdict anyway.
 */
export const DURABILITY_CUTS = { low: 0, high: 80 } as const;

export interface CompositeResult {
  /** null when no input is present at all. Never a zero standing in for one. */
  score: number | null;
  inputsPresent: number;
  inputsTotal: number;
  present: InputKey[];
  missing: InputKey[];
  /** Weights actually applied, renormalised over the present inputs. */
  applied: Partial<Weights>;
}

/** The tercile boundaries of a set of values, ignoring absences. */
export function terciles(values: (number | null)[]): {
  low: number;
  high: number;
} {
  const xs = values
    .filter((v): v is number => typeof v === "number")
    .sort((a, b) => a - b);
  if (xs.length === 0) return { low: 0, high: 0 };
  const at = (q: number) => {
    const i = (xs.length - 1) * q;
    const lo = Math.floor(i);
    const hi = Math.ceil(i);
    return lo === hi ? xs[lo] : xs[lo] + (xs[hi] - xs[lo]) * (i - lo);
  };
  return { low: at(1 / 3), high: at(2 / 3) };
}

/**
 * Where one value sits against its own measure's spread. Unknown is a first
 * class answer: it is returned for a genuine absence and never inferred.
 */
export function verdictFor(
  value: number | null,
  cut: { low: number; high: number }
): Verdict {
  if (value === null) return "unknown";
  if (value >= cut.high) return "yes";
  if (value < cut.low) return "no";
  return "mixed";
}

export function verdicts(
  inputs: CompositeInputs,
  thresholds: Thresholds
): Record<InputKey, Verdict> {
  return {
    winning: verdictFor(inputs.winning, thresholds.winning),
    trust: verdictFor(inputs.trust, thresholds.trust),
    durability: verdictFor(inputs.durability, thresholds.durability),
  };
}

/**
 * The 0-100 composite, and the count that has to travel with it.
 *
 * Weights are renormalised over the present inputs so that a vendor scored on
 * two of three is not dragged down by the third being unmeasured. The result
 * is a fair reading of what is known, and `inputsPresent` is what stops that
 * from being mistaken for a reading of everything.
 */
export function composite(
  inputs: CompositeInputs,
  weights: Weights = DEFAULT_WEIGHTS
): CompositeResult {
  const present = INPUT_KEYS.filter((k) => inputs[k] !== null);
  const missing = INPUT_KEYS.filter((k) => inputs[k] === null);

  const totalWeight = present.reduce((a, k) => a + weights[k], 0);
  if (present.length === 0 || totalWeight <= 0) {
    return {
      score: null,
      inputsPresent: 0,
      inputsTotal: INPUT_KEYS.length,
      present: [],
      missing: [...INPUT_KEYS],
      applied: {},
    };
  }

  const applied: Partial<Weights> = {};
  let score = 0;
  for (const k of present) {
    const w = weights[k] / totalWeight;
    applied[k] = w;
    score += (inputs[k] as number) * w;
  }

  return {
    score: Math.round(score * 10) / 10,
    inputsPresent: present.length,
    inputsTotal: INPUT_KEYS.length,
    present,
    missing,
    applied,
  };
}

/**
 * The sentence that must appear wherever the composite appears.
 * "74: from 2 of 3 inputs. Financial durability not disclosed."
 */
export function compositeCaveat(result: CompositeResult): string {
  if (result.score === null) {
    return "No score: none of the three inputs is published for this vendor.";
  }
  const base = `from ${result.inputsPresent} of ${result.inputsTotal} inputs`;
  if (result.missing.length === 0) return `${base}. All three published.`;
  const names = result.missing.map((k) => QUESTIONS[k].question.toLowerCase());
  return `${base}. Not published: ${names.join(", ")}`;
}
