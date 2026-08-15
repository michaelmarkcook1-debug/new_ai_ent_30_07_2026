// What the platform remembers about yesterday.
//
// Every sync used to overwrite its fixtures, so the product had no memory at
// all: after a refresh, "Anthropic's security score fell" was a sentence only
// git could produce. Nothing in the app could answer "what changed since
// Tuesday", which is the question a daily reader is actually asking.
//
// This keeps a compact snapshot of the figures worth watching, and an
// append-only log of the moves between snapshots. Deliberately not a copy of
// the fixtures: news.json alone is 250KB and carries its own dates, so it
// needs no snapshot. What needs one is anything that is a bare number today
// with no record of what it was yesterday.
//
// The upstream's own change tracking cannot be used for this. market-share
// ships previousEstimate and changePct on every row, and changePct is zero on
// every row because each prior estimate is a copy of the current one.

import { isInvestor } from "@/lib/vendor/is-investor";

export type SignalKind =
  | "vendor_score"
  | "capability_score"
  | "market_share"
  | "narrative_gap";

/** One watched figure, flattened so a diff is a map lookup. */
export interface Signal {
  /** Stable across syncs: kind + subject, and the facet where there is one. */
  key: string;
  kind: SignalKind;
  /** The vendor this belongs to, so a watchlist can filter on it. */
  vendorId: string;
  /** What moved, in words, for the change line. */
  label: string;
  value: number;
}

export interface Snapshot {
  capturedAt: string;
  signals: Record<string, Signal>;
}

export type Direction = "up" | "down";

export interface Change {
  key: string;
  kind: SignalKind;
  vendorId: string;
  label: string;
  from: number;
  to: number;
  delta: number;
  direction: Direction;
  /** The snapshot date this move was detected on. */
  detectedAt: string;
}

export interface ChangeLog {
  /** Newest first. */
  changes: Change[];
}

// Movement below this is rounding, not news. Applied per kind because the
// scales differ: a share point is not a capability point.
const NOISE_FLOOR: Record<SignalKind, number> = {
  vendor_score: 0.05,
  capability_score: 0.05,
  market_share: 0.05,
  narrative_gap: 0.05,
};

const round2 = (n: number) => Math.round(n * 100) / 100;

/** Flattens the fixtures into the watched set. */
export function buildSnapshot(
  capturedAt: string,
  input: {
    vendors?: { id: string; name?: string; overallScore?: unknown }[];
    vendorCapabilities?: {
      vendorId: string;
      capabilityId: string;
      maturityScore?: unknown;
    }[];
    shares?: {
      vendorId: string;
      categoryId: string;
      estimatedShare?: unknown;
    }[];
    gaps?: { vendorId: string; gap?: unknown }[];
  }
): Snapshot {
  const signals: Record<string, Signal> = {};
  const put = (s: Signal) => {
    signals[s.key] = { ...s, value: round2(s.value) };
  };
  const num = (v: unknown): number | null =>
    typeof v === "number" && Number.isFinite(v) ? v : null;

  for (const v of input.vendors ?? []) {
    const n = num(v.overallScore);
    if (n === null) continue;
    put({
      key: `vendor_score:${v.id}`,
      kind: "vendor_score",
      vendorId: v.id,
      label: "overall score",
      value: n,
    });
  }

  for (const c of input.vendorCapabilities ?? []) {
    const n = num(c.maturityScore);
    if (n === null) continue;
    put({
      key: `capability_score:${c.vendorId}:${c.capabilityId}`,
      kind: "capability_score",
      vendorId: c.vendorId,
      label: `${c.capabilityId.replace(/_/g, " ")} capability`,
      value: n,
    });
  }

  for (const s of input.shares ?? []) {
    const n = num(s.estimatedShare);
    if (n === null) continue;
    put({
      key: `market_share:${s.vendorId}:${s.categoryId}`,
      kind: "market_share",
      vendorId: s.vendorId,
      label: `share of ${s.categoryId.replace(/_/g, " ")}`,
      value: n,
    });
  }

  for (const g of input.gaps ?? []) {
    const n = num(g.gap);
    if (n === null) continue;
    put({
      key: `narrative_gap:${g.vendorId}`,
      kind: "narrative_gap",
      vendorId: g.vendorId,
      label: "narrative versus reality gap",
      value: n,
    });
  }

  return { capturedAt, signals };
}

/**
 * What moved between two snapshots.
 *
 * A signal that appears or disappears is not reported as a change. An arrival
 * has no "from" to move from, and a departure usually means the source stopped
 * publishing rather than that anything happened; calling either a move would
 * put noise into the one surface that has to stay trustworthy.
 */
export function diffSnapshots(prev: Snapshot, next: Snapshot): Change[] {
  const out: Change[] = [];
  for (const [key, to] of Object.entries(next.signals)) {
    const from = prev.signals[key];
    if (!from) continue;
    const delta = round2(to.value - from.value);
    if (Math.abs(delta) < NOISE_FLOOR[to.kind]) continue;
    out.push({
      key,
      kind: to.kind,
      vendorId: to.vendorId,
      label: to.label,
      from: from.value,
      to: to.value,
      delta,
      direction: delta > 0 ? "up" : "down",
      detectedAt: next.capturedAt,
    });
  }
  // Largest move first: the reader wants the biggest thing, not the first.
  return out.sort((a, b) => Math.abs(b.delta) - Math.abs(a.delta));
}

/** Newest-first log, capped so the file cannot grow without bound. */
export function appendChanges(
  log: ChangeLog,
  changes: Change[],
  keep = 2000
): ChangeLog {
  return { changes: [...changes, ...log.changes].slice(0, keep) };
}

/** Changes since a moment, optionally narrowed to a watchlist. */
export function changesSince(
  log: ChangeLog,
  sinceIso: string | null,
  watchedVendorIds: string[] | null
): Change[] {
  const watch = watchedVendorIds?.length ? new Set(watchedVendorIds) : null;
  return log.changes.filter((c) => {
    // Investors are never news for a buyer, and this is where that has to be
    // enforced rather than in the panel: every reader of this function is
    // buyer-facing, and the one that was not filtering filled its whole panel
    // with MGX, an investment fund, then wrote procurement advice off the back
    // of it. Applied at read rather than at ingest so a snapshot taken before
    // this existed is also cleaned.
    if (isInvestor(c.vendorId)) return false;
    if (watch && !watch.has(c.vendorId)) return false;
    if (!sinceIso) return true;
    // detectedAt is a date, sinceIso may carry a time; compare on the date so
    // a visit at 09:00 still sees a change stamped that morning.
    return c.detectedAt.slice(0, 10) >= sinceIso.slice(0, 10);
  });
}
