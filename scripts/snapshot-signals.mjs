// Records what the watched figures are today, and what moved since last time.
//
// Run it after scripts/sync-aie-fixtures.mjs. The sync overwrites the fixtures,
// so this must read them in the same pass or the movement is lost: before this
// existed, the only record that a score had changed was the git diff.
//
// Writes two files:
//   fixtures/signal-snapshot.json  the current value of every watched figure
//   fixtures/signal-changes.json   an append-only, newest-first log of moves
//
// Usage:  node scripts/snapshot-signals.mjs
//         node scripts/snapshot-signals.mjs --dry

import { readFileSync, writeFileSync, existsSync } from "node:fs";
import { buildSnapshot, diffSnapshots, appendChanges } from "../lib/changes/snapshot.ts";

const DRY = process.argv.includes("--dry");
const SNAP = "fixtures/signal-snapshot.json";
const LOG = "fixtures/signal-changes.json";

const read = (p, fallback) =>
  existsSync(p) ? JSON.parse(readFileSync(p, "utf8")) : fallback;

const vendors = read("fixtures/aie-live/vendors.json", { vendors: [] }).vendors ?? [];
const caps = read("fixtures/aie-live/capabilities.json", {});
const shares = read("fixtures/aie-live/market-share.json", { estimates: [] }).estimates ?? [];
const gaps = read("fixtures/narrative-reality-gap.json", { vendors: [] }).vendors ?? [];

// The capture date comes from the data, not the clock: re-running this on a
// day the sources did not move must not invent a new dated entry.
const capturedAt =
  (read("fixtures/aie-live/vendors.json", {}).asOf ?? "").slice(0, 10) ||
  new Date().toISOString().slice(0, 10);

const next = buildSnapshot(capturedAt, {
  vendors,
  vendorCapabilities: caps.vendorCapabilities ?? [],
  shares,
  gaps,
});

const prev = read(SNAP, null);
const log = read(LOG, { changes: [] });

if (!prev) {
  console.log(
    `no previous snapshot: recording ${Object.keys(next.signals).length} signals as the baseline.`
  );
  console.log("nothing to diff against yet. Movement starts from the next run.");
  if (!DRY) writeFileSync(SNAP, JSON.stringify(next, null, 1));
  process.exit(0);
}

if (prev.capturedAt === next.capturedAt) {
  console.log(
    `sources still report ${next.capturedAt}; nothing new to snapshot. Re-run after a sync that moves the capture date.`
  );
  process.exit(0);
}

const changes = diffSnapshots(prev, next);
const byKind = changes.reduce((acc, c) => {
  acc[c.kind] = (acc[c.kind] ?? 0) + 1;
  return acc;
}, {});

console.log(`\n${prev.capturedAt} -> ${next.capturedAt}`);
console.log(
  `  ${Object.keys(next.signals).length} signals watched, ${changes.length} moved\n`
);
for (const [kind, n] of Object.entries(byKind)) {
  console.log(`  ${kind.padEnd(18)} ${n}`);
}
console.log("\n  largest moves:");
for (const c of changes.slice(0, 8)) {
  const arrow = c.direction === "up" ? "+" : "";
  console.log(
    `    ${c.vendorId.padEnd(14)} ${c.label.padEnd(30)} ${c.from} -> ${c.to}  (${arrow}${c.delta})`
  );
}

if (DRY) {
  console.log("\n  dry run, nothing written");
} else {
  writeFileSync(SNAP, JSON.stringify(next, null, 1));
  writeFileSync(LOG, JSON.stringify(appendChanges(log, changes), null, 1));
  console.log(`\n  wrote ${SNAP} and ${LOG}`);
}
