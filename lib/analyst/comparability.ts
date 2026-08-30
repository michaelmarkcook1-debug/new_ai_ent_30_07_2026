import type { ArgumentUnit } from "./question";

// Whether the comparison an authored reading made is one this page may make.
//
// THE FAILURE THIS CATCHES, quoted from live Vendor View on 30 August 2026:
//
//   "SAP at 2.82 in workflow automation AI sits 0.8 clear of Salesforce ...
//    Databricks and Google in cloud AI platform sit 0.05 apart ... Meanwhile
//    AMD, Groq, Lambda and one other rank in the top third of a category while
//    carrying an open high-severity risk."
//
// Every figure is correct and every sentence is defensible on its own. The
// paragraph is still wrong: it puts three categories and a risk register into
// one argument without ever saying what makes them one argument. The reader is
// left to assume a connection the product never established.
//
// WHY THIS IS NOT AN NLP PARSER, WHICH THE BRIEF RULES OUT AND WHICH WOULD NOT
// WORK ANYWAY. Nothing here reads English. The deterministic layer already
// knows which category every entity was scored in, because it is the thing that
// scored them. So the check is a set operation: find the entities the authored
// text names, look up the category each was supplied under, and count how many
// distinct categories the paragraph reached into.
//
// WHAT MAKES IT LEGITIMATE RATHER THAN A LIMIT. On a page whose unit is the
// MARKET, naming vendors from several categories is exactly how you show a
// pattern holds in more than one place, and forbidding it would forbid the
// analysis this tranche exists to produce. What that page must do first is
// state the market-level finding the categories are evidence FOR. So the rule
// is not "never cross categories", it is "cross them only underneath a finding
// that is about the market", and `unit` is what says which page is which.

/** One fact as it was supplied to the authoring step. */
export interface ComparableFact {
  /** The entity the fact is about, as the prompt named it. */
  subject: string;
  /** The category it was scored in. Null where the fact is not category-scoped. */
  category: string | null;
  /** The set the figure is drawn from, so unlike populations cannot be merged. */
  population: string;
  /** What was measured. Two different metrics are not one comparison. */
  metric: string;
  /** A point reading or a change. */
  period: "point" | "change";
}

export interface ComparabilityBreach {
  kind: "cross-category" | "cross-population" | "cross-metric";
  /** Said the way the retry prompt will quote it back. */
  detail: string;
}

/**
 * Whether a name appears in the text as a word.
 *
 * Vendor names carry regex metacharacters ("Cohere (incl. Aleph Alpha)"), so
 * the needle is matched literally and the boundaries are checked by hand. A
 * word boundary does not fire next to a bracket or a full stop, which is
 * exactly where these names end.
 */
function names(text: string, subject: string): boolean {
  const i = text.toLowerCase().indexOf(subject.toLowerCase());
  if (i === -1) return false;
  const before = i === 0 ? " " : text[i - 1];
  const after = text[i + subject.length] ?? " ";
  return !/[a-z0-9]/i.test(before) && !/[a-z0-9]/i.test(after);
}

/**
 * The breaches an authored reading committed against the facts it was given.
 *
 * Returns an empty list where the comparison is legitimate, which includes
 * every market-level page that stated a market-level finding, and every case
 * where only one category was reached into at all.
 *
 * A SYNTHESIS RELATIONSHIP IS THE APPROVED WAY ACROSS. `marketLevelFinding` is
 * true when the deterministic layer supplied a finding about the market as a
 * whole. That is the brief's option B: establish the common dimension first,
 * and the categories become examples of it. Without one, several categories in
 * one paragraph are several arguments wearing one paragraph.
 */
export function comparabilityBreaches(
  text: string,
  facts: readonly ComparableFact[],
  opts: { unit: ArgumentUnit; marketLevelFinding: boolean }
): ComparabilityBreach[] {
  const mentioned = facts.filter((f) => names(text, f.subject));
  if (mentioned.length < 2) return [];

  const out: ComparabilityBreach[] = [];

  const categories = [
    ...new Set(mentioned.map((f) => f.category).filter((c): c is string => Boolean(c))),
  ];
  // On a category page two categories in one argument is the failure outright.
  // On a market page it is a failure only when nothing established the market
  // finding they are supposed to be evidence for.
  if (categories.length > 1 && !(opts.unit === "market" && opts.marketLevelFinding)) {
    out.push({
      kind: "cross-category",
      detail:
        opts.unit === "market"
          ? `it moves between ${categories.join(" and ")} without first stating the market-level finding they are evidence for`
          : `it compares ${categories.join(" and ")}, which are different categories, on a page whose argument is about one`,
    });
  }

  const populations = [...new Set(mentioned.map((f) => f.population))];
  if (populations.length > 1) {
    out.push({
      kind: "cross-population",
      detail: `it puts ${populations.join(" and ")} into one comparison, and those are different sets`,
    });
  }

  // Two metrics is a breach only where categories were crossed as well. The
  // deterministic layer cannot read the sentence, so it applies the narrower
  // rule it can defend: a capability score set beside a risk count, across
  // categories, is two scales presented as one, and that has to be said rather
  // than implied by adjacency.
  const metrics = [...new Set(mentioned.map((f) => f.metric))];
  if (metrics.length > 1 && categories.length > 1) {
    out.push({
      kind: "cross-metric",
      detail: `it mixes ${metrics.join(" and ")} across categories, so the figures are not on one scale`,
    });
  }

  return out;
}
