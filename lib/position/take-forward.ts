import type { RoleColumn } from "./role-fit";

// Which opportunities the reader has taken forward, and who they said owns them.
//
// WHERE THIS LIVES AND WHY. The same place saved positions live: this browser,
// under localStorage. `store.ts` sets out the reasoning and it applies
// unchanged here. There is no user identity in this product beyond a shared
// demo credential, so a server-side store would be one shared drawer that every
// reader writes into, and your take-forward list would be whoever looked last.
//
// SEPARATE KEY FROM THE SAVED POSITION, deliberately. `ag_positions_v1` is
// capped at eight entries and holds the research itself; a reader who researches
// nine companies loses the oldest, and losing their ownership decisions with it
// would be a different and worse loss. Keyed by the position it belongs to so
// two companies never share a take-forward list.
//
// ONLY THE OVERRIDE IS STORED. The recommendation is recomputed from the
// workflow every time, because it is derived from the catalogue rather than
// chosen by the reader, and a stored recommendation would go stale silently the
// moment the catalogue moved. What is stored is the fact that the reader took
// the area forward, and any role they picked instead of the recommended one.

const KEY = "ag_take_forward_v1";

/** What the reader decided about one opportunity. */
export interface TakeForwardEntry {
  takeForward: boolean;
  /** Only where the reader overrode the recommendation. */
  roles: Partial<Record<RoleColumn, string>>;
}

/** Keyed by position, then by the workflow's own catalogue id. */
type Store = Record<string, Record<string, TakeForwardEntry>>;

/**
 * Fired on every write, so a sibling component showing this state can refresh.
 *
 * The same mechanism `store.ts` uses, and for the same reason: components that
 * read once on mount and never learn the value changed go on showing something
 * that is no longer true. That has now been fixed twice in this codebase, so
 * this one ships with the event rather than acquiring it later.
 */
export const TAKE_FORWARD_CHANGED = "ag:take-forward-changed";

function read(): Store {
  if (typeof window === "undefined") return {};
  try {
    const raw = window.localStorage.getItem(KEY);
    if (!raw) return {};
    const parsed = JSON.parse(raw);
    return parsed && typeof parsed === "object" ? (parsed as Store) : {};
  } catch {
    // Blocked, full, or holding something this version cannot read. A reader
    // with no take-forward state is a working reader.
    return {};
  }
}

function write(next: Store): boolean {
  if (typeof window === "undefined") return false;
  try {
    window.localStorage.setItem(KEY, JSON.stringify(next));
  } catch {
    return false;
  }
  try {
    window.dispatchEvent(new Event(TAKE_FORWARD_CHANGED));
  } catch {
    // No listeners will hear it. The write still stands.
  }
  return true;
}

/** Everything decided for one company. Empty when nothing has been. */
export function entriesFor(positionKey: string): Record<string, TakeForwardEntry> {
  return read()[positionKey] ?? {};
}

export function entryFor(
  positionKey: string,
  opportunityId: string
): TakeForwardEntry {
  return (
    entriesFor(positionKey)[opportunityId] ?? { takeForward: false, roles: {} }
  );
}

/**
 * Take an opportunity forward, or stop.
 *
 * Deselecting keeps the entry rather than deleting it, so the roles a reader
 * chose survive a collapse and are still there if they expand it again. The
 * opportunity itself is never touched: it is derived from the catalogue and
 * this store has no opinion about which areas exist.
 */
export function setTakeForward(
  positionKey: string,
  opportunityId: string,
  takeForward: boolean
): boolean {
  const all = read();
  const forPosition = { ...(all[positionKey] ?? {}) };
  const held = forPosition[opportunityId] ?? { takeForward: false, roles: {} };
  forPosition[opportunityId] = { ...held, takeForward };
  return write({ ...all, [positionKey]: forPosition });
}

/** Record a role the reader picked instead of the recommended one. */
export function setRole(
  positionKey: string,
  opportunityId: string,
  column: RoleColumn,
  role: string
): boolean {
  const all = read();
  const forPosition = { ...(all[positionKey] ?? {}) };
  const held = forPosition[opportunityId] ?? { takeForward: true, roles: {} };
  forPosition[opportunityId] = {
    ...held,
    roles: { ...held.roles, [column]: role },
  };
  return write({ ...all, [positionKey]: forPosition });
}

/** How many areas are being taken forward for this company. */
export function takenForwardCount(positionKey: string): number {
  return Object.values(entriesFor(positionKey)).filter((e) => e.takeForward)
    .length;
}
