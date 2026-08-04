// The source registry for first-party adoption data.
//
// Copied in shape from the ranking engine's lib/evidence/source-registry.ts,
// which is the right pattern: a controlled list where every source declares
// its licence position and whether redisplay is allowed, so nothing is
// scraped and shown on a whim.
//
// Only sources that actually answer without a paid key are listed. The
// ranking engine registers thirteen connectors, of which eight need an API
// key that this machine does not hold (FRED, BLS, BEA, EIA, Congress,
// AlphaVantage, GitHub, and its vendor-docs reader needs an Anthropic key).
// Those are omitted rather than registered in a permanently unconfigured
// state, because a source list whose entries mostly cannot run tells an
// operator nothing.
//
// SEC's "key" is only a User-Agent string identifying the caller, which their
// fair-access policy requires. It is not a secret, and it has a default here
// so the connector works out of the box; setting SEC_USER_AGENT to a real
// contact address is the courteous thing to do in production.

import type { AdoptionSource } from "./types";

export const SEC_EDGAR: AdoptionSource = {
  id: "sec_edgar_fts",
  name: "SEC EDGAR full-text search",
  homepage: "https://efts.sec.gov/LATEST/search-index?q=%22artificial+intelligence%22",
  apiDocs: "https://www.sec.gov/edgar/search/efts-faq.html",
  requiresKey: false,
  envVars: ["SEC_USER_AGENT"],
  evidenceClass: "A",
  measures:
    "How many SEC registrants name a vendor in a given filing type, with the industry (SIC) and filing date of each.",
  cannotSupport:
    "Whether the registrant is a customer. A filing may name a vendor as a competitor, investor, supplier or partner, and does not say which. It is also US registrants only, so private and non-US adoption is invisible.",
  licence:
    "US government work, public domain. SEC fair-access policy requires a declared User-Agent and asks for under 10 requests per second.",
};

export const FEDERAL_REGISTER: AdoptionSource = {
  id: "federal_register",
  name: "Federal Register API",
  homepage: "https://www.federalregister.gov/",
  apiDocs: "https://www.federalregister.gov/developers/documentation/api/v1",
  requiresKey: false,
  envVars: [],
  evidenceClass: "A",
  measures:
    "The volume and type of US federal rulemaking that mentions artificial intelligence, and the most recent such document.",
  cannotSupport:
    "Anything outside US federal rulemaking: no EU AI Act, no UK regulator activity, no state law.",
  licence: "US government work, public domain. No key, no declared rate limit.",
};

export const ADOPTION_SOURCES: AdoptionSource[] = [SEC_EDGAR, FEDERAL_REGISTER];

/**
 * SEC industry codes are four-digit and meaningless to a reader, so the ones
 * this product actually surfaces carry a plain-English label. Anything not
 * listed is shown as its bare code rather than guessed at.
 */
export const SIC_LABELS: Record<string, string> = {
  "7372": "Prepackaged software",
  "7370": "Computer services",
  "7371": "Computer programming services",
  "7374": "Data processing and hosting",
  "7389": "Business services",
  "6770": "Blank cheques and holding companies",
  "6199": "Finance services",
  "6022": "State commercial banks",
  "6021": "National commercial banks",
  "5961": "Retail, catalogue and mail-order",
  "3674": "Semiconductors",
  "2836": "Biological products",
  "2834": "Pharmaceutical preparations",
  "8742": "Management consulting",
  "4813": "Telecommunications",
  "6324": "Hospital and medical service plans",
  "3841": "Surgical and medical instruments",
  "7812": "Motion picture and video production",
  "6798": "Real estate investment trusts",
  "4911": "Electric services",
};

export function sicLabel(code: string): string {
  return SIC_LABELS[code] ?? `SIC ${code}`;
}

/**
 * The vendors this product tracks for disclosure. Kept deliberately short and
 * unambiguous: a search term that collides with ordinary English would count
 * filings that have nothing to do with the vendor.
 *
 * "OpenAI" and "Anthropic" are safe — they are coined names. "Google Cloud"
 * and "Microsoft Azure" are used rather than "Google" and "Microsoft", which
 * would match almost every technology filing ever written and measure nothing.
 * Mistral is excluded: it collides with the wind and with several unrelated
 * company names.
 */
export const TRACKED_VENDORS: { vendor: string; term: string; vendorId?: string }[] = [
  { vendor: "OpenAI", term: "OpenAI", vendorId: "openai" },
  { vendor: "Anthropic", term: "Anthropic", vendorId: "anthropic" },
  { vendor: "Google Cloud", term: "Google Cloud", vendorId: "google" },
  { vendor: "Microsoft Azure", term: "Microsoft Azure", vendorId: "microsoft" },
  { vendor: "Databricks", term: "Databricks", vendorId: "databricks" },
  { vendor: "Palantir", term: "Palantir", vendorId: "palantir" },
  { vendor: "Snowflake", term: "Snowflake", vendorId: "snowflake" },
  { vendor: "Hugging Face", term: "Hugging Face", vendorId: "huggingface" },
];
