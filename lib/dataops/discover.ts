import {
  AIE_UPSTREAM,
  CANONICAL_FILES,
  ENDPOINT_OF,
  SCRIPT_CAPTURED,
  captureDateOf,
  day,
  meaningfulHash,
  recordCount,
  type CanonicalFile,
} from "./sources";
import type { CanonicalStore } from "./store";
import { matchExisting, type MatchResult } from "./entities";
import { suggestCategory, type CategorySuggestion } from "./taxonomy";

// Discovery: what the upstream holds now, set against what we hold, without
// touching what we hold.
//
// It reads the canonical store and never writes it. Every finding is a value
// compared with a value; the fetch time is recorded as discoveredAt and used
// for nothing else, because a payload regenerated at 04:30 with the same
// numbers in it is not new evidence. Evidence dates come from the payloads.

export type FileStatus = "new-capture" | "unchanged" | "older" | "failed" | "script-captured";

export interface FileDiscovery {
  file: string;
  endpoint: string | null;
  status: FileStatus;
  canonicalCapture: string | null;
  discoveredCapture: string | null;
  canonicalRecords: number | null;
  discoveredRecords: number | null;
  /** Values that differ, from the entity diff. Zero on a re-fetch that moved only timestamps. */
  valuesChanged: number;
  note: string;
}

export type EntityState = "KNOWN" | "NEW" | "UNRESOLVED" | "REJECTED";

export interface EntityDiscovery {
  id: string;
  name: string;
  state: EntityState;
  /** Which payload it was seen in. */
  source: string;
  upstreamCategory: string | null;
  suggestion: CategorySuggestion | null;
  match: MatchResult | null;
  reason: string;
  evidenceDate: string | null;
}

export type ChangeStatus = "new" | "changed" | "unchanged" | "removed";
export type ChangeKind = "vendor" | "share" | "reputation" | "price" | "capability" | "file";

export interface ValueChange {
  /** Stable across discoveries: file, entity and field. What the operator approves. */
  id: string;
  kind: ChangeKind;
  entity: string;
  label: string;
  file: CanonicalFile;
  field: string;
  current: unknown;
  discovered: unknown;
  status: ChangeStatus;
  canonicalCapture: string | null;
  /** The payload's own date. Never the fetch time. */
  evidenceDate: string | null;
  source: string;
}

export interface Discovery {
  discoveredAt: string;
  source: string;
  note: string;
  files: FileDiscovery[];
  entities: EntityDiscovery[];
  changes: ValueChange[];
  summary: {
    newEntities: number;
    unresolved: number;
    rejected: number;
    changed: number;
    unchanged: number;
    removed: number;
    filesFailed: number;
  };
}

export type FetchJson = (endpoint: string) => Promise<unknown | null>;

type Row = Record<string, unknown>;
const rows = (payload: unknown, key: string): Row[] => {
  const arr = (payload as Record<string, unknown> | null)?.[key];
  return Array.isArray(arr) ? (arr as Row[]) : [];
};
const str = (v: unknown): string | null => (typeof v === "string" && v.length > 0 ? v : null);
const get = (o: Row, pathKey: string): unknown =>
  pathKey.split(".").reduce<unknown>((acc, k) => (acc && typeof acc === "object" ? (acc as Row)[k] : undefined), o);

interface EntitySpec {
  file: CanonicalFile;
  kind: ChangeKind;
  arrayKey: string;
  key: (r: Row) => string | null;
  entity: (r: Row) => string;
  label: (r: Row) => string;
  fields: string[];
}

const SPECS: EntitySpec[] = [
  { file: "vendors.json", kind: "vendor", arrayKey: "vendors", key: (r) => str(r.id), entity: (r) => String(r.id), label: (r) => str(r.name) ?? String(r.id), fields: ["name", "category", "ownershipType", "headquarters", "overallScore", "marketPosition"] },
  { file: "market-share.json", kind: "share", arrayKey: "estimates", key: (r) => (str(r.vendorId) && str(r.categoryId) ? `${r.vendorId}:${r.categoryId}` : null), entity: (r) => String(r.vendorId), label: (r) => `${r.vendorId} in ${r.categoryId}`, fields: ["estimatedShare", "confidence"] },
  { file: "reputation.json", kind: "reputation", arrayKey: "rows", key: (r) => str(r.vendorId), entity: (r) => String(r.vendorId), label: (r) => String(r.vendorId), fields: ["customer.overall", "developer.overall", "employee.overall"] },
  { file: "pricing.json", kind: "price", arrayKey: "rows", key: (r) => str(r.id), entity: (r) => str(r.vendorId) ?? String(r.id), label: (r) => `${r.vendorName ?? r.vendorId} ${r.modelName ?? r.id}`, fields: ["inputPerM", "outputPerM", "cachedInputPerM"] },
  { file: "capabilities.json", kind: "capability", arrayKey: "vendorCapabilities", key: (r) => (str(r.vendorId) && str(r.capabilityId) ? `${r.vendorId}:${r.capabilityId}` : null), entity: (r) => String(r.vendorId), label: (r) => `${r.vendorId} ${r.capabilityId}`, fields: ["maturityScore", "status"] },
];

const FILE_LEVEL: CanonicalFile[] = ["metadata.json", "uptake.json", "news.json"];

function diffEntities(spec: EntitySpec, canonical: unknown, discovered: unknown, canonicalCapture: string | null, evidenceDate: string | null): ValueChange[] {
  const cur = new Map<string, Row>();
  for (const r of rows(canonical, spec.arrayKey)) { const k = spec.key(r); if (k) cur.set(k, r); }
  const out: ValueChange[] = [];
  const seen = new Set<string>();
  for (const r of rows(discovered, spec.arrayKey)) {
    const k = spec.key(r);
    if (!k) continue;
    seen.add(k);
    const before = cur.get(k);
    for (const field of spec.fields) {
      const after = get(r, field);
      const prior = before ? get(before, field) : undefined;
      const status: ChangeStatus = !before ? "new" : JSON.stringify(prior) === JSON.stringify(after) ? "unchanged" : "changed";
      if (status === "unchanged" && after === undefined) continue;
      out.push({ id: `${spec.file}|${k}|${field}`, kind: spec.kind, entity: spec.entity(r), label: spec.label(r), file: spec.file, field, current: prior, discovered: after, status, canonicalCapture, evidenceDate, source: ENDPOINT_OF[spec.file] });
    }
  }
  for (const [k, before] of cur) {
    if (seen.has(k)) continue;
    out.push({ id: `${spec.file}|${k}|*`, kind: spec.kind, entity: spec.entity(before), label: spec.label(before), file: spec.file, field: "*", current: "present", discovered: "absent upstream", status: "removed", canonicalCapture, evidenceDate, source: ENDPOINT_OF[spec.file] });
  }
  return out;
}

export async function discover(store: CanonicalStore, fetchJson: FetchJson, opts: { now?: () => number } = {}): Promise<Discovery> {
  const now = opts.now ?? Date.now;
  const discoveredAt = new Date(now()).toISOString();
  const files: FileDiscovery[] = [];
  const changes: ValueChange[] = [];
  const payloads = new Map<CanonicalFile, { canonical: unknown; discovered: unknown; canonicalCapture: string | null; evidenceDate: string | null }>();

  for (const file of CANONICAL_FILES) {
    const endpoint = ENDPOINT_OF[file];
    const canonicalText = await store.read(file);
    const canonical = canonicalText ? (JSON.parse(canonicalText) as unknown) : null;
    const canonicalCapture = captureDateOf(canonical);
    const discovered = await fetchJson(endpoint);
    const base = { file, endpoint, canonicalCapture, canonicalRecords: recordCount(file, canonical), valuesChanged: 0 };
    if (discovered === null) {
      files.push({ ...base, status: "failed", discoveredCapture: null, discoveredRecords: null, note: "no answer from the upstream; nothing to compare, nothing changed" });
      continue;
    }
    const discoveredCapture = captureDateOf(discovered);
    if (day(canonicalCapture) && day(discoveredCapture) && (day(discoveredCapture) as string) < (day(canonicalCapture) as string)) {
      files.push({ ...base, status: "older", discoveredCapture, discoveredRecords: recordCount(file, discovered), note: `the upstream serves a ${day(discoveredCapture)} capture and canonical holds ${day(canonicalCapture)}; an older capture is never taken` });
      continue;
    }
    const moved = meaningfulHash(canonical) !== meaningfulHash(discovered);
    payloads.set(file, { canonical, discovered, canonicalCapture, evidenceDate: discoveredCapture });
    const spec = SPECS.find((s) => s.file === file);
    let valuesChanged = 0;
    if (spec) {
      const diff = diffEntities(spec, canonical, discovered, canonicalCapture, discoveredCapture);
      valuesChanged = diff.filter((c) => c.status !== "unchanged").length;
      changes.push(...diff);
    } else if (FILE_LEVEL.includes(file)) {
      valuesChanged = moved ? 1 : 0;
      changes.push({ id: `${file}|*|*`, kind: "file", entity: file, label: file, file, field: "payload", current: `${recordCount(file, canonical) ?? "?"} records, capture ${day(canonicalCapture) ?? "?"}`, discovered: `${recordCount(file, discovered) ?? "?"} records, capture ${day(discoveredCapture) ?? "?"}`, status: canonical === null ? "new" : moved ? "changed" : "unchanged", canonicalCapture, evidenceDate: discoveredCapture, source: endpoint });
    }
    const captureAdvanced = day(discoveredCapture) !== day(canonicalCapture);
    files.push({
      ...base,
      status: moved || valuesChanged > 0 ? "new-capture" : "unchanged",
      discoveredCapture,
      discoveredRecords: recordCount(file, discovered),
      valuesChanged,
      note: moved || valuesChanged > 0
        ? `${valuesChanged} value${valuesChanged === 1 ? "" : "s"} differ`
        : captureAdvanced
          ? `capture date moved to ${day(discoveredCapture)}; no value did, so this is not new evidence`
          : "identical to canonical",
    });
  }
  for (const [file, how] of Object.entries(SCRIPT_CAPTURED)) {
    const text = await store.read(file);
    const payload = text ? (JSON.parse(text) as unknown) : null;
    files.push({ file, endpoint: null, status: "script-captured", canonicalCapture: captureDateOf(payload), discoveredCapture: null, canonicalRecords: null, discoveredRecords: null, valuesChanged: 0, note: how });
  }

  // Entities: every vendor id the upstream mentions, set against the roster we hold.
  const vendorsCanonical = payloads.get("vendors.json")?.canonical ?? (await store.read("vendors.json").then((t) => (t ? JSON.parse(t) : null)));
  const roster = rows(vendorsCanonical, "vendors").map((r) => ({ id: String(r.id), name: str(r.name) ?? String(r.id) }));
  const known = new Set(roster.map((r) => r.id));
  const entities: EntityDiscovery[] = [];
  const seenIds = new Set<string>();
  const upstreamVendors = rows(payloads.get("vendors.json")?.discovered, "vendors");
  const evidenceVendors = payloads.get("vendors.json")?.evidenceDate ?? null;
  for (const r of upstreamVendors) {
    const id = str(r.id);
    const name = str(r.name) ?? id ?? "";
    if (!id || !/^[a-z0-9][a-z0-9-_]*$/.test(id) || !name) {
      entities.push({ id: id ?? "(no id)", name, state: "REJECTED", source: "vendors", upstreamCategory: str(r.category), suggestion: null, match: null, reason: "the upstream record has no usable identifier or name", evidenceDate: evidenceVendors });
      continue;
    }
    seenIds.add(id);
    if (known.has(id)) {
      entities.push({ id, name, state: "KNOWN", source: "vendors", upstreamCategory: str(r.category), suggestion: null, match: null, reason: "already in the canonical roster", evidenceDate: evidenceVendors });
      continue;
    }
    const match = matchExisting({ id, name }, roster);
    const suggestion = suggestCategory({ id, name, category: str(r.category) });
    if (match.suggestion || match.ambiguous) {
      entities.push({ id, name, state: "UNRESOLVED", source: "vendors", upstreamCategory: str(r.category), suggestion, match, reason: match.ambiguous ? "two canonical vendors are close matches; a person must choose or declare it new" : `probably ${match.suggestion} under another name; a person must confirm before anything is merged`, evidenceDate: evidenceVendors });
      continue;
    }
    entities.push({ id, name, state: "NEW", source: "vendors", upstreamCategory: str(r.category), suggestion, match, reason: suggestion.requiresNewTopLevel ? "new vendor whose upstream category this product does not have: stopped for a human decision" : "new vendor, not matching any canonical name or alias", evidenceDate: evidenceVendors });
  }
  // Ids that metric payloads reference but no roster carries, upstream or here.
  const referenced = new Map<string, { where: string; evidenceDate: string | null }>();
  for (const [file, key] of [["market-share.json", "estimates"], ["reputation.json", "rows"], ["pricing.json", "rows"], ["capabilities.json", "vendorCapabilities"], ["metadata.json", "vendors"]] as [CanonicalFile, string][]) {
    for (const r of rows(payloads.get(file)?.discovered, key)) {
      const id = str(r.vendorId) ?? str(r.id);
      if (id && !known.has(id) && !seenIds.has(id) && !referenced.has(id)) referenced.set(id, { where: `${file} rows`, evidenceDate: payloads.get(file)?.evidenceDate ?? null });
    }
  }
  for (const [id, { where, evidenceDate }] of referenced) {
    entities.push({ id, name: id, state: "UNRESOLVED", source: where, upstreamCategory: null, suggestion: null, match: matchExisting({ id, name: id }, roster), reason: `referenced by ${where} but on no vendor roster, upstream or canonical; needs a vendor entity before its figures can mean anything`, evidenceDate });
  }

  const count = (s: ChangeStatus) => changes.filter((c) => c.status === s).length;
  return {
    discoveredAt,
    source: AIE_UPSTREAM,
    note: "discoveredAt is when this was fetched and is not an evidence date; every change carries the payload's own date",
    files,
    entities,
    changes,
    summary: {
      newEntities: entities.filter((e) => e.state === "NEW").length,
      unresolved: entities.filter((e) => e.state === "UNRESOLVED").length,
      rejected: entities.filter((e) => e.state === "REJECTED").length,
      changed: count("changed") + count("new"),
      unchanged: count("unchanged"),
      removed: count("removed"),
      filesFailed: files.filter((f) => f.status === "failed").length,
    },
  };
}
