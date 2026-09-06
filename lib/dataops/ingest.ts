import { CANONICAL_FILES, captureDateOf, type CanonicalFile } from "./sources";
import type { CanonicalStore } from "./store";
import type { Discovery, ValueChange } from "./discover";
import type { Resolution, StagedRecord, Validation } from "./validate";
import { evidenceVersion } from "./evidence";

// The mutation boundary.
//
// plan() takes what the operator selected and keeps only what may land:
// READY or WARNING records that were explicitly selected, never BLOCKED,
// never a removal, never an entity without a resolution. apply() then builds
// every affected file in memory, writes all of them or none, regenerates the
// derived artefacts, and if any of that fails puts the previous contents back
// and says FAILED. The audit record carries what changed, from what, to what,
// from where and when. The Analyst Insight cache is not touched: it is keyed
// on the facts these files produce, so the next reader's request authors the
// new reading if the facts moved, and nothing here authors anything.

export interface IngestPlan {
  approved: StagedRecord[];
  skipped: { id: string; reason: string }[];
  blocked: StagedRecord[];
  counts: { records: number; entities: number; changes: number; files: string[] };
}

export function plan(validation: Validation, approvedIds: readonly string[]): IngestPlan {
  const wanted = new Set(approvedIds);
  const approved: StagedRecord[] = [];
  const skipped: { id: string; reason: string }[] = [];
  const blocked: StagedRecord[] = [];
  for (const r of validation.records) {
    if (r.level === "BLOCKED") { blocked.push(r); continue; }
    if (!wanted.has(r.id)) { skipped.push({ id: r.id, reason: "not selected" }); continue; }
    if (!r.applicable) { skipped.push({ id: r.id, reason: r.change?.status === "removed" ? "removals are not applied" : "rejected by the operator" }); continue; }
    approved.push(r);
  }
  const files = [...new Set(approved.map((r) => (r.kind === "change" ? r.change!.file : "vendors.json")))];
  return { approved, skipped, blocked, counts: { records: approved.length, entities: approved.filter((r) => r.kind === "entity").length, changes: approved.filter((r) => r.kind === "change").length, files } };
}

export interface DerivedStep { step: string; ok: boolean; output: string }

export interface AuditRecord {
  discoveredAt: string;
  ingestedAt: string;
  source: string;
  approved: { id: string; kind: string; entity: string; file: string; field: string; from: unknown; to: unknown; evidenceDate: string | null; source: string }[];
  skipped: { id: string; reason: string }[];
  blocked: { id: string; reason: string }[];
  categoryMappings: { entityId: string; category: string }[];
  aliases: { entityId: string; matchedTo: string }[];
  evidenceVersion: { before: string; after: string; changed: boolean };
  derived: DerivedStep[];
  status: "INGESTED" | "FAILED";
}

export interface IngestResult {
  status: "INGESTED" | "FAILED" | "NOTHING" | "REFUSED";
  ingested: number;
  skipped: number;
  blocked: number;
  failed: number;
  files: string[];
  derived: DerivedStep[];
  evidenceVersion: { before: string; after: string; changed: boolean } | null;
  analystInsight: string;
  audit: AuditRecord | null;
  reverted: boolean;
  error?: string;
}

const ANALYST_NOTE = "not regenerated: the Analyst Insight cache is keyed on the facts these files produce, so the next reader request authors a new reading where the facts moved; nothing here calls the model";

type Row = Record<string, unknown>;
const ARRAY_KEY: Record<CanonicalFile, string> = { "vendors.json": "vendors", "market-share.json": "estimates", "reputation.json": "rows", "pricing.json": "rows", "capabilities.json": "vendorCapabilities", "metadata.json": "vendors", "uptake.json": "rows", "news.json": "news" };
const KEY_OF: Partial<Record<CanonicalFile, (r: Row) => string | null>> = {
  "vendors.json": (r) => (typeof r.id === "string" ? r.id : null),
  "market-share.json": (r) => (r.vendorId && r.categoryId ? `${r.vendorId}:${r.categoryId}` : null),
  "reputation.json": (r) => (typeof r.vendorId === "string" ? r.vendorId : null),
  "pricing.json": (r) => (typeof r.id === "string" ? r.id : null),
  "capabilities.json": (r) => (r.vendorId && r.capabilityId ? `${r.vendorId}:${r.capabilityId}` : null),
};

function setPath(o: Row, pathKey: string, value: unknown): void {
  const parts = pathKey.split(".");
  let cur: Row = o;
  for (const p of parts.slice(0, -1)) {
    if (!cur[p] || typeof cur[p] !== "object") cur[p] = {};
    cur = cur[p] as Row;
  }
  cur[parts[parts.length - 1]] = value;
}

export interface ApplyOptions {
  runDerived?: () => Promise<DerivedStep[]>;
  auditSink?: (audit: AuditRecord) => Promise<void>;
  now?: () => number;
}

export async function apply(
  discovery: Discovery & { payloads?: Partial<Record<CanonicalFile, unknown>> },
  planned: IngestPlan,
  resolutions: Resolution[],
  store: CanonicalStore,
  opts: ApplyOptions = {}
): Promise<IngestResult> {
  const now = opts.now ?? Date.now;
  const none = (status: IngestResult["status"], error?: string): IngestResult => ({ status, ingested: 0, skipped: planned.skipped.length, blocked: planned.blocked.length, failed: 0, files: [], derived: [], evidenceVersion: null, analystInsight: ANALYST_NOTE, audit: null, reverted: false, error });
  if (!store.writable()) return none("REFUSED", `canonical store is read-only: ${store.reason()}`);
  if (planned.approved.length === 0) return none("NOTHING", "no approved records");

  const before = await evidenceVersion(store);
  const aliases = new Map<string, string>();
  const categoryMappings: { entityId: string; category: string }[] = [];
  const aliasList: { entityId: string; matchedTo: string }[] = [];
  for (const r of resolutions) {
    if (r.action === "match" && r.matchId) { aliases.set(r.entityId, r.matchId); aliasList.push({ entityId: r.entityId, matchedTo: r.matchId }); }
    if (r.action === "new" && r.category) categoryMappings.push({ entityId: r.entityId, category: r.category });
  }
  const approvedEntities = new Set(planned.approved.filter((r) => r.kind === "entity").map((r) => r.entity!.id));

  // Build every affected file in memory.
  const touched = new Set<CanonicalFile>();
  const canonical = new Map<CanonicalFile, Row>();
  const load = async (file: CanonicalFile): Promise<Row> => {
    if (!canonical.has(file)) { const t = await store.read(file); canonical.set(file, (t ? JSON.parse(t) : { [ARRAY_KEY[file]]: [] }) as Row); }
    return canonical.get(file)!;
  };
  const discoveredRows = (file: CanonicalFile): Row[] => {
    const arr = (discovery.payloads?.[file] as Row | undefined)?.[ARRAY_KEY[file]];
    return Array.isArray(arr) ? (arr as Row[]) : [];
  };
  const previous: Record<string, string> = {};
  const applied: AuditRecord["approved"] = [];

  try {
    // New vendors first, so figures that depend on them find them.
    for (const r of planned.approved.filter((x) => x.kind === "entity")) {
      const res = resolutions.find((x) => x.entityId === r.entity!.id);
      if (!res || res.action !== "new") continue;
      const v = await load("vendors.json");
      const list = v.vendors as Row[];
      const row = discoveredRows("vendors.json").find((x) => x.id === r.entity!.id);
      if (!row) throw new Error(`no upstream row for new vendor ${r.entity!.id}`);
      if (list.some((x) => x.id === row.id)) throw new Error(`${row.id} is already canonical`);
      list.push({ ...row, category: res.category });
      touched.add("vendors.json");
      applied.push({ id: r.id, kind: "entity", entity: String(row.id), file: "vendors.json", field: "*", from: null, to: `new vendor in "${res.category}"`, evidenceDate: r.entity!.evidenceDate, source: "vendors" });
    }
    for (const r of planned.approved.filter((x) => x.kind === "change")) {
      const c = r.change as ValueChange;
      const file = c.file;
      const payload = await load(file);
      if (c.kind === "file") {
        const fresh = discovery.payloads?.[file];
        if (!fresh || typeof fresh !== "object") throw new Error(`no discovered payload for ${file}`);
        canonical.set(file, fresh as Row);
        touched.add(file);
        applied.push({ id: c.id, kind: "file", entity: file, file, field: "payload", from: c.current, to: c.discovered, evidenceDate: c.evidenceDate, source: c.source });
        continue;
      }
      const keyOf = KEY_OF[file]!;
      const list = payload[ARRAY_KEY[file]] as Row[];
      const remap = (row: Row): Row => (typeof row.vendorId === "string" && aliases.has(row.vendorId) ? { ...row, vendorId: aliases.get(row.vendorId) } : row);
      const [, key] = c.id.split("|");
      const upstreamRow = discoveredRows(file).map(remap).find((x) => keyOf(x) === key || keyOf(x) === key.replace(/^[^:]+/, (m) => aliases.get(m) ?? m));
      let target = list.find((x) => keyOf(x) === (upstreamRow ? keyOf(upstreamRow) : key));
      if (!target) {
        if (!upstreamRow) throw new Error(`no upstream row for ${c.id}`);
        if (typeof upstreamRow.vendorId === "string" && !approvedEntities.has(upstreamRow.vendorId) && !aliases.has(c.entity) && !(await load("vendors.json")).vendors) throw new Error(`entity ${upstreamRow.vendorId} unknown`);
        target = { ...upstreamRow };
        list.push(target);
      }
      setPath(target, c.field, c.discovered);
      touched.add(file);
      applied.push({ id: c.id, kind: c.kind, entity: c.entity, file, field: c.field, from: c.current, to: c.discovered, evidenceDate: c.evidenceDate, source: c.source });
    }
    // Capture fields follow the evidence, counts follow the arrays.
    const files: Record<string, string> = {};
    for (const file of touched) {
      const payload = canonical.get(file)!;
      const fresh = discovery.payloads?.[file] as Row | undefined;
      const date = captureDateOf(fresh);
      if (date) { if ("capturedAt" in payload) payload.capturedAt = date; if ("asOf" in payload) payload.asOf = date; }
      const arr = payload[ARRAY_KEY[file]];
      if (Array.isArray(arr) && "count" in payload) payload.count = arr.length;
      previous[file] = (await store.read(file)) ?? "";
      files[file] = JSON.stringify(payload, null, 1);
    }
    await store.write(files);
  } catch (err) {
    return { ...none("FAILED", err instanceof Error ? err.message : String(err)), failed: planned.approved.length };
  }

  // Derived artefacts, or revert.
  let derived: DerivedStep[] = [];
  let reverted = false;
  if (opts.runDerived) {
    try { derived = await opts.runDerived(); } catch (err) { derived = [{ step: "derived", ok: false, output: err instanceof Error ? err.message : String(err) }]; }
    if (derived.some((d) => !d.ok)) {
      await store.write(previous);
      reverted = true;
    }
  }
  const after = await evidenceVersion(store);
  const status: AuditRecord["status"] = reverted ? "FAILED" : "INGESTED";
  const audit: AuditRecord = {
    discoveredAt: discovery.discoveredAt,
    ingestedAt: new Date(now()).toISOString(),
    source: discovery.source,
    approved: applied,
    skipped: planned.skipped,
    blocked: planned.blocked.map((b) => ({ id: b.id, reason: b.findings.filter((f) => f.level === "BLOCKED").map((f) => f.message).join("; ") })),
    categoryMappings,
    aliases: aliasList,
    evidenceVersion: { before, after, changed: before !== after },
    derived,
    status,
  };
  if (opts.auditSink) { try { await opts.auditSink(audit); } catch { /* the audit is returned regardless */ } }
  return {
    status,
    ingested: reverted ? 0 : applied.length,
    skipped: planned.skipped.length,
    blocked: planned.blocked.length,
    failed: reverted ? applied.length : 0,
    files: reverted ? [] : [...touched],
    derived,
    evidenceVersion: audit.evidenceVersion,
    analystInsight: ANALYST_NOTE,
    audit,
    reverted,
    error: reverted ? "a derived artefact failed to regenerate; the fixtures were put back as they were" : undefined,
  };
}

export { CANONICAL_FILES };
