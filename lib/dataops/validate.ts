import type { Discovery, EntityDiscovery, ValueChange } from "./discover";
import { isKnownCategory } from "./taxonomy";

// Deterministic validation of a staged discovery, before any of it may land.
//
// Every record ends READY, WARNING or BLOCKED with the rule that said so.
// BLOCKED never ingests. Nothing here consults a model, and nothing here
// decides for the operator: a new entity is BLOCKED until a person has chosen
// a category that already exists or matched it to a vendor that already
// exists, and an ambiguous alias is BLOCKED until a person has picked.

export type Level = "READY" | "WARNING" | "BLOCKED";

export interface Finding {
  rule: string;
  level: Level;
  message: string;
}

/** What the operator decided about a NEW or UNRESOLVED entity. */
export interface Resolution {
  entityId: string;
  action: "new" | "match" | "reject";
  /** For "new": one of the existing categories. */
  category?: string;
  /** For "match": the canonical vendor id it is the same as. */
  matchId?: string;
}

export interface StagedRecord {
  id: string;
  kind: "entity" | "change";
  entity?: EntityDiscovery;
  change?: ValueChange;
  level: Level;
  findings: Finding[];
  /** READY changes are pre-selected; entities and warnings never are. */
  selectedByDefault: boolean;
  /** Removals are shown and never applied by this tool. */
  applicable: boolean;
}

export interface Validation {
  records: StagedRecord[];
  summary: {
    newEntities: number;
    changedValues: number;
    unchanged: number;
    categoryChanges: number;
    unresolved: number;
    blocked: number;
    warnings: number;
    ready: number;
  };
}

const RANGES: Record<string, [number, number]> = {
  estimatedShare: [0, 100],
  confidence: [0, 100],
  "customer.overall": [0, 100],
  "developer.overall": [0, 100],
  "employee.overall": [0, 100],
  maturityScore: [0, 100],
  overallScore: [0, 100],
  inputPerM: [0, Number.POSITIVE_INFINITY],
  outputPerM: [0, Number.POSITIVE_INFINITY],
  cachedInputPerM: [0, Number.POSITIVE_INFINITY],
};

const worst = (fs: Finding[]): Level =>
  fs.some((f) => f.level === "BLOCKED") ? "BLOCKED" : fs.some((f) => f.level === "WARNING") ? "WARNING" : "READY";

function rankedAndHeld(rankings: unknown): Map<string, number> {
  const out = new Map<string, number>();
  const cats = (rankings as { categories?: { categoryId?: string; held?: number; ranked?: unknown[] }[] } | null)?.categories;
  for (const c of cats ?? []) {
    if (typeof c.categoryId === "string") out.set(c.categoryId, (Array.isArray(c.ranked) ? c.ranked.length : 0) + (typeof c.held === "number" ? c.held : 0));
  }
  return out;
}

export function validate(
  discovery: Discovery,
  resolutions: Resolution[],
  opts: { canonicalRankings?: unknown; now?: () => number } = {}
): Validation {
  const now = opts.now ?? Date.now;
  const byEntity = new Map(resolutions.map((r) => [r.entityId, r]));
  const records: StagedRecord[] = [];
  const known = new Set(discovery.entities.filter((e) => e.state === "KNOWN").map((e) => e.id));
  const resolvedOk = new Set<string>();
  const seenEntityIds = new Set<string>();

  // ---- entities
  for (const e of discovery.entities) {
    if (e.state === "KNOWN") continue;
    const fs: Finding[] = [];
    const r = byEntity.get(e.id);
    if (seenEntityIds.has(e.id)) fs.push({ rule: "duplicate", level: "BLOCKED", message: `${e.id} appears twice in the discovery` });
    seenEntityIds.add(e.id);
    if (e.state === "REJECTED") {
      fs.push({ rule: "entity-validity", level: "BLOCKED", message: e.reason });
    } else if (!r) {
      fs.push({
        rule: e.state === "NEW" ? "new-entity-review" : "unresolved-entity",
        level: "BLOCKED",
        message:
          e.state === "NEW"
            ? e.suggestion?.requiresNewTopLevel
              ? `${e.reason}. Assign one of the existing categories, match an existing vendor, or reject it.`
              : "a new entity requires explicit review: assign an existing category, match an existing vendor, or reject it"
            : e.reason,
      });
    } else if (r.action === "reject") {
      fs.push({ rule: "operator-rejected", level: "WARNING", message: "rejected by the operator; will be skipped, not ingested" });
    } else if (r.action === "match") {
      if (!r.matchId || !known.has(r.matchId)) fs.push({ rule: "match-target", level: "BLOCKED", message: `match target "${r.matchId ?? ""}" is not a canonical vendor` });
      else {
        resolvedOk.add(e.id);
        fs.push({ rule: "alias", level: "READY", message: `recorded as an alias of ${r.matchId}; its figures land under that id and no new vendor is created` });
      }
    } else if (r.action === "new") {
      if (!isKnownCategory(r.category)) fs.push({ rule: "taxonomy-validity", level: "BLOCKED", message: `category "${r.category ?? ""}" is not one of the existing categories; a new top-level category is a human decision and is not created here` });
      else {
        resolvedOk.add(e.id);
        if (e.suggestion?.suggested && e.suggestion.suggested !== r.category) fs.push({ rule: "category-override", level: "WARNING", message: `operator chose "${r.category}" over the suggested "${e.suggestion.suggested}"` });
        if (e.match?.candidates.length) fs.push({ rule: "possible-duplicate", level: "WARNING", message: `declared new although ${e.match.candidates[0].name} was a candidate (${e.match.candidates[0].reason})` });
      }
    }
    if (!e.evidenceDate) fs.push({ rule: "observation-date", level: "WARNING", message: "the upstream payload carries no capture date for this entity" });
    const level = worst(fs);
    records.push({ id: `entity|${e.id}`, kind: "entity", entity: e, level, findings: fs, selectedByDefault: false, applicable: level !== "BLOCKED" && r?.action !== "reject" });
  }

  // ---- population consistency, per category, from the discovered shares
  const rankedHeld = rankedAndHeld(opts.canonicalRankings ?? null);
  const shareVendors = new Map<string, Set<string>>();
  for (const c of discovery.changes) {
    if (c.kind !== "share") continue;
    const cat = c.label.split(" in ")[1];
    if (!cat) continue;
    if (!shareVendors.has(cat)) shareVendors.set(cat, new Set());
    shareVendors.get(cat)!.add(c.entity);
  }
  const populationWarning = new Map<string, string>();
  for (const [cat, vendors] of shareVendors) {
    const rh = rankedHeld.get(cat);
    if (rh !== undefined && rh !== vendors.size) populationWarning.set(cat, `market-share lists ${vendors.size} vendors for ${cat}; the canonical category rankings hold ${rh} (ranked plus held). Refresh the rankings with npm run sync:aie after ingesting, or the product holds two vintages.`);
  }

  // ---- value changes
  const seenChangeIds = new Set<string>();
  let categoryChanges = 0;
  const today = now();
  for (const c of discovery.changes) {
    if (c.status === "unchanged") continue;
    const fs: Finding[] = [];
    if (seenChangeIds.has(c.id)) fs.push({ rule: "duplicate", level: "BLOCKED", message: `${c.id} appears twice` });
    seenChangeIds.add(c.id);
    if (c.status === "removed") {
      fs.push({ rule: "removal", level: "WARNING", message: "the row is absent upstream; removals are shown and never applied by Data Operations" });
    } else {
      // The entity behind the figure has to exist, or be about to.
      if (c.kind !== "file" && !known.has(c.entity) && !resolvedOk.has(c.entity)) {
        fs.push({ rule: "required-identifier", level: "BLOCKED", message: `depends on ${c.entity}, which is not a canonical vendor and has not been approved as one` });
      }
      const range = RANGES[c.field];
      if (range) {
        const v = c.discovered;
        if (typeof v !== "number" || !Number.isFinite(v)) fs.push({ rule: "value-type", level: "BLOCKED", message: `${c.field} is ${JSON.stringify(v)}, not a number` });
        else if (v < range[0] || v > range[1]) fs.push({ rule: "value-range", level: "BLOCKED", message: `${c.field} ${v} is outside ${range[0]} to ${range[1] === Number.POSITIVE_INFINITY ? "any" : range[1]}` });
      }
      if (c.field === "category") {
        categoryChanges += 1;
        if (!isKnownCategory(c.discovered as string)) fs.push({ rule: "taxonomy-validity", level: "BLOCKED", message: `category "${String(c.discovered)}" is not one of the existing categories` });
        else fs.push({ rule: "category-change", level: "WARNING", message: `category moves from "${String(c.current)}" to "${String(c.discovered)}"` });
      }
      if (!c.evidenceDate) fs.push({ rule: "observation-date", level: "WARNING", message: "the payload carries no capture date; the fetch time is not used in its place" });
      else if (Date.parse(c.evidenceDate) > today + 86_400_000) fs.push({ rule: "observation-date", level: "BLOCKED", message: `capture date ${c.evidenceDate} is in the future` });
      else if (c.canonicalCapture && c.evidenceDate.slice(0, 10) < c.canonicalCapture.slice(0, 10)) fs.push({ rule: "observation-date", level: "BLOCKED", message: `capture ${c.evidenceDate.slice(0, 10)} is older than canonical ${c.canonicalCapture.slice(0, 10)}` });
      if (c.kind === "price") fs.push({ rule: "currency", level: "WARNING", message: "the source states no currency; USD per million tokens is assumed, as the source's own note says" });
      if (c.kind === "share") {
        const cat = c.label.split(" in ")[1];
        const w = cat ? populationWarning.get(cat) : undefined;
        if (w) fs.push({ rule: "population-consistency", level: "WARNING", message: w });
      }
      if (c.kind === "file") {
        const ok = typeof c.discovered === "string" && !c.discovered.startsWith("? records");
        if (!ok) fs.push({ rule: "schema", level: "BLOCKED", message: "the discovered payload does not carry the array this file is built on" });
      }
    }
    const level = worst(fs);
    records.push({ id: c.id, kind: "change", change: c, level, findings: fs, selectedByDefault: level === "READY", applicable: level !== "BLOCKED" && c.status !== "removed" });
  }

  const count = (l: Level) => records.filter((r) => r.level === l).length;
  return {
    records,
    summary: {
      newEntities: discovery.entities.filter((e) => e.state === "NEW").length,
      changedValues: discovery.changes.filter((c) => c.status === "changed" || c.status === "new").length,
      unchanged: discovery.summary.unchanged,
      categoryChanges,
      unresolved: discovery.entities.filter((e) => e.state === "UNRESOLVED" && !byEntity.has(e.id)).length,
      blocked: count("BLOCKED"),
      warnings: count("WARNING"),
      ready: count("READY"),
    },
  };
}
