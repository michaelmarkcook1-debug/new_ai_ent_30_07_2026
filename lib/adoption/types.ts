// First-party adoption data: types.
//
// This is our own data layer, not a proxy. Until 4 August 2026 every adoption
// figure on this product came from the ranking engine's /api/uptake, which
// serves a static May 2026 model that its own provenance string calls a
// "MODELLED ESTIMATE". Wiring harder to that endpoint could never make the
// data fresher, because there is nothing fresher behind it.
//
// So this layer measures something else, and says plainly what it measures.
//
// DISCLOSED ADOPTION is not market share. It is the count of SEC registrants
// that name a given AI vendor in a given filing type. A company naming
// Anthropic in its 10-K might be a customer, a competitor, an investor or a
// partner, and the filing does not say which. What the count does establish,
// with a citation to a real document, is that the vendor is material enough to
// appear in an annual report — which is a fact, dated, auditable, and nobody's
// model.
//
// The rule this layer exists to honour: prefer a narrow measured fact with a
// link over a broad modelled estimate without one.

/** The connector's own view of whether it can run. Nothing fakes "ok". */
export type ConnectorStatus =
  | "ok"
  | "not_configured"
  | "rate_limited"
  | "error";

/**
 * How much weight a source carries, using the same vocabulary as the role
 * library's evidence classes so one idea is not named twice in one product.
 *
 *   A  Regulatory/statutory   a filing, a statute, a mandatory standard
 *   B  Professional body      a chartered institute's framework
 *   C  Occupational survey    incumbent-rated survey data
 *   D  Labour market          convergent evidence from current postings
 *   E  Reasoned judgement     assessor inference, no external source
 */
export type EvidenceClass = "A" | "B" | "C" | "D" | "E";

export interface AdoptionSource {
  id: string;
  name: string;
  homepage: string;
  apiDocs: string;
  /** Whether a key or identifying header is needed, and which. */
  requiresKey: boolean;
  envVars: string[];
  evidenceClass: EvidenceClass;
  /** What this source can and cannot support, in the buyer's terms. */
  measures: string;
  cannotSupport: string;
  /** Licence position for redisplay. Stated because redisplay is the risk. */
  licence: string;
}

export interface ConnectorHealth {
  id: string;
  label: string;
  status: ConnectorStatus;
  configured: boolean;
  message?: string;
  source: AdoptionSource;
}

export interface FetchOutcome<T> {
  ok: boolean;
  status: ConnectorStatus;
  records: T[];
  fetchedAt: string;
  sourceUrl?: string;
  error?: string;
}

/** One vendor's disclosure footprint in SEC filings. */
export interface DisclosureRow {
  vendor: string;
  /** Registrants whose filing of this type names the vendor. */
  filings: number;
  /** Industry breakdown, SIC code to count, most common first. */
  bySic: { sic: string; label: string; filings: number }[];
  /** A handful of named registrants, so the figure can be spot-checked. */
  examples: {
    company: string;
    cik: string;
    filedOn: string;
    sic: string;
    url: string;
  }[];
  /** The exact query that produced this row, so it can be re-run. */
  query: string;
}

export interface DisclosureSnapshot {
  /** What this measures, in one sentence, carried with the data. */
  measures: string;
  formType: string;
  /** The filing window the counts cover, e.g. "last 365 days". */
  window: string;
  fetchedAt: string;
  /** Present when served from the committed snapshot rather than live. */
  snapshotOf?: string;
  rows: DisclosureRow[];
  /** Vendors the ingestion tried and failed to resolve, never silently dropped. */
  failed: { vendor: string; reason: string }[];
  source: AdoptionSource;
}

/** Regulatory pressure: AI rulemaking volume, as an obligations signal. */
export interface RegulatoryPulse {
  totalDocuments: number;
  window: string;
  newest: { title: string; publishedOn: string; url: string } | null;
  byType: { type: string; count: number }[];
  fetchedAt: string;
  source: AdoptionSource;
}
