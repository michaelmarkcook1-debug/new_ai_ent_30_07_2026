// Captures a dated snapshot of the reputation pillar scores.
//
// The reputation API publishes current values only, with no history. There is
// therefore no way to draw a trend line today that is not invented. The fix is
// not a cleverer derivation, it is time: capture the real scores on a schedule
// and the history accumulates honestly from the first run.
//
// Append-only and idempotent per day. Re-running on the same date replaces
// that date's snapshot rather than stacking duplicates, so a re-run after a
// failed pull is safe.
//
// Usage: node scripts/capture-reputation.mjs

import { readFileSync, writeFileSync, existsSync } from "node:fs";

const API = "https://ranking-engine-red.vercel.app/api/reputation";
const OUT = new URL("../fixtures/reputation-snapshots.json", import.meta.url);

const res = await fetch(API, {
  headers: { "User-Agent": "AI Enterprise reputation capture" },
});
if (!res.ok) {
  console.error(`upstream returned ${res.status}; nothing captured`);
  process.exit(1);
}
const payload = await res.json();
const rows = payload.rows ?? [];
if (!rows.length) {
  console.error("upstream returned no rows; nothing captured");
  process.exit(1);
}

const num = (v) => (typeof v === "number" ? v : null);
const mean = (a) => {
  const v = a.filter((n) => typeof n === "number");
  return v.length ? Math.round((v.reduce((x, y) => x + y, 0) / v.length) * 10) / 10 : null;
};

const vendors = rows.map((r) => {
  const customer = num(r.customer?.overall);
  const developer = num(r.developer?.overall);
  const employee = num(r.employee?.overall);
  return {
    vendorId: r.vendorId,
    customer,
    developer,
    employee,
    overall: mean([customer, developer, employee]),
  };
});

const capturedAt = new Date().toISOString().slice(0, 10);
const snapshot = {
  capturedAt,
  // The dataset's own as-of stamp, which can lag the capture date. Both are
  // kept: one says when we looked, the other when the source last moved.
  sourceAsOf: payload.asOf ?? null,
  provenance: payload.provenance ?? null,
  vendorCount: vendors.length,
  vendors,
};

const existing = existsSync(OUT)
  ? JSON.parse(readFileSync(OUT, "utf8"))
  : {
      metric: "Reputation pillar scores (customer, developer, employee), captured over time",
      provenance:
        "Dated snapshots of the AI Enterprise reputation pillars. The upstream API publishes current values only and no history, so this file IS the history: it starts at the first capture and grows on each run. Nothing is back-projected.",
      source: "ranking-engine-red.vercel.app/api/reputation",
      snapshots: [],
    };

const kept = (existing.snapshots ?? []).filter((s) => s.capturedAt !== capturedAt);
kept.push(snapshot);
kept.sort((a, b) => a.capturedAt.localeCompare(b.capturedAt));
existing.snapshots = kept;

writeFileSync(OUT, JSON.stringify(existing, null, 1));

const scored = vendors.filter((v) => v.overall !== null).length;
console.error(
  `captured ${capturedAt}: ${vendors.length} vendors (${scored} with a score). ` +
    `history now ${kept.length} snapshot${kept.length === 1 ? "" : "s"}: ${kept.map((s) => s.capturedAt).join(", ")}`
);
