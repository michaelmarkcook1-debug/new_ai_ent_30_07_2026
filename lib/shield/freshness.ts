// Is the Shield's verification still current?
//
// ORIGIN. Ported 5 August 2026 from the-desk/lib/freshness.ts (commit b9bb51c),
// read-only and unmodified at source.
//
// The Shield's marks are read from vendors' own legal documents: terms of
// service, DPAs, privacy policies. There is no API to poll, so this data can
// never be "live" the way a price feed or a status page is, and badging it
// LIVE would be a lie. What can honestly be live is the clock. This computes
// elapsed days since the last verification pass against the real current date
// on every request, with no manual upkeep. It never re-derives a legal fact.
// It only says how much to trust the age of one, and states plainly when a
// human re-check is due.
//
// That distinction is the reason the CITED lane exists in lib/provenance.ts:
// the reader is told what the vendor wrote, where to check it, and how long
// ago somebody last looked.

export type FreshnessStatus = "fresh" | "due" | "overdue";

export interface Freshness {
  /** ISO yyyy-mm-dd, the last full verification pass. */
  verifiedDate: string;
  daysAgo: number;
  status: FreshnessStatus;
  label: string;
}

const FRESH_DAYS = 30; // enterprise ToS and DPA terms rarely move faster
const DUE_DAYS = 60;

/** SHIELD_VERSION carries a trailing same-day-pass letter ("2026-07-14b"), so
 *  strip it back to the date the verification pass actually ran. */
function versionDate(version: string): string {
  return version.slice(0, 10);
}

export function shieldFreshness(version: string, now: Date): Freshness {
  const verifiedDate = versionDate(version);
  const [y, m, d] = verifiedDate.split("-").map(Number);
  const then = Date.UTC(y, m - 1, d);
  const today = Date.UTC(
    now.getUTCFullYear(),
    now.getUTCMonth(),
    now.getUTCDate()
  );
  const daysAgo = Math.max(0, Math.round((today - then) / 86_400_000));

  const status: FreshnessStatus =
    daysAgo <= FRESH_DAYS ? "fresh" : daysAgo <= DUE_DAYS ? "due" : "overdue";
  const label =
    daysAgo === 0
      ? "verified today"
      : status === "overdue"
        ? `verified ${daysAgo} days ago, re-check overdue`
        : status === "due"
          ? `verified ${daysAgo} days ago, re-check due soon`
          : `verified ${daysAgo} days ago`;

  return { verifiedDate, daysAgo, status, label };
}
