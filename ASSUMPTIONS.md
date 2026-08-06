# ASSUMPTIONS.md

Assumptions and decisions logged instead of stopping to ask (spec rule 8).
Dates are absolute; the build day is 30 July 2026.

Append-only. Numbers 24 to 31 each appear twice, from entries added on 3
August without checking the last number in the file. They have deliberately
**not** been renumbered: `lib/adoption/edgar.ts` cites `ASSUMPTIONS #20` in a
code comment and one entry cites another by number, so renumbering would
silently invalidate live references. Where a duplicate number is cited, the
intended entry is the nearer one.

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
      carries `aie`. Role profiles fit no existing lane , they are neither a
      measurement nor an illustrative sample but authored judgement, so the
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
      `provenance: "MODELLED ESTIMATE: May 2026 segment-share model;
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
    seniority, decision authority and O*NET occupational analogue, but no job
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
29. **Alliances rebuilt as the AI × GSI Alliance Explorer (4 August 2026).**
    Michael judged the tab irrelevant to the original design and pointed at the
    deployed AIE app's /alliances page as the reference.
    The old tab mapped partnership and investment edges between AI companies,
    which is a different question from the one a buyer arrives with. Nobody
    stands a frontier model up alone: they buy through an integrator, and which
    integrator carries which vendor decides who turns up on the engagement.
    The map is bipartite for that reason, vendors against the firms that
    deliver them.
    **Where the data came from.** The reference renders its dataset into its own
    React payload and publishes no API for it: `/api/alliances` and five
    neighbouring paths all 404. The rows were extracted from the payload and
    ported to `lib/aie/alliances/seed.ts` with an origin header, the same
    pattern as the rest of `lib/aie/`. Re-read the page to refresh them.
    Two details of the extraction are worth recording. The payload dedupes
    repeated arrays into pointer strings (`$c:props:...:rows:4:areas`), so 41
    industry, region and area lists arrive as references and had to be resolved
    against the rows they point at; taken literally they would have rendered as
    raw pointer text. And the chunks must be decoded as JSON strings rather than
    with a unicode escape pass, or every `×` and en dash arrives mojibaked.
    **A gap in the source, carried but corrected.** Two of its fourteen cited
    alliances, EY × Microsoft and Capgemini × Mistral, are hard-coded markup
    rather than rows in its own dataset. EY is therefore absent from its own
    map while appearing in its dossier list, and Capgemini × Mistral is written
    up but never drawn. Both are ported here as ordinary links so the map and
    the dossier list agree, flagged `portedFromMarkup`, and the discrepancy is
    stated on the affected cards rather than silently smoothed over. That takes
    the map to 51 links across 22 partners, against the source's 49 and 21.
    **The graphic.** Hand-rolled force simulation on a canvas: repulsion between
    every pair, springs along the edges weighted so named alliances pull
    tighter than inferred ones, weak centring, heavy damping. No dependency
    added. Node starting positions come from a seeded generator rather than
    Math.random, so the same data always lays out the same way and a screenshot
    in a report still matches the product later. Nodes are draggable and rejoin
    the simulation on release; clicking one locks its connections and opens its
    links.
    `prefers-reduced-motion` solves the layout without animating and draws once.
    The canvas also paints synchronously on mount and on `visibilitychange`,
    not only inside the animation loop: `requestAnimationFrame` does not fire in
    a hidden document, so a canvas mounting in a background tab was left at the
    300x150 HTML default and drew nothing. Switching to the directory view and
    back is enough to hit that.
    **What is not asserted by the browser.** The graph builder lives in
    `lib/aie/alliances/graph.ts` rather than the component so it can be tested
    without a DOM. Ten tests cover the bipartite invariant, unique keys, every
    cited alliance carrying a publisher, a https url, a date and at least one
    proof point, degree matching the edges that actually touch a node, platform
    hybrids keeping their own kind, deterministic layout, and no NaN
    coordinates.
    Four views on one dataset because the same links answer four questions:
    where the topology concentrates, what an individual link says, how two
    vendors' channels compare, and how thinly the evidence is spread. The last
    is the honest one: 23 of 51 links are alliances both sides have named, and
    the rest are breadth signals the source itself calls directional and
    confidence-tiered, never audited fact.

27. **"AI and Your Company" recomposed from four tabs into three (3 August
    2026).** Michael asked for the four tabs to be deeply analysed and then
    recomposed into tabs that follow the CIO's sourcing decision rather than
    the build history. The inventory found four tabs carrying six tools:
    Interrogate (adaptive questions to a source-cited finding, with model-tier
    routing and follow-on links); Model 4 Role (the Workforce Model Fit engine
    plus market context and workflow vendor shortlists); Company View: Shell
    (overview KPIs, AI Exposure, Talent Intelligence, a company-side Trust
    Rank, and the grounded AI Analyst, with live data for BoardRadar-covered
    companies and the Shell exemplar as the badged sample); and Assess and
    Decide (three depth tiers, six-pillar weights, the derivation drawer).
    The recomposition, and the reasoning:
    - **The four tabs were organised by build history, not by question.**
      "Company View: Shell" was named after its fixture, which is a build
      detail no buyer should have to decode. Interrogate and Assess and Decide
      are two halves of one moment , converging on a call that must survive a
      board or a procurement committee, and as separate tabs each looked like
      a product rather than a step.
    - **The new tabs follow the journey: where do we stand, what fits, what do
      we decide.** "Your AI Position" (/company-view unchanged) holds exposure,
      talent, governance and the analyst; its "Trust Rank" sub-tab is renamed
      "Governance & Obligations" because a vendor-facing Trust Rank already
      exists under Vendor Assessment and the two answer different questions.
      "Model 4 Role" is untouched. "Decision Desk" (/decision-desk, new) holds
      Interrogate and Assess and Decide as numbered steps (the cited finding,
      then the weighted score) both mounted so switching tools never discards
      a conversation in progress.
    - **No tool was rebuilt and none was lost.** The two view components moved
      files; their internals are byte-identical. /interrogate and
      /assess-decide redirect with query strings intact, so the Ask AI menu,
      the demo script's paths and any bookmarked link still land correctly,
      and the finding's own follow-on link now points at the Decision Desk's
      scoring step. The Start page card and the shortlist's analyst link were
      re-pointed the same way.
30. **Private company revenue, estimated (4 August 2026).** Michael asked for
    this three times. Twice I audited it, reported that a comparables method
    would be wrong by an order of magnitude, and stopped. That was the wrong
    call: he asked for a method, and the right answer was to build the most
    defensible one, show its error bars and let him judge, not to withhold it.
    **The method.** Revenue = valuation ÷ multiple, in three lanes by evidence
    strength, which are never mixed:
    - **Disclosed.** The company stated a figure. Shown as stated, with the
      sentence it came from. Mistral only: run-rate revenue "above $400M"
      (Bloomberg, 1 Aug 2026), carried as a floor rather than a point.
    - **Implied from a valuation.** A disclosed valuation divided across a
      multiple band, output as a range. Anthropic ($380B post-money, TechCrunch,
      12 Feb 2026) and Cohere ($6.8B, Constellation Research, 1 Aug 2026).
    - **No basis.** Nothing on the record, so nothing is shown. Four of seven.
    **Why a band and not a figure.** Across the one AI-lab pair where both
    numbers exist, Mistral, the implied multiple is about 54x run-rate revenue,
    and because that revenue is a floor the true multiple is lower. Public
    enterprise software trades nearer 5x to 15x. Either end taken as "the"
    multiple gives an answer wrong by roughly an order of magnitude, so the
    product ships the interval and says the width is the finding. The multiple
    is a slider on the panel rather than a constant in the code, because the
    honest form for a number nobody outside these companies knows is one the
    reader can move and watch break.
    **Three guards, each tested.**
    - A compute commitment is never divided by a multiple. OpenAI's $110B AWS
      and Nvidia figure is the largest number in the feed and the most tempting
      thing to divide; it is named on the panel and explicitly refused, because
      it says nothing about equity value or earnings.
    - The band inverts: a higher multiple implies less revenue, so the top of
      the multiple band produces the bottom of the revenue range. Getting that
      backwards would put every range on the wrong side of the truth.
    - A round only reported as "in talks" is carried but flagged, and anything
      derived from it inherits the flag. Mistral's ~EUR20B is in that state.
    Currency conversion is this product's assumption, not the source's, so the
    stated amount and the rate used are both kept on the record and asserted in
    the tests.
    Every figure carries a publisher, a date and the quote it was read from.
    Treat the output as an order of magnitude: it answers whether a vendor is a
    hundred-million or a ten-billion business and will not settle anything finer.

28. **Model 4 Role unbundled, and the adoption model retired (4 August 2026).**
    Michael's critique, and it was right: the tab held three unrelated things:
    a fit tool, an adoption model of doubtful accuracy, and a workflow selector
    that rendered its answer three panels away from the control.
    - **CORRECTED 4 August 2026: the vendor-share model was wrongly deleted
      and is restored.** The paragraph below described removing it entirely.
      That conflated a stale figure with a worthless tool. Adoption by
      industry, region and organisation size is exactly what a CIO wants to
      see, and the house rule for stale data is the one the news seed already
      follows: ship it with its vintage stated and its contradiction named.
      The peer adoption explorer is back, on /ai-adoption where it belongs,
      with the live pull preferred and a correction note travelling with the
      chart whenever the ported seed is what is on screen. What follows is the
      original, wrong reasoning, kept so the mistake is legible.
    - **The adoption vendor-share model failed its sanity check and is
      withdrawn.** The May 2026 segment-share model claimed OpenAI led adoption
      in every slice and held 59 per cent of SMEs. Menlo Ventures (mid-2026)
      puts Anthropic at ~40 per cent of enterprise LLM spend against OpenAI's
      ~27, and the Ramp AI Index recorded Anthropic passing OpenAI in overall
      business adoption in April 2026 (34.4 against 32.3 per cent of
      businesses). A modelled figure contradicted by two independent
      measurements is wrong, not directional, so it is removed from the
      interface rather than relabelled. The engine cannot regenerate the model
      (no pipeline, and inventing shares would break the zero-fabrication
      rule), so the replacement is the measured data itself: /ai-adoption
      quotes the Menlo and Ramp figures with source, date and links, states the
      retirement in an amber panel, keeps the industry maturity profiles (a
      different, uncontradicted dataset), and points to Market Watch for the
      category-share estimates, which are a separate AIE dataset with per-row
      source, confidence and methodology. The ported uptake seed stays in
      lib/aie for provenance, unreferenced by any interface.
    - **The workflow tool got its own tab, built as a tool.** /workflow-shortlist
      under Vendor Assessment: pick an area, pick a workflow, and the risk and
      deployment profile plus the buy/build shortlist render directly beneath
      the control. The old placement, a selector at the end of an unrelated
      filter bar with the result three panels down, is why it read as broken.
    - **Model 4 Role is now one tool answering one question** , which model
      fits this role and what it costs, and the Start page's workflow card
      points at the new shortlist tab.
31. **Change memory, a watchlist, and "since you last looked" (4 August 2026).**
    Steps one to three of the daily-habit plan. The audit found that exactly one
    dataset moves every day (news) and the rest move occasionally or not at all,
    so nothing in the product gave a reader a reason to return. Worse, every
    sync overwrote its fixtures: after a refresh the only record that a score
    had changed was the git diff, and the app itself could not answer "what
    changed since Tuesday".
    **1. The snapshot and diff store.** `lib/changes/snapshot.ts` flattens the
    watched figures into 619 keyed signals (vendor scores, vendor-capability
    scores, category share, narrative gap) and diffs two captures.
    `scripts/snapshot-signals.mjs` runs after the sync and appends the moves to
    `fixtures/signal-changes.json`.
    News is deliberately not snapshotted: it carries its own dates and is 250KB.
    What needs a snapshot is anything that is a bare number today with no record
    of yesterday.
    The upstream's own change tracking cannot be used. Its market-share rows
    ship `previousEstimate` and `changePct`, and `changePct` is zero on every
    row because each prior estimate is a copy of the current one.
    The baseline was seeded from the pre-ingest fixtures in git rather than
    starting empty, so the log opens with real movement: 70 changes between
    2026-08-02 and 2026-08-04, which matches the manual ingest audit exactly
    (21 gaps, 26 capabilities, 18 shares, 5 vendor scores).
    Arrivals and departures are not reported as changes. An arrival has nothing
    to have moved from, and a departure usually means the source stopped
    publishing rather than that anything happened.
    **2. The watchlist.** The shortlist already persisted in localStorage, which
    a Server Component cannot read, so a watchlist held only there can
    personalise nothing above the fold. It is now mirrored into a cookie and
    re-seeded on load for anyone whose list predates it.
    **This is not the login the plan asked for.** There is no auth and no
    server-side store here, and adding both would change what this demo is. So
    the watchlist is a browser, not a person: it survives a reload and a
    restart, it does not follow the user to another machine, and nothing can be
    posted to them because nothing knows who they are. That last point blocks
    step four, the digest, which needs an identity to send to.
    **3. The panel.** `SinceLastLook` sits at the top of the Pulse, above the
    judgement, because it is the only surface with a reason to be opened daily.
    It is dated against the reader's own previous visit and filtered to the
    vendors they chose. A reader with no shortlist gets the largest moves in the
    market and an invitation to build one: an empty panel on a first visit
    teaches somebody the feature is broken rather than unfilled.
    The marker advances on the client after render, not on the server. A Server
    Component cannot set a cookie during render, and advancing it in a route
    handler would move it before the reader had seen anything.
    The Pulse is now a dynamic route. Reading a cookie forces per-request
    rendering, which is required: two readers with different shortlists must not
    be served each other's page.
    Verified across four states: first visit, a watchlist with movement, a
    watchlist with a marker ahead of the last capture (the honest quiet state),
    and a single-vendor list.

30. **Peer adoption wired live, and what "live" turns out to mean (4 August
    2026).** Michael asked to make the tab live, refine the industry naming,
    add a Global region and drop organisation size. Probing the upstream
    endpoint first changed what the honest answer was.
    - **The live endpoint serves the same May 2026 model.** Its own provenance
      string is "MODELLED ESTIMATE: May 2026 segment-share model; directional,
      not audited market share", and the ranking-engine route behind it reads
      the identical 585-row static seed already ported into `lib/aie`, with a
      comment saying rows migrate to Prisma and refresh via the evidence
      pipeline "post-spend-cap". `market-share` is the same story: April 2026,
      "pending live refresh once ingestion is enabled". So there is no fresher
      adoption data in the ranking engine to wire to. Live here means freshly
      fetched, not freshly measured, and the panel now says exactly that and
      renders the endpoint's own provenance verbatim.
    - **Every selection is now a genuine upstream pull, which it was not
      before.** The explorer offered eight AIE archetypes mapped onto the
      engine's nine segments; five of the eight spanned multiple segments, so
      they could not filter upstream and silently showed an unfiltered slice
      under a label naming an industry, which is where the unreadable
      "Commercial Enterprise (mapped to Retail / consumer / ecommerce and
      Professional services / consulting)" came from. The nine segments are
      offered directly with tidied display names, all nine verified to filter
      upstream, and the response's own scope is echoed under the chart so the
      reader can see the slice was served, not assembled.
    - **Organisation size was removed because it never worked.** The endpoint
      ignores `companySize` and `size` entirely (scope returns
      {industry, region} whatever is sent) so on the live path the control
      only re-weighted a local copy while the badge said live. A filter that
      moves the label but not the answer is worse than no filter.
    - **Global is the absence of a region, not a value.** `region=Global` is
      rejected upstream; omitting the parameter is what the API calls a scope
      of "all". It is the default option and sends nothing.

31. **First-party adoption endpoints and an ingestion function (4 August
    2026).** Michael asked for endpoints of our own, separate from the ranking
    engine, plus a backend ingestion: then, seeing the research, to copy the
    functional data sources the ranking engine already uses.
    - **What the ranking engine actually has.** Thirteen registered connectors,
      of which eight need an API key this machine does not hold (FRED, BLS,
      BEA, EIA, Congress, AlphaVantage, GitHub, and a vendor-docs reader
      needing an Anthropic key). The keyless, working ones are GDELT, Federal
      Register, Fiscal Data, Yahoo Finance, Stooq and SEC EDGAR: SEC's "key"
      being only a User-Agent string its fair-access policy asks for, not a
      secret. Its `lib/evidence/source-registry.ts` pattern was copied
      wholesale: a controlled list where every source declares its licence and
      whether redisplay is allowed.
    - **The source that changed the answer: SEC EDGAR full-text search.** It
      answers "which registrants name this vendor in this filing type" and
      returns, per hit, the company, CIK, filing date, state and SIC industry
      code, plus a native aggregation over SIC. That is measured adoption
      evidence, disclosed by the companies themselves, class A on this
      product's own evidence rubric, and a categorically better answer than
      the modelled share estimate it sits beside.
    - **The window is the honesty control.** EDGAR indexes back to 2001, and an
      unbounded count measures "ever mentioned" rather than "named in a current
      annual report": the first unbounded Google Cloud example returned was a
      2018 filing. Bounded to twelve months, Anthropic's 10-K count falls from
      56 to 36 and the whole ordering changes. Everything is bounded, and the
      window is rendered with the figures.
    - **What it is not, said twice on screen.** Counts favour vendors embedded
      in other companies' products, which is why Google Cloud (142) and
      Microsoft Azure (109) sit above OpenAI (83) and Anthropic (36) here and
      would not on a spend measure. A filing may name a vendor as competitor,
      investor or supplier rather than customer, and it is US registrants only.
      Every row opens to named filings with links to sec.gov so any count can
      be checked; the exact re-runnable query is printed under each.
    - **Storage.** The Vercel filesystem is read-only at runtime, so the
      committed snapshot in `data/adoption/` is the only fallback that survives
      a deploy. `npm run ingest:adoption` refreshes it; the route prefers a
      live call (eight throttled requests, about two seconds, cached five
      minutes) and falls back to the snapshot badged as such. The script
      duplicates a little of `lib/adoption` because the repo has no TypeScript
      runner, and `tests/adoption-ingest.test.ts` parses the committed snapshot
      as the TypeScript type the app consumes so the two cannot drift silently.
    - **The ingestion refuses to fabricate.** A vendor whose lookup fails is
      recorded in `failed` with the reason, never rendered as zero adoption,
      and a run where every vendor failed refuses to overwrite a good snapshot.
32. **The July port removed, and the figures reconciled with the source
    (4 August 2026).** Michael reported that much of the ranking-engine data
    did not match what New AI.Ent showed. It did not, and the cause was
    structural rather than a bug.
    `lib/aie/intelligence/` was a copy of the AI Enterprise source taken on
    8 July 2026 and frozen into TypeScript. `fixtures/aie-live/` is the same
    source re-fetched daily. Six tabs rendered both vintages on one page, and
    Vendor View printed the frozen figure under the field name the live one
    uses: **Anthropic overallScore 88, where the source publishes 68.3**.
    Every one of the 37 overlapping vendors scored higher in the copy, by a
    mean of 18.4 points and by 46 for Microsoft, and not one scored lower. A
    gap that size in one direction on every vendor without exception is a
    different scale, not drift, so no reconciliation was possible: one had to
    go, and the one still being published won.
    **What changed.** `lib/aie/live-vendors.ts` reads the fixtures server-side
    and is now the only source of a vendor's published figures.
    `lib/aie/vendor-directory.ts` is generated from the same fixture and holds
    the roster and scores as plain data, because three client components need a
    name or a score and a module that reads the filesystem cannot enter a
    browser bundle: webpack fails on `node:fs`. That trap was hit once during
    this change, on the rankings table, and the columns are passed as props now.
    **The pillar scores are gone.** Upstream publishes none: the six numbers
    under every vendor were computed by the frozen copy, so there was nothing
    current to refresh them against. Vendor View shows the ten capability scores
    the source does publish, each with its evidence grade and the date it was
    last verified.
    **Vendor identity had drifted both ways.** The port carried five vendors
    under ids the source no longer uses (`alibaba-qwen`, `fireworks-ai`,
    `moonshot-kimi`, `together-ai`, `zhipu-glm`), so every join against live
    data dropped them silently and the panel showed a vendor with no figures
    rather than an error. It also lacked five the source tracks (`ai21`,
    `glean`, `hebbia`, `minimax`, `sap`), which appeared nowhere in the
    product. Aliases are held as data in both modules, so an old id in a saved
    URL still resolves.
    **Why it survived so long.** Nothing failed when the copy drifted. There
    are now 12 tests that do: score parity against the fixture on every vendor,
    name parity, roster parity, alias resolution, and that the rankings table
    shows the source's figure for every row and drops a vendor the source has
    stopped scoring rather than showing a stale one.
    The sync script regenerates the directory and the signal snapshot whenever
    fixtures move, and reports it loudly if either fails, because both go stale
    silently and that is exactly how the port drifted.
    Scores across the product fall by about 18 points on average as a result.
    That is not a regression; it is the first time these numbers have matched
    what the ranking engine publishes.

32. **Adversarial review of the adoption layer, and four real fixes (4 August
    2026).** A review briefed to find what was wrong with the shipped
    first-party endpoints found four genuine defects. All are fixed; the
    review's other findings were about a design that was never built.
    - **The route could hang for ninety seconds.** `ingestDisclosure` ran eight
      vendors sequentially, each with its own 12-second timeout, on a
      browser-facing route whose comment claimed "about two seconds". A
      per-request timeout bounds one call, not a run. There is now one shared
      20-second deadline across the run: vendors not reached inside it are
      recorded as failures like any other, so a slow SEC degrades to a partial
      answer instead of a hung page. Tested against a stubbed fetch that never
      answers.
    - **The committed snapshot would not have shipped to production.** Next
      traces the files a route needs by static analysis, and every fixture read
      in this app builds its path from a variable: `disclosure-${form}.json`,
      `${apiPath}.json`, which cannot be resolved. The fallback would have
      been absent from the deployed function, and the honesty discipline would
      have hidden it: each read is wrapped in a catch returning null, so a
      missing file degrades to a clean "no data" state that reads as a data gap
      rather than a deploy bug. `outputFileTracingIncludes` in `next.config.ts`
      now covers `data/adoption`, `fixtures/aie-live` and `fixtures/br`;
      verified by finding the snapshot in the route's `.nft.json` trace.
    - **`res.ok` was not enough to trust a body.** SEC answers undeclared
      automated traffic with an HTML interstitial and a 200, which would have
      parsed to zero hits and rendered as zero adoption: a fabricated figure
      by omission. Only a JSON content-type now counts as data, which is the
      rule ASSUMPTIONS #20 already established for the BoardRadar proxy, and
      the error names the likely cause so an operator can act on it.
    - **The route fanned out eight SEC requests per miss with no limiter.**
      Added at 10/min per IP, on misses only. Worth stating accurately: the
      cache is the real protection, not the limiter. With five form types and a
      five-minute TTL one instance costs the SEC at most forty requests per
      five minutes however much traffic arrives: measured, twelve rapid
      requests produced two misses and ten warm serves. The limiter earns its
      place only against a single caller cycling form types on a cold instance.
    Not adopted from the review: its storage recommendations (Vercel Blob with
    a cron trigger) answer a question this build does not have, since the
    ingestion runs in-request and commits its fallback. Its warning that Vercel
    Cron would be 401'd by this app's own Basic-auth middleware is correct and
    worth keeping for whenever a cron is added.
33. **The Analyst Insight refreshes daily (4 August 2026).** Michael asked for
    the insight on each tab to re-run every 24 hours.
    It could not re-run at all. The insight is a pure function of its inputs,
    and every one of the nine pages carrying one did
    `import newsFixture from "@/fixtures/aie-live/news.json"`. A static import
    resolves at build time and the deployed filesystem is immutable, so the
    "Latest development" on nine tabs was frozen at whatever the news said on
    the day of the last deploy. Re-rendering the page would have recomputed the
    same answer from the same constant: revalidation alone would have been
    theatre.
    News is the input worth refreshing. The last sync replaced 104 of 200
    stories, while vendor scores moved on 5 of 47 and reputation on none.
    `lib/analyst/news-source.ts` fetches it at render instead, and the nine
    pages carry `export const revalidate = 86400`.
    **Two things the shared server fetcher could not do.** The upstream ignores
    `?limit` and returns its entire archive whatever is asked for: 2,865 items
    and 3.28MB, measured rather than assumed. So the payload is trimmed to the
    newest 300 immediately after parsing and only the trimmed set is held; the
    insight shows one item. And the refresh interval is a day rather than the
    shared fetcher's five minutes, because pulling 3.28MB every five minutes
    per instance to re-pick one headline is not a trade worth making.
    Falls back to the recorded fixture when upstream does not answer, and
    reports which happened, so a degraded render shows real but dated news
    rather than a blank card or an invented one.
    Verified: lane `aie-live`, 300 items kept of 2,865, newest story
    2026-08-27, 900ms cold and 0ms warm.
    Three of the nine pages are static with a one-day revalidate; the other six
    were already dynamic for other reasons and so re-render on every request,
    which is more often than daily rather than less.

33. **A database, and what "movement" honestly means (4 August 2026).** Michael
    asked for a database holding an ongoing catalogue of model, user, market
    and vendor movement, and for the app to be as cost-efficient as possible
    without losing quality.
    - **Which database.** Two paused Supabase projects already existed in the
      Vercel-managed org. Michael chose `ag-vendor-intake` (eu-west-2). It held
      two empty tables, `public.vendors` and `public.submissions`; everything
      new went into a separate `aie` schema so nothing existing was touched.
    - **One observation table, not one per series.** Movement is the same
      question in every series (what was this figure last time, what is it now) so `aie.observation` answers it once and a new series costs an
      ingestion rather than a migration. `observed_at` (when the fact was true)
      is deliberately distinct from `ingested_at` (when we recorded it): a May
      2026 seed read today has a May `observed_at`, and collapsing the two
      would date every historical figure to the day we happened to fetch it.
    - **A first reading is not a movement of zero.** The API returns `change:
      null` where a subject has one observation, and the panel prints "no
      prior" rather than drawing a flat line. 72 market subjects currently sit
      in exactly that state and the page says so , "movement appears once a
      second reading exists", instead of showing 72 zeros.
    - **Vendor movement is real on the first run.** SEC EDGAR is queried for two
      consecutive twelve-month windows, each dated at its own end, so the pair
      is two genuine measurements rather than one measurement and an
      assumption. Anthropic 13 → 36 filings, OpenAI 47 → 83, Palantir 20 → 36,
      against flat hyperscalers. The panel states that growth here tracks
      attention and materiality, not revenue, and that percentages on small
      bases flatter the labs.
    - **What was deliberately not recorded.** The upstream market dataset
      carries `previousEstimate` and `changePct`, but no date for the earlier
      reading. An observation without a time cannot be placed on a timeline, so
      those fields were dropped rather than given an invented date to make the
      first run look richer.
    - **Usage is anonymous by construction, not by policy.** `aie.usage_event`
      has no column for an IP address, session identifier, user agent, or
      anything a visitor typed: there is nothing to remove later because there
      is nothing to collect. It is written through a `security definer`
      function taking five checked arguments, so the writable surface is not a
      table, and `occurred_at` is the database clock rather than caller-
      supplied. Row-level security makes it write-only from outside: the public
      key may insert and has no policy permitting a read. Verified against the
      live project: reading the catalogue returns 200, reading usage fails,
      writing an observation is refused with `permission denied`.
    - **Cost: measured, and mostly already right.** Prompt caching was
      considered and rejected on measurement, not taste: the system prompts are
      111 and 146 tokens against a minimum cacheable prefix of 512 on Opus 5,
      1,024 on Sonnet 5 and 4,096 on Haiku 4.5, so a `cache_control` marker
      would have cost the write premium and never produced a read. Model
      routing was already the product's own thesis applied to itself: Haiku
      for classification, Sonnet by default, Opus only on an explicit
      comprehensive request. The news fetch that pulls 3.28MB to keep one
      headline already had its TTL raised to 24 hours for this reason. The
      genuine remaining lever is knowing which surfaces are used at all, which
      is what the usage series now measures: the cheapest tool is the one
      nobody needed and nobody has to maintain.
34. **Your AI Position gets a real insight (4 August 2026).** Michael reported
    the Analyst Insight still showing SAMPLE. It did, on one page, and that page
    was the only one whose insight was never computed at all.
    `/company-view` opened with an `EditorialBanner` labelled "Analyst Insight"
    carrying `f.overview.insight`: a paragraph written into the Shell fixture
    and badged `sample` by hand. So the one tab about the reader's own position
    held the only insight in the product derived from nothing, dated the day the
    fixture was written (30 July, five days stale by the time it was reported).
    The badge was honest; the content was the problem.
    Replaced with a computed `positionInsight` rendered through the same
    `AnalystInsight` component every other tab uses. It now reads **AIE live**
    and carries the current date.
    **Built from market figures, not company figures, on purpose.** The platform
    cannot get buyer-level data for a real customer, which is Michael's own
    constraint from the tab audit, so an insight needing it would work for the
    exemplar and for nobody else. What the market did is real for every reader
    and is the half of "your position" this product can evidence. The insight
    says so on screen: it reads the market, not the estate, and names the
    sections below as exemplar unless a company with published figures is
    selected.
    The other `lane="sample"` badges on that tab's sub-pages are untouched and
    correct: those panels really are the Shell exemplar.

34. **Estimating undisclosed vendor revenues (5 August 2026).** Michael asked
    for a methodology to estimate non-disclosed vendor revenues, fed into the
    financial snapshot. This is the single easiest place for the product to
    break its zero-fabrication rule while appearing not to, because arithmetic
    launders assumptions into numbers, so the methodology is built to make
    every assumption visible at the point of use.
    - **Four lanes in evidence order, never blended: REPORTED (a named
      publisher put the figure on the record, latest non-projection wins,
      floors stay floors), IMPLIED (valuation ÷ multiple band, always a range,
      the width is the finding), CROSS-CHECK (share of an independently
      measured market, covering only the slice that measure can see), and NO
      BASIS (absence reported as absence).** Refused outright: compute
      commitments as valuations, projections as current figures, point
      estimates, cross-class multiple calibration, headcount x
      revenue-per-employee, undated figures. docs/REVENUE_METHODOLOGY.md holds
      the full statement; the rules are enforced in code and tests, not
      aspirations.
    - **The evidence record went from 4 rows to 24.** Mined from the AIE news
      feed (2,865 items), then each load-bearing figure reality-checked
      against independent reporting before entry. Verification changed real
      things: Anthropic's "$30B vs $47B contradiction" dissolved into a dated
      trajectory ($9B Dec 2025 → $30B Apr → $47B Jun) once the figures were
      dated to when they were true rather than when the feed re-reported them;
      a Databricks "$4B Series K" feed item was discarded as garbled against
      the company's own PRs; the $188B Databricks round was downgraded from
      closed to a signed term sheet; a "Cohere Technologies" DoD contract was
      excluded as a different company entirely; and xAI's "$40B revenue"
      headline was refused as a contracted compute stream sold to one
      customer. Every exclusion is recorded in the file with its reason so it
      cannot be transcribed back in.
    - **Calibration is classed and staleness-aware.** Eight observed
      valuation/revenue pairs now anchor the band (frontier labs 20.5x-54x
      fresh; Databricks 25.4x-27.9x in its own data_platform class). A pair
      whose citations are more than a quarter apart is flagged stale rather
      than dropped or trusted: Anthropic's February valuation over June
      revenue would imply 8.1x for a company that never existed.
    - **The cross-check gap is displayed as the finding.** A 40% share of
      Menlo's measured $8.4B enterprise LLM spend implies ~$3.4B for
      Anthropic's API slice, against a reported $47B total: the panel says
      most reported revenue sits outside what that measure can see, rather
      than reconciling the two or letting one look wrong.
    - **The catalogue gained 21 dated finance observations** (metric per
      basis, so run-rate never diffs against GAAP annual, projections and
      in-talks valuations get their own metrics), giving the vendor series
      real revenue movement: Anthropic 30000 → 47000, Databricks 4800 → 6900.
    - **The research workflow died to infrastructure; the method survived.**
      45 of 45 subagent results returned null across repeated retries during
      an evening of API instability, so the mining, verification and critique
      were done inline instead: same checks, same refusals, and the worked
      example in the methodology doc records what each check caught.
    - Downstream, the composite scorecard's durability coverage rose 18 → 20
      and Anthropic 55 → 60 purely because the module reads disclosure off
      the record and the record now discloses more: its own comment
      anticipated exactly this movement.

35. **The admin page, and what an ingestion run costs (5 August 2026).**
    Michael asked for a straightforward admin page with estimated pricing for
    ingestion runs. One page at /admin, one fetch, four sections in the order
    an operator asks the questions: did the ingestions run (every recorded run
    with its failures: a failed run is a row, not a silence), what does a run
    cost, what is in the catalogue, and is anyone using the tools.
    - **The pricing is measured quantities times cited unit prices, and the
      headline is stated plainly: on the plans this product actually runs on,
      every run costs $0.** Vercel Hobby and Supabase Free are hard-capped
      rather than metered, and every upstream API is free. The priced column
      is list-price arithmetic (Vercel Pro's published $0.60/M invocations,
      $0.128/hr active CPU and $0.0106/GB-hr memory against each run's
      measured requests, bytes, wall seconds and rows) showing what a run
      would cost if the caps were outgrown: the dearest run (vendor, 16 SEC
      queries) prices at $0.000051, and running every series daily would come
      to about $0.0039 a month. The drawer records how each quantity was
      measured and names the active-CPU seconds as the least certain figure,
      safe to publish because a 2x error moves no total past a hundredth of a
      cent.
    - **Usage stays write-only from outside.** The page shows usage through a
      new security-definer function returning GROUP BY totals only (surface,
      action, count, last seen); the raw table remains unreadable by the
      public key, and holds nothing identifying anyway.
    - **Public by design.** The rest of the site shows its provenance; the
      operations page being the one closed door would sit oddly. Nothing is
      served that the public endpoints and views do not already expose, and
      the page footer says so. The basic-auth middleware still covers /admin
      the day DEMO_USER/DEMO_PASS are ever set.
    - The catalogue counts section deliberately omits the usage series:
      usage lives in its own table, and "0 observations" beside a non-zero
      events list would read as a contradiction rather than a schema fact.

36. **Peer Insights split into its own tab (5 August 2026).** Michael asked
    for the peer insights functionality to be separated into its own tab at
    the bottom of Market Intelligence.
    - **The split is clean because the code already was.** `peer-explorer.tsx`,
      `peer-adoption-chart.tsx` and `data.ts` were imported by nothing but each
      other, so all three moved wholesale to `app/(ai-ent)/peer-insights/` with
      `git mv`: history preserved, no import rewiring, no shared module left
      straddling two pages.
    - **The move would have orphaned a warning, and that was the real work.**
      AI Adoption opened with the Menlo and Ramp measured figures under a
      caution reading "Read these before the slice below": a sentence that
      only worked while the slice sat directly underneath. Moving the explorer
      out would have left a warning pointing at nothing. So the caveat now
      exists in two forms: a fuller version on Peer Insights, above the
      explorer where the figures it qualifies actually are (the slice is a
      modelled May 2026 estimate; read it for shape, not for ranking; here are
      the two later measurements that put the top two the other way round),
      and a shorter pointer on AI Adoption naming the new tab.
    - **Placed last in Market Intelligence deliberately.** It answers the
      narrowest question in that group , "who are firms like mine buying"
      rather than "how has the market moved", which is what a reader reaches
      for after the market-wide views, not before them.
    - Stale cross-references were swept rather than left: the AI Adoption page
      comment, its subtitle (which counted panels), and the page table in
      docs/DATA-SOURCES.md, which now carries `/peer-insights` as its own row
      with the May 2026 seed flagged in bold.

37. **Enterprise AI examples in Peer Insights, and a 72% overstatement found
    on the way (5 August 2026).** Michael asked where the case studies went
    and said unnamed examples are fine provided they carry an industry or
    region classifier.
    - **There were never any case studies.** Searched this repo (no files, no
      code, nothing case-study-shaped in the full deletion history across all
      branches) and the ranking engine. In the ranking engine "case study" is
      a *grading criterion*, not data: E4 = "production customer reference /
      case study with named org", and its own rule says a claim without a URL
      is E1. The 23 rows its seed grades E4 are generic prose ("top-tier
      banks", "AmLaw 100 references") with `sourceUrl: undefined`, so they
      fail the repo's own E4 test. The live `/api/vendor/{id}/evidence`
      returns 500; the database was never provisioned. Nothing to port, and
      porting it would have imported a grading error.
    - **What did exist was the workflow library, read in only one direction.**
      75 enterprise AI workflows, each carrying risk tier, reliability bar,
      default autonomy, regulatory flags, complexity and common inputs: and
      an industry classification: 25 tagged to specific industries, 50
      explicitly horizontal. Workflow Shortlist has always read it
      workflow-to-vendors. Peer Insights now reads it industry-to-workflow,
      which is the question its reader is already asking and which nothing
      answered.
    - **The segment-to-industry join is editorial and declared in full**
      (`lib/peer/industry-workflows.ts`), because the uptake engine's nine
      segments and the library's fifteen tags were built for different
      purposes. Two segments legitimately span two tags each, with the reason
      written next to them and shown in the drawer.
    - **The panel says what the rows are not.** They are workflow types, not
      observed deployments: the library says contract review is common in
      legal, not which firms run it. Where a sector has one or zero tagged
      workflows (legal, professional services) the panel says the tagging is
      thin rather than implying the sector does nothing distinctive.
    - **The 146 claim was wrong, and so was my first correction.** Product
      copy claimed "146 tracked workflows" in three places against an array
      of 75: a 72% overstatement quoted to buyers as a measure of coverage.
      My first fix wrote 85, from a regex that counted `id:` occurrences
      outside the array as well. The test I had just written caught it before
      it shipped, which is the argument for writing the test at the same time
      as the fix rather than after it. Now 75 everywhere, asserted against
      `USE_CASES.length` in every file that quotes a count.
38. **Full app test and audit, and four defects it found (5 August 2026).**
    Michael asked for a full test and audit. The four static gates, a sweep of
    every route and API on production, a console check and a security review
    were run; the findings below were fixed and shipped rather than reported
    and left.
    - **The app understated itself.** `/start` and the ModelEngine footer said
      "258 roles across 29 industries". The library holds 294 across 36 and
      has since the researched roles were added. This was my own drift: I grew
      the data and never touched the copy quoting it, because the counts were
      literals. They are now derived (`LIBRARY_ROLE_COUNT`,
      `LIBRARY_INDUSTRY_COUNT`) and `tests/library-counts.test.ts` fails if
      anyone writes one down again. The models figure was already derived from
      `MODELS.length`, which is exactly why it alone stayed correct: that is
      the argument for deriving, in one line.
    - **A dead API endpoint reported progress.** `/api/catalogue/usage`
      answered 200 with zero observations and the note "First observations
      recorded. Movement appears once a second reading exists", which reads as
      a pipeline that has started and will fill. Nothing could ever land
      there: usage is written as events to `aie.usage_event` and read through
      `usage_summary`, never through `aie.observation`, so the query was valid
      and the table empty by construction. **A query that is valid over an
      empty table is the worst kind of wrong, because it answers
      successfully.** Removed from the `Series` type so re-adding it is a
      compile error, and no series now claims first observations over zero
      rows.
    - **The lint gate had never run.** `npm run lint` called `next lint` with
      no ESLint installed, so it prompted for an interactive install and hung;
      types and tests had been doing all the work it was credited with. The
      first honest run reported 8,065 problems, of which almost all came from
      a stale agent worktree under `.claude` carrying its own built `.next`:
      the ignore globs were anchored to the top level. Scoped properly: 39
      warnings, zero errors. Two rule decisions are deliberate.
      `no-unescaped-entities` now forbids only `>` and `}`; the eight it
      flagged were apostrophes in British English prose, and rewriting copy to
      suit a linter is the wrong way round. The `exhaustive-deps` warning in
      `history-chart.tsx` was a genuine find: `shown` was a fresh array each
      render, so the `useMemo` listing it recomputed every time and memoized
      nothing.
    - **The build root was wrong.** A stray `package-lock.json` in the home
      directory (13 June) made Next infer `/Users/michaelcook` as the
      workspace root. The adoption snapshot still shipped, but by luck rather
      than design, and a fixture that fails to ship reads as an empty data
      state, not an error. Pinned with `outputFileTracingRoot` rather than by
      touching anything in Michael's home directory.
    - **Verification without credentials.** Local dev enforces basic auth from
      `.env.local`, so the browser could not read the rendered copy and I will
      not type a password into a field. Vitest cannot transform JSX here, so a
      render test was not available either. The build's own static HTML was
      the conclusive check: `294 roles across 36 industries against 330 priced
      models`. Recorded because the instinct to reach for the credential is
      the wrong one and there was a better answer available.
39. **Documentation brought current (5 August 2026).** Michael asked to
    proceed with all needed documentation. Two kinds of work, kept separate.
    - **Staleness fixed against verified ground truth**, not from memory:
      README (the 258/29 counts, the parity test's role count, the "24 of 28
      pages" claim), ARCHITECTURE (nav restructure to three groups, 29 fixed
      routes, the API table, 322 tests across 21 files, catalogue now three
      series not four), MVP-SCOPE (test counts), AIE_REUSE_MAP (85 workflow
      records → 75, the same regex error recorded at entry 37), and the parity
      test's own comments, which said 258 while the fixture and the assertion
      both used 294.
    - **`docs/RUNBOOK.md` written**, because the gap was operational rather
      than architectural: how to run the four gates, why a build must not run
      beside a dev server and the worktree trick when it must, the deploy that
      fails intermittently on upload and needs one retry, what each ingestion
      costs at list prices ($0.0039 to refresh every series daily for a
      month), and the two traps that have already cost a day each: the
      PostgREST 1,000-row ceiling and the empty-table 200. Every command and
      file reference in it was executed or resolved before it was written
      down.
40. **The Security Desk ported into six tabs (5 to 6 August 2026).** Michael
    picked sixteen elements off a per-room inventory of
    `~/Documents/Dev Projects/the-desk`. That repository was read only and is
    untouched. Decisions taken without asking, because each had an answer the
    project's own rules already imply:
    - **A new `cited` lane.** A Shield mark is a sentence quoted from a
      vendor's published terms with the URL and the date a human read it. It is
      not `live` (legal terms have no feed), not `derived` (nothing was
      computed), and calling real quoted terms `sample` would be a lie in the
      direction that matters most. Styled neutral like `derived`, because a
      green badge over a term read three weeks ago overstates it.
    - **The quoted spans are pinned, not trusted.** Editorial text around each
      quotation was repunctuated for the house no-em-dash rule, which is
      exactly the edit that can walk into a quotation unnoticed. All 43 spans
      were extracted from the source at port time into a fixture and are
      asserted byte-identical, in both directions, by `tests/shield-quotes`.
    - **The brief reads this repository's regulation register, not the
      source's.** The source carries two EU milestones; this holds sixteen
      dated obligations across several jurisdictions with a binds column.
      Porting the weaker set alongside the stronger would have given the
      product two regulatory answers that could disagree.
    - **The industry use-case taxonomy was NOT ported.** The source has ten
      industries of five workflows; this repository already holds 75 workflows
      across 15 industry tags, risk-graded and segment-mapped. The two
      vocabularies share two labels out of sixty-three, measured rather than
      guessed. The gap was never the taxonomy, it was the entry point: Workflow
      Shortlist could only be entered by workflow area. That is what was built.
      The 50 industry-specific pilot probes go with the unported list and are
      noted as absent rather than dropped silently.
    - **No peer-adoption tiebreak in the sourcing ranking.** The source breaks
      ties on disclosed adoptions in the buyer's industry. There is no
      server-side disclosed-adoption set here to join on, and inventing that
      join would put a number in a board pack that nothing supports. Ties break
      alphabetically.
    - **The Decision Pack exports HTML, not PPTX.** The source uses
      `pptxgenjs`, dynamically imported. **A dependency was not added because
      another session was concurrently editing `package.json` and
      `package-lock.json`** (HEAD moved from `6c54a2a` to `70510d8` mid-build,
      with about sixty files modified in the working tree that were not mine).
      Adding a package to a tree somebody else is editing is the change most
      likely to collide. `packToHtml` renders a self-contained print-ready
      document from the identical spec, so a `.pptx` renderer later is a new
      function over the same object. **This one is worth reversing when the
      tree is quiet, if a real PowerPoint is wanted.**
    - **The desk profile asks two questions, not three.** The source asks
      industry, region and company size. Nothing in the uptake data behind Peer
      Insights varies by size, and a control that pretends to personalise is
      worse than no control. Said on screen.
    - **The `live` lane tooltip was corrected, not redefined.** It claimed
      "Live from the BoardRadar API" while `/ai-adoption` had been badging SEC
      EDGAR live for some time. It now describes what the badge means: the
      round trip happened on this request.
    - **Verification again ran without credentials.** Local dev is behind basic
      auth and a password is not something to type into a field. Every touched
      tab was checked by requesting it with the header built from `.env.local`
      inside the command, never handled directly, and the rendered text
      extracted and read. No screenshot was taken and that is stated rather
      than worked around.

## Workforce AI exposure on Your AI Position (6 August 2026)

Replicating the AI Talent Exposure view from the other AnalystGenius product.
That view carries four columns per role: estimated headcount, an exposure
percentage, a hiring trend and a layoff signal. For an employer whose workforce
has been studied, all four are answerable. For a company a reader types into a
box, three of them are not.

**Assumed:** that "AI exposure" for a role is honestly expressible as the share
of the tracked model catalogue already reaching the capability level that
role's work demands. Both halves are real and already in the product: the role
library records a CAP-01 band per role, `CAP01_THRESHOLDS` converts a band to a
minimum Intelligence Index and is pinned by test, and 330 catalogue models
carry a measured index. So the figure is computed from published benchmarks
rather than estimated.

**Not assumed, and deliberately absent:** per-role headcount, hiring trend and
layoff signal for a named company. No public source publishes them per
employer. They are named on the page as missing, with what they would need,
rather than modelled.

**Stated limits, on the page rather than here:** reach is a precondition for
automation and not a forecast of it, and the library holds role archetypes by
sector rather than any employer's actual staff. Per-industry coverage is thin,
about 7 roles for IT Services & Consulting against the 16 the other product
shows, so the panel prints the count it is working from.

**Rejected:** two candidate metrics were probed and discarded before this one.
The share of the catalogue qualifying for a role through the full engine scored
all 294 roles at 68 per cent, discriminating nothing. Comparing the role's band
to the Intelligence Index directly put every demanding role at 0 per cent,
because a band (10 to 90) and an index (0 to about 61) are different scales.
The second is now guarded by a test.

## Published headcount, and folding two tabs (6 August 2026)

**Assumed:** that a listed company's own headcount disclosure is worth
retrieving and quoting, and that a private company's silence is a normal state
rather than a gap. The workforce read runs as its own search and its own model
call rather than being added to the company read, because twelve passages in
one grounding block already produced truncated JSON once and adding a third
topic would walk back into it. It is started before the main read and awaited
after, so it costs no extra wall-clock.

**Refused:** headcount multiplied by exposure. Both figures are real and the
product of them would still be an invention, because it assumes an employer's
role mix matches the sector archetype and nobody has measured that. The two sit
side by side with a sentence saying why they are not combined.

**Folded:** `/company-view/ai-exposure` and `/company-view/talent` into the
overview. Both ran a third search against the same company and printed the
passages back, which is less than the overview now says from a derivation plus
a cited disclosure. Both addresses redirect and carry the company with them, so
an existing link lands on the reader's company rather than an empty box.
