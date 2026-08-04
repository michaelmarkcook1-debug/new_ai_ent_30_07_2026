import segmentRevenue from "@/fixtures/sec/segment-revenue.json";
import aiDisclosures from "@/fixtures/sec/ai-revenue-disclosures.json";
import { estimateRevenue } from "./private-revenue";
import { vendorName } from "@/lib/aie/vendor-directory";

// Five rungs, one visual language, and no invented number on any of them.
//
// The page used to have two states: a company either stated an AI revenue
// figure or it showed nothing. That is honest and it left 6 of 9 filers blank
// while the answer to a narrower question was sitting in the same fixture.
//
// A ceiling is a fact. "Alphabet's AI revenue is at most the $58.7B Google
// Cloud segment" is an audited number with a bracket around it, not a guess,
// and it is genuinely useful: it rules out the number being $200B. So BOUNDED
// joins STATED rather than replacing the blank with an estimate.
//
// The rungs, hardest evidence first:
//
//   STATED         the company put a figure in a filing
//   BOUNDED        no figure, but an audited segment caps it
//   DERIVED        computed from named, re-checkable inputs
//   OVERRIDE       the reader's own number, never ours
//   NOT ESTIMABLE  nothing published and nothing inferable
//
// One rule runs through STATED. A company that says "generative AI book of
// business, inception to date" has not stated annual AI revenue, and a company
// reporting "Data Center compute revenue" has not isolated AI either. Each
// entry carries the company's own words for what the figure measures, and the
// UI prints those words rather than relabelling everything "AI revenue". The
// figures are checked against the filing text by test, so a fixture that moves
// breaks the build instead of quietly changing what we attribute to a filer.

export type Rung =
  | "stated"
  | "bounded"
  | "derived"
  | "override"
  | "not_estimable";

export const RUNG_LABEL: Record<Rung, string> = {
  stated: "STATED",
  bounded: "BOUNDED",
  derived: "DERIVED",
  override: "YOUR FIGURE",
  not_estimable: "NOT ESTIMABLE",
};

export const RUNG_MEANS: Record<Rung, string> = {
  stated: "The company stated this figure in a filing.",
  bounded:
    "The company states no AI figure. The audited segment it would sit inside caps it.",
  derived: "Computed from named inputs you can re-check and re-weight.",
  override: "Your own figure. Never ours, and never mixed into our published numbers.",
  not_estimable:
    "Nothing published and nothing inferable. No figure is shown rather than a guess.",
};

export interface StatedFigure {
  /** USD. */
  valueUsd: number;
  /** True when the filing says "over" or "greater than": a floor, not a point. */
  isFloor: boolean;
  /** The company's own words for what this measures. Never normalised. */
  measures: string;
  /** The exact phrase the figure was read from, checked against the fixture. */
  phrase: string;
  form: string | null;
  filedAt: string | null;
  url: string;
}

export interface BoundedFigure {
  ceilingUsd: number;
  segment: string;
  /** Why this segment is the ceiling and not another. */
  because: string;
  form: string | null;
  periodEnd: string | null;
  filingUrl: string | null;
  /** Set when the bound is so wide it barely constrains anything. */
  looseNote?: string;
}

export interface DerivedFigure {
  lowUsd: number;
  highUsd: number;
  basis: string;
}

export interface LadderEntry {
  key: string;
  name: string;
  rung: Rung;
  stated?: StatedFigure;
  bounded?: BoundedFigure;
  derived?: DerivedFigure;
  notEstimable?: string;
}

const B = 1_000_000_000;

// ------------------------------------------------------------------ STATED
//
// Read from fixtures/sec/ai-revenue-disclosures.json. `phrase` is asserted
// against the filing text in tests, so this cannot drift from the source.

const STATED: Record<string, Omit<StatedFigure, "form" | "filedAt" | "url">> = {
  AMZN: {
    valueUsd: 15 * B,
    isFloor: true,
    measures: "AWS AI revenue run rate, Q1 2026",
    phrase: "AWS’s AI revenue run rate is over $15 billion in Q1 2026",
  },
  IBM: {
    valueUsd: 2 * B,
    isFloor: true,
    // Not annual revenue. Cumulative bookings since the business began, which
    // is a different quantity and is labelled as one everywhere it appears.
    measures: "Generative AI book of business, inception to date (bookings, not revenue)",
    phrase: "book of business in generative AI inception to date is greater than $2 billion",
  },
  NVDA: {
    valueUsd: 22.6 * B,
    isFloor: false,
    // NVIDIA does not isolate AI revenue. This is the reported segment line,
    // and calling it "AI revenue" would be our word, not theirs.
    measures: "Data Center compute revenue (NVIDIA states no isolated AI figure)",
    phrase: "Data Center compute revenue was $22.6 billion",
  },
};

// ----------------------------------------------------------------- BOUNDED
//
// The ceiling is the audited segment the company's AI business is reported
// within. Naming the segment is the whole point: the reader can judge whether
// the bracket is tight enough to be worth anything.

const BOUNDED: Record<
  string,
  { segment: string; because: string; looseNote?: string }
> = {
  MSFT: {
    segment: "Intelligent Cloud",
    because: "Azure AI services are reported inside this segment.",
  },
  GOOGL: {
    segment: "Google Cloud",
    because: "Vertex AI and the Gemini API are sold through Google Cloud.",
  },
  ORCL: {
    segment: "Cloud And Software Business",
    because: "OCI, including its AI infrastructure, is reported here.",
  },
  META: {
    segment: "Family Of Apps",
    because:
      "Meta reports no AI product revenue line; its AI work sits inside the apps business.",
    // Stated rather than hidden: this bracket rules out almost nothing, and a
    // bound that wide should be read as "we do not know" rather than as a
    // measurement.
    looseNote:
      "This bound is very wide and rules out little. Meta sells no AI product line, so the segment is close to the whole company.",
  },
};

// ---------------------------------------------------------- NOT ESTIMABLE

const NOT_ESTIMABLE: Record<string, string> = {
  openai:
    "No audited accounts, no disclosed valuation we will use, and no stated revenue. Its widely quoted $110B figure is a compute commitment, not a valuation or a revenue.",
  xai: "No audited accounts, no disclosed round we can cite, and no stated revenue.",
  databricks: "No audited accounts and no revenue figure in any source we hold.",
  together: "No audited accounts and no revenue figure in any source we hold.",
};

interface RawStatement {
  statement: string;
  form?: string | null;
  filedAt?: string | null;
  url: string;
}
interface RawVendor {
  ticker: string;
  name: string;
  statements?: RawStatement[] | null;
}
interface RawSegment {
  segment: string;
  revenueUsd: number;
}
interface RawCompany {
  ticker: string;
  name: string;
  segments?: RawSegment[] | null;
  form?: string | null;
  periodEnd?: string | null;
  filingUrl?: string | null;
}

const DISCLOSURES = (aiDisclosures as { vendors: RawVendor[] }).vendors;
const SEGMENTS = (segmentRevenue as { companies: RawCompany[] }).companies;

/** The filing a stated phrase came from, matched on the phrase itself. */
function sourceFor(ticker: string, phrase: string): RawStatement | null {
  const vendor = DISCLOSURES.find((v) => v.ticker === ticker);
  return (
    (vendor?.statements ?? []).find((s) => s.statement.includes(phrase)) ?? null
  );
}

const NO_FILING_INGESTED =
  "No filing is ingested for this ticker yet, so there is nothing to state or bound. It is in the selector because BoardRadar serves live market figures for it; the accounts pipeline has not reached it. That is our gap, not the filer's.";

/**
 * @param roster every ticker offered in the selector. Tickers with no ingested
 * filing are still listed, because a ticker a reader can pick and then find
 * nothing about reads as a broken page rather than as a known gap.
 */
export function publicLadder(
  roster: { ticker: string; name: string }[] = []
): LadderEntry[] {
  const rows = SEGMENTS.map((company): LadderEntry => {
    const { ticker, name } = company;

    const stated = STATED[ticker];
    if (stated) {
      const src = sourceFor(ticker, stated.phrase);
      return {
        key: ticker,
        name,
        rung: "stated",
        stated: {
          ...stated,
          form: src?.form ?? null,
          filedAt: src?.filedAt ?? null,
          url: src?.url ?? "",
        },
      };
    }

    const bound = BOUNDED[ticker];
    const segments = company.segments ?? [];
    const hit = bound
      ? segments.find((s) => s.segment === bound.segment)
      : undefined;
    if (bound && hit) {
      return {
        key: ticker,
        name,
        rung: "bounded",
        bounded: {
          ceilingUsd: hit.revenueUsd,
          segment: hit.segment,
          because: bound.because,
          looseNote: bound.looseNote,
          form: company.form ?? null,
          periodEnd: company.periodEnd ?? null,
          filingUrl: company.filingUrl ?? null,
        },
      };
    }

    // Salesforce and ServiceNow. Both file segment data; we have not ingested
    // it. That is our gap, and saying "not estimable" would blame the filer
    // for our backlog.
    return {
      key: ticker,
      name,
      rung: "not_estimable",
      notEstimable:
        "Segment revenue is not yet ingested for this filer. It files segment data, so this is a gap in our pipeline rather than in their disclosure, and a bound should be possible once it lands.",
    };
  });

  // Tickers in the selector with no filing ingested at all. They used to
  // render no card, so picking one from the list led to nothing.
  const known = new Set(rows.map((r) => r.key));
  const extra = roster
    .filter((t) => !known.has(t.ticker))
    .map(
      (t): LadderEntry => ({
        key: t.ticker,
        name: t.name,
        rung: "not_estimable",
        notEstimable: NO_FILING_INGESTED,
      })
    );

  return [...rows, ...extra];
}

export function privateLadder(): LadderEntry[] {
  const ids = [
    "anthropic",
    "openai",
    "xai",
    "mistral",
    "cohere",
    "databricks",
    "together",
  ];

  return ids.map((id): LadderEntry => {
    const name = vendorName(id);
    // estimateRevenue already ranks the evidence: a disclosed figure beats a
    // valuation-implied range, and neither is invented when absent.
    const est = estimateRevenue(id, name);

    if (est.basis === "disclosed" && est.disclosed) {
      const d = est.disclosed;
      return {
        key: id,
        name,
        rung: "stated",
        stated: {
          valueUsd: d.revenueUsdM * 1_000_000,
          isFloor: d.isFloor,
          measures: `${d.basis.replace(/_/g, " ")} revenue, reported by ${d.citation.publisher}`,
          phrase: d.citation.quote,
          form: null,
          filedAt: d.citation.asOf,
          url: "",
        },
      };
    }

    if (
      est.basis === "implied_from_valuation" &&
      est.lowUsdM !== null &&
      est.highUsdM !== null &&
      est.valuation
    ) {
      return {
        key: id,
        name,
        rung: "derived",
        derived: {
          lowUsd: est.lowUsdM * 1_000_000,
          highUsd: est.highUsdM * 1_000_000,
          basis: `A ${est.valuation.state === "closed" ? "closed" : "reported"} valuation of $${(est.valuation.valuationUsdM / 1000).toFixed(1)}B divided by the observed revenue-multiple band. Move the band to move the range.`,
        },
      };
    }

    return {
      key: id,
      name,
      rung: "not_estimable",
      notEstimable:
        est.absence ?? NOT_ESTIMABLE[id] ?? "Nothing published and nothing inferable.",
    };
  });
}

/** How many filers now carry a figure or a hard bound, and out of how many. */
export function publicCoverage(roster: { ticker: string; name: string }[] = []): {
  withFigure: number;
  /** Filers whose accounts we have ingested. */
  ingested: number;
  /** Every ticker in the selector, including those with no filing yet. */
  listed: number;
} {
  const rows = publicLadder(roster);
  return {
    withFigure: rows.filter(
      (r) => r.rung === "stated" || r.rung === "bounded"
    ).length,
    ingested: SEGMENTS.length,
    listed: rows.length,
  };
}
