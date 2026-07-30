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
10. **Em-dash sanitisation of ported files.** The ranking-engine source
    files contain em-dashes in comments and data strings; spec rule 7 bans
    em-dashes anywhere and some of those strings render in the UI. All
    em-dashes in lib/aie/ were replaced with commas or colons by a scripted
    transformation on 30 July 2026. This is typography only; no words,
    figures or labels were altered. Recorded BoardRadar responses in
    fixtures/br/ were NOT modified (they are evidence and pass through
    untouched); the ordinary English word "peak" appearing inside recorded
    upstream text is not the competitor framework name and is left as is.
11. **Module-level decisions from the parallel build (Phases 3 and 4).**
    - Vendor View column labels are the AIE dataset's literal field names
      (overallScore, business_fit, enterprise_control and so on) with human
      labels in hover titles; cross-dataset id schemes are bridged by
      documented alias maps in the module data adapters.
    - Where an AIE sub-dataset covers only part of the 43-vendor roster
      (capabilities 20 vendors, uptake 13 providers, reputation 29), the
      uncovered vendors render honest empty states and the on-screen counts
      are computed from the data, never hard-coded.
    - The AIE news seed is shown against its own dataset window (April to
      May 2026) with its native mock/seed labels; timeframe filters anchor
      to the window end, not today.
    - The Alliances page reads "partnership" as the dataset's
      commercial_partnership edge type; other edge types stay on the
      dependency views.
    - The Trust Rank vendor lens maps rulings by layer only (frontier gets
      EU GPAI obligations, infrastructure gets chip export controls);
      other layers state plainly that no vendor-specific ruling is
      recorded.
    - The competitive heatmap fixture was generated by a script that
      derives category averages arithmetically from its own cells, so no
      derived figure can disagree with its inputs.
    - Cyber risk score polarity is not documented by the API, so the score
      renders exactly as returned with the derivation drawer saying so.
12. **Sample content policy.** SAMPLE-badged narrative content (headlines,
    insight titles) is written to be plausible and clearly illustrative; no
    real-world measurement, benchmark or financial figure is stated in
    SAMPLE content. Real figures appear only in live BoardRadar payloads or
    AIE dataset rows with their own provenance.

13. **AIE live linkage (30 July 2026).** The deployed AI Enterprise app at
    ranking-engine-red.vercel.app exposes public JSON APIs, and the spec
    permits proxying them as a secondary source. A second proxy at
    `/api/aie/[...path]` (GET only, ten-path whitelist, 300 second cache,
    12 second timeout, one retry, recorded fixtures in
    `fixtures/aie-live/`) now serves them, and a new `aie-live` lane badge
    ("AIE live") marks that content. No credentials are involved: the
    upstream routes are public. Wired live: The Pulse news strips, the
    News page's live feed, Market Watch category shares and the winning
    and losing read, Reputation Tracker's three pillars, Price and
    Performance token pricing, Market View uptake, and the Assess and
    Decide pillar strip. Every one keeps its previous source as an
    explicit fallback, so a failed pull degrades to the ported dataset or
    a Cached sample badge rather than an empty screen.
14. **Assess and Decide promoted to its own tab.** It now sits in the
    sidebar under AI and Your Company with the three depth tiers of the
    deployed app (Opportunity, Strategy, Procurement), adjustable
    weights, and the live six-pillar methodology strip. The old path
    `/company-view/assess` redirects so no existing link dead-ends, and
    the Company View tab strip still lists it.
15. **Interrogate is the hero.** A new module at `/interrogate` runs the
    adaptive pattern from the deployed app: state your situation, answer
    a small number of sharp questions chosen from what you have not yet
    covered, then receive a tailored finding where every claim carries a
    citation. It is the target of the top-bar "Ask AI" button, occupies
    the hero band on The Pulse, and receives the suggested question
    chips. Scripted sample mode uses a curated question bank and an
    extractive finding; with a key in `.env.local` Haiku shapes the
    questions and Sonnet streams the finding. Grounding adds the live AIE
    vendor read to the existing sources. The AI Analyst remains inside
    Company View for document-grounded questions.
16. **Live uptake filtering.** The live uptake API accepts a single
    industry display name and rejects unknown values. Archetypes that map
    onto exactly one of its segments filter upstream; archetypes spanning
    several send no industry filter, and the panel states that the slice
    is unfiltered upstream rather than implying a filter that did not run.
