// Seeds three ILLUSTRATIVE prior quarters onto the reputation history, so the
// trend chart can be demonstrated before real captures have accumulated.
//
// These are invented. Nothing else in this app invents a figure, so they are
// marked at every level that could carry them into a chart:
//   - each snapshot has synthetic: true
//   - the file records demoQuarters so the UI can count them
//   - the chart renders them dashed, behind a SAMPLE badge, and says which
//     points are real
//
// Real captures are never touched: this only prepends quarters BEFORE the
// earliest real one, and refuses to run if that would collide.
//
// Usage:  node scripts/seed-demo-reputation-history.mjs
// Undo:   node scripts/seed-demo-reputation-history.mjs --clear

import { readFileSync, writeFileSync } from "node:fs";

const OUT = new URL("../fixtures/reputation-snapshots.json", import.meta.url);
const data = JSON.parse(readFileSync(OUT, "utf8"));
const clear = process.argv.includes("--clear");

const real = (data.snapshots ?? []).filter((s) => !s.synthetic);
if (real.length === 0) {
  console.error("no real capture to anchor on; run capture-reputation.mjs first");
  process.exit(1);
}

if (clear) {
  data.snapshots = real;
  delete data.demoQuarters;
  writeFileSync(OUT, JSON.stringify(data, null, 1));
  console.error(`cleared demo quarters; ${real.length} real snapshot(s) remain`);
  process.exit(0);
}

const anchor = real[0];
const QUARTERS = ["2025-10-31", "2026-01-31", "2026-04-30"];

// Deterministic drift so the file does not churn on every run, and so the
// shape is reproducible. Vendors trend gently upward toward today's real
// figure, which is what a demo wants to show, and each vendor drifts at its
// own rate rather than all moving in lockstep.
function seeded(str) {
  let h = 2166136261;
  for (let i = 0; i < str.length; i++) {
    h ^= str.charCodeAt(i);
    h = Math.imul(h, 16777619);
  }
  return ((h >>> 0) % 1000) / 1000;
}

const clamp = (v) => Math.max(0, Math.min(100, Math.round(v * 10) / 10));

const synthetic = QUARTERS.map((capturedAt, qi) => {
  // Furthest-back quarter sits lowest; each step closes part of the gap.
  const stepsBack = QUARTERS.length - qi;
  return {
    capturedAt,
    synthetic: true,
    sourceAsOf: null,
    provenance:
      "ILLUSTRATIVE SAMPLE. Invented for demonstration; not a captured reading.",
    vendorCount: anchor.vendors.length,
    vendors: anchor.vendors.map((v) => {
      const wobble = seeded(v.vendorId + capturedAt) - 0.5;
      const drop = (base) =>
        base === null ? null : clamp(base - stepsBack * (1.1 + wobble * 1.4));
      const customer = drop(v.customer);
      const developer = drop(v.developer);
      const employee = drop(v.employee);
      const vals = [customer, developer, employee].filter((n) => n !== null);
      return {
        vendorId: v.vendorId,
        customer,
        developer,
        employee,
        overall: vals.length
          ? Math.round((vals.reduce((a, b) => a + b, 0) / vals.length) * 10) / 10
          : null,
      };
    }),
  };
});

const collision = synthetic.find((s) =>
  real.some((r) => r.capturedAt <= s.capturedAt)
);
if (collision) {
  console.error(
    `refusing to seed: ${collision.capturedAt} is not earlier than the first real capture (${real[0].capturedAt})`
  );
  process.exit(1);
}

data.snapshots = [...synthetic, ...real].sort((a, b) =>
  a.capturedAt.localeCompare(b.capturedAt)
);
data.demoQuarters = synthetic.length;
writeFileSync(OUT, JSON.stringify(data, null, 1));

console.error(
  `seeded ${synthetic.length} illustrative quarters (${QUARTERS.join(", ")}) ` +
    `before the real capture ${real[0].capturedAt}. Undo with --clear.`
);
