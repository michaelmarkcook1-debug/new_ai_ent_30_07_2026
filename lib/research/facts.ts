// A figure a source stated, kept as a fact rather than as a sentence.
//
// WHY THIS EXISTS. `CompanyMetric.value` was a string: "£13.65bn" arrived as
// eleven characters and nothing downstream could ask what currency it was in,
// what period it covered, or whether it agreed with the "$17.2bn" a second
// source gave for the same year. Every question this module answers was
// unanswerable by construction, so the product could not tell a genuine
// contradiction from two sources reporting the same truth in two currencies,
// and it could not tell a restatement from a different fiscal year.
//
// THE RULE THAT GOVERNS EVERY FUNCTION HERE. The reported figure is never
// overwritten. A converted value is a SEPARATE derived value carrying its rate,
// its rate date and where the rate came from, so a reader is always looking at
// what the source said and can see what we did to compare it. Converting in
// place would make the product the author of a number it did not observe, which
// is the one thing this codebase does not do.
//
// AND DIFFERENT IS NOT CONTRADICTORY. £10bn and $13.5bn for FY2025 are the same
// company reported twice. £10bn FY2024 and £10bn FY2025 are two facts that
// happen to share a number. Neither is a conflict, and calling either one an
// accuracy problem trains a reader to ignore the ones that are.

/** How much weight a source's own nature earns it, before anything it says. */
export type EvidenceType =
  | "regulatory_filing"
  | "annual_report"
  | "company_announcement"
  | "public_dataset"
  | "primary_reporting"
  | "secondary_reporting"
  | "aggregator";

/**
 * The source hierarchy, most authoritative first.
 *
 * NOT A TRUTH RANKING ON ITS OWN. A filing outranks a news article about the
 * filing, and neither outranks the other when they answer different questions:
 * a 10-K's group revenue does not beat a trade report's segment figure, because
 * they are not the same claim. Rank decides which of two COMPARABLE facts wins,
 * and comparability is decided first and separately.
 */
export const EVIDENCE_RANK: Readonly<Record<EvidenceType, number>> = {
  regulatory_filing: 7,
  annual_report: 6,
  company_announcement: 5,
  public_dataset: 4,
  primary_reporting: 3,
  secondary_reporting: 2,
  aggregator: 1,
};

/** Scale, kept separate from the number so millions and billions can meet. */
export type MoneyUnit = "unit" | "thousand" | "million" | "billion" | "trillion";

const UNIT_FACTOR: Readonly<Record<MoneyUnit, number>> = {
  unit: 1,
  thousand: 1e3,
  million: 1e6,
  billion: 1e9,
  trillion: 1e12,
};

/**
 * What the figure covers in time.
 *
 * `kind` matters as much as the year. A fiscal year is not the calendar year of
 * the same number, and a quarter is not the year that contains it, so two facts
 * only compare when both agree.
 */
export interface FactPeriod {
  kind: "fiscal_year" | "calendar_year" | "quarter" | "half" | "point_in_time" | "unknown";
  year: number | null;
  /** 1 to 4 for a quarter, 1 or 2 for a half. Null otherwise. */
  index?: number | null;
  /** As written by the source, so the card can show what it said. */
  label: string;
}

/**
 * What the figure is measured over.
 *
 * Group revenue and segment revenue are different facts about the same company
 * and must never be compared as though one contradicted the other.
 */
export type FactScope = "group" | "segment" | "region" | "product_line" | "unknown";

/** Reported or adjusted. An adjusted figure is not a restatement of a reported one. */
export type FactBasis = "reported" | "adjusted" | "unknown";

/** A conversion, carried beside the original and never in place of it. */
export interface Conversion {
  value: number;
  currency: string;
  rate: number;
  /** The date the rate is for. Null where no defensible date exists. */
  rateDate: string | null;
  rateSource: string;
}

export interface CompanyFact {
  /** Normalised metric name: "revenue", "employees", "market_cap". */
  metric: string;
  /** Exactly as the source gave it. Never rewritten. */
  value: number;
  unit: MoneyUnit;
  /** ISO code for money. Null for counts such as employees. */
  currency: string | null;
  period: FactPeriod;
  scope: FactScope;
  basis: FactBasis;
  /** Index into the research sources, so the claim opens its own page. */
  sourceIndex: number;
  evidenceType: EvidenceType;
  /** The figure as the source wrote it, for display. */
  asStated: string;
  /**
   * Only ever set by a comparison that needed it, never by ingestion.
   * The reported value above stays untouched.
   */
  converted?: Conversion;
}

/** The absolute value in base units, for comparing across scales. */
export function magnitude(f: CompanyFact): number {
  return f.value * UNIT_FACTOR[f.unit];
}

// ------------------------------------------------------------------ parsing

const CURRENCY_SYMBOL: Record<string, string> = {
  "£": "GBP",
  "$": "USD",
  "€": "EUR",
  "¥": "JPY",
  "₹": "INR",
};

const UNIT_WORD: Record<string, MoneyUnit> = {
  k: "thousand",
  thousand: "thousand",
  m: "million",
  mn: "million",
  million: "million",
  millions: "million",
  bn: "billion",
  b: "billion",
  billion: "billion",
  billions: "billion",
  tn: "trillion",
  trillion: "trillion",
};

/**
 * A stated figure, read into its parts.
 *
 * Deliberately conservative: anything it cannot read confidently comes back
 * null and the caller keeps the string. A half-parsed figure is worse than an
 * unparsed one, because the half that parsed will be compared.
 */
export function parseStatedValue(
  raw: string
): { value: number; unit: MoneyUnit; currency: string | null } | null {
  const s = raw.trim();
  if (!s) return null;

  // Currency, from a symbol or a trailing/leading code.
  let currency: string | null = null;
  for (const [sym, code] of Object.entries(CURRENCY_SYMBOL)) {
    if (s.includes(sym)) currency = code;
  }
  const code = s.match(/\b(GBP|USD|EUR|JPY|CHF|CAD|AUD|INR|SEK|NOK|DKK)\b/i);
  if (code) currency = code[1].toUpperCase();

  // The number. Rejects a range outright rather than taking one end of it.
  //
  // The scale word and the second currency symbol sit between the two numbers
  // ("£10bn to £12bn"), so a digit-to-digit pattern misses it and the parser
  // silently keeps 10. That would make this product the author of a precision
  // the source never gave. Fiscal spans ("2024-25") are stripped first because
  // they are one period rather than two figures.
  const withoutSpans = s.replace(/\b(19|20)\d{2}\s*[-–—/]\s*\d{2,4}\b/g, " ");
  if (/\d[\d.,]*\s*[a-z]{0,8}\s*(?:to|through|-|–|—)\s*[£$€¥₹]?\s*\d/i.test(withoutSpans)) {
    return null;
  }
  const num = s.match(/-?\d[\d,]*(?:\.\d+)?/);
  if (!num) return null;
  const value = Number(num[0].replace(/,/g, ""));
  if (!Number.isFinite(value)) return null;

  // Scale word, taken from what follows the number.
  const after = s.slice((num.index ?? 0) + num[0].length).trim().toLowerCase();
  const word = after.match(/^([a-z]+)/)?.[1] ?? "";
  const unit = UNIT_WORD[word] ?? "unit";

  return { value, unit, currency };
}

/** A period as a source writes it, read into its parts. */
export function parsePeriod(raw: string | null | undefined): FactPeriod {
  const s = (raw ?? "").trim();
  if (!s) return { kind: "unknown", year: null, label: "" };

  const q = s.match(/\bQ([1-4])\s*(?:FY)?\s*(\d{4})\b/i);
  if (q) {
    return { kind: "quarter", year: Number(q[2]), index: Number(q[1]), label: s };
  }
  const h = s.match(/\bH([12])\s*(?:FY)?\s*(\d{4})\b/i);
  if (h) return { kind: "half", year: Number(h[2]), index: Number(h[1]), label: s };

  // "FY2025", "FY 2025", "fiscal 2025" and "fiscal year 2025" are one thing.
  // Observed on a live Salesforce run: "fiscal 2025" fell through to the bare
  // year branch and was compared against a calendar-year figure as though the
  // two covered the same twelve months.
  const fy = s.match(/\b(?:FY|fiscal(?:\s+year)?)\s*(?:ending\s+[^,]*,?\s*)?(\d{4})\b/i);
  if (fy) return { kind: "fiscal_year", year: Number(fy[1]), index: null, label: s };

  const cy = s.match(/\b(?:CY|calendar\s+year)\s*(\d{4})\b/i);
  if (cy) return { kind: "calendar_year", year: Number(cy[1]), index: null, label: s };

  const bare = s.match(/\b(19|20)\d{2}\b/);
  if (bare) {
    // A bare year is not knowably fiscal or calendar. Saying which would be
    // inventing the half of the fact that decides whether two figures compare.
    return { kind: "unknown", year: Number(bare[0]), index: null, label: s };
  }
  return { kind: "unknown", year: null, index: null, label: s };
}

// ------------------------------------------------------------ comparability

/**
 * Why two facts cannot be compared, and whether that is knowledge or ignorance.
 *
 * THE DISTINCTION THIS DRAWS, and it took a live case to see it. Group revenue
 * against segment revenue is KNOWN to be two different measures, so it is not a
 * disagreement and never could be. Group revenue against a figure whose scope
 * nobody stated is UNKNOWN: it might be the same claim disagreeing, or a
 * different one entirely, and the product cannot tell which.
 *
 * Collapsing those two into "not comparable" made the second come out as
 * "not a disagreement", which is an assertion the evidence does not support.
 * Worse, it let any figure escape scrutiny by omitting its scope: the Boots
 * run had a filing's group sales against two aggregator estimates that stated
 * no scope, and three revenue figures spanning threefold were reported as
 * compatible. Ignorance now reads as ignorance.
 */
export type Comparability =
  | { kind: "comparable" }
  /** Known to be different measures. Not a disagreement, and cannot become one. */
  | { kind: "different"; why: string }
  /** Cannot be established either way, so no verdict may rest on it. */
  | { kind: "unknown"; why: string };

export function comparability(a: CompanyFact, b: CompanyFact): Comparability {
  if (a.metric !== b.metric) {
    return { kind: "different", why: "they measure different things" };
  }

  // Scope. Unknown on either side is ignorance, not difference.
  if (a.scope === "unknown" || b.scope === "unknown") {
    if (a.scope !== b.scope) {
      return {
        kind: "unknown",
        why: `one is stated as ${a.scope === "unknown" ? b.scope : a.scope} and the other does not say what it covers, so whether they describe the same thing cannot be established`,
      };
    }
  } else if (a.scope !== b.scope) {
    return {
      kind: "different",
      why: `one is ${a.scope} and the other is ${b.scope}, which are different figures rather than disagreeing ones`,
    };
  }

  // Basis. Only a KNOWN difference blocks: reported and adjusted are genuinely
  // different measures, because adjusted strips exceptionals the reported
  // figure includes.
  //
  // An unknown basis must not block, and getting this wrong kept the Boots case
  // unresolved. An aggregator's estimate OF revenue is a claim about the same
  // quantity the filing reports; it is trying to be that number. Treating the
  // missing label as incomparability meant a filing could never supersede an
  // estimate, so the product said "cannot tell" even with the audited figure in
  // front of it. Source rank is what that case needs, and rank only gets to act
  // once the two are allowed to meet.
  if (a.basis !== b.basis && a.basis !== "unknown" && b.basis !== "unknown") {
    return { kind: "different", why: `one is ${a.basis} and the other is ${b.basis}` };
  }

  // Period. Same rule: a stated year against no year is not a known difference.
  // A period is unknown when its KIND is, whether or not a year came with it.
  // A bare "2025" does not say whether it means the calendar year or a fiscal
  // one, and those are different twelve-month windows. Requiring the year to be
  // missing too was the same mistake as the scope rule above and it surfaced
  // the same way: a live Salesforce run reported "2025" against "fiscal 2025"
  // as "not a disagreement: they cover different periods", which asserts they
  // are different windows when the truth is that nobody said.
  const aUnknown = a.period.kind === "unknown";
  const bUnknown = b.period.kind === "unknown";
  if (aUnknown !== bUnknown) {
    return {
      kind: "unknown",
      // The unknown side often carries no label at all, which read as "does
      // not say whether is a fiscal or a calendar year".
      why: (() => {
        const known = (aUnknown ? b : a).period.label || "a stated period";
        const other = (aUnknown ? a : b).period.label;
        return other
          ? `one covers ${known} and the other does not say whether ${other} is a fiscal or a calendar year, so they cannot be lined up`
          : `one covers ${known} and the other states no period at all, so they cannot be lined up`;
      })(),
    };
  }
  if (aUnknown && bUnknown) {
    // Two bare years. Comparable when they name the same year, different when
    // they do not: neither is knowably fiscal, so at least they are alike.
    if (a.period.year !== b.period.year) {
      return {
        kind: "different",
        why: `they cover different periods, ${a.period.label || "unstated"} and ${b.period.label || "unstated"}`,
      };
    }
  } else if (a.period.kind !== b.period.kind || a.period.year !== b.period.year) {
    return {
      kind: "different",
      why: `they cover different periods, ${a.period.label || "unstated"} and ${b.period.label || "unstated"}`,
    };
  } else if ((a.period.index ?? null) !== (b.period.index ?? null)) {
    return { kind: "different", why: "they cover different parts of the same year" };
  }

  return { kind: "comparable" };
}

/**
 * Why two facts cannot be compared, or null when they can.
 *
 * Kept as the narrower question some callers actually want. It answers "is
 * there a reason these do not line up", without distinguishing a known
 * difference from an unknown one; `comparability()` is what reconciliation
 * uses, because the difference between those two decides the verdict.
 */
export function incomparableBecause(a: CompanyFact, b: CompanyFact): string | null {
  const c = comparability(a, b);
  return c.kind === "comparable" ? null : c.why;
}

// ------------------------------------------------------------------- money

/**
 * FX rates, held explicitly with the date they are for.
 *
 * A SMALL FIXED TABLE, AND THAT IS THE POINT. This product does not hold a rate
 * feed, and inventing a precise historical rate to make two figures agree would
 * be manufacturing the evidence that settles the comparison. So the table is
 * declared, dated, and where a pair is absent the comparison returns UNKNOWN
 * rather than reaching for a plausible number.
 */
export interface FxTable {
  date: string;
  source: string;
  /** Units of the quote currency per one unit of the base. */
  rates: Record<string, number>;
}

export const FX: FxTable = {
  date: "2026-08-01",
  source: "AIE reference rates, monthly",
  rates: {
    "GBP:USD": 1.35,
    "USD:GBP": 0.741,
    "EUR:USD": 1.16,
    "USD:EUR": 0.862,
    "GBP:EUR": 1.164,
    "EUR:GBP": 0.859,
  },
};

/** The rate, or null where the table does not hold the pair. */
export function fxRate(from: string, to: string, table: FxTable = FX): number | null {
  if (from === to) return 1;
  return table.rates[`${from}:${to}`] ?? null;
}

/**
 * The same fact expressed in another currency, as a derived value.
 *
 * Returns a new fact carrying `converted`; the reported value, unit and
 * currency on it are untouched.
 */
export function convertedTo(
  f: CompanyFact,
  currency: string,
  table: FxTable = FX
): CompanyFact | null {
  if (!f.currency) return null;
  const rate = fxRate(f.currency, currency, table);
  if (rate === null) return null;
  return {
    ...f,
    converted: {
      value: f.value * rate,
      currency,
      rate,
      rateDate: table.date,
      rateSource: table.source,
    },
  };
}

// --------------------------------------------------------- reconciliation

export type Verdict =
  /** Same figure, same period, from a source that settles it. */
  | "CONFIRMED"
  /** Independent sources agreeing within tolerance. */
  | "CORROBORATED"
  /** Different presentations of the same underlying figure, e.g. two currencies. */
  | "COMPATIBLE"
  /** Same claim, later or more authoritative source replaces the earlier. */
  | "SUPERSEDED"
  /** Genuinely disagreeing, and left disagreeing. */
  | "CONFLICTING"
  /** Not enough to say. Never resolved by preference. */
  | "INSUFFICIENT";

export interface Reconciliation {
  verdict: Verdict;
  /** The fact to use downstream. Null where the evidence cannot support one. */
  chosen: CompanyFact | null;
  /** Said in the reader's language, never a rule id. */
  why: string;
  /** Everything considered, so an unresolved conflict stays visible. */
  facts: CompanyFact[];
}

/** How far apart two figures may be and still be the same figure. */
const TOLERANCE = 0.02;

/**
 * Two comparable facts, judged.
 *
 * The order of the checks is the whole design. Comparability first, because two
 * facts that answer different questions can never conflict. Then currency,
 * because a difference that disappears on conversion was never a disagreement.
 * Only then magnitude, and only then does source rank decide anything.
 */
function judgePair(a: CompanyFact, b: CompanyFact, table: FxTable): Reconciliation {
  const facts = [a, b];
  const c = comparability(a, b);

  // Known to be different measures. Not a disagreement, and the stronger source
  // is still the one to carry forward.
  if (c.kind === "different") {
    return {
      verdict: "COMPATIBLE",
      chosen: EVIDENCE_RANK[a.evidenceType] >= EVIDENCE_RANK[b.evidenceType] ? a : b,
      why: `Not a disagreement: ${c.why}.`,
      facts,
    };
  }

  // Cannot be established either way. This must NOT come out as "compatible":
  // that asserts agreement the evidence does not support, and it is how three
  // revenue figures spanning threefold were reported as reconciled. Where the
  // figures are also far apart, say so, because a reader looking at both needs
  // to know the product has not settled it.
  if (c.kind === "unknown") {
    const far =
      a.currency === b.currency &&
      Math.abs(magnitude(a) - magnitude(b)) /
        Math.max(Math.abs(magnitude(a)), Math.abs(magnitude(b)), 1) >
        TOLERANCE;
    return {
      verdict: "INSUFFICIENT",
      chosen: null,
      why: far
        ? `${a.asStated} and ${b.asStated} are far apart and ${c.why}. Neither is used.`
        : `${c.why}. Neither is used.`,
      facts,
    };
  }

  // Same metric, period, scope and basis. Now make them numerically comparable.
  const av = magnitude(a);
  let bv = magnitude(b);
  let note = "";
  if (a.currency && b.currency && a.currency !== b.currency) {
    const rate = fxRate(b.currency, a.currency, table);
    if (rate === null) {
      return {
        verdict: "INSUFFICIENT",
        chosen: null,
        why: `Reported in ${a.currency} and ${b.currency}, and no rate is held for that pair, so whether they agree cannot be established without inventing one.`,
        facts,
      };
    }
    bv = bv * rate;
    note = ` after converting ${b.currency} to ${a.currency} at ${rate} on ${table.date}`;
  } else if (!a.currency !== !b.currency) {
    return {
      verdict: "INSUFFICIENT",
      chosen: null,
      why: "One figure states a currency and the other does not, so they cannot be compared without assuming one.",
      facts,
    };
  }

  const spread = Math.abs(av - bv) / Math.max(Math.abs(av), Math.abs(bv), 1);
  if (spread <= TOLERANCE) {
    const differentCurrency = a.currency !== b.currency;
    const rankA = EVIDENCE_RANK[a.evidenceType];
    const rankB = EVIDENCE_RANK[b.evidenceType];
    const chosen = rankA >= rankB ? a : b;
    return {
      verdict: differentCurrency ? "COMPATIBLE" : "CORROBORATED",
      chosen,
      why: differentCurrency
        ? `The same figure reported in two currencies${note}, so these agree.`
        : `Two sources give the same figure for ${a.period.label || "the same period"}, within rounding.`,
      facts,
    };
  }

  // They genuinely differ. Rank decides only whether one SUPERSEDES the other,
  // and only where the gap in authority is real.
  const rankA = EVIDENCE_RANK[a.evidenceType];
  const rankB = EVIDENCE_RANK[b.evidenceType];
  if (Math.abs(rankA - rankB) >= 2) {
    const stronger = rankA > rankB ? a : b;
    const weaker = rankA > rankB ? b : a;
    return {
      verdict: "SUPERSEDED",
      chosen: stronger,
      why: `${stronger.asStated} comes from a ${stronger.evidenceType.replace(/_/g, " ")} and ${weaker.asStated} from a ${weaker.evidenceType.replace(/_/g, " ")}, so the first is taken and the second is kept visible.`,
      facts,
    };
  }

  return {
    verdict: "CONFLICTING",
    chosen: null,
    why: `${a.asStated} and ${b.asStated} describe the same measure over the same period${note} and do not agree. Both are kept and neither is used.`,
    facts,
  };
}

/**
 * Every candidate for one metric, reconciled.
 *
 * Returns INSUFFICIENT with no chosen fact rather than picking a winner the
 * evidence cannot support. A genuine unresolved conflict stays unresolved and
 * stays visible, which is the behaviour the opportunity engine depends on: it
 * must not lean on a figure the product could not settle.
 */
export function reconcile(
  candidates: CompanyFact[],
  table: FxTable = FX
): Reconciliation {
  if (candidates.length === 0) {
    return { verdict: "INSUFFICIENT", chosen: null, why: "No source states this.", facts: [] };
  }
  if (candidates.length === 1) {
    const only = candidates[0];
    const settles = EVIDENCE_RANK[only.evidenceType] >= EVIDENCE_RANK.annual_report;
    return {
      verdict: settles ? "CONFIRMED" : "INSUFFICIENT",
      chosen: settles ? only : null,
      why: settles
        ? `Stated in a ${only.evidenceType.replace(/_/g, " ")}, which settles it.`
        : `Only one source states this, and it is ${only.evidenceType.replace(/_/g, " ")} rather than a filing, so it is reported rather than relied on.`,
      facts: candidates,
    };
  }

  // Fold pairwise, keeping the worst verdict seen: one genuine conflict in a
  // set is a conflicted set, however many others agree.
  const ORDER: Verdict[] = [
    "CONFIRMED",
    "CORROBORATED",
    "COMPATIBLE",
    "SUPERSEDED",
    "INSUFFICIENT",
    "CONFLICTING",
  ];
  let worst = judgePair(candidates[0], candidates[1], table);
  for (let i = 2; i < candidates.length; i++) {
    const next = judgePair(worst.chosen ?? candidates[0], candidates[i], table);
    if (ORDER.indexOf(next.verdict) > ORDER.indexOf(worst.verdict)) worst = next;
  }
  return { ...worst, facts: candidates };
}

/**
 * Whether a reconciled fact is solid enough to build a recommendation on.
 *
 * The opportunity engine asks this rather than reading `chosen` directly, so a
 * conflicted or insufficient figure cannot quietly become the basis of advice.
 */
export function usableForRecommendation(r: Reconciliation): boolean {
  return (
    r.chosen !== null &&
    (r.verdict === "CONFIRMED" ||
      r.verdict === "CORROBORATED" ||
      r.verdict === "COMPATIBLE" ||
      r.verdict === "SUPERSEDED")
  );
}
