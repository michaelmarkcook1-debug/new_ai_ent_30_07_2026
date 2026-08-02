// Re-pulls every AIE fixture from the live API and reports what moved.
//
// Two things this deliberately does NOT do:
//
//   1. It does not overwrite a fixture with a payload that is older than the
//      one on disk. The pricing endpoint answers on request but serves a
//      capture dated 2026-06-02 whatever day it is asked, so "re-pull" and
//      "refresh" are not the same thing. Writing an older capture over a newer
//      one because the request succeeded would lose data.
//
//   2. It does not report a sync as successful when the payload came back
//      identical. A source that has not moved is a finding worth printing, not
//      a no-op to hide.
//
// Usage:  node scripts/sync-aie-fixtures.mjs
//         node scripts/sync-aie-fixtures.mjs --dry

import { readFileSync, writeFileSync, existsSync } from "node:fs";
import { createHash } from "node:crypto";

const BASE =
  process.env.AIE_BASE ?? "https://newaient30072026.vercel.app/api/aie";
const DRY = process.argv.includes("--dry");

// fixture file -> endpoint. Fixtures with no endpoint are captured by their own
// script and are listed so the gap is visible rather than silently skipped.
const MAP = {
  "capabilities.json": "capabilities",
  "market-share.json": "market-share",
  "metadata.json": "metadata",
  "news.json": "news?limit=500",
  "pricing.json": "pricing",
  "reputation.json": "reputation",
  "uptake.json": "uptake",
  "vendors.json": "vendors",
};
const NO_ENDPOINT = {
  "cost-capability.json": "captured from the AI Enterprise model inventory",
  "market-dashboard.json": "captured from the AIE dashboard",
  "model-inventory.json": "captured from the AIE model inventory",
};

const hash = (s) => createHash("sha256").update(s).digest("hex").slice(0, 12);
const dateIn = (o) =>
  o?.capturedAt ?? o?.asOf ?? o?.generatedAt ?? o?.provenance?.capturedAt ?? null;

async function getJson(url, tries = 3) {
  for (let i = 0; i < tries; i++) {
    try {
      const r = await fetch(url, { headers: { accept: "application/json" } });
      if (r.ok) return await r.json();
    } catch {
      /* retried */
    }
    await new Promise((r) => setTimeout(r, 600 * (i + 1)));
  }
  return null;
}

const day = (v) => (typeof v === "string" ? v.slice(0, 10) : null);

let changed = 0,
  same = 0,
  failed = 0,
  refused = 0;

for (const [file, endpoint] of Object.entries(MAP)) {
  const path = `fixtures/aie-live/${file}`;
  const before = existsSync(path) ? readFileSync(path, "utf8") : null;
  const beforeObj = before ? JSON.parse(before) : null;

  const fresh = await getJson(`${BASE}/${endpoint}`);
  if (!fresh) {
    console.error(`  FAILED   ${file.padEnd(24)} no answer from ${endpoint}`);
    failed += 1;
    continue;
  }

  const beforeDate = day(dateIn(beforeObj));
  const afterDate = day(dateIn(fresh));

  // Never write an older capture over a newer one.
  if (beforeDate && afterDate && afterDate < beforeDate) {
    console.error(
      `  REFUSED  ${file.padEnd(24)} API serves ${afterDate}, disk holds ${beforeDate}. Keeping disk.`
    );
    refused += 1;
    continue;
  }

  const next = JSON.stringify(fresh, null, 1);
  if (before && hash(before) === hash(next)) {
    console.error(
      `  same     ${file.padEnd(24)} unchanged${afterDate ? ` (capture ${afterDate})` : ""}`
    );
    same += 1;
    continue;
  }

  if (!DRY) writeFileSync(path, next);
  console.error(
    `  UPDATED  ${file.padEnd(24)} ${beforeDate ?? "?"} -> ${afterDate ?? "?"}`
  );
  changed += 1;
}

console.error("");
for (const [file, how] of Object.entries(NO_ENDPOINT)) {
  const path = `fixtures/aie-live/${file}`;
  const d = existsSync(path) ? day(dateIn(JSON.parse(readFileSync(path, "utf8")))) : null;
  console.error(
    `  no endpoint  ${file.padEnd(24)} ${how}${d ? `, holds ${d}` : ""}`
  );
}

console.error(
  `\n${changed} updated, ${same} unchanged, ${refused} refused as older, ${failed} failed${DRY ? "  (dry run, nothing written)" : ""}`
);
