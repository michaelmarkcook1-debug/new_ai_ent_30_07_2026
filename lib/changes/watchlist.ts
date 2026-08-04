import { cookies } from "next/headers";
import { readFileSync, existsSync } from "node:fs";
import path from "node:path";
import { changesSince, type Change, type ChangeLog } from "./snapshot";

// Reading the watchlist on the server, and working out what is new to it.
//
// The watchlist is the shortlist mirrored into a cookie by lib/shortlist.tsx.
// It is not an identity: there is no account, so this personalises the page
// for a browser and can post nothing to anybody. Stated here rather than
// discovered later.

const SHORTLIST_COOKIE = "ag_shortlist";
const LAST_SEEN_COOKIE = "ag_last_seen";

export interface WatchState {
  vendorIds: string[];
  /** ISO date of the previous visit, or null on a first visit. */
  lastSeen: string | null;
}

export async function readWatchState(): Promise<WatchState> {
  const jar = await cookies();
  let vendorIds: string[] = [];
  const raw = jar.get(SHORTLIST_COOKIE)?.value;
  if (raw) {
    try {
      const parsed = JSON.parse(decodeURIComponent(raw));
      if (Array.isArray(parsed)) {
        vendorIds = parsed.filter((x): x is string => typeof x === "string");
      }
    } catch {
      // A corrupt cookie means no watchlist, not a broken page.
    }
  }
  const lastSeen = jar.get(LAST_SEEN_COOKIE)?.value ?? null;
  return { vendorIds, lastSeen: lastSeen && /^\d{4}-\d{2}-\d{2}/.test(lastSeen) ? lastSeen : null };
}

let cachedLog: ChangeLog | null = null;

export function readChangeLog(): ChangeLog {
  if (cachedLog) return cachedLog;
  const p = path.join(process.cwd(), "fixtures", "signal-changes.json");
  if (!existsSync(p)) {
    cachedLog = { changes: [] };
    return cachedLog;
  }
  try {
    cachedLog = JSON.parse(readFileSync(p, "utf8")) as ChangeLog;
  } catch {
    cachedLog = { changes: [] };
  }
  return cachedLog;
}

export interface SinceView {
  /** Moves against watched vendors only. Empty when nothing is watched. */
  watched: Change[];
  /** The largest moves overall, for a reader with no watchlist yet. */
  everything: Change[];
  lastSeen: string | null;
  watchedCount: number;
  /** The most recent date anything moved, so the panel can date itself. */
  latest: string | null;
}

/**
 * What to show at the top of the Pulse.
 *
 * Two lanes on purpose. A reader with a watchlist gets their own vendors, and
 * a reader without one gets the biggest moves in the market plus an invitation
 * to build a list: showing an empty panel to somebody on their first visit
 * teaches them the feature is broken rather than unfilled.
 */
export function buildSinceView(
  log: ChangeLog,
  state: WatchState,
  limit = 6
): SinceView {
  const latest = log.changes[0]?.detectedAt ?? null;
  const watched = state.vendorIds.length
    ? changesSince(log, state.lastSeen, state.vendorIds).slice(0, limit)
    : [];
  return {
    watched,
    everything: changesSince(log, state.lastSeen, null).slice(0, limit),
    lastSeen: state.lastSeen,
    watchedCount: state.vendorIds.length,
    latest,
  };
}
