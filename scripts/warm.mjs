#!/usr/bin/env node
// Manual analyst warm. A person runs it; nothing else ever does.
//
// WHAT IT IS FOR. An analyst reading is authored inside a page render and
// cached under its evidence and authoring contract (lib/analyst/llm.ts). When
// either changes there is no entry to serve and the next request pays a full
// Fable 5.1 call before the first byte, about 42 seconds. After a release that
// changes the contract, every page is in that state. This lets a person pay
// that cost on purpose, all at once, instead of leaving it to whoever opens a
// page next.
//
// WHY THERE IS NO SCHEDULE. Until 6 September 2026 a Vercel cron did this
// twice a day. The owner's instruction is that analyst warming must never run
// because the clock reached a time, so the cron, its route and its secret are
// gone. This script is the only warm entry point and it does nothing until a
// person passes --yes.
//
// WHAT IT COSTS. One Fable 5.1 reading per page whose reading is not current
// (Today's Pulse is three). A page whose reading IS current is served from
// cache in under a second and calls no model, so running this against a warm
// site costs nothing.
//
// Usage:  npm run warm            shows the plan and stops
//         npm run warm -- --yes   warms
//         npm run warm -- --yes https://some-other-origin

import { runWarm, WARM_CONCURRENCY, WARM_PAGE_TIMEOUT_MS } from "@/lib/analyst/warm";
import { WARM_PAGES } from "@/lib/analyst/warm-list";

const args = process.argv.slice(2);
const yes = args.includes("--yes");
const origin = args.find((a) => a.startsWith("http")) ?? "https://newaient30072026.vercel.app";

console.log(`Manual analyst warm against ${origin}`);
console.log(`  targets: ${WARM_PAGES.length}`);
for (const p of WARM_PAGES) console.log(`    ${p}`);
console.log(`  concurrency ${WARM_CONCURRENCY}, up to ${WARM_PAGE_TIMEOUT_MS / 1000}s per page`);
console.log(
  "  cost: one Fable 5.1 reading per page whose reading is not current (Today's Pulse is three); a current page costs nothing"
);

if (!yes) {
  console.log("\nNothing fetched. This never runs on a schedule. To warm now:\n  npm run warm -- --yes");
  process.exit(0);
}

// Forwarded only when the demo gate is on in this environment; nothing is
// read from anywhere else and nothing is printed.
const user = process.env.DEMO_USER;
const pass = process.env.DEMO_PASS;
const pageHeaders =
  user && pass
    ? { authorization: `Basic ${Buffer.from(`${user}:${pass}`).toString("base64")}` }
    : undefined;

console.log("\nWarming...");
const report = await runWarm({ origin, pageHeaders, budgetMs: 30 * 60_000 });

for (const r of report.results) {
  console.log(
    `  ${r.outcome.padEnd(10)} ${String(r.status ?? "-").padEnd(4)} ${(r.ms / 1000).toFixed(1).padStart(6)}s  ${r.path}`
  );
}
console.log(
  `\n  ${report.success ? "COMPLETE" : "PARTIAL"}: requested ${report.requested}, authored ${report.authored}, cached ${report.cached}, fallback ${report.fallback}, failed ${report.failed}, timed out ${report.timedOut}, remaining ${report.remaining}` +
    (report.remainingPaths.length ? ` (${report.remainingPaths.join(", ")})` : "") +
    `, ${(report.totalMs / 1000).toFixed(1)}s`
);
process.exit(report.success ? 0 : 1);
