// Tracked AI vendor roster for the demo coverage universe.
// Derived from the canonical 47-vendor roster (INTELLIGENCE_VENDORS) in
// lib/aie/intelligence/seed.ts, ported from the ranking-engine repo; see
// AIE_REUSE_MAP.md. Ids, names, and public/private status come straight from
// the seed rows so the roster cannot drift from the dataset.
//
// Layer mapping rules (seed category -> demo layer):
//   "Frontier model/API"    -> frontier
//   "Cloud AI platform"     -> hyperscaler (microsoft, google, aws, oracle;
//                              databricks and snowflake are overridden to
//                              enterprise because their seed infraBand is
//                              data_platform, not cloud_compute)
//   "Enterprise applications", "CRM/customer AI", "ITSM/HR/service AI",
//   "RAG/enterprise search", "Enterprise assistant" -> application
//   "Regulated-industry AI" -> application (vertical specialists harvey and
//                              rogo; ibm is overridden to enterprise as a
//                              governance and hybrid-platform incumbent)
//   "AI infrastructure"     -> infrastructure
//   "Sovereign/regional AI" -> infrastructure (g42 and humain run sovereign
//                              compute build-outs; sakana is overridden to
//                              frontier because it is a model lab, not a
//                              compute provider)
//   "AI investor"           -> excluded from TRACKED_VENDORS. None of the
//                              seed investors (softbank, a16z, sequoia, mgx)
//                              are compute providers, so all four are
//                              exported separately as ECOSYSTEM_ONLY.
//
// BoardRadar tickers (brTicker) are attached only where the coverage probe
// confirmed the company exists in the BoardRadar universe (see
// DATA_COVERAGE.md): MSFT, GOOGL, AMZN, IBM, ORCL, CRM, NOW, SAP.
// Public-market tickers (ticker) are filled only where present in the ported
// seed data (exposure-map-data.ts nodes plus the previously probed roster);
// public companies without a ticker in that data keep ticker: null.

import { VENDOR_DIRECTORY } from "@/lib/aie/vendor-directory";
import { INTELLIGENCE_VENDORS } from "./intelligence/seed";

export interface TrackedVendor {
  id: string;
  name: string;
  layer: "frontier" | "hyperscaler" | "enterprise" | "application" | "infrastructure";
  isPublic: boolean;
  ticker: string | null; // public market ticker, for display
  brTicker: string | null; // ticker usable against the BoardRadar API, if probed live
}

// Pure capital-layer entities from the seed roster. Shown on ecosystem maps
// but excluded from the tracked (rankable) vendor universe.
export interface EcosystemVendor {
  id: string;
  name: string;
  role: "investor";
  isPublic: boolean;
  ticker: string | null;
  brTicker: string | null;
}

type Layer = TrackedVendor["layer"];

/** The seed categories this product knows, and the layer each maps to. Exported so Data Operations can offer exactly this list and nothing else. */
export const CATEGORY_TO_LAYER: Record<string, Layer> = {
  "Frontier model/API": "frontier",
  "Cloud AI platform": "hyperscaler",
  "Enterprise applications": "application",
  "CRM/customer AI": "application",
  "ITSM/HR/service AI": "application",
  "RAG/enterprise search": "application",
  "Enterprise assistant": "application",
  "Regulated-industry AI": "application",
  "AI infrastructure": "infrastructure",
  "Sovereign/regional AI": "infrastructure",
};

// Per-vendor overrides where the seed category alone is too coarse.
const LAYER_OVERRIDES: Record<string, Layer> = {
  databricks: "enterprise", // data_platform infraBand, not hyperscaler cloud
  snowflake: "enterprise", // data_platform infraBand, not hyperscaler cloud
  ibm: "enterprise", // governance and hybrid-platform incumbent, not a vertical app
  sakana: "frontier", // model lab; no sovereign compute build-out
};

export const INVESTOR_CATEGORY = "AI investor";

// Tickers present in the ported seed data (exposure-map-data.ts) or already
// confirmed in the previous probed roster. Everything else stays null.
const TICKER_BY_ID: Record<string, string> = {
  microsoft: "MSFT",
  google: "GOOGL",
  aws: "AMZN",
  oracle: "ORCL",
  salesforce: "CRM",
  servicenow: "NOW",
  sap: "SAP",
  ibm: "IBM",
  snowflake: "SNOW",
  alibaba: "BABA",
  meta: "META",
  nvidia: "NVDA",
  amd: "AMD",
  tsmc: "TSM",
  coreweave: "CRWV",
};

// Confirmed live in BoardRadar (coverage probe).
const BR_TICKERS = new Set(["MSFT", "GOOGL", "AMZN", "IBM", "ORCL", "CRM", "NOW", "SAP", "BABA"]);

function layerFor(id: string, category: string): Layer {
  const override = LAYER_OVERRIDES[id];
  if (override) return override;
  const layer = CATEGORY_TO_LAYER[category];
  if (!layer) {
    throw new Error(`vendors.ts: no layer mapping for seed category "${category}" (vendor "${id}")`);
  }
  return layer;
}

function tickerFor(id: string): string | null {
  return TICKER_BY_ID[id] ?? null;
}

// Built from the live directory, not the 8 July port.
//
// The port's roster had drifted in both directions: it carried five vendors
// under ids the source no longer uses (alibaba-qwen for alibaba, and four
// like it), so every join against live data silently dropped them, and it was
// missing five the source now tracks (ai21, glean, hebbia, minimax, sap),
// which simply never appeared anywhere in this product.
export const TRACKED_VENDORS: TrackedVendor[] = VENDOR_DIRECTORY.filter(
  (v) => v.category !== INVESTOR_CATEGORY,
).map((v) => {
  const ticker = tickerFor(v.id);
  return {
    id: v.id,
    name: v.name,
    layer: layerFor(v.id, v.category ?? ""),
    isPublic: v.ownershipType === "public",
    ticker,
    brTicker: ticker !== null && BR_TICKERS.has(ticker) ? ticker : null,
  };
});

export const ECOSYSTEM_ONLY: EcosystemVendor[] = VENDOR_DIRECTORY.filter(
  (v) => v.category === INVESTOR_CATEGORY,
).map((v) => ({
  id: v.id,
  name: v.name,
  role: "investor" as const,
  isPublic: v.ownershipType === "public",
  ticker: tickerFor(v.id),
  brTicker: null,
}));

export function vendorById(id: string): TrackedVendor | undefined {
  return TRACKED_VENDORS.find((v) => v.id === id);
}
