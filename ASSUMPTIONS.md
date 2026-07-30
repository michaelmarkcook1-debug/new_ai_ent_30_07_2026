# ASSUMPTIONS.md

Assumptions and decisions logged instead of stopping to ask (spec rule 8).
Dates are absolute; the build day is 30 July 2026.

1. **Repository location.** "Create the new-ai-ent-demo repository here"
   was read as: initialise git in the working directory
   `~/new ai ent 30_07_2026` (which was empty) with the package named
   `new-ai-ent-demo`, rather than nesting a subfolder. The Vercel project
   `new_ai_ent_30_07_2026` is noted but untouched: hard rule 2 forbids any
   deployment until Michael explicitly says so.
2. **Ranking-engine source.** `../ranking-engine` does not exist. The spec
   allows Michael to supply a path or a zip; the machine holds two identical
   zips (5 June 2026) and a newer full working copy at
   `~/Documents/Dev Projects/_archive/ranking-engine-stray-copy-2026-07-08`.
   The newer working copy was used as the read-only source and recorded in
   `.env.local` as `RANKING_ENGINE_REPO_PATH`. Its `.env*` files were never
   opened; no secrets were copied.
3. **English variants.** Spec rule 7 mandates British English; Michael's
   build instruction mandates American English for everything including
   commit messages, reports and code comments. Resolution: British English
   for all product copy, UI strings and user-facing docs (README, demo
   script); American English for commit messages, progress reports and code
   comments. Flagged in the first progress report.
4. **Basic auth continuation cookie.** Browsers do not reliably replay
   Basic credentials on client-side fetch() calls, so after one successful
   Basic handshake the middleware sets an httpOnly cookie carrying the same
   base64 token the header carried. It grants nothing the header did not.
5. **Meta and NVIDIA coverage.** The probe shows META and NVDA resolve on
   financial snapshot endpoints only (any public ticker resolves) and 404 on
   universe-scoped endpoints. They are treated as LIVE for financials and
   SAMPLE or empty-state elsewhere, and are excluded from claims about the
   BoardRadar company universe.
6. **Vendor roster and layers.** TRACKED_VENDORS derives from the ported
   47-vendor AIE seed roster. Pure investors (softbank, a16z, sequoia, mgx)
   are excluded from rankable vendors and exported as ECOSYSTEM_ONLY for the
   ecosystem map. Layer mapping documented in lib/aie/vendors.ts.
7. **Cold endpoints.** financial-snapshot/overview, ai-exposure and
   ai-platform/integration can exceed the mandated 12 second proxy timeout
   on a cold first call. Behaviour kept per spec (12s, one retry, then
   fixture fallback with "Cached sample" badge) rather than raising the
   timeout.
8. **AIE news staleness.** The ranking-engine news seed is explicitly
   mock-labelled by its own repo and stale beyond June 2026. It is shown as
   the AIE dataset with its native labels and dates, never as current live
   news; the live BoardRadar news feed covers universe companies only.
9. **Anthropic API key.** ANTHROPIC_API_KEY is empty in .env.local, so the
   AI Analyst ships in scripted sample mode with badged canned answers, per
   Section 8. Adding a key switches it live without code changes.
10. **Sample content policy.** SAMPLE-badged narrative content (headlines,
    insight titles) is written to be plausible and clearly illustrative; no
    real-world measurement, benchmark or financial figure is stated in
    SAMPLE content. Real figures appear only in live BoardRadar payloads or
    AIE dataset rows with their own provenance.
