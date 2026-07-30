# AIE_SITE_SCOPE.md

Full pass of the deployed AI Enterprise app at ranking-engine-red.vercel.app,
walked 30 July 2026 (after the demo build). Complements AIE_REUSE_MAP.md,
which audited the source repository snapshot (8 July working copy). The
deployed app has moved past that snapshot in data and in navigation; this
document records what it has today and what that means for the demo.

## What the deployed app contains (walked surface by surface)

| Surface | What it is | Demo counterpart | Gap |
|---|---|---|---|
| Homepage | Live news hero (items 27 to 29 Jul), The Brief (7-day sourced moves), regulatory horizon strip, derived dependency signal, ecosystem navigator embed, newsletter | The Pulse (SAMPLE editorial + BoardRadar delivery card) | Live site's news is real and current; demo's Pulse strip is SAMPLE by design |
| /vendors | 70 vendors ranked within 13 categories, "tiers not precise ranks", buyer-mode nav | Vendor View (43 vendors from the 47-seed roster) | Live universe grew past the snapshot (70 vs 47) |
| /vendors/[slug] | 12-domain evidence scorecard, 0 to 5, re-weightable, exportable | Vendor View profiles (pillar scores, capabilities, edges) | Live adds re-weighting and export |
| /dependencies | Dependency and encroachment graph, 90 source-backed edges, confidence tiers | Ecosystem Navigator (66 edges from the ported snapshot) | Live has 24 more edges plus derived encroachment alerts |
| /alliances | AI vendor x integrator alliance explorer: 14 cited alliances, 21 integrators, 49 channel links, industry filters, interactive canvas | Alliances page (25 partnership/investment edges from exposure map) | Live models the integrator channel explicitly; richer than the ported edges |
| /models | Model inventory with a frontier face-off scored on independent cited benchmarks, "as of 2026-07-24" | Ecosystem Navigator models catalogue; Price/Performance has an honest empty benchmark state | The repo snapshot had NO benchmark data; the deployed app now does |
| /capabilities | 10-capability matrix, 47 vendors, 10,906 verified evidence rows, 52 per cent verified | Vendor profiles capability section (seed matrix, 20 vendors) | Live evidence base is far deeper than the seed |
| /legislation | Register across EU, US federal, CO, CA (three acts), TX, UT, IL, UK and more, cited to primary sources, last verified 10 Jul 2026 | Trust Rank regulatory grid (10 rows, 2 AIE-sourced) | Live register is broader, dated, and primary-sourced |
| /shield | "The Trust Rank / Privacy & IP Shield": four questions (trains on your data, retention, IP indemnity, residency) quoted from vendor terms, buyer-re-weightable | Demo Trust Rank is governance posture + regulatory grid | Different concept under the same name; the live Trust Rank is a terms-of-service receipt table |
| /assess + /assessment | Three depth tiers (Opportunity, Strategy, Procurement), six pillars with dynamic weights, E0 to E5 evidence grading, branded "AG AnalystGenius proprietary methodology", 49 scored vendors | Assess and Decide (4-dimension weighted framework per the BoardRadar schema) | Live is the fuller product; demo mirrors the BoardRadar schema per spec |
| /interrogate and /use-cases ("Start here") | Adaptive questioning that ends in a tailored source-cited finding | AI Analyst (grounded chat) | Similar promise; live version is adaptive-question-first |
| /peers | "What are enterprises like mine doing": cohort adoption benchmarks by segment | Market View (uptake explorer) | Overlapping; live adds ahead/behind cohort framing |
| /news | Decision feed: impact, confidence, pillar impact, why it matters; 9 connectors (GDELT, RSS, SEC 8-K, newsletters, benchmark orgs) | News page (30-item April-May AIE seed + live BoardRadar company news) | Live feed is current and enriched; seed is stale by its own labels |
| /monitor, /watchlists | Private shortlist watch + watchlist builder with alerts | Not in demo (not in the memo IA) | Optional future module |
| /briefings, /demonstrate | Executive briefing generator; CIO Board Defence packs (board, procurement, risk) | Not in demo (out of memo scope) | Candidate for a future phase |
| /investor-tools, /atlas, /dashboard, /quadrant, /understand | Investor workflows, atlas map, exec dashboard, strategic quadrant | Deliberately absent | The live app's quadrant language is its own; spec rule 5 forbids it in AG surfaces, and the demo complies |

## Public API routes on the deployment (probed 30 July 2026)

- `GET /api/news` returns 200: real sourced items, current same-day (a
  Bloomberg item published 30 Jul 19:20 UTC), each with sourceKind "real",
  impactScore, confidenceScore, vendor tags.
- `GET /api/vendors` returns 200: full vendor registry with categories,
  industries, use cases.
- Also present in the codebase and worth probing on demand: /api/rank,
  /api/market-share, /api/model-inventory, /api/reputation, /api/uptake,
  /api/pricing, /api/capabilities, /api/market-dashboard.
- Admin surfaces (/admin/*) exist and were NOT entered.

## What this means for the demo

The demo faithfully mirrors the repository snapshot, exactly as the spec
directed (source-level re-use first). The deployed app has since moved:
bigger universe (70 ranked vendors), a benchmark dataset that did not exist
in the snapshot, a primary-sourced legislation register, a richer alliance
registry, and a live news pipeline. Three upgrade paths, in preference
order per the spec:

1. **Refresh the port from a current checkout.** If Michael supplies an
   up-to-date clone (the stray copy is 8 July), re-run the port: roster,
   edges, benchmarks, legislation register, alliances registry.
2. **Proxy the public API routes as a secondary live source.** The spec
   explicitly permits this. Wiring /api/news through our proxy would make
   the News page and the Pulse strip genuinely current; /api/rank and
   /api/model-inventory could refresh rankings and benchmarks. Needs a
   whitelist extension and provenance badging ("AIE live" as a lane).
3. **Leave as is.** The demo is honest about its dataset vintage today;
   nothing is misrepresented.

Decision left to Michael; nothing was changed in the demo as part of this
scoping pass.
