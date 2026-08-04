// The ingestion function.
//
// Runs every tracked vendor through EDGAR, assembles a snapshot with the
// provenance attached, and reports what it could NOT resolve. The last part
// is the point: a vendor whose search fails is listed in `failed` with the
// reason, never dropped so the remaining rows look complete.
//
// Throttled deliberately. SEC fair access asks for under ten requests a
// second and the whole run is eight requests, so a 250ms gap is polite and
// costs two seconds. Requests are sequential rather than parallel for the
// same reason: a burst of eight is the shape that gets a caller blocked.

import { fetchDisclosure } from "./edgar";
import { SEC_EDGAR, TRACKED_VENDORS } from "./sources";
import type { DisclosureRow, DisclosureSnapshot } from "./types";

const THROTTLE_MS = 250;

const MEASURES =
  "Registrants naming each vendor in the stated SEC filing type, within the stated window. A count of disclosures, not of customers and not market share.";

const WINDOW_DAYS = 365;

const sleep = (ms: number) => new Promise((r) => setTimeout(r, ms));

export interface IngestReport {
  snapshot: DisclosureSnapshot;
  attempted: number;
  succeeded: number;
  failed: number;
  durationMs: number;
}

/**
 * Build a disclosure snapshot for one form type.
 *
 * Never throws for a single vendor's failure: one dead request must not cost
 * the whole run. It throws only if every vendor failed, because a snapshot of
 * nothing should not be written over a good one.
 */
export async function ingestDisclosure(
  formType = "10-K",
  windowDays = WINDOW_DAYS
): Promise<IngestReport> {
  const startedAt = Date.now();
  const rows: DisclosureRow[] = [];
  const failed: { vendor: string; reason: string }[] = [];

  for (const [i, v] of TRACKED_VENDORS.entries()) {
    if (i > 0) await sleep(THROTTLE_MS);
    const out = await fetchDisclosure(v.term, v.vendor, formType, windowDays);
    if (out.ok && out.records[0]) {
      rows.push(out.records[0]);
    } else {
      failed.push({
        vendor: v.vendor,
        reason: out.error ?? `status ${out.status}`,
      });
    }
  }

  if (rows.length === 0) {
    throw new Error(
      `Ingestion produced no rows for ${formType}: ${failed
        .map((f) => `${f.vendor} (${f.reason})`)
        .join("; ")}`
    );
  }

  rows.sort((a, b) => b.filings - a.filings);

  return {
    snapshot: {
      measures: MEASURES,
      formType,
      window: `last ${windowDays} days`,
      fetchedAt: new Date().toISOString(),
      rows,
      failed,
      source: SEC_EDGAR,
    },
    attempted: TRACKED_VENDORS.length,
    succeeded: rows.length,
    failed: failed.length,
    durationMs: Date.now() - startedAt,
  };
}
