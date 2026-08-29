import {
  parseStatedValue,
  parsePeriod,
  reconcile,
  usableForRecommendation,
  type CompanyFact,
  type EvidenceType,
  type FactBasis,
  type FactScope,
  type Reconciliation,
} from "./facts";
import type { SearchHit } from "./search";

// Turning what the model reported into facts the product can reason over.
//
// THE RULE HERE. Model JSON parsing is not the same as model JSON being true.
// The research call now returns a period, a scope and a reported-or-estimated
// status alongside each figure, and every one of those is a field a model can
// fill in plausibly when the passage did not say. So nothing is taken on trust:
// a value that cannot be read becomes no fact at all, and a period, scope or
// basis that cannot be classified becomes `unknown` rather than a guess.
//
// UNKNOWN IS LOAD-BEARING, not a gap. `incomparableBecause()` refuses to
// compare two facts whose periods differ, and an unknown period differs from
// every stated one, so a figure the model could not date cannot be used to
// contradict a dated one. Coercing unknown to "probably this year" would
// manufacture exactly the comparison the missing evidence forbids.

/** What the source's own nature earns it, before anything it says. */
const HOST_AUTHORITY: { test: RegExp; type: EvidenceType }[] = [
  { test: /sec\.gov|companieshouse\.gov\.uk|\.gov(\.[a-z]{2})?$|edgar/i, type: "regulatory_filing" },
  { test: /annualreport|investor|\/ir\/|results|-plc\.com/i, type: "annual_report" },
  { test: /newsroom|press-release|\/press\/|media-cent/i, type: "company_announcement" },
  { test: /ons\.gov|worldbank|oecd|eurostat|statista/i, type: "public_dataset" },
  { test: /owler|rocketreach|zoominfo|crunchbase|pitchbook|craft\.co|leadiq|growjo/i, type: "aggregator" },
  { test: /reuters|bloomberg|ft\.com|wsj|financial-?times|cnbc|bbc\./i, type: "primary_reporting" },
];

/**
 * How much weight a retrieved page's origin earns.
 *
 * A CRUDE CLASSIFIER, AND SAID SO. It reads the host, which is a decent proxy
 * for what kind of source something is and a poor one for whether this
 * particular page is authoritative. It exists to separate a company profile
 * site's estimate from a filing, which is the distinction that was doing damage
 * on the live Boots run, and it is not trying to do more than that. Anything it
 * cannot place falls to secondary reporting, which is mid-table and therefore
 * neither promotes nor demotes on a guess.
 */
export function evidenceTypeFor(url: string | undefined): EvidenceType {
  if (!url) return "secondary_reporting";
  for (const { test, type } of HOST_AUTHORITY) if (test.test(url)) return type;
  return "secondary_reporting";
}

const SCOPES: FactScope[] = ["group", "segment", "region", "product_line"];

/** Only a value the model actually classified. Anything else is unknown. */
function readScope(raw: string | undefined): FactScope {
  const v = (raw ?? "").trim().toLowerCase().replace(/[\s-]/g, "_");
  return (SCOPES as string[]).includes(v) ? (v as FactScope) : "unknown";
}

/**
 * Reported, adjusted or unknown.
 *
 * "estimated" from the prompt maps to `unknown` rather than to `reported`,
 * deliberately. An estimate is not a reported figure and calling it one would
 * let an aggregator's model outrank nothing and be compared as though the
 * company had published it. It is carried as a fact, labelled, and its
 * aggregator source rank does the rest.
 */
function readBasis(raw: string | undefined): FactBasis {
  const v = (raw ?? "").trim().toLowerCase();
  if (v === "reported") return "reported";
  if (v === "adjusted") return "adjusted";
  return "unknown";
}

/**
 * A metric name the product can group on.
 *
 * Falls back to the display label lower-cased, so an unclassified figure still
 * groups with others of the same label rather than becoming its own singleton
 * and silently escaping reconciliation.
 */
function readMetric(raw: string | undefined, label: string): string {
  const v = (raw ?? "").trim().toLowerCase().replace(/[\s-]+/g, "_");
  if (/^[a-z][a-z0-9_]{1,40}$/.test(v)) return v;
  return label.trim().toLowerCase().replace(/[\s-]+/g, "_").replace(/[^a-z0-9_]/g, "");
}

export interface RawMetric {
  label: string;
  value: string;
  sourceIndex: number;
  metric?: string;
  period?: string;
  scope?: string;
  basis?: string;
}

/**
 * Structured facts, from what the model reported and what we retrieved.
 *
 * Returns only the figures that could be read. A value the parser refuses (a
 * range, a phrase, something with no number in it) produces no fact, and the
 * card still renders from the original string: the display never depended on
 * this succeeding, so a figure that cannot be reconciled is still shown as the
 * source wrote it and is simply not reasoned over.
 */
export function factsFrom(
  metrics: readonly RawMetric[],
  sources: readonly SearchHit[]
): CompanyFact[] {
  const out: CompanyFact[] = [];
  for (const m of metrics) {
    const parsed = parseStatedValue(m.value);
    if (!parsed) continue;
    out.push({
      metric: readMetric(m.metric, m.label),
      value: parsed.value,
      unit: parsed.unit,
      currency: parsed.currency,
      period: parsePeriod(m.period),
      scope: readScope(m.scope),
      basis: readBasis(m.basis),
      sourceIndex: m.sourceIndex,
      evidenceType: evidenceTypeFor(sources[m.sourceIndex]?.url),
      asStated: m.value.trim(),
    });
  }
  return out;
}

/** One metric's candidates and what the product concluded about them. */
export interface ReconciledMetric {
  metric: string;
  reconciliation: Reconciliation;
  /** True where downstream intelligence may lean on it. */
  usable: boolean;
}

/**
 * Every metric with more than one candidate, reconciled.
 *
 * Grouped by the normalised metric name, so "Group sales" and "Est. revenue"
 * meet as two candidates for `revenue` rather than sitting on the page as two
 * unrelated cards that happen to disagree.
 */
export function reconcileFacts(facts: readonly CompanyFact[]): ReconciledMetric[] {
  const byMetric = new Map<string, CompanyFact[]>();
  for (const f of facts) {
    const held = byMetric.get(f.metric) ?? [];
    held.push(f);
    byMetric.set(f.metric, held);
  }
  return [...byMetric.entries()]
    .map(([metric, candidates]) => {
      const reconciliation = reconcile(candidates);
      return {
        metric,
        reconciliation,
        usable: usableForRecommendation(reconciliation),
      };
    })
    .sort((a, b) => a.metric.localeCompare(b.metric));
}

/**
 * How a reconciled metric should be described on screen.
 *
 * Written here rather than in the component so the wording cannot drift from
 * the verdict that produced it, and so a reader is never shown a figure the
 * product has quietly stopped believing.
 */
export function verdictNote(r: ReconciledMetric): string | null {
  const { verdict, why, facts } = r.reconciliation;
  if (facts.length < 2) {
    // A lone aggregator figure is worth saying something about even with
    // nothing to compare it against.
    return verdict === "INSUFFICIENT" ? why : null;
  }
  return why;
}
