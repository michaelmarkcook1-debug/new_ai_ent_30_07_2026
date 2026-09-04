#!/usr/bin/env node
// Warm the analyst cache after a deploy, so the first real visitor does not.
//
// The authored insight is cached in Vercel's Data Cache, which is shared
// across instances but keyed partly on the build id. Every deploy therefore
// empties it, and the next person to open a page pays for a full Opus call
// before the first byte: measured between 8 and 30 seconds on production.
//
// This walks the pages that author a reading and absorbs that cost on our
// side. It is not an optimisation, it is moving a cost from the reader to the
// deploy, which is where it belongs.
//
// Usage:  node scripts/warm-insights.mjs [baseUrl]
// Runs after `vercel --prod`. Safe to run at any time and safe to run twice.

const BASE = process.argv[2] ?? "https://newaient30072026.vercel.app";

// Every page that calls authorInsight, plus the Pulse, which authors its own
// hero. Kept as a list rather than derived: a page that stops authoring should
// drop off this list deliberately, not silently.
//
// MIRRORS lib/analyst/warm-list.ts, which the /api/warm cron reads. This file
// is plain JS and cannot import a TypeScript module, so the list lives twice.
// tests/warm-list.test.ts fails if the two ever disagree.
const PAGES = [
  "/pulse",
  "/trust-rank",
  "/news-feed",
  "/vendor-view",
  "/financial-snapshot",
  "/market-watch",
  "/competitive-intel",
  "/reputation-tracker",
  "/alliances",
  "/price-performance",
  "/peer-insights",
];

// One at a time. Firing eleven Opus calls at once would race the same cold
// instances and could trip an upstream rate limit, which is a worse outcome
// than taking a minute over it.
const results = [];
for (const path of PAGES) {
  const started = Date.now();
  try {
    const res = await fetch(`${BASE}${path}`, {
      headers: { "user-agent": "aie-cache-warmer" },
      // Generous: a cold authored page is the thing being paid for here. The
      // dynamic pages author at warm time, and on Fable 5.1 news-feed took 52
      // seconds cold on an idle machine (4 September 2026), so 60 would abort
      // it under any load. 150 covers Today's Pulse authoring its three
      // readings and a retry.
      signal: AbortSignal.timeout(150_000),
    });
    results.push({ path, status: res.status, ms: Date.now() - started });
  } catch (e) {
    results.push({
      path,
      status: "failed",
      ms: Date.now() - started,
      error: e instanceof Error ? e.message : String(e),
    });
  }
}

let slowest = 0;
for (const r of results) {
  slowest = Math.max(slowest, r.ms);
  const secs = (r.ms / 1000).toFixed(1).padStart(5);
  console.log(
    `  ${String(r.status).padEnd(6)} ${secs}s  ${r.path}${r.error ? `  ${r.error}` : ""}`
  );
}

const failed = results.filter((r) => r.status !== 200);
console.log(
  `\n  ${results.length - failed.length}/${results.length} warmed, slowest ${(slowest / 1000).toFixed(1)}s`
);

// A failure here is worth surfacing but is not worth failing a deploy over:
// the page still works, it is just slow for whoever opens it first.
if (failed.length > 0) {
  console.log(`  ${failed.length} did not warm; those pages stay cold.`);
}
