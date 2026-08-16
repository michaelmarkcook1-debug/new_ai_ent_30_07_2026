// The pages that author an analyst reading.
//
// One list, read by both the post-deploy script and the cron, because the two
// drifting apart is the failure that would leave a page cold for a day without
// anybody noticing. scripts/warm-insights.mjs is plain JS and cannot import
// this, so it holds the same list with a comment pointing here; the test in
// tests/warm-list.test.ts fails if the two ever disagree.
//
// Kept as a list rather than derived from the routes, so a page that stops
// authoring drops off it deliberately rather than silently.
export const WARM_PAGES = [
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
] as const;
