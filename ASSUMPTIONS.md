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
24. **Layout: a capped content column and container queries (3 August 2026).**
    Michael reported the sizing and screen fit as awkward across every tab.
    Measured across all 18 routes at six widths, three causes:
    - **Nothing capped the content column.** On a 1920px monitor the main
      column ran 1696px, so paragraphs reached 300 characters a line while
      their `max-w-3xl` siblings stopped at 768px. Cards read as content
      hugging the left with dead space to the right. The column is now capped
      at 1440px and centred.
    - **Breakpoints described the window, not the space.** The sidebar takes
      224px, so an `lg:` grid firing at a 1024px window was laying three
      columns into 760px, and collapsing the sidebar reflowed nothing at all.
      All 96 grid and 17 column-span declarations now query the content
      container instead. Thresholds were chosen from the width each column
      count needs, not translated from the old viewport numbers.
    - **A pixel cap is not a measure.** `max-w-3xl` is 93 characters at 15px
      and 134 at 11px, and the app used it at both. Replaced by a `measure`
      utility in `ch`, which tracks the font size. Headlines keep a pixel cap,
      since 76ch of 22px type is wider than the column.
    Container queries carry `contain: layout`, which makes the element the
    containing block for any fixed descendant. The derivation drawers would
    have been trapped inside the centred column, so they portal to the body,
    and the demo footer is now a sibling of the Shell. Both were verified
    open at 1920px before the change was called done.
    Deliberately not capped: paragraphs carrying a fill or a rule, where a
    cap would stop the fill short of its container, and centred empty states.
    Verified at 1920, 1440, 1280, 1024, 768 and 390: zero horizontal overflow
    and no running copy past ~96 characters on any tab.
25. **Uptake chart: what the bars are, and a control that did nothing
    (3 August 2026).** Michael did not buy the output of the provider
    adoption chart on Model 4 Role. Four faults, all found in the wiring:
    - **The source's own caveat was dropped.** Every response carries
      `provenance: "MODELLED ESTIMATE — May 2026 segment-share model;
      directional, not audited market share"`. The panel discarded it and
      showed a bare percentage under a LIVE badge, which reads as measurement.
      It is now reproduced verbatim above the chart.
    - **Organisation size was a dead control.** The upstream API facets on
      industry and region only, and echoes that back in its `scope`. The size
      was never sent, so selecting one changed nothing while the slice label
      above the chart claimed the cut had been applied. Selecting a size now
      moves the panel to the ported dataset, which carries the size split from
      the same source spreadsheet, and the lane badge changes with it.
    - **The ranking is breadth, not size of business.** `aggregateUptake`
      takes an unweighted mean across matching region-by-industry cells, so
      Legal in Latin America counts as much as Technology in North America.
      That is why OpenAI leads at 26.5 per cent while Anthropic, which holds
      38.3 per cent of North America Technology, sits third. Defensible, and
      now stated on the panel rather than left for a reader to infer.
    - **Cell counts and confidence were computed and never drawn.** The
      component's own header argues that a share off 3 cells is not the same
      claim as one off 45; it then printed neither. Both now sit against every
      row.
    Live here means freshly fetched, not freshly measured: the upstream serves
    the same May 2026 model, which the drawer now says.

24. **The role library, filled out (3 August 2026).** Two separate problems sat
    behind "we haven't populated all the functions and roles for each industry",
    and only one of them was a data gap.
    - **Most of it was an interface bug.** 99 of the 258 roles are cross-industry:
      filed once because a Financial Controller or a CIO exists in every sector.
      The panel filtered on `industry === chosen`, so picking Banking showed 6
      roles when Banking actually has 105, and every named industry looked all
      but empty. `functionsFor` and `rolesFor` now return the industry's
      specialist roles AND the common ones, in labelled option groups, with the
      split stated under each menu: Banking went from 5 functions to 23.
    - **The genuine gap was seven industries with nothing in them at all**, which
      INTEGRATION.md section 6 lists as the largest remaining piece of work:
      Agriculture, Airlines, Gaming, Higher Education, Management Consulting,
      Real Estate and Renewable Energy, 36 roles between them. They are now
      authored, in `scripts/author-missing-industries.py`, which is the artefact
      to review rather than the JSON it writes.
    **SUPERSEDED on 3 August 2026 by entry 25: these were researched and are
    no longer class E.** What follows is kept because it records why the first
    pass was labelled the way it was.
    **These 36 are evidence class E and must never be presented as anything
    else.** The shipped 258 are class D, "convergent evidence from multiple
    current job descriptions", produced by a four-stage research pipeline that
    read those descriptions. These were authored against the same rubric and the
    same five anchored bands, reasoned from each role's function definition,
    seniority, decision authority and O*NET occupational analogue — but no job
    advert was read and no SME has reviewed them, which is the definition of
    class E. The rubric says class E is legitimate and often necessary, and says
    equally plainly that it must never be dressed as A to D.
    Three consequences, all deliberate:
    - The engine floors a recommendation's confidence at the worst evidence class
      among the requirements that decided it, so every one of these roles returns
      **Very low** confidence without any special-casing. That is the mechanism
      working, not a defect.
    - The panel carries an explicit notice on these roles naming the class
      difference and the occupational analogue it was reasoned from.
    - The suite's no-duplicate-profiles check now covers 294 roles, and the
      authoring script refuses to write a set containing a collision, because two
      roles returning the same answer is the failure that broke the previous
      build.
    Outcomes across the full 294: 231 qualified, 4 supported, 6 partially
    supported, 43 not supported, 10 best available. Of the 36 authored, 32
    qualified and 4 returned no qualifying model.

25. **The seven industries, researched (3 August 2026).** Michael asked for the
    36 authored profiles to be researched properly rather than reasoned from the
    role definitions, and they now are. `scripts/author-missing-industries.py` is
    deleted and replaced by `scripts/research-missing-industries.py`, which
    carries the evidence, the reasoning and the sources for every profile.
    The package's own pipeline sets the standard, and it was followed: regulation
    and mandatory standards first, then professional body competency frameworks,
    then multiple current job descriptions, and never fill a field from general
    knowledge alone. That pipeline runs on Haiku with web search and scores with
    Sonnet; it needs an `ANTHROPIC_API_KEY` this machine does not have, so the
    research was done directly and the scoring by hand against the same rubric.
    **Evidence class is now recorded per requirement rather than per role**,
    because the support genuinely differs within a role. A food safety manager's
    instruction-following and accuracy requirements rest on statute and an
    audited mandatory standard, which is class A; the same role's general
    intelligence requirement rests on job descriptions, which is class D.
    Recording one class for the whole role would overstate the weak half and
    understate the strong half. Across the 648 requirements: 36 class A, 8
    class B, 604 class D, and no class E remaining.
    Nine roles turned out to be governed by named law or mandatory standards
    rather than convention, and the profiles were corrected where the evidence
    contradicted the first pass. Agronomist: the BASIS Certificate in Crop
    Protection has been a legal requirement since 1985 for advising on plant
    protection products, which raised instruction-following and assurance.
    Flight Operations Controller: ICAO Annex 6 permits operational control to be
    delegated only to the pilot-in-command and the flight operations officer,
    which raised assurance to the top band. Student Administration Manager: UKVI
    right-to-study checks and sponsor duties raised assurance. Aircraft
    Maintenance Planner sits under EASA Part-M and Part-145, Property Manager
    under gas safety and deposit statute, Facilities Manager under the statutory
    compliance programme and building safety regime, Grid Connection Engineer
    under mandatory grid code compliance, Trust and Safety Analyst under the DSA,
    and Valuation Surveyor under RICS Red Book rules and the audited Valuer
    Registration Scheme.
    **The confidence these roles report moved from Very low to Low, which is the
    mechanism working rather than a cosmetic change.** The engine floors a
    recommendation's confidence at the worst evidence class among the
    requirements that decided it. Better evidence, better confidence, visibly,
    and with no special-casing anywhere.
    The outcome distribution across all 294 roles is unchanged by the research
    (231 qualified, 4 supported, 6 partially supported, 43 not supported, 10 best
    available), which is a reassuring result: the research confirmed the shape of
    the first pass rather than overturning it, while replacing its basis.
    The panel now shows what each profile rests on, with the class mix and the
    sources as links. Worth stating plainly: **the 258 roles that shipped with the
    package cite no sources at all**, because the pipeline that produced them did
    not retain its evidence. These 36 can be checked and those 258 cannot, which
    is an odd inversion of the usual assumption that the shipped data is the
    stronger. No SME has reviewed either set.
26. **Purple marks AG's judgement (3 August 2026).** Michael asked for every
    recommendation and analyst finding to carry a purple border on the card or
    a purple highlight on the data point.
    Findings and recommendations were rendered in the brand navy, which is also
    every link, button and the active nav item, so the one thing on a page that
    was AG's opinion looked exactly like the chrome around it. Purple now
    answers a question no other colour on the product answers: **who is
    speaking**. Navy is chrome, blue is the data lane, and green, amber and red
    stay reserved for **what the verdict is**. The two are deliberately kept
    apart: the Analyst Insight action sits in a purple box with a green, amber
    or red pill inside it, and the Assess and Decide card has a purple edge
    around an amber score ring.
    Applied through four utilities in `globals.css` rather than a dozen
    hand-edited borders, so the rule survives new surfaces: `finding`,
    `finding-strong`, `finding-figure` and `finding-row`.
    **Purple had to be taken off three other things first**, or the marker
    would have meant two contradictory things at once:
    - **The delivery channel** owned purple, under an explicit "purple means
      one thing only" rule. It moves to teal. Teal against the semantic green
      is safe because the forms never overlap: the channel is always a 3px card
      edge with a labelled chip, the good band is always text or a pill.
    - **The alliance map drew investment edges in `#8b5cf6`**, which is the
      judgement purple to within a shade, so an investment read as a
      recommendation. Now magenta.
    - **Two categorical chart palettes carried `#7c3aed` itself**, the exact
      judgement hue, as a vendor series colour. Both swapped for olive. A
      second, more magenta purple (`#9333ea`) stays in those palettes: a
      labelled categorical key is not making a claim, and removing it would
      cost hue separation across ten and eleven series.
    Deliberately **not** marked, because purple means AG concluded it and these
    are the opposite: the verbatim company filing quotes on Financial Snapshot
    ("Stated by the company"), the filter-status notices on Competitive Intel,
    and the sharp questions on Interrogate, which lead to a finding but are not
    one. The Start page legend, which documented purple as the delivery
    channel, now states both meanings.
    Verified across every tab: every element labelled Analyst insight, Overall
    recommendation, Recommended action, Recommended model, What to do about it,
    Talent insight or Tailored finding resolves inside a purple-marked surface,
    in light and dark. Ecosystem Navigator and Financial Snapshot show none
    because the Analyst Insight is not wired on those two pages, which is a
    pre-existing gap rather than a missed marker.
27. **AG's type scale and spacing adopted (3 August 2026).** Michael asked for
    the font, sizing and spacing of the live AnalystGenius portal.
    The fonts were already right (Inter, Plus Jakarta Sans, JetBrains Mono,
    confirmed against `app.analystgenius.ai`). Three things were not, and all
    were measured off the portal rather than inferred from a screenshot:
    - **Base size.** AG's body computes to 16px on a 24px line. This product
      sat at 14px, so every inherited string read a step smaller than the same
      string in AG.
    - **No type scale at all.** There were 981 font sizes set per element
      across 24 distinct values from 8px to 38px, so nothing shared a step.
      They now sit on the named Tailwind classes, which carry AG's exact
      line-heights because both are Tailwind v4 defaults on a 16px root: 12/16,
      14/20, 16/24 and 30/36 all match values measured on the portal.
    - **Micro-labels.** AG renders these at 0.7rem, 0.1em tracking, weight 500.
      Ours were 10px at 0.08em and unweighted, which is what made the label
      above every figure read as fine print rather than as structure.
    Card padding follows AG's `--card-p: 1.5rem`, one step up throughout, with
    row padding raised to match so the taller type is not cramped by padding
    that suited 11px text.
    Verified after the change: zero horizontal overflow on any tab at 1920,
    1440, 1280, 1024, 768 and 390, and no page scrolls sideways.
    Not adopted: AG's own arbitrary sizes below 12px. Its stylesheet ships
    `text-[8px]` and `text-[9px]`, but nothing on a rendered page measured
    under 11.2px, so the floor here follows what the portal draws rather than
    what it defines.
28. **Judgement edge weight, and colour on the ranking cards (3 August 2026).**
    Michael asked for a heavier purple edge on everything AG concludes, for
    the Pulse itself to carry it, and for ranking cards to be colour-coded.
    - `finding` went to 2px at 55 per cent, `finding-strong` to 2.5px at 80.
      At 1px these read as one more bordered card on a page full of them.
    - **Today's Pulse was not marked at all.** The largest judgement in the
      product wore the same grey border as the data panels beneath it. It now
      carries the strong edge.
    - **KPI gauge cards** drew their band on the gauge ring and nowhere else,
      so a card had to be read before it could be sorted. The border carries
      good, warn or bad as well. Where there is no score there is no colour: an
      absent reading is not a neutral one. The Pulse scorecard's existing tone
      borders were raised to the same 2px weight so the two read as one system.
    - **Reputation trend labels collided.** Each series' name was drawn at its
      own final y, so vendors finishing within a line-height of each other
      printed on top of one another: Anthropic over Mistral, Google over
      Microsoft, IBM over DeepSeek. Positions are now solved for the whole set,
      sorted by value then pushed apart to a 13px minimum, which keeps the
      vertical order a reader matches against the lines. Verified: 11 labels,
      minimum gap 13px, zero collisions.

26. **Audit of the rest of Model 4 Role (3 August 2026).** Michael asked for
    everything on the tab except Workforce Model Fit to be tested: logic, live
    status, and every figure sanity-checked, against the web where possible.
    Three defects found and fixed, all of the same family: a number on screen
    that a reader cannot reconcile with what is next to it.
    - **Four of the eight industry archetypes silently showed the wrong slice.**
      The live uptake API filters on a single industry name, and four archetypes
      map to more than one segment, so those selections were sent unfiltered.
      The chart came back as all industries while the slice label above it named
      the cut, and the contributing-cell count quietly said 45 rather than 10.
      For Legal & Professional Advisory this was not cosmetic: the real slice
      puts Harvey second at 18 per cent, which is the entire reason to filter to
      legal, and the unfiltered view buried it at 5 per cent in twelfth place.
      Those archetypes now use the ported dataset, which holds every segment and
      can express them exactly, with the badge and the note saying so. Same
      resolution as the organisation-size filter fixed earlier.
    - **The delivery matrix printed "3 platforms" above eight rows.** The
      endpoint counts distinct platforms and the grid lists each once per service
      line it appears in, so Accenture's three platforms across five lines render
      as eight rows. Both figures are now stated: "3 distinct platforms across 5
      service lines". The upstream number was right; the label made it look wrong.
    - **A finance platform ranked third for contract review.** "Regulated-industry
      AI" is one market category holding specialists in different regulated
      domains, so the Legal shortlist reached Rogo, whose own record declares
      Financial services AI and no legal capability, and ranked it above vendors
      that do contract review. The vendor records draw the distinction the
      category does not (Harvey declares Legal AI; Rogo and Hebbia declare
      Financial services AI, and those are the only two domain tags in the
      catalogue). Vendors declaring a different domain are now ranked last and
      labelled, not dropped, and the rule is symmetric: Harvey falls to fifth on
      a KYC/AML workflow. A vendor with no domain tag is not demoted, because
      saying nothing is not the same as saying something else.
    **What was verified and found correct.** Both live paths are genuinely live
    (`x-eai-source: live`), not cached fixtures. The uptake seed is internally
    sound: 585 rows, exactly 5 regions x 9 industries x 13 vendors, and all 45
    cells sum to 1.000. The live API and the ported dataset agree to 0.000
    percentage points on every vendor, and an independent reimplementation of the
    aggregation in Python matches both, for the unfiltered slice, the APAC slice
    (9 cells per vendor) and the Financial services slice (5 cells). The
    large-enterprise reweighting reproduces exactly (Anthropic 45.1, OpenAI 27.1,
    Google DeepMind 23.6). All eight industry maturity scores and bands recompute
    exactly from the published formula. The workflow taxonomy is 75 workflows
    with 75 unique ids in 15 areas, and the area chips sum to 75, matching the
    counter. Glean's shortlist score of 59.2 matches the live vendor record.
    Externally: Rogo confirmed as a finance platform, and Accenture AI Refinery
    confirmed as a real proprietary platform, correctly marked proprietary.
    **Two limitations found that are not ours to fix.** The confidence maps are
    lossy in one direction: "Medium-Low" and "Low-Medium" both rank 2 and rank 2
    prints as "Low-Medium", so a slice of entirely Medium-Low cells displays as
    Low-Medium. And the live integration endpoint lists only Google Cloud as
    Accenture's partner platform, omitting the NVIDIA Business Group, which is
    Accenture's most prominent AI partnership. The app renders what the endpoint
    returns, with provenance attached; the gap is upstream.
    **The delivery matrix was then removed from this tab entirely.** Michael
    asked why Accenture appeared here at all, and the honest answer was that the
    ticker was hardcoded with nothing on screen saying why that provider and not
    another. It also answered a different question from the rest of the tab, who
    delivers an AI programme rather than which model suits a role, and the
    Ecosystem Navigator already answers it with a chooser across every live
    provider. The panel and its now-unused types file are deleted, the `live`
    lane is dropped from the page header because no BoardRadar surface remains
    here, and the route is preserved as a line under the shortlist: neither buy
    nor build is who delivers the programme.
