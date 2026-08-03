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
17. **Green identity and the AI Enterprise name (30 July 2026).** Michael
    asked for the product to read as distinct from AnalystGenius, so the
    accent family moved from AG's indigo to green and the product is now
    named AI Enterprise. This deliberately departs from spec Section 3,
    which pinned the verified AG brand tokens and said not to invent brand
    colours: the instruction supersedes it for the accent only. Everything
    else in Section 3 still holds (Plus Jakarta Sans, Inter, JetBrains
    Mono, the shell anatomy, the house UI idioms, light default with the
    persisted `ag_theme` toggle). Primary is `#0b8457` light and `#1fa672`
    dark, both dark enough to keep white text legible on the solid fills
    (4.7:1 and 3.4:1); secondary moved to a deep green slate.
    Consequence handled: the AIE lane badges previously borrowed the
    purple secondary, which would now collide with the semantic green
    "good" band, so the AIE dataset and AIE live badges were given their
    own cool blue marker (`--ag-aie`). The three lanes therefore stay
    readable at a glance: green for live BoardRadar, blue for AIE, amber
    for sample. The wordmark is "AI Enterprise" with an "AI" mark, and
    the AnalystGenius wordmark no longer appears in the shell; AG is still
    named in the docs where it explains provenance.
18. **Comparability: rank within a market category, never across one
    (31 July 2026).** The rankings previously ordered all tracked vendors on
    one composite, which compared a chip foundry with a CRM assistant. That
    is not a defensible comparison and it is now structurally prevented.
    `lib/comparability.ts` takes the ranking engine's own taxonomy: the 13
    MARKET_CATEGORIES for the boundary and MARKET_SHARE_ESTIMATES for
    membership, so both come from the dataset rather than an editorial
    choice here. A vendor competes in every category the dataset places it
    in (Microsoft in seven, Google in five) and is ranked separately in each
    against that category's real competitors. Sorting reorders within a
    category only, so no interaction can produce a cross-category league
    table. Categories with fewer than three placements are marked thin and
    state that the order is a tier, not a rank. Tracked vendors the dataset
    places in no category are listed separately and not ranked, rather than
    being dropped or forced into a category they do not compete in. Applied
    to Vendor View rankings, The Pulse comparison table and the Competitive
    Intel rankings; recorded as rule 3b in docs/MODULE_GUIDE.md so future
    modules inherit it.
19. **Cost versus capability graph (31 July 2026).** The Price and
    Performance page previously showed an honest empty state because the
    ported repo snapshot carried no benchmark data. The deployed AI
    Enterprise app has since published one, so the graph is ported: 330
    commercially available models plotting published list input price (log
    scale) against the independent Artificial Analysis Intelligence Index.
    The efficiency frontier is computed here from the data (each model no
    cheaper peer beats on intelligence) and reproduces the source's own
    10-model frontier exactly, which is why the derivation drawer can state
    the method rather than cite a supplied flag. Benchmarks sit under the
    third-party signals divider, attributed and dated; AG produces no
    benchmark of its own. The token pricing table now sits behind a
    disclosure so the graph leads.
20. **Data integrity audit and the removal of sample figures (31 July 2026).**
    Michael asked for an audit of whether every surface faithfully shows what
    the ranking engine and AG actually publish, and for real sources behind
    the SAMPLE figures. Findings and what changed:
    - **The Pulse was entirely sample.** Its market figures now come from
      `lib/market-metrics.ts`, which maps one metric to one named upstream
      field and returns null where the data does not reach: composite from
      `vendors[].overallScore`, momentum from `agenticMomentum`, maturity from
      the capability assessments, reputation from the three pillars, presence
      from `market-share`. Verified against an independent computation over
      the same payloads.
    - **A false-movement trap.** `market-share` carries `previousEstimate` and
      `changePct` on every row, which looks like trend data. Every
      `previousEstimate` is a copy of the current estimate and every
      `changePct` is 0. A "share gaining" figure off that would have read as
      "nothing is growing" when the truth is "no movement is published". The
      KPI was dropped and surfaces now say movement is not published rather
      than rendering a flat zero.
    - **Columns claiming more than the data supports.** The Pulse comparison
      table's adoption, trust and delivery-readiness columns were renamed to
      capability maturity, reputation and category presence, which is what the
      underlying fields actually measure. Category presence carries the
      source's own words: a directional adoption-signal estimate, not measured
      revenue share.
    - **Third-party signals were placeholders.** Generic analyst-firm cards
      were replaced with the real external sources the reputation dataset
      cites (GitHub, Hacker News, Reddit, vendor status pages, CourtListener),
      each with coverage counts, the dataset's own verified/documented/seed
      cell grades and fetch dates.
    - **Sample where live existed.** The competitive heatmap rendered a sample
      fixture while the BoardRadar competitive-intelligence endpoint was
      answering. It is now live with a peer-group anchor selector.
    - **"No source exists" was wrong twice.** The Security Desk's private labs
      and Trust Rank's governance block both claimed no source covered them.
      The AI Enterprise capability dataset assesses all 47 tracked vendors on
      Security and Governance with evidence grades and cited evidence. Both
      surfaces now show it. It is kept separate from BoardRadar cyber-risk and
      governance-risk, which measure incidents and exposure over public
      companies: different measurements, never merged.
    - **A dead route badged live.** The BoardRadar proxy passed non-JSON 404s
      through as `x-eai-source: live` with a JSON content type, so a path the
      API no longer recognises looked like a successful pull and skipped the
      recorded fixture. Only JSON 4xx now passes through as a real answer.
    - **False precision.** Upstream returns raw quotients (53.33333333333333).
      ScorePill now displays one decimal, with the exact value in the title.
    - **Shell can never be covered.** The BoardRadar universe is 161
      technology, financial services and telecoms companies; Shell is an
      energy major and is not among them. Rather than leave the module
      permanently sample, Company View now takes `?company=TICKER` and runs
      against any covered company: AI Exposure and Talent Intelligence fetch
      live, and tabs with no live equivalent say so instead of showing the
      exemplar's figures under another company's name. Shell remains the
      default, badged sample.
    - Remaining sample content is editorial by nature and stays badged: the
      analyst banner, the suggested questions, the narrative-versus-reality
      spotlight, the Shell exemplar's own tabs, and the AI Analyst's scripted
      mode when no `ANTHROPIC_API_KEY` is present.
21. **Remaining ranking-engine visuals ported (31 July 2026).** A sweep of the
    deployed ranking engine found four visuals this app did not carry. All
    four are now built on real data:
    - **Frontier model face-off** (Price and Performance). Each frontier-lab
      vendor's single highest-rated model on identical fields. The vendor set
      is the frontier_model_api market category from the dataset taxonomy, not
      a hardcoded "top four", so the count follows the data; category vendors
      with no priced and scored model are named as absent rather than dropped.
    - **Alliance topology** (Alliances). A radial chord map of the 25
      partnership and investment edges. Deliberately not a force simulation:
      placement is deterministic, so the same data always draws the same map,
      and no position implies rank or size. The source renders an interactive
      physics canvas; a stable layout was chosen instead because a map that
      moves between renders cannot be cited.
    - **Partnership depth donut** (Alliances). strengthScore banded into deep,
      established and emerging. The band boundaries are drawn here, not
      published upstream, and the drawer says so. Depth and confidence are
      reported separately: a deep alliance can still be seed-graded.
    - **Peer adoption chart** (Market View). The uptake slice was previously a
      list of thin rules; it is now a ranked bar chart carrying each row's own
      confidence label and contributing-cell count, because the same
      percentage off 3 cells and off 45 is not the same claim. It replaced the
      list rather than being added beside it, so uptake is not rendered twice.
    Deliberately **not** ported: the source repo's `QuadrantChart` ("AI Atlas
    chart, analyst-style 2x2"). Spec rule 4 forbids quadrant and wave charts
    outright. It is also absent from the deployed navigation, so the archived
    repo is ahead of this app there but behind the live product.
    Noted while checking: the deployed cost/capability scatter now reports 9
    efficiency-frontier models against the 10 in the 31 July capture, so the
    upstream data has moved. The page states its capture date and freshest
    benchmark date, so it reports its own vintage rather than implying
    currency.

22. **Workforce Model Fit embedded in Model 4 Role (2 August 2026).** The
    integration package at `~/Downloads/pkg` was rebuilt inside this app as the
    hero asset on `/market-view`. Decisions taken rather than asked:
    - **The engine is a literal port, not a rewrite.** `lib/model-fit/engine.ts`
      follows `02_engine/engine.py` line for line, including the eleven rules in
      their stated order. Where the reference is awkward the port keeps the
      behaviour and comments the reason, because the two are checked against
      each other and a tidier port that answered differently would be worthless.
    - **Proved against the reference, not merely against itself.**
      `scripts/model-fit-baseline.py` runs the reference engine over all 258
      roles under four control configurations plus six synthetic profiles and
      writes `tests/fixtures/model-fit-python-baseline.json`;
      `tests/model-fit-parity.test.ts` replays it against the port. The package's
      own suite, `02_engine/test_engine.py`, is ported check for check in
      `tests/model-fit-engine.test.ts`. Both ran green before any UI was wired.
    - **One deliberate difference from the reference, and the reference is
      wrong.** It appends thinly-covered requirements by iterating a Python set,
      so the tail of `unassessed` comes out in a different order on every run:
      two identical assessments of ROLE-0137 minutes apart list the same six
      requirements in two different orders. The port keeps insertion order, and
      the parity test compares that one list as a set. Nothing else is
      order-insensitive.
    - **Two smaller repairs the reference does not need but a module does.**
      Validation coerces into a copy rather than in place, because the role
      library is an imported module every screen shares and repairing one
      caller's input must not alter the next one's; and a benchmark score prints
      with its axis's own precision (55.0 on an index scale, 1720 on an Elo
      scale) so elimination reasons read consistently down a column.
    - **The bundled snapshot ships as data, per the brief.** 330 models, 258
      roles and the calibration table sit in `lib/model-fit/data/`, copied
      verbatim. `INTEGRATION.md` section 5 asks for the live price/performance
      catalogue instead; that is the next step, and the loader is the only
      thing that would change. The snapshot is 21 KB gzipped, so it is imported
      into the client component and the engine recomputes locally: the
      calibration slider has to move the answer while it is being dragged, and
      a round trip per drag would defeat the point of exposing it.
    - **Four catalogue columns are empty and stay empty.** Output price,
      context window, deployment/residency and input modalities are null for all
      330 models, so CAP-09, CAP-14, CAP-16 and CAP-17 cannot be checked at all
      and CAP-13 only where throughput is published. The interface reports these
      as unassessed or not assessable, never as passed. Cost is therefore
      labelled "per 1M input tokens" rather than blended.
    - **"Qualified" is shown as its own outcome.** The join specification names
      three outcomes; the reference engine emits a fourth, `qualified`, when a
      model clears everything checkable but requirements remain unassessed. The
      port keeps it and the interface labels it, rather than folding it into
      "supported" and implying a completeness the data does not have.
    - **A silent overstatement in the reference is captioned, not fixed.** Four
      roles (Account Executive, Account Manager and two Customer Success
      Managers) have no Mandatory requirement at all, so nothing can eliminate
      and the answer is simply the cheapest model in the catalogue, reported as
      "meets every requirement". The engine is left alone for parity; the panel
      says plainly what happened. Account Executive is the default selection, so
      this is the first thing a demo sees.
    - **Data lanes.** Engine output carries `derived`; the model catalogue
      carries `aie`. Role profiles fit no existing lane — they are neither a
      measurement nor an illustrative sample but authored judgement — so the
      panel carries its own MEASURED / JUDGEMENT / ASSUMPTION chips and
      reproduces the package's own measured-versus-judged table in full.
    - **One pre-existing fix taken in passing.** `peer-adoption-chart.tsx` gave
      its SVG `<title>` interleaved children, which React refuses, logging on
      every render and raising the Next dev overlay on this page. Collapsed to a
      single template string. Five more of the same are on other pages and were
      left alone.

23. **Audit of the Model Fit engine and interface (3 August 2026).** Six
    defects found and fixed. The engine ones were all invisible to the shipped
    catalogue, because it publishes no output price, no context window, no
    deployment record and no input modalities: roughly a third of the join never
    executes against it, and would have lit up unreviewed the day those columns
    arrive. `scripts/model-fit-baseline.py` now runs a synthetic catalogue that
    populates all of them through the reference, and the port is checked against
    it across 41 further cases covering every specification requirement at every
    band, blended cost, and all five outcomes.
    - **A null headcount became 60 seats instead of 1.** The reference reads
      `role.get("headcount", 60)`, where the default applies only to an absent
      key; `?? 60` also swallows an explicit null. No role in the library carries
      one today.
    - **Missing controls were rendered as JSON.** The reference interpolates a
      Python list, so a shortfall reads `missing ['audit_logging',
      'certifications']`. The port produced double quotes and no spaces.
    - **An unpriced model can be the recommendation.** The ranking sorts unpriced
      models last, which decides nothing when one is the last model standing. The
      headline then read "at $null per 1M input tokens". It now states the
      absence instead.
    - **The interface recomputed the engine's arithmetic.** Band shift, overflow,
      ceiling and the top-rated model were reimplemented in the view, so the
      threshold shown to a buyer could drift from the threshold that eliminated.
      The engine now exposes `appliedThreshold()` and `topRated()`, `recommend()`
      uses the former itself, and the view has no copy of those rules.
    - **The headcount field snapped to 1 on every keystroke.** Clearing it to
      type a new number coerced the empty string immediately. Held as text while
      being edited, coerced for the engine.
    - **Two verdicts overstated.** "Pick clears" was shown for requirements that
      were never checked, and a Desirable shortfall was coloured as a failure
      when it is the ranking signal working. Now "not assessable" and "desirable
      shortfall". A Mandatory shortfall is unreachable by construction, which the
      258-role sweep confirms: it never renders.
    One thing deliberately **not** reproduced: Python prints `55.0` where
    JavaScript prints `55`, because it keeps the JSON literal's type and
    JavaScript has one number type. The port infers the axis's scale from the
    catalogue, which is right for the shipped data and undecidable on a small
    one, so the parity test normalises a trailing `.0` on both sides and
    compares everything else exactly.
    Interface verified by sweeping all 258 role views in the browser: zero
    faults, zero missing sections, and an outcome distribution identical to the
    engine's own. Also fixed the five remaining multi-child SVG `<title>` sites
    flagged earlier, and a hydration mismatch on the alliance map, where
    `Math.sin`/`Math.cos` differ in the last bit between Node and the browser and
    React abandoned hydration for the whole chart; coordinates are quantised to
    three decimals, which is far below a pixel and identical on both engines.
