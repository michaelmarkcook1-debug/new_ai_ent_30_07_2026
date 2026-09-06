import { createHash } from "node:crypto";

// Where the canonical AIE payloads come from, and what counts as a change.
//
// THE ONE LIST. scripts/sync-aie-fixtures.mjs held this map since August; the
// Data Operations discovery reads the same endpoints, so the map lives here and
// the script imports it through the alias hook. Two lists would drift the day
// one gained an endpoint.

/** The upstream API, the same base lib/aie-server.ts reads at render time. */
export const AIE_UPSTREAM = "https://ranking-engine-red.vercel.app/api";

export type CanonicalFile =
  | "vendors.json"
  | "market-share.json"
  | "reputation.json"
  | "pricing.json"
  | "capabilities.json"
  | "metadata.json"
  | "uptake.json"
  | "news.json";

/** Fixture file to endpoint path, relative to AIE_UPSTREAM. */
export const ENDPOINT_OF: Record<CanonicalFile, string> = {
  "vendors.json": "vendors",
  "market-share.json": "market-share",
  "reputation.json": "reputation",
  "pricing.json": "pricing",
  "capabilities.json": "capabilities",
  "metadata.json": "metadata",
  "uptake.json": "uptake",
  "news.json": "news?limit=500",
};

export const CANONICAL_FILES = Object.keys(ENDPOINT_OF) as CanonicalFile[];

/**
 * Files no endpoint serves. Listed so discovery reports them with their last
 * capture instead of silently leaving them out. category-rankings.json is
 * parsed from the upstream category pages by scripts/sync-category-rankings.mjs
 * and cross-checked against market-share per category; that parser stays a
 * script and is not re-implemented here.
 */
export const SCRIPT_CAPTURED: Record<string, string> = {
  "category-rankings.json": "parsed from the upstream category pages by npm run sync:aie",
  "cost-capability.json": "captured from the AI Enterprise model inventory",
  "market-dashboard.json": "captured from the AIE dashboard",
  "model-inventory.json": "captured from the AIE model inventory",
};

/** The date the payload says it was captured. Never the time we fetched it. */
export function captureDateOf(payload: unknown): string | null {
  if (!payload || typeof payload !== "object") return null;
  const o = payload as Record<string, unknown>;
  const prov = o.provenance as Record<string, unknown> | undefined;
  const v = o.capturedAt ?? o.asOf ?? o.generatedAt ?? prov?.capturedAt ?? null;
  return typeof v === "string" ? v : null;
}

/** Day precision, for "is this capture newer than that one". */
export const day = (iso: string | null): string | null =>
  typeof iso === "string" && iso.length >= 10 ? iso.slice(0, 10) : null;

/**
 * Fields that move when a payload is regenerated whether or not any value
 * did. They are dropped before hashing, so a re-fetch that changed only these
 * is "unchanged": a new timestamp is not new evidence.
 */
export const TIMESTAMP_FIELDS = new Set([
  "capturedAt",
  "asOf",
  "generatedAt",
  "sourceDate",
  "lastUpdated",
  "lastVerified",
  "fetchedAt",
]);

function stripTimestamps(value: unknown): unknown {
  if (Array.isArray(value)) return value.map(stripTimestamps);
  if (value && typeof value === "object") {
    const out: Record<string, unknown> = {};
    for (const [k, v] of Object.entries(value as Record<string, unknown>)) {
      if (TIMESTAMP_FIELDS.has(k)) continue;
      out[k] = stripTimestamps(v);
    }
    return out;
  }
  return value;
}

/** A hash of what the payload SAYS, ignoring when it said it. */
export function meaningfulHash(payload: unknown): string {
  return createHash("sha256")
    .update(JSON.stringify(stripTimestamps(payload)))
    .digest("hex")
    .slice(0, 16);
}

/**
 * Payloads too large to travel with a discovery. news.json is a file-level
 * change and today's capture runs to four megabytes, past the request-body
 * limit of a Vercel function; on 6 September 2026 validate and ingest answered
 * 413 on production for exactly that reason. These stay behind: the discovery
 * carries their meaningful hash instead, and ingestion fetches them again and
 * refuses unless the hash still matches what was reviewed.
 */
export const STAYS_BEHIND: ReadonlySet<CanonicalFile> = new Set<CanonicalFile>(["news.json"]);

/** The payloads a discovery may carry to the client and back. */
export function payloadsForTransit<T>(payloads: Partial<Record<CanonicalFile, T>>): Partial<Record<CanonicalFile, T>> {
  const out: Partial<Record<CanonicalFile, T>> = {};
  for (const [file, payload] of Object.entries(payloads) as [CanonicalFile, T][]) {
    if (!STAYS_BEHIND.has(file)) out[file] = payload;
  }
  return out;
}

/** True when a re-fetched payload says what the reviewed one said. */
export function matchesReviewed(reviewedHash: string | undefined, fetched: unknown): boolean {
  return typeof reviewedHash === "string" && reviewedHash === meaningfulHash(fetched);
}

/** How many records a payload carries, by its known top-level array. */
export function recordCount(file: CanonicalFile, payload: unknown): number | null {
  if (!payload || typeof payload !== "object") return null;
  const o = payload as Record<string, unknown[]>;
  const key: Record<CanonicalFile, string> = {
    "vendors.json": "vendors",
    "market-share.json": "estimates",
    "reputation.json": "rows",
    "pricing.json": "rows",
    "capabilities.json": "vendorCapabilities",
    "metadata.json": "vendors",
    "uptake.json": "rows",
    "news.json": "news",
  };
  const arr = o[key[file]];
  return Array.isArray(arr) ? arr.length : null;
}
