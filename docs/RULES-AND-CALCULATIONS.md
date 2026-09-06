# AI Enterprise: rules and calculations

The register of what underpins every number on screen. Written for the pod.

**Every constant below is quoted from the code with the file and line it lives
on.** Nothing here is described from memory. If a figure in this document and
the code disagree, the code is right and this document is a bug: fix it here
and say so in the commit.

Companion documents, which carry the other two legs:
[API.md](API.md) for endpoint and schema contracts,
[DATA-SOURCES.md](DATA-SOURCES.md) for every upstream and its vintage,
[ARCHITECTURE.md](ARCHITECTURE.md) for how it is assembled,
[CAPABILITY-HISTORY.md](CAPABILITY-HISTORY.md) for what changed when.

Verified against the working tree at commit `82e20da`, 5 August 2026.

Sections 8.1 to 8.10 (everything ported from The Security Desk) were verified
against the working tree at commit `1ef3bfa`, on 5 and 6 August 2026, and are
uncommitted at the time of writing. Every line number and count in those
sections was read from the files rather than recalled, and re-read after the
last edit and again after `1ef3bfa` landed.

---

## 1. Provenance: the lane rules

`lib/provenance.ts:42` defines eight lanes and no ninth:

| Lane | Badge (`LANE_LABEL`, `lib/provenance.ts:52`) |
|---|---|
| `live` | LIVE |
| `aie` | AIE dataset |
| `aie-live` | AIE live |
| `cited` | CITED |
| `derived` | DERIVED |
| `sample` | SAMPLE |
| `mock` | Cached sample |
| `stub` | In development |

`cited` was added 5 August 2026 (`lib/provenance.ts:46`) for the Privacy & IP
Shield. A Shield mark is a sentence quoted out of a vendor's published terms,
carrying the URL it was read from and the date a human read it. That is not
`live`, because legal terms have no feed to poll; not `derived`, because
nothing was computed; and badging real quoted terms `sample` would be a lie in
the direction that matters most. Styled the same neutral as `derived`
(`lib/ui/badges.tsx`), deliberately: a green badge over a term read three weeks
ago would overstate it.

Two rules govern their use, and both exist because breaking either produces a
screen that lies quietly:

1. **Worst lane wins.** A panel combining live and sample data is badged
   sample. The badge describes the weakest input, not the strongest.
2. **A lane is never asserted before the data arrives.** A LIVE badge rendered
   over a spinner claims a fact about a response that has not happened yet.
   Components seed their source as `null` and render no badge until it resolves.

Proxied responses carry the lane in the `x-eai-source` header. The badge is
driven by that header and nothing else, so a wrong badge is almost never a
component bug.

---

## 2. The analyst guards

`lib/analyst/llm.ts`. Model `claude-fable-5-1` (line 38, Fable 5.1 since
4 September 2026, Opus 5 before that), `TIMEOUT_MS` 75 s (line 92), `TTL_MS`
24 h (line 219). Re-verified against the working tree on 4 September 2026;
the previous line numbers here dated from before the file grew.

Two independent guards run over every generated passage. Both must pass or the
output is discarded and regenerated.

### 2.1 The numeric guard

`guard()` at line 338, `invented()` at line 347, `numbersIn()` at line 317.

Every number in the generated text must appear in the whitelist of figures
handed to the model. A number that does not is an invention, and its presence
fails the whole passage rather than the sentence.

Dates are excluded by `DATE_RE` (line 378), because a year is not a claim about
the data.

### 2.2 The entity guard

`foreignEntities()` at line 408.

The numeric guard cannot see a fabricated claim built entirely from real words:
"OpenAI leads here" on a page whose data never mentions OpenAI contains no
number at all. Vendor and model names are therefore matched on word boundaries
against the known roster, and an unknown name fails the passage.

### 2.3 On failure

Two attempts. The correction fed back to the model names the specific invented
figures rather than asking generally for accuracy. A parse failure also
retries, and is logged rather than silently swallowed: a truncated JSON
response used to fail invisibly.

**When comparing figures before declaring a conflict, align currency, entity
and date first.** £1,361.5m and $1.7B can be the same revenue converted. That
is not a disagreement between sources.

---

## 3. Vendor composite

`lib/vendor/composite.ts`. Three inputs, `INPUT_KEYS` at line 28: `winning`,
`trust`, `durability`.

### 3.1 Weights

`DEFAULT_WEIGHTS`, line 55:

| Input | Weight |
|---|---|
| `winning` | 0.4 |
| `trust` | 0.3 |
| `durability` | 0.3 |

**Weights are renormalised over the inputs actually present** (lines 154 and
169). A vendor missing one input is scored on the two it has, at their relative
weights, rather than being penalised for an absence that is ours and not
theirs.

### 3.2 Thresholds

Two of the three measures are cut at **terciles of their own spread**
(`terciles()`, line 97: the 1/3 and 2/3 quantiles with linear interpolation
between neighbours). The reason is that the measures run on different scales,
so no single fixed threshold is meaningful across all three.

`durability` is the exception, cut at a fixed `DURABILITY_CUTS = { low: 0, high: 80 }`
(line 83).

`verdictFor()`, line 118:

```
value === null   -> "unknown"
value >= high    -> "yes"
value <  low     -> "no"
otherwise        -> "mixed"
```

**`unknown` is a first-class answer.** It is returned for a genuine absence and
never inferred from the other inputs.

---

## 4. Workforce model fit

`lib/model-fit/workforce-curve.ts`.

### 4.1 CAP-01 tier thresholds

`CAP01_THRESHOLDS`, line 26. Percentile tier to minimum Intelligence Index:

| Tier | Minimum index |
|---|---|
| 10 | 0 |
| 30 | 20 |
| 50 | 32 |
| 70 | 45 |
| 90 | 56 |

`TOP_TIER_INDEX` (line 41) reads the top tier's threshold from this map rather
than restating it, so the two cannot drift apart.

### 4.2 Curve parameters

- `BANDWIDTH = 9` (line 50), the kernel bandwidth for the density curve.
- Density curve domain: `min -6, max 66, steps 160` (line 128). The negative
  floor is deliberate: it gives the kernel room at the bottom of the range so
  the curve is not clipped at zero.
- Price staircase domain: `min 0, max 66, steps 132` (line 192).

### 4.3 Payload boundary

`lib/model-fit/workforce-payload.ts` flattens the 697 KB roles file
server-side. It must not be imported into a client component: it reads
`node:fs`, and doing so produces `UnhandledSchemeError` at build time.

---

## 5. Price against capability

`lib/model-fit/price-performance.ts`. Six axes at `AXES`, line 40. Five live,
one shipped deliberately dark.

| Axis | CAP | Field | Status |
|---|---|---|---|
| General intelligence | CAP-01 | `benchmarks.intelligence` | live |
| Multi-step reasoning | CAP-02 | `benchmarks.gpqa` | live |
| Agentic | CAP-05 | `benchmarks.briefcase` | live |
| Accuracy | CAP-11 | `benchmarks.reliability` | live |
| Latency and speed | CAP-13 | `throughput_tokens_per_sec` | live |
| Coding | CAP-04 | none | identified |

**Coding ships as a disabled tab carrying its reason** (line 100), rather than
being hidden. A switcher that quietly drops the most asked-for axis looks
complete and is not.

### 5.1 The frontier is recomputed per axis

`markFrontier()`, line 142. A model is on the frontier when no cheaper-or-equal
model scores at least as well. Points are sorted by price ascending, then score
descending, so only the best model at a tied price can qualify.

**Do not reuse the `frontier` field on `models.json`.** That field was computed
against intelligence. Claude Opus 5 is on the intelligence frontier and has no
Briefcase score at all; carrying it onto the agentic axis would draw
intelligence conclusions in agentic clothing. It is used only to cross-check
the intelligence axis, where `tests/price-performance.test.ts` asserts the
recomputed set reproduces the catalogue's own 10.

### 5.2 Unscored models are kept, not dropped

An axis covering 44 of 330 leaves 286 real products at real prices whose
capability is simply unmeasured there. They are returned separately
(`AxisView.unscored`) so the caller can render them in a gutter. Dropping them
would make the axis look like the whole market.

### 5.3 Labels

`pickLabels()`, line 163: the two cheapest frontier models plus the top scorer,
deduplicated. Three at most. Labelling a 330-point scatter renders an
unreadable wall; labelling none makes the chart undiscussable.

---

## 6. The disclosure ladder

`lib/finance/disclosure-ladder.ts`. Five rungs, `RUNG_LABEL` at line 40 and
`RUNG_MEANS` at line 48, quoted verbatim:

| Rung | Badge | What it means |
|---|---|---|
| `stated` | STATED | The company stated this figure in a filing. |
| `bounded` | BOUNDED | The company states no AI figure. The audited segment it would sit inside caps it. |
| `derived` | DERIVED | Computed from named inputs you can re-check and re-weight. |
| `override` | YOUR FIGURE | Your own figure. Never ours, and never mixed into our published numbers. |
| `not_estimable` | NOT ESTIMABLE | Nothing published and nothing inferable. No figure is shown rather than a guess. |

`STATED` entries carry the company's own wording, and the phrase is asserted
against the fixture by `tests/disclosure-ladder.test.ts` so the quote cannot
drift from the filing.

---

## 7. Private company revenue

`lib/finance/private-revenue.ts`.

The inference is arithmetic on exactly one assumption: `revenue = valuation /
multiple`. The valuation is cited. **The multiple is not knowable from outside**,
so the output is always a range across a multiple band, never a point.

Observed frontier-lab multiples run roughly 20x to 54x run-rate revenue (lines
16 to 19). Collapsing that spread to a single multiple would produce a number
wrong by a large factor while looking precise.

**`STALE_PAIR_DAYS = 90`** (line 147). A valuation and a revenue figure cited
more than a quarter apart are measuring two different companies at these growth
rates. Stale pairs are kept and shown, because dropping them silently would
hide evidence, but they are flagged and they do not anchor the default band.

What this deliberately does not do (line 24): apply a multiple to a valuation
that was never a revenue multiple in the first place. `NOT_VALUATIONS`
(line 97) records entries excluded for that reason, each with its `why`.

### 7.1 Correction: the OpenAI $110B round (16 August 2026)

Found by spot-checking rendered figures against sources rather than by a test,
which is why it survived. Two errors, both in our own curated record and not in
anything upstream.

**The round was misattributed.** `private-figures.json` read "$110B in funding
involving Amazon, Microsoft and Nvidia". Microsoft did not participate. The
round was **Amazon $50B, Nvidia $30B, SoftBank $30B**, announced 27 February
2026 at a **$730B pre-money** valuation. Verified against Reuters, CNBC and
TechCrunch on 16 August 2026.

**The round was misclassified, which mattered more.** It sat in
`notValuations`, whose stated `why` is "compute and infrastructure commitments,
not equity rounds". A $110B equity round is exactly an equity round. The genuine
compute commitments are the separate $100B expansion of the existing $38B AWS
agreement and the ~$300B Oracle agreement of September 2025; those remain in
`notValuations` and the round has been removed from it.

`NOT_ESTIMABLE.openai` in `lib/finance/disclosure-ladder.ts` repeated the
misclassification and added a third claim: "no disclosed valuation we will use".
A valuation was disclosed. The note now states the $730B, states that it is not
carried in the valuation record, and therefore that no range is derived from it,
rather than implying none exists.

**Not done, and deliberately.** OpenAI has not been added to `valuations`.
That array feeds `impliedRange()`, so adding it would mint a new derived revenue
range for the largest vendor in the set. That is a product decision about
whether a negotiated private-round price is a sound basis, not a correction, and
it is left open. Anthropic is carried on the same basis at $380B, so the
inconsistency is real and is recorded here rather than resolved silently.

**Still outstanding: the news item itself.** `fixtures/aie-live/news.json`
carries the upstream headline "OpenAI Secures $110 Billion in Funding from
Amazon, Microsoft, Nvidia" and the analyst summary above it repeats "Nvidia and
Microsoft among them". That file is a recorded upstream response, so rewriting
it would falsify the record of what the source said. It needs a correction layer
at render, not an edit at rest. See CAPABILITY-HISTORY for what a reader
currently sees.

---

## 8. Freshness and evidence

- `lib/aie/evidence/freshness.ts:26` grades a source date against its connector
  tier, returning `fresh | stale | unknown`. Tiers at line 13: `official`,
  `official_government`, `central_bank`, `exchange`, `reputable_news`,
  `developer_signal`. A government filing and a developer signal do not go
  stale at the same rate.
- `lib/aie/evidence/confidence.ts:16` grades evidence quality.
- `lib/comparability.ts` decides whether two figures may be set against each
  other at all. **Scores compare within a market category, never across it:** a
  chip maker and a CRM assistant do not compete for the same budget.

### 8.1 The Shield's freshness clock

`lib/shield/freshness.ts`. A separate mechanism from the evidence grading
above, because it answers a different question: not "how good is this source"
but "how long since a human last opened it".

| Constant | Value | Line |
|---|---|---|
| `FRESH_DAYS` | `30` | `lib/shield/freshness.ts:29` |
| `DUE_DAYS` | `60` | `lib/shield/freshness.ts:30` |

Banding at line 50: `daysAgo <= FRESH_DAYS ? "fresh" : daysAgo <= DUE_DAYS ?
"due" : "overdue"`. The date is parsed off `SHIELD_VERSION` by
`versionDate()` (line 35), which slices the first ten characters, because the
version carries a same-day-pass letter (`"2026-07-14b"`).

Computed against the real current date on every request, so it ages without
manual upkeep. **It never re-derives a legal fact.** It only reports the age of
one. This is what the CITED lane means in practice.

---

## 8.2 The Privacy & IP Shield

`lib/shield/data.ts`. Ported 5 August 2026 from The Security Desk
(`the-desk`, `lib/shield-data.ts`, commit `b9bb51c`), recorded in
`SHIELD_ORIGIN` at `lib/shield/data.ts:35`. The source repository is read-only
from here and was not modified.

14 model providers (`SHIELD`, line 71), four marks each, `SHIELD_VERSION =
"2026-07-14b"` (line 32), every mark stamped `verified 2026-07-14` (`V`, line
66). Scope is model providers only: cloud hosts reselling these models do not
change whose terms govern the data, so they belong on the Ecosystem Navigator.

**Mark states and their weights.** `MARK_WEIGHT`, `lib/shield/data.ts:677`,
duplicated in `shieldScore()` at line 601:

| State | Weight | Meaning |
|---|---|---|
| `protective` | `1` | Protective fact, verified in the vendor's own words |
| `conditional` | `0.5` | Protection exists but is gated |
| `adverse` | `0` | Verified fact working against the customer |
| `unverified` | `0` | No receipt obtained |

**`unverified` scores zero deliberately** (line 597 comment): under-claiming
beats over-claiming when the receipt is missing. That makes raw score
ambiguous, so `shieldCoverage()` (line 618) counts how many of the four marks
carry a determination and the screen prints it as `n/4`. A 2.0 built from two
adverse marks is a different fact from a 2.0 built from two blanks, and
collapsing them would penalise a vendor for our own missing receipts. Current
state: **6 of 56 marks unverified**, **10 of 14 providers read on all four**.

**Buyer weighting.** `shieldScoreWeighted()` (line 686) multiplies the same
per-mark 0 / 0.5 / 1 by a buyer-supplied dimension weight, 0 to 3 on the
control. `DEFAULT_SHIELD_WEIGHTS` (line 643) is 1 across all four and
reproduces `rankedShield()` order exactly, asserted in
`tests/shield-quotes.test.ts`. `rankedShieldWeighted()` (line 701) returns
`max` alongside each score so a bar reads against what is achievable under
*those* weights. Weighting changes priority, never a fact: an all-adverse
vendor scores zero at any weight, also asserted.

**The quotes are load-bearing and are pinned.** Every determined mark's `note`
contains at least one span in curly quotes lifted from the vendor's document.
Editorial text around those spans was repunctuated on port for the house
no-em-dash rule, which is exactly the edit that can walk into a quotation
unnoticed. `scripts/extract-shield-quotes.mjs` extracted all **43 spans** from
the source at port time into `tests/fixtures/shield-quotes.json`;
`tests/shield-quotes.test.ts` asserts each appears byte-identical in the port,
*and* that the port introduces no quotation the source did not carry. Re-run
the script only when the ledger is re-verified and re-ported.

Two further guards in the same file: a determined mark must carry an `https://`
source whose name matches `verified YYYY-MM-DD`, and an `unverified` mark must
carry **no** source, because a half-cited blank reads as a receipt that does
not exist.

### 8.3 The Sovereignty Lens

`lib/shield/sovereignty.ts`. Lane `derived`: a pure projection of `SHIELD`
plus one public-record field per vendor, never a second dataset that could
drift from the first.

Three flags, ordered by `FLAG_ORDER` at line 149: `hard-stop` (0),
`consideration` (1), `none` (2). Rows sort by flag then alphabetically
(`sovereigntyRows()`, line 163). Current counts, from `sovereigntyCounts()`
(line 184): **1 hard-stop, 3 consideration, 10 none**.

`hard-stop` is reserved for a vendor whose own document rules out a residency
choice. At present that is DeepSeek alone, and only because DeepSeek says so in
writing. `consideration` is where documented hosting and corporate parentage
disagree, currently Alibaba, Z.ai and Moonshot: each hosts in Singapore under a
Chinese parent. Country of incorporation carries no vendor citation because it
is public record; where the Shield already fetched a parent-company fact, that
fetched fact is the one shown rather than a re-derived one.

### 8.3a The HQ register: jurisdiction for the other thirty vendors

`lib/shield/hq-register.ts` (added 16 August 2026). Lane `derived`. A second
map, keyed by **vendor-directory id** rather than Shield slug, holding country
of incorporation for the 30 scored vendors the Shield does not reach.

**Why it is not more Shield rows.** `sovereigntyRows()` maps over `SHIELD`, and
`SHIELD` is a ledger of documents that were actually fetched and quoted. Adding
thirty rows to it would assert thirty fetches that never happened.

**The two classes and their precedence.** `jurisdictions()` in
`lib/desk/shortlist.ts` loads the register first and the Shield second, so a
Shield row overwrites a register row. Every `Jurisdiction` now carries
`basis: "vendor-document" | "public-record"`, surfaced on the card as "their
terms" or "public record". A fetched policy answers where the data sits; country
of incorporation answers only which legal system reaches the company.

**Coverage.** `jurisdictionCoverage()` returns `assessed`, `total`,
`fromDocument` and `fromPublicRecord` rather than one total, because a single
number would let a reader take 30 public-record entries for 30 fetched policies.
Currently **43 of 43: 13 from documents, 30 from public record.** Pinned by
`tests/hq-register.test.ts` and by "covers every scored vendor" in
`tests/shortlist.test.ts`.

**What it fixed.** At 13 of 43 the filter passed unassessed vendors through, by
design, since silence is not clearance. MiniMax sat in the unassessed set, so
"exclude anything flagged" returned a Shanghai-headquartered frontier lab. The
default was not changed; the coverage was.

**The three flags added**, all `consideration`, verified 16 August 2026:

| Vendor | Jurisdiction | What the flag rests on |
|---|---|---|
| `minimax` | China, listed parent Cayman Islands | Shanghai HQ, R&D in Shanghai and Beijing; MiniMax Group Inc. is Cayman-incorporated and HKEX-listed. Hosting not established |
| `g42` | United Arab Emirates | Group 42 Holding Ltd, Abu Dhabi, chaired by a member of the ruling family, Mubadala-backed. No EU or UK adequacy decision |
| `humain` | Saudi Arabia | Riyadh, wholly owned by the Public Investment Fund, chaired by the Crown Prince. No EU or UK adequacy decision |

The adequacy position was read at the time of writing, not recalled. The list
covers Andorra, Argentina, Canada for commercial organisations under PIPEDA, the
Faroe Islands, Guernsey, Israel, the Isle of Man, Japan, Jersey, New Zealand,
the Republic of Korea, Switzerland, Uruguay, the United Kingdom and the United
States under the EU-US Data Privacy Framework for certified organisations.

**`tsmc` is Taiwanese and carries no flag**, which is deliberate and not an
oversight. Taiwan holds no adequacy decision, but a foundry never holds a
buyer's data, so the question does not arise through that vendor. Same
structural reasoning the lens already applies to Meta's self-hosted weights. The
note says so rather than leaving it looking cleared.

**`passesFilter` is exported** from `lib/desk/shortlist.ts` so the pass-through
rule is pinned directly. It was previously pinned by asserting that some scored
vendor had no record, which was true at 13 of 43 and became false here, making a
rule still in force look as though it had been removed.

### 8.3b The category assessment: v1's better score

`lib/aie/category-rankings.ts`, fixture `fixtures/aie-live/category-rankings.json`,
refreshed by `scripts/sync-category-rankings.mjs` (added 16 August 2026).

**v1 publishes two scores and they name different leaders.** In
`frontier_model_api`, `vendors[].overallScore` puts OpenAI first at 69.4; the
category assessment puts Anthropic first at 3.65 against OpenAI's 3.36. Both are
v1's numbers. This was the whole of the apparent disagreement between the two
products: our comparison sorted on `overallScore` while v1's own front page
sorts on the assessment.

| | `overallScore` | category assessment |
|---|---|---|
| Scale | 0 to 100 | 0 to 5 |
| Weights | one global formula | **specific to each category** |
| Evidence | not reflected | each domain capped by its grade |
| Thin evidence | ranked anyway | **held** under 60% domain coverage |
| Domains | n/a | 7 (AI silicon) to 14 (frontier models) |

Frontier model/API weights Enterprise Control 22%, Reliability & Safety 21%,
Integration & Operations 20%, Market Strength 20%, Business Fit 10%, Vendor
Resilience 7%. The formula v1 publishes is
`domain score (0-5) x weight x (0.7 + 0.3 x confidence)`, contributions summing
to the composite. Anthropic's six sum to 3.65.

**It is parsed from v1's published pages**, which is done nowhere else in this
product. It is not on v1's API: it is computed server-side into the
`/category/<id>` pages. v1 is read-only from this side, confirmed explicitly on
16 August 2026, so adding an endpoint was not available.

What makes the parse safe enough to carry:

- **It fails loudly.** A category yielding no rows stops the script. The
  dangerous failure is not a parser that throws, it is one that returns nothing
  and leaves yesterday's leader on screen under today's date.
- **It writes a fixture, not the render path.** Their markup changing breaks a
  script we run deliberately, never a page a reader is looking at.
- **It reconciles per category.** ranked + held must equal the vendor count
  `/api/market-share` reports for that category. That is what proves no rows
  were dropped, and it is asserted per category rather than in aggregate.
- The first parser both dropped and duplicated rows: v1 renders its table more
  than once for responsive layouts, so vendors appeared at two ranks. The
  contiguous-rank test in `tests/category-rankings.test.ts` caught it.

Verified against v1's front page in all thirteen categories: same leader, same
composite, same ranked count, and both held counts (AI silicon 4 ranked 1 held,
AI cloud & compute 7 ranked 1 held).

**The comparison already grouped correctly.** `lib/comparability.ts` has been
many-to-many across the thirteen categories since it was written, and its
membership already reconciles to ranked-plus-held. Only the metric was wrong.

### 8.4 Joining the Shield to the shortlist

`lib/shield/vendor-map.ts`. Shield slugs (`openai-api`) and vendor-directory
ids (`openai`) are reconciled in exactly one table, `SLUG_TO_VENDOR_ID`, so
neither dataset needs to know about the other. **13 of the 14 map.** Reka has
no vendor-directory entry and therefore can never be marked "on your list";
`unmappedShieldSlugs()` surfaces that on screen as a stated limit. Inventing an
id for it would put a vendor on somebody's shortlist that they never chose.

---

## 8.4a Where all of it lives

**Every Security Desk element renders on `/trust-rank` and nowhere else**
(6 August 2026). The first build spread them across six tabs; they were
consolidated the same day. Your Pulse, News, Decision Desk, Workflow Shortlist
and the vendor profile are back to their prior state, each carrying a comment
recording what briefly sat there and where it went.

`app/(ai-ent)/trust-rank/components/desk/desk-view.tsx` is a client component
holding four steps. Inactive steps are **hidden, not unmounted**, the same rule
Decision Desk follows: the sourcing flow holds weights and constraints a reader
has set, and switching step must not discard them.

| Step | Panels |
|---|---|
| 1 Today | Today's brief and portfolio verdict, the Tape, the wire, For firms like yours |
| 2 The terms | Privacy & IP Shield with re-weighting and freshness, Sovereignty Lens, per-vendor dossier |
| 3 Source | Industry entry, sourcing shortlist, constraints, pilot, Decision Pack |
| 4 Obligations | The regulatory brief, cyber-risk panel, lab postures, the jurisdiction lens |

The **per-vendor dossier** moved off the vendor profile and takes a selector
here instead. Dossiers are built on the server for the 13 Shield vendors the
directory also carries; Reka has no directory entry so it is not offered,
rather than being given an invented id.

The **industry entry** takes an optional `onPick`. On Workflow Shortlist it
drove the picker beneath it; here there is no picker to drive, so each workflow
links out to that tool instead.

---

## 8.5 The live spine: status and the wire

`lib/desk/status.ts` and `lib/desk/news.ts`. Both ported 6 August 2026 from
The Security Desk (`the-desk`, `lib/today.ts` and `lib/news.ts`, commit
`b9bb51c`). Both are genuinely live: the round trip happens on the request, so
both carry the LIVE lane.

**Provider status.** Six pages (`STATUS_PAGES`, `lib/desk/status.ts:40`),
surfaced as `STATUS_SOURCE_COUNT` at line 75: OpenAI, Anthropic, Google Cloud,
Cohere, Groq, DeepSeek. `STATUS_REVALIDATE = 900` (line 79).

Three schemas, not two. Atlassian Statuspage v2 (`status.indicator === "none"`
means up) and Instatus (`page.status === "UP"`) are both handled by
`readStatus()`; Google Cloud publishes an incidents **array** and is parsed
separately (`kind: "gcp"`, line 55), where an incident with `end == null` is
open. **A page that returns anything else yields null and the row does not
render at all.** Not "operational", not stale, not an error card. As of
6 August 2026, five of six answer and DeepSeek's does not, which is the case
this rule exists for. Both the Tape and the brief print `n of 6 answered` so a
short strip cannot be misread as a healthy market.

**The wire.** Four RSS feeds (`FEEDS`, `lib/desk/news.ts:43`) plus Hacker News,
so `NEWS_SOURCE_COUNT = FEEDS.length + 1` (line 71). `NEWS_REVALIDATE = 900`
(line 73). Four filters, all regexes in the same file: `AI_SIGNAL`,
`ENTERPRISE_SIGNAL`, `NOISE`, `SECURITY_SIGNAL`. Security press must clear
`AI_SIGNAL`; a vendor newsroom must clear `ENTERPRISE_SIGNAL` or be security.
Anything older than 14 days is dropped (line 169), as is anything undated.
Ranking (line 260): security first, then primary sources over community
(`kindRank` puts `vendor` and `security` at 0, `community` at 1), then
freshest. Deduped on a 60-character normalised title.

Two sources are deliberately absent and documented as such in the file header:
Anthropic publishes no public RSS feed, and BleepingComputer sits behind a bot
challenge that is not worked around.

## 8.6 Today's Brief and the portfolio verdict

`lib/desk/brief.ts`. Lane `derived`: the verdict is AG's conclusion from named
inputs, none of which it publishes itself.

| Threshold | Value | Line |
|---|---|---|
| `URGENT_DAYS` | `30` | `lib/desk/brief.ts:72` |
| `SOON_DAYS` | `90` | `lib/desk/brief.ts:74` |
| `WEAK_SHIELD` | `2` | `lib/desk/brief.ts:76` |
| `REG_URGENT_DAYS` | `30` | `lib/desk/brief.ts:78` |

**Health, in order of precedence.** No shortlist gives `unset`. Then `red` for
a live incident or a retirement inside `URGENT_DAYS`, **on a shortlisted vendor
only**. Then `amber` for a retirement in `URGENT_DAYS` to `SOON_DAYS`, a Shield
score at or below `WEAK_SHIELD`, or a deployer-side obligation inside
`REG_URGENT_DAYS`. Otherwise `green`. The reason string is built from the same
booleans that chose the colour, so it cannot describe a different verdict.

**Only deployer-side obligations can turn the page amber** (`onMe`, line 116:
`binds === "deployer" || binds === "both"`). An obligation binding the model
provider is the vendor's duty, and colouring the reader's portfolio for it
would be telling them to act on somebody else's problem.

**The regulation leg reads this repository's own register**
(`lib/aie/regulation/obligations.ts`), not the source's two EU milestones.
Porting the weaker dataset alongside the stronger would have given the product
two regulatory answers that could disagree.

**A section with no lines is omitted, never rendered empty**, asserted in
`tests/desk-brief.test.ts`.

### 8.6.1 Ported reference data behind the brief

- `lib/desk/deprecations.ts`, `DEPRECATIONS_VERSION = "2026-07-13"`. Seven firm
  retirements transcribed from OpenAI's and Anthropic's own deprecation pages.
  `upcomingDeprecations()` filters `daysAway >= 0` **at read time** rather than
  deleting rows, so the ledger stays a faithful record of what those pages said
  on the verification date. The repository's own model inventory carries one
  dated deprecation in total, which is why this is ported rather than derived.
- `lib/desk/encroachment.ts`, `ENCROACHMENT_VERSION = "2026-07-14"`. Four
  cited entries. Structural risk, never breaking news.
- `lib/desk/vendor-map.ts` is the **single** table reconciling the names each
  source uses ("Google Cloud", "AWS", "Amazon") with directory ids. An unmapped
  name returns null and is never marked as the reader's, which is the safe
  direction: a missed prompt beats a false alarm about their own portfolio.
  Tests assert every party in both ported datasets resolves.

## 8.7 The sourcing shortlist, the pilot and the Decision Pack

`lib/desk/sourcing.ts`, `lib/desk/pilot.ts`, `lib/desk/pack.ts`,
`lib/desk/pack-html.ts`. All ported 6 August 2026 from `the-desk`
(`lib/decide.ts`, `lib/pilot.ts`, `lib/deck.ts`, `lib/render-pptx.ts`).

**It ranks on the Shield and on nothing else.** `MARK_VALUE`
(`lib/desk/sourcing.ts:64`) is the same 1 / 0.5 / 0 / 0 as the Shield itself.
`rankVendors()` (line 147) sorts passing vendors first, then by weighted score,
then alphabetically.

**Two deliberate departures from the source, both in the file header.** The
source breaks ties on disclosed peer adoption; there is no server-side
disclosed-adoption set here to join on, so ties break alphabetically rather
than on an invented join. And the source's ten-industry use-case list is not
ported: see 8.8.

**Five constraints** (`CONSTRAINTS`, line 82). An unverified indemnity **fails**
`require_indemnity`, because no receipt is not a yes. Every dropped vendor
carries a `failReason`, asserted for all five constraints in
`tests/desk-sourcing.test.ts`.

**`topPriorities()` (line 184) returns null when the buyer raised nothing.** At
equal weights, naming the first two dimensions would tell a board that those
were prioritised when no preference was expressed. Callers print "weighted
equally" instead. This was a real defect caught in render: the panel read
"Ranked on will not train on our data and retention" under default weights.

**The pilot is methodology, never results.** `PILOT_STEPS`
(`lib/desk/pilot.ts:36`), seven ordered steps. `USE_CASE_PROBES` (line 76), 13
probes, one for each of the 13 use cases the flow offers. A test asserts no
vendor is named anywhere in the pilot text.

**One spec drives both outputs.** `buildPack()` (`lib/desk/pack.ts:65`) returns
a `PackSpec`; the screen and `packToHtml()` both render that same object, so a
figure cannot differ between what the reader saw and what they downloaded.
Tests assert the pack's shortlist row count equals the ranking's passing count,
that every rejection appears with its reason, and that the scope section states
the tool does not rank capability.

**The export is a self-contained HTML document, not PPTX.** The source renders
to `.pptx` via `pptxgenjs`, imported on click. That dependency was **not** added
here: another session was mid-flight in `package.json` and `package-lock.json`
when this was built. `packToHtml()` produces a print-ready page with inline
styles, no external fonts or scripts and no network dependency, and escapes
every interpolated value. Swapping in a `.pptx` renderer later is a new
function over the same `PackSpec` and changes nothing above it.

## 8.8 What was deliberately not ported

**The source's industry use-case taxonomy.** It carries ten industries of five
workflows. This repository already holds **75 workflows across 15 industry
tags** in `lib/aie/use-cases.ts`, each with risk tier, reliability requirement,
autonomy default and regulatory flags, plus a declared segment mapping in
`lib/peer/industry-workflows.ts`. The two vocabularies share **two labels out
of sixty-three**, measured rather than estimated. Porting the smaller one
alongside the larger would have given the product two workflow taxonomies that
disagree, and this register would then have to document both.

The gap was never the taxonomy: it was the **entry point**. Workflow Shortlist
could only be entered by workflow area, so a reader who knows they run a bank
had nowhere to start. `app/(ai-ent)/workflow-shortlist/industry-entry.tsx` adds
that over the library that was already there, reading the desk profile so a
reader is not asked twice.

**The source's 50 industry-specific pilot probes** go with that list and are
not reachable without it, so only the 13 horizontal probes came across. Noted
in the header of `lib/desk/pilot.ts` rather than dropped silently.

## 8.9 The desk profile

`lib/desk/profile.tsx` (browser) and `lib/desk/profile-server.ts` (request).
Cookie `ag_desk_profile`, 180-day max age, mirrored from localStorage exactly
as the shortlist is, so the server can personalise above the fold.

**Two fields, not three.** The source asks industry, region and company size.
This asks industry and region only, because those are the two dimensions the
uptake data behind Peer Insights is actually cut by, and the values are
`ADOPTION_SEGMENTS` and `ADOPTION_REGIONS` themselves rather than a second,
prettier list. A size selector that changed nothing on screen would be a
control that pretends to personalise. The panel says so.

Not an identity: no account, no server-side store, so it lives on one browser
and nothing can be sent to the reader because nothing knows who they are.

## 8.10 The analyst's cited corpus

`lib/desk/corpus.ts`, wired into `buildCorpus()` in `app/api/analyst/lib.ts`.
`citedChunks()` (`lib/desk/corpus.ts:52`) emits **81 chunks**: 56 Shield marks
(14 vendors x 4), 14 sovereignty rows, 7 deprecations, 4 encroachments.

Chunks are built as **sentences, not records**, because the retriever scores on
term overlap with the reader's question. A JSON blob retrieves badly and reads
worse when quoted back.

**Retrieval precedence** (`app/api/analyst/lib.ts:133`):

| Kind | Boost |
|---|---|
| `upload` | `0.3` |
| `cited` | `0.25` |
| `document` | `0.2` |
| `shell-fixture` | `0.1` |
| `aie-dataset` | `0` |

`cited` sits above `document` because a sentence lifted out of the contract
that governs the reader beats a sample memo about contracts in general, and
below `upload` because the reader's own agreement beats the public one.

Why this matters more than it looks: the figure guard and the vendor-name guard
cannot catch the failure this fixes. Asked "can OpenAI train on our data", the
analyst previously retrieved a one-line vendor description and answered from
memory. That sentence is fluent, names a real vendor, contains no number, and
may still be wrong about a contract somebody is about to sign.

---

## 8.11 The role-vertical pilot: Customer Operations & Service

Closes a gap the role library records against itself. `lib/model-fit/data/roles.json`
holds 297 roles, of which 99 carry `industry: "*"` and ONE shared profile each,
so a Customer Support Advisor scored identically in investment banking and in
retail. This is the first evidence-backed correction, scoped to the six roles in
Customer Operations & Service.

**Dataset**: `data/role-verticals/customer-operations.json`. **Reader**:
`lib/exposure/role-vertical.ts`. **Tests**: `tests/role-vertical.test.ts`, 23.

### It stores deltas, not profiles

An entry says a requirement moves from X to Y and names the rule. A requirement
with no entry reads at its base value. This makes the absence of evidence
visible instead of burying it inside a plausible-looking full profile, and keeps
the library the single source of the unlensed score.

### Evidence class is per requirement, not per role

Inherited from `scripts/research-missing-industries.py` and its rule, *"Never
fill a field from general knowledge alone."*

| Class | Meaning |
|---|---|
| A | Statute, statutory instrument, regulator rule or licence condition that states the requirement |
| B | Professional body framework, or a requirement following directly from a class A rule |
| D | Job descriptions |
| E | Reasoned judgement, nothing else |

`CLASS_RANK` (`lib/exposure/role-vertical.ts:36`) orders them worst-last, and
`lensRole()` sets a reading's confidence to the WORST class among the deltas
that moved it. Same principle as the lane badging in section 1.

### What the pilot produced

Six sectors, six roles. Counted by `coverage()` and pinned by the final test
block: **class A is over 60 per cent of all deltas and class E is exactly
zero.** If either stops holding, the dataset has drifted toward judgement and
needs re-reading.

| Sector tag | Governing regime | Source class |
|---|---|---|
| `financial_services` | FCA DISP 1.6.2R, eight-week final response; Consumer Duty | A |
| `telecom_media` | Ofcom General Condition C4 and annexed approved code | A |
| `healthcare` | SI 2009/309, three working days to acknowledge, six-month period | A |
| `energy_utilities` | Ofgem SLC 0 Standards of Conduct, SLC 26 Priority Services Register | A |
| `transport_logistics` | UK261, assimilated Regulation (EC) 261/2004 | A |
| `retail_consumer` | No sector regime found. The documented baseline | E |

Nine of the fifteen tags in `TAG_LABEL` (`lib/exposure/vertical.ts:131`) are
unresearched and named in `meta.verticalsUnresearched`. `lensRole()` returns
null for them rather than falling back.

### Three guards, each pinned by test

1. **`baseDrift()`** compares every delta's recorded `from` against the live
   library score. Non-empty means the library was re-scored and the research was
   reasoned from a profile that no longer exists. This is the most important
   test in the file.
2. **Tag alignment.** The first cut of the dataset invented its own sector names;
   four of six were wrong, so the lens would have silently never fired. Tests now
   assert every tag is in `TAG_LABEL` and that researched plus unresearched
   equals the full vocabulary.
3. **`scopeNote`** where the app's bucket is wider than the evidence. UK261 is
   passenger aviation and `transport_logistics` also holds freight; GC C4 binds
   communications providers and `telecom_media` also holds broadcasters. Both
   render as a warning rather than being applied silently.

### A delta may record a rule change without moving a band

`to === from` is a deliberate record, not a no-op. Ofcom cut the ADR escalation
window from eight weeks to six on **8 April 2026**; CAP-13 stays at 90 and the
deadline still changed. `movedRequirements` filters on the delta's existence,
not on band movement, so this cannot vanish.

### Two dated facts the pilot depends on

Both were verified by search on 6 August 2026 and both contradict what a model
answers from recall:

- **Ofcom ADR window: six weeks, from 8 April 2026.** Eight is the long-standing
  figure and is now wrong.
- **EU AI Act.** Article 50 transparency applies from **2 August 2026**. The AI
  Omnibus, in force **27 July 2026**, moved Annex III high-risk to **2 December
  2027** and Annex I to **2 August 2028**. Recorded in `crossCutting.eu_ai_act`.

### The pipeline for the remaining sectors

`scripts/research-role-verticals.mjs`. Retrieval on `claude-haiku-4-5`, scoring
on `claude-sonnet-5`, both overridable. It writes a PROPOSAL to
`data/role-verticals/proposed/` and never into the pilot file. It rejects a
delta whose `from` disagrees with the library, and demotes a class A or B claim
carrying no source URL to class E.

**It has not been run.** `ANTHROPIC_API_KEY` is present but empty in
`.env.local` and no search key is set on this machine; both live in the deployed
environment. The six pilot sectors were therefore researched by hand, exactly as
`scripts/research-missing-industries.py` records for its own seven industries.

### Cost, if the full job is ever run

Measured scope: 99 multi-industry roles, 18 functions, 15 sector tags. Six roles
in this function. At roughly $0.05 per profile with Sonnet 5 scoring, the
remaining nine sectors of this pilot are about **$3**, and all 99 roles across
15 sectors is about **$50 to $95** depending on the scoring model. Web search is
NOT modelled in `lib/admin/cost-model.ts` and is additional.

The API spend is not the cost. 99 roles across 15 sectors is roughly 23,000
requirement-level evidence claims, and because confidence floors at the worst
class among the deciding requirements, a claim graded A that is really E
propagates a wrong number onto the screen.

---

## 8.12 The three construction design roles

`lib/model-fit/data/roles.json` held five roles under
`Construction & Engineering`: Civil Engineer, Construction Project Manager, Site
Manager, Quantity Surveyor, Health and Safety Manager. That is delivery,
commercial and safety plus one generic engineer. The three disciplines that
produce the design were absent, so a design office got no answer.

Added 17 August 2026 by `scripts/add-construction-design-roles.mjs`, which
refuses to overwrite an existing `role_id` and asserts 18 capabilities per role
before it writes. Library 294 to 297.

| Role | id | `function` |
|---|---|---|
| Architect | `ROLE-0295` | Architecture |
| Structural Engineer | `ROLE-0296` | Structural Engineering |
| Building Services (MEP) Engineer | `ROLE-0297` | Building Services Engineering |

**Criticality is derived, not authored.** `scripts/add-construction-design-roles.mjs:64`

```js
const critical = (score) => (score >= 70 ? "Mandatory" : "Desirable");
```

Verified against all 5,292 pre-existing capability entries: the rule holds
without exception, so it is applied rather than restated per capability.

**Evidence class D throughout**, the same as the other 294 roles. Class D means
derived from role definitions. The definitions used were ARB *Tomorrow's
Architects* (competency outcome D5 for CAP-09, PE4 for CAP-11 and CAP-15), the
IStructE Code of Conduct, and the CIBSE Level 6 Building Services Design
Engineering standard, whose named scope of twelve system families is the basis
for the MEP engineer's CAP-09 of 90. All three carry the Building Safety Act
2022 dutyholder regime, with PAS 8671 setting the individual principal designer
threshold. Nothing here states a number; the scores are derived, and the
frameworks are what they were derived from.

### The architect is the one construction role no model covers

Distinguishing scores, read from `scripts/add-construction-design-roles.mjs`:

| | CAP-01 general intelligence | CAP-11 accuracy | Outcome |
|---|---|---|---|
| Civil Engineer (existing) | 50 | 90 | qualified |
| Structural Engineer | 50 | 90 | qualified, Granite 3.3 8B |
| Building Services (MEP) | 50 | 90 | qualified, Gemma 4 E4B |
| Architect | 70 | 90 | **not supported** |

The architect sits at 70 on CAP-01 because ARB's competency areas make each
brief and site genuinely novel, where civil and structural work carries more
codified method. No model in `models.json` clears 70 general intelligence and 90
accuracy together, so the engine returns `blocked_by: ["General intelligence",
"Accuracy"]` rather than a recommendation. That is the engine declining, not a
missing record.

Confirmed against the Python reference: `python3 scripts/model-fit-baseline.py`
regenerated the baseline at 297 roles x 4 configs, 43 specification cases, and
`tests/model-fit-engine.test.ts` parity passes unchanged. The distribution moved
by exactly the three roles, qualified 231 to 233 and not supported 43 to 44.

**Tests**: `tests/model-fit-engine.test.ts` (roles load, outcome distribution),
`tests/workforce-curve.test.ts`. All three now assert against
`LIBRARY_ROLE_COUNT` (`lib/model-fit/index.ts:239`) rather than a literal, so
the library can grow without a test edit.

---

## 8.13 Saved positions: Your AI Position into the Decision Desk

Carries a finished company research result from `/company-view` to the
Interrogate step of `/decision-desk`.

**Store**: `lib/position/store.ts`. **UI**: `lib/position/save-position.tsx`.
**Tests**: `tests/position-store.test.ts` (21), `tests/interrogate-position.test.ts` (4).

### Where it lives, and why not Postgres

`localStorage`, key `ag_positions_v1` (`lib/position/store.ts:22`), capped at
`MAX = 8` (line 24). There is no user identity in this product beyond a shared
demo credential, so a server-side store would be one drawer every reader writes
into: your saved position would be whoever was researched last. Per-browser is
the honest scope and the UI states it.

Distinct from the `sessionStorage` cache in `research-runner.tsx` (`ag_research:${company}`),
which stops a tab revisit paying for the research twice. That is a per-tab cache
nobody asked for; this is a save the reader chooses. Deliberately not merged.

### Matching a situation to a saved company

`matchPosition()`. `normaliseName()` lowercases, strips `. ,` and the legal
suffixes `ltd limited plc inc incorporated corp corporation llc llp gmbh sa nv ag co`,
then collapses whitespace. Matching is on a **word boundary** against the
normalised text, longest name wins, and names under **3 characters** are never
matched.

| Case | Result | Why |
|---|---|---|
| "Ocado Retail Ltd." vs "ocado retail" | match | suffix and case stripped |
| "Ocado" vs "Ocado Retail" | distinct | collapsing lets a subsidiary answer for its parent |
| "pineapple", "applesauce" vs "Apple" | no match | word boundary, not substring |
| "apple juice" vs "Apple" | **match** | known limit, see below |
| "BP" | never matched | two-letter initialisms collide with ordinary words |

**The known limit is deliberate and mitigated on screen, not in code.** String
matching cannot tell a company called Apple from the fruit, and inferring it
from context would fail silently, which is worse. The interface names the
attached position and offers "Not this company", so a wrong match is visible and
one click from undone. Pinned by the test named *"still fires on a standalone
common word, which is a known limit"*.

### The prefill is deliberately partial

`openingLine()` returns `We are ${name}, ${what}. ` and stops. A complete
pre-written situation gets submitted unread and the finding answers a question
nobody asked. Pinned by *"stops before the part only the reader knows"*, and by
a round-trip test asserting the prefill matches itself, without which a reader
who accepts the offer and types nothing else would get no research attached.

### Clamps, on both sides of the wire

`toContext()` (client) and `sanitisePosition()` (`app/api/interrogate/route.ts:27`)
apply the same limits. The server's is the one that counts: this text is pasted
into a model prompt.

| Field | Limit |
|---|---|
| `name` | 120 chars, required, else the whole position is dropped |
| `industry` | 200 |
| `what` | 400 |
| `aiFindings`, `findings` | 6 items, 400 chars each |

Fields are taken one at a time rather than spread, and anything unrecognised is
dropped rather than forwarded.

### It is prior research, not grounding, and the prompt says so

`InterrogateState.position` (`app/api/interrogate/lib.ts`) reaches the model
through `positionBlock()` in `live.ts` as a **separately labelled, fenced block**
after the grounded chunks, never merged with them.

The distinction is not cosmetic. The chunks are this workspace's own corpus and
are citable; these statements came from retrieved web pages about one company.
Merging them would let the finding hand the reader's own research back as an
independently sourced claim, which is the laundering the grounding rule exists
to prevent. The system prompt instructs attribution as *"your own research on X
found ..."* and forbids bracket citation.

The block is fenced with `<<<PRIOR_RESEARCH` / `PRIOR_RESEARCH` and the system
prompt states it is untrusted third-party page text: data to weigh, never
instructions. It originates in retrieved web pages, so it is treated as such.

### What actually changes in the engine

`nextQuestion()` (`lib.ts`) skips the industry question when
`state.position.industry` is non-empty, because `detectFacets()` is string
matching and will not find "Online grocery retail and technology" in a sentence
that does not contain it. `live.ts` folds the same fact into `known` for the
question model. Verified against the running server:

| Request | First question |
|---|---|
| "We are Ocado. Should we buy Copilot..." | "Which industry and regulatory context..." |
| Same, with the position attached | "Roughly what scale are we planning for..." |

An empty `industry` is not treated as an answer. A reader who never used Your AI
Position sees no change at all, which is the common case and is pinned by test.

---

## 8.14 The Decision Desk shortlist

Step 3 of `/decision-desk`: three vendors, a computed paragraph on each, and the
pilot sequence.

**Derivation**: `lib/desk/shortlist.ts`. **Payload**: `lib/desk/shortlist-payload.ts`.
**View**: `app/(ai-ent)/decision-desk/shortlist-view.tsx`. **Tests**:
`tests/shortlist.test.ts`, 20.

### It ranks within one market category, never across

`buildShortlist(category, weights, size = 3)` filters `scorecardSet()` to one
`VENDOR_DIRECTORY` category before ranking. This is not presentational. The
composite rests on capability assessed **relative to peers doing the same job**,
which `WORKSPACE_COVERS` in `app/api/interrogate/live.ts` already states as
"comparable only within a market category". A list mixing a frontier lab with a
chip maker orders two scales against each other.

Pinned by *"draws every card from the chosen category"*, which walks every
category and asserts each entry's directory category matches.

Investors are excluded, the same exclusion `scorecardSet()` already makes:
"is it winning, do people trust it, will it still exist" are questions about a
vendor you might buy from.

### It returns fewer than three rather than padding

Only **4 of 10** categories hold three or more scored vendors:

| Category | Scored |
|---|---|
| Frontier model/API | 12 |
| AI infrastructure | 11 |
| Cloud AI platform | 6 |
| Regulated-industry AI | 3 |
| Sovereign/regional AI | 3 |
| Enterprise assistant, ITSM/HR, RAG | 2 each |
| CRM/customer AI, Enterprise applications | 1 each |

A short category returns what it has and sets `shortfall`, which the interface
renders as a warning. Reaching into a neighbouring category to fill a third card
would commit precisely the cross-category comparison the section above forbids.

### Ordering, and how ties break

Composite descending, then **`inputsPresent` descending**, then name. The second
key is the substantive one: between two equal scores, the better-evidenced claim
ranks higher. A vendor whose `result.score` is null is never shortlisted, since
an absence is not a zero and cannot be ranked.

### The reason paragraph is computed, not authored

Every clause restates a figure already on the card. No model call, so it cannot
drift from the score it explains, costs nothing, and survives an analyst outage.

Three presentation rules exist because the first cut broke each of them:

1. **`fig()` rounds to one decimal.** Raw inputs carry float noise
   (`64.9651156889088`) that reads as precision the measure does not have.
   Pinned by *"does not print raw float noise"*, which fails on any run of three
   or more decimals.
2. **`INPUT_NOUN` not `QUESTIONS`.** The rubric holds the inputs as questions,
   which is right as a column heading and not English inside a sentence: "top
   third on is it winning at 64.9". The nouns are capability, reputation and
   disclosed durability.
3. **The absence is named, not skipped.** A score on one input is a different
   claim from one on three. Two phrasings, because "rests on a single input"
   and "nothing is published for reputation" are different facts, and both say
   the weights were renormalised over what exists.

### What it refuses to claim

`limitFor()` puts the same sentence on every card rather than in one footnote:
it does not price the work, does not know the reader's stack, and **is not a
recommendation to buy**. Pinned by *"never reads as a recommendation to buy"*,
which also fails on "you should" and "best choice" appearing in a reason.

### Next steps

`PILOT_STEPS` from `lib/desk/pilot.ts`, seven ordered steps, reused rather than
rewritten. Ticking is `useState` only: not persisted, not sent anywhere, and the
interface says so.

---

## 8.15 What carries across "AI and Your Company"

Five tabs in `lib/ui/shell.tsx:102`: Your AI Position, Decision Desk,
ModelEngine, Trust Rank, Integrators. **Two** stores carry between them, and
they are deliberately separate because they are written at different moments by
different acts.

| What | Store | Written by | Read by |
|---|---|---|---|
| Company and sector | `localStorage` `ag_positions_v1` (`lib/position/store.ts:22`) | Your AI Position, on save | The context bar on all five |
| Vendors taken forward | `localStorage` `ag_shortlist` **plus a cookie** (`lib/shortlist.tsx:33`) | Decision Desk step 3 | ModelEngine, Integrators (client), Trust Rank (server, via the cookie) |

### The vendor half needed almost no new code

`lib/shortlist.tsx` already existed and was already read by
`market-view/components/model-fit.tsx:1838`,
`alliances/components/alliances-view.tsx:87`, and server-side by
`lib/changes/watchlist.ts` through `SHORTLIST_COOKIE`. `model-fit.tsx:1876` was
already captioned *"vendors approved on the Decision Desk"* while nothing on the
Decision Desk could approve one. The readers and the store were built; the
writer was missing. Step 3 now calls `useShortlist().toggle()`.

The cookie mirror is what lets Trust Rank personalise on the **server**, since
`readWatchState()` runs in a Server Component and cannot see `localStorage`.

### `CompanyContextBar`

`lib/position/context-bar.tsx`, on all five tabs directly under `PageHeader`.

- Renders **nothing** when nothing is carried. A strip reading "no company
  selected" on every page is a standing apology for an unused feature.
- Resolves after mount, because `localStorage` does not exist during the server
  render and reading it while rendering is a hydration mismatch.
- `here` names the current tab so it never offers to send you where you are.

### Two things checked and deliberately not built

**Integrators' industry filter was not pre-selected from the sector.**
`AlliancesView` takes `industries` and `CHANNEL_LINKS` supplies them, but every
`industries` array in `lib/aie/alliances/seed.ts` is empty. Syncing the sector
into it would drive a control with nothing behind it.

**ModelEngine does not change its model pick from the sector.** The role library
holds one profile per cross-industry role, so the sector cannot alter which
model fits a role. Section 8.11 is the evidence-backed exception and covers
customer operations only. The context bar states the company on that tab without
implying it moved the answer.

---

## 8.16 The jurisdiction filter, and the interrogation's memory

### The filter

`JurisdictionFilter` in `lib/desk/shortlist.ts`: `all`, `no-stop`, `cleared`.

Flags are read from `lib/shield/sovereignty.ts` through `vendorIdForSlug`,
never restated, so the shortlist and Trust Rank cannot give different answers
about one vendor. That lens rests on the Shield's own fetched quotes.

| Vendor | Flag | Basis |
|---|---|---|
| DeepSeek | `hard-stop` | its own privacy policy: stores in the PRC, no residency choice |
| Alibaba, Moonshot, Z.ai | `consideration` | documented Singapore hosting, PRC parent |
| 9 others | `none` | US, Canada, France/EU, Israel |

**Three rules, each of which a naive filter would get wrong.**

1. **It runs BEFORE the top three are cut**, not after. Filtering afterwards
   hands back one or two cards and calls it a shortlist. Excluding flagged
   vendors from frontier models promotes AI21 Labs into third; the reader still
   gets three. Pinned by *"still returns three by promoting the next vendor"*.
2. **An unassessed vendor is kept.** `passesFilter()` returns true when
   `jurisdictionFor()` is null. Coverage is **13 of 43** scored vendors, so
   treating silence as a flag would drop most of the market on no evidence. The
   panel states this in those words, and the count comes from
   `jurisdictionCoverage()` rather than being written into prose that would rot.
3. **Every exclusion is named**, with the lens's own `flagNote`. A vendor that
   vanishes from a ranking without a reason is a decision made for the reader.

The reason paragraph renumbers to the filtered field: "first of 12" becomes
"first of N". Pinned by *"renumbers the reason to the filtered field"*.

### The payload is sparse

`byFilter` stores a category under a filter **only where that filter changed
it**. Measured: 18 of 20 variants were byte-identical to `all`, because only
two categories hold a flagged vendor, and carrying all three in full cost 40 KB
to say the same thing three times (65 KB against a 40 KB budget).

Read it through **`shortlistFor()`**, never directly: a missing key means "this
filter changed nothing here", and indexing the record straight would blank most
categories the moment a filter was selected.

### The interrogation now remembers its own questions

`InterrogateState.asked`. The engine received the answers and never the
questions, so it could not see its own turns and re-used the framing it had
just used: two consecutive questions opening *"Across supply chain, HR and
payroll, which functions..."* is what that produced on screen.

`live.ts` now renders the exchange as **Q/A pairs** rather than two flat lists,
forbids rephrasing a question already put, and carries a standard for what earns
a turn: one thing not three joined by "and", their nouns, and only where the two
possible answers would send the finding somewhere different.

### Question shaping is tiered to the depth

| Depth | Question model | Finding model |
|---|---|---|
| Quick | `claude-haiku-4-5` | `claude-sonnet-5` |
| Comprehensive | `claude-sonnet-5` | `claude-opus-5` |

Haiku shaped every question at both depths, which is why a comprehensive run
still produced broad questions: the cheapest tier was being asked to find the
one thing worth asking. `max_tokens` on the question rose from 200 to 700. The
tier label shown to the reader is derived from the same variable as the model,
so it cannot claim Haiku while running Sonnet.

---

## 8.17 Investors are not vendors

`lib/vendor/is-investor.ts`. **Tests**: `tests/investors-excluded.test.ts`, 10.

The ranking engine tracks four investment firms beside the vendors: `a16z`,
`mgx`, `sequoia`, `softbank`, all carrying `category: "AI investor"`.

`scorecardSet()` has excluded them since it was written, on the grounds that
"is it winning, do people trust it, will it still exist in three years" are
questions about a supplier. **That rule was enforced in exactly one place and
was needed in three.**

### What it looked like when it leaked

| Surface | What a buyer was shown |
|---|---|
| "Since you last looked" (Pulse) | All six rows MGX, plus an authored paragraph on unit economics recommending shorter commitments and priced exit terms |
| Pulse momentum panel | *"Worth a dated check before renewing or widening SoftBank"* |
| Pulse headline | *"AWS and Cohere gaining, SoftBank and AI21 slipping"* |

MGX dominated because it is **thinly assessed**: with few inputs behind it,
small revisions swing its scores hard, so it wins any list sorted by size of
movement. It had 12 recorded moves in `signal-changes.json`, joint highest of
any entity tracked.

### Three enforcement points, one definition

| Where | Call |
|---|---|
| `lib/changes/snapshot.ts` `changesSince()` | every reader is buyer-facing, so the filter sits here, not in one panel |
| `lib/market-metrics.ts` vendor roster | drives the momentum panel |
| `lib/market-metrics.ts` `signal()` | gaining, slipping and risks come from the dashboard payload, NOT the roster, so filtering the roster did not reach them |

`composite-data.ts` and `desk/shortlist.ts` now call the same predicate instead
of each declaring `INVESTOR_CATEGORY`.

### Two deliberate choices

**Filtered at read, not at ingest.** `diffSnapshots()` still records investor
movement and `signal-changes.json` still contains it. The snapshot is a complete
record of what moved; the buyer-facing view is the thing that must be filtered.
This also means a snapshot taken before the fix is cleaned on read rather than
needing a re-ingest.

**A predicate over the directory, not a hardcoded list of four ids**, so a fifth
investor added upstream is excluded without anybody remembering to come back
here. Pinned by *"stays in step with the directory as it changes"*.

### A test fixture that had to change

`tests/change-detection.test.ts` used `mgx` as the generic second vendor in its
`buildSinceView` fixture. That test is about falling back to the market when
nothing is watched, and it needs two rows that survive the filter, so the
fixture now names two suppliers. The `diffSnapshots` test still uses `mgx`
deliberately: the raw diff is not filtered.

---

## 8.18 Touch targets and loading states

From a design audit of the live app at 375, 768 and 1280, 16 August 2026.

### Touch targets

`.tap` and `.tap-row` in `app/globals.css`, both inside `@media (pointer: coarse)`.

Twenty interactive elements measured under 44px at 375px, and they were the
chrome a reader touches most: the sidebar toggle, theme switch and notification
bell were 28px each (14px icons in `p-1.5`), the Ask AI pill 36px, and every
`MicroLabel` tooltip 11px.

**Gated on `pointer: coarse` deliberately.** Those sizes are correct for a
mouse, and forcing 44px everywhere would put three oversized buttons in the
desktop header to solve a problem desktop does not have. Only the hit area
grows; padding and border are untouched, so nothing moves visually on either.

Verified after the change: **0** interactive elements under 44px at 375px, and
the theme toggle still measures **28px** at 1280 with `pointer: coarse` false.

### Loading states

`app/(ai-ent)/loading.tsx`, plus the `.skeleton` class in `globals.css`.

The app had **zero** `loading.tsx` files and no Suspense boundary on Trust Rank,
so every dynamic route blocked on its slowest fetch showing the previous page.
Trust Rank takes 1 to 2 seconds fetching vendor status and desk news at open.

One file at the route-group level covers all tabs. Per-route skeletons would be
eighteen shapes to keep in step with eighteen layouts, and a stale skeleton is
worse than an honest generic one. It mirrors `PageHeader`'s geometry so the
layout does not jump when the real page replaces it, carries `aria-busy` and an
`sr-only` line, and its shimmer is switched off under `prefers-reduced-motion`.

`.skeleton` draws from `--ag-base-300` rather than a grey literal, so it sits on
the page's own ground in both themes.

Verified by MutationObserver during a real navigation to `/trust-rank`:
skeleton observed, then replaced by the page.

### Two things audited and found already correct

Recorded so nobody re-opens them.

**Every wide table already scrolls in its own container.** All 12 tables
carrying a `min-w-` have an `overflow-x-auto` ancestor, and no page overflows
the body at 375 or 768. Four tables have no scroller and need none: they are
`w-full` with no minimum, so they compress rather than overflow.

**Keyboard focus is already drawn correctly.** `globals.css:279` uses
`:where(a, button, select, input, textarea, summary, [tabindex]):focus-visible`
with a 2px `--ag-primary` outline. `:focus-visible` rather than `:focus`, so a
pointer click leaves no ring behind, and `:where()` so it never fights component
specificity.

### A trap worth not repeating

Running `next build` **while the dev server is running** overwrites `.next` and
breaks the running server's chunks: `layout.js` and `main-app.js` start 404ing
and the page hangs on the loading state forever, which looks exactly like a
broken `loading.tsx`. It is not. Stop the dev server before building, or clear
`.next` and restart afterwards.


---

## 8.19 The three vendors a cited finding recommends

`lib/desk/three-vendors.ts`. The three are **computed before the model writes
a word**, from the weighted assessment, and the model is told it may not change
them.

**Why not let the model pick.** `scripts/audit-cited-findings.ts`, run 17
August 2026, retrieved over the cited corpus for ten realistic buyer
situations. It surfaced **zero to two distinct vendors** per situation, and the
ones it surfaced shared words with the question rather than fitting it: a
European bank asking about agentic onboarding retrieved Cohere and DeepSeek.

**Selection.** `categoryRanking(marketId).ranked.slice(0, 3)`, read and never
re-sorted. `tests/three-vendors.test.ts` asserts the ids and composites equal
the source ranking's first three.

**Market detection.** `detectMarket()` returns `null` rather than guessing, and
a null market means the finding recommends nobody and names the market it
needs. A market named outright beats one inferred.

**Coverage stated, not implied.** `alsoRanked` and `held` are carried so a
reader is never shown three from a market of five as though it were the whole
market.

**Contract evidence.** `SHIELDED` is built from `vendorIdForSlug` over the
Shield. **15 of the 39 recommended vendors across the thirteen markets carry
Shield evidence**, and in six markets none of the three does, because the
Shield grades model providers' published terms while the assessment ranks every
market. The prompt block states that once instead of the model writing "no
evidence on X" per vendor.

**Handoff.** `profileHref` only. ModelEngine, Trust Rank and Integrators read
the shortlist cookie and not a query param, so the page carries all three onto
the shortlist and then links; a `?vendor=` link would have filtered nothing.

**Length bound.** Under 220 words with three vendors, under 180 without. There
was no bound before, and no requirement to name a vendor at all.

**Option list.** `depth` is `"quick" | "comprehensive" | "weighted"`
(`app/api/interrogate/lib.ts`). Weighted sets `maxQuestions` to 0.

---

## 8.20 Competitive Intel: two corrections

**The insight was computed on the wrong population.** `competitiveInsight()`
took a `categoryName` and a provider count scoped to that category, then read
`aiVendors(m)`, which is every tracked vendor. Measured 17 August 2026:

| Population | top | median | spread | branch | action |
|---|---|---|---|---|---|
| All tracked vendors (what it used) | 75.5 (TSMC) | 57.6 | 17.9 | wide | Shortlist |
| Every one of the 13 categories | 59.3 to 75.5 | varies | **0.0 to 11.2** | narrow | Renegotiate |

TSMC, a chip foundry, was setting the top for a page about model providers. The
conclusion was inverted in every category. `competitiveInsight()` now takes
`rows: CapabilityRow[]` and derives `providerCount` from them, so the count and
the scores cannot disagree. Pinned by `tests/competitive-insight.test.ts`.

**The category dropdown offered 7 of 13.** `PROVIDER_CATEGORIES` in
`app/(ai-ent)/competitive-intel/provider-matrix-data.ts` excluded silicon,
compute and services on the stated grounds that the capability rubric does not
describe them. Checked against `fixtures/aie-live/capabilities.json`: all 47
assessed vendors carry all 10 capabilities, scored, graded and status-stamped.
NVIDIA is assessed on enterprise assistant at 45, `verified`, grade E2. The set
is removed.

---

## 8.21 Retrieval: stemming

`app/api/analyst/lib.ts`, `stem()`. Substring matching is asymmetric: a query
term "train" matches a chunk saying "trains", but "retired" never matches
"retiring". "Which models are being retired and when do our calls start
failing" retrieved **no deprecation chunk at all**. Suffix stripping now runs on
both sides, paired with a whole-word prefix test and OR-ed with the original
substring test, so it only adds recall. Corpus reach across the ten audit
situations: **34 chunks to 40**.

`lib/desk/corpus.ts` was also the only consumer in the codebase bypassing
`upcomingDeprecations()`, so three already-retired models were stated in the
future tense. Past retirements now read in the past tense and are kept.


---

## 8.22 The carried chain: position to desk to engine to Trust Rank

Four tabs that each asked their question in isolation, joined so a reader
establishes something once. Added 18 and 19 August 2026.

**Modules**: `lib/position/opportunities.ts`, `lib/position/handoff.ts`,
`lib/workflow-category-map.ts`.
**Tests**: `tests/opportunities.test.ts` (17), `tests/handoff.test.ts` (7),
`tests/position-store.test.ts` (23).

### Where AI could go: derived, never written

The research prompt forbids carrying in anything the passages do not contain
(section 7 of `lib/research/company.ts`). So the stand is taken from the
workflow catalogue keyed on `sectorTag`, not from the model's impression of the
company. `opportunitiesFor()` returns null when `placeSector()` found no
sector, rather than inventing one.

| Field | Meaning |
|---|---|
| `basis: "evidenced"` | the company's own retrieved sources spoke to this area, and `evidence` quotes them |
| `basis: "sector"` | the catalogue holds this workflow for their sector and the sources were silent |

`evidenceFor()` requires two matching content words over 4 characters, or one
on a single-word label. Deliberately conservative: a miss costs a "sector"
label where "evidenced" was available, which understates. A false match would
put a claim about the company on screen that its sources never made.

### Claims are scoped to the LEAD three, not all eight

`lead = top.slice(0, 3)`. Everything asserted about the company (`topRisk`,
`regulatoryFlags`, the weighting, the situation line) is computed from these.

Aggregated across all eight, `regulatoryFlags` told a retail bank that
**BASEL_III, EU_AI_Act, FINRA, GDPR, HIPAA, MiFID_II, PCI_DSS and SOX** applied.
HIPAA does not apply to a bank: it was carried by a workflow far down the list
the bank would never run. A flag is a fact about a workflow, and asserting it of
the company is defensible only for the areas actually put forward.

`regulatoryFlagSentence()` phrases them as "these areas carry X", never
"X applies", for the same reason.

### The starting weights, and why proportions rather than maxima

Targets the four dimensions `assess-decide-view.tsx` renders sliders for:
`strategic_fit`, `execution_readiness`, `governance_trust`, `economics`.

```
strategic_fit       0.30
execution_readiness 0.20 + 0.20 * ((avgReliability - 1) / 4)
governance_trust    0.15 + 0.25 * (0.5 * criticalShare + 0.5 * flagLoad)
economics           0.20 - 0.10 * heavyShare
```
then normalised so the four sum to 1. `flagLoad = min(flags, 6) / 6`.

A first cut used the highest risk tier and the highest reliability requirement
and returned an **identical weighting for a bank, a hospital, a retailer, a
school, a law firm and a software company**: every sector's most valuable AI
workflows are high-risk and reliability-critical, so a max saturates at once.
Measured after the change:

| Sector | fit | exec | gov | econ |
|---|---|---|---|---|
| Financial services | 0.26 | 0.35 | 0.30 | 0.09 |
| Healthcare | 0.27 | 0.36 | 0.28 | 0.09 |
| Manufacturing | 0.31 | 0.38 | 0.20 | 0.10 |
| Technology and software | 0.29 | 0.36 | 0.19 | 0.16 |

Pinned by "actually varies by sector" and "weights governance higher for a
regulated sector than for software". With no sector, the Desk's own balanced
preset is returned unchanged.

### The two vocabularies, bridged

`SECTOR_TO_INDUSTRIES` maps the workflow catalogue's 15 sector tags to the role
library's 37 industries; `CATEGORY_TO_FUNCTION` maps workflow categories to role
functions. Both hand-written, because the lists were authored independently and
no mechanical join exists: "Healthcare Providers" and "Pharmaceuticals" are both
healthcare-adjacent and only one of them is what `healthcare` means.

One tag maps to SEVERAL industries and that is the honest shape rather than a
limitation. `financial_services` covers retail banking, investment banking,
payments and asset management; the first is the default and the rest are
returned as `alternatives`.

**Every mapped value is asserted against `roles.json`** by
`tests/handoff.test.ts`, so a typo cannot preselect a menu entry that does not
exist.

**The role is never preselected.** `model-fit.tsx` states the rule in its own
comment: a role sitting there by default is one the tool answered on its own.
Industry and function are context the reader established about themselves; the
role is the question they came to ask. `modelEngineHandoff()` returns no role
field at all, pinned by test.

### Trust Rank narrows nothing

`app/(ai-ent)/trust-rank/components/your-exposure.tsx` states what the carried
company and shortlist make relevant and filters nothing. Deciding which law
binds a reader from a workflow tag is not a judgement the evidence supports, so
the register stays whole and the panel says where to start.

### Flag labels

`flagLabel()` maps `EU_AI_Act` to "the EU AI Act", `FDA_21CFR11` to "FDA 21 CFR
Part 11" and so on. These were reaching the screen as identifiers, which is the
same defect as leaking a raw taxonomy id and has now shipped three times. An
unmapped flag falls back to its identifier with underscores spaced, so a new one
degrades rather than breaking. Pinned by a test asserting no `[A-Za-z]_[A-Za-z0-9]`
reaches the weighting rationale.

### The change notification

`POSITIONS_CHANGED`, dispatched by `write()` in `lib/position/store.ts`. A DOM
event rather than a store or a context, because the consumers are siblings
across three trees and the window is all they share; `storage` fires in OTHER
tabs and never the one that made the change.

**It is dispatched outside the try that wraps `setItem`.** Inside it, a window
without `dispatchEvent` threw, the catch ran, and a write that had already
succeeded was reported as failed: the save button told a reader it had not saved
something it just had. A missed notification costs a stale panel until the next
navigation; a wrong return value costs the reader their work. Pinned by "never
turns a successful write into a reported failure".

### Two client-side traps recorded

**A ref survives a client-side navigation.** `started.current` guarded the `?q=`
handler, so Ask AI did nothing whenever the reader was already on the Decision
Desk: the URL changed and the previous answer stayed. It now tracks WHICH
question was acted on (`startedQ`), and defers rather than consumes one that
arrives while a stream is running, because `start()` bails on `busy`.

**A state updater has to be pure.** Calling `setInput` from inside the
`setOffered` updater did not run, so the context bar cleared while the chip and
the prefilled box carried on naming the company. Read through a ref instead.

### The build boundary, a third time

`lib/workflow-category-map.ts` exists because reading `WORKFLOW_CATEGORY_MAP`
out of `lib/workflow-vendors.ts` pulled in `lib/aie-server.ts` and therefore
`node:fs`, and the production build failed with "Can't resolve 'fs'".
**Typecheck and 607 tests passed with the bad import.** Only `next build` sees
this. Same shape as `shortlistFor` and the workforce payload.


---

## 8.23 The finding weighs a strategy, not a role

Four defects and one redesign, 19 August 2026. `lib/desk/three-vendors.ts`.
**Tests**: `tests/three-vendors.test.ts`, 25.

### Keyword matching fired inside ordinary words

`MARKET_WORDS` was matched with `String.includes`. Measured against one
innocent retail sentence:

| Keyword | Fired inside |
|---|---|
| `ide` | provide, decide, wider, outside |
| `rag` | average |
| `code` | barcode, postcode |
| `process` | processing |

"provide", "decide" and "outside" are unavoidable in a sentence about a
decision, so almost any Decision Desk situation scored a hit for
`developer_coding_agent`. A luxury food retailer asking about discount approval
was placed in that market and recommended vendors for a market it had never
mentioned.

`hasPhrase()` now matches on a word boundary, with one trailing plural allowed
so "GPUs" and "chips" still land. The optional `s` cannot reopen the hole: a
leading-boundary failure rejects "provide" before it is considered. The same
function guards the named-outright check above it, which had the same flaw.

### The three now span the reader's markets

`threeVendorsFor(text, opp?)` has two shapes:

| `spread` | When | What it returns |
|---|---|---|
| `across your strategy` | a position is carried and its areas name markets | the LEADER of each of up to three different markets |
| `one market` | nothing carried | the top three of one detected market |

`strategyMarkets()` turns the wire position into `{ sectorLabel, marketIds }`
via `opportunitiesFor()`, so the markets come from the company's own AI areas
(section 8.22) rather than from the words the reader typed.

A vendor is taken once: `seen` stops one competing in several of the reader's
markets from filling two slots and leaving a market unrepresented.

**Comparability is preserved and stated three times.** Each vendor is number one
in ITS OWN market and none is ranked against the others. The prompt block
forbids saying one outscores another, the card renders the market label instead
of a rank number, and the panel says a 3.34 leading one market and a 2.25
leading another are two readings rather than a league table.

**This is why the three are no longer all frontier labs.** That was a
consequence of the single-market path, not a policy: `frontier_model_api` was
simply what most situations detected. Across a retail strategy it returns
Anthropic leading agent platform, OpenAI leading enterprise assistant and Oracle
leading CRM, verified against production.

### Security and data are carried every time

`SECURITY_DOMAINS`, four of the fourteen the composite already weighs:

```
data_security_privacy · security_threat · governance_compliance · identity_access
```

`securityRead()` returns all four for every vendor, scored or explicitly not
scored, and they render on every card. `strongest` only ever showed what a
vendor is best at, so one weak on data handling never mentioned it and the
reader had to notice an absence. Oracle scores 1.6 on identity access and 1.6 on
security threat while leading its market at 2.25.

The prompt block carries `SECURITY AND DATA ARE NOT OPTIONAL HERE` and requires
a sentence per vendor, plus an explicit note where a vendor's security sits
materially below its own composite.

### `sectorTag` crosses the wire

Added to `PositionContext` (`lib/position/store.ts`) and to
`InterrogateState.position`. **Validated in `sanitisePosition()` against
`TAG_LABEL`** rather than taken as given: it decides which markets the finding
shops in, so an arbitrary string arriving there would choose vendors.

### The carried company attaches without being named

`matchPosition()` requires the company name to appear in the reader's own
sentence, which was right when a position supplied only prose. Once it also
decided the markets, clearing the prefill and writing your own sentence dropped
you to one guessed market while the context bar still said the company was
carried.

`start()` now falls back to `toContext(carried)` **with `aiFindings` and
`findings` emptied**. The sector is the reader's own carried choice and the bar
announces it; the research statements are claims about a company they did not
name in this sentence, so they stay out and nothing can be misattributed. The
strict name match still governs everything said about the company.

### A third instance of state initialised on mount

`decision-desk-view.tsx` held `tool` as `useState(initialTool)`. The finding's
own "Score it against your weights" link points at `/decision-desk?tool=assess`
and the reader clicking it is already on that route, so the URL changed and the
step did not move. It now tracks which `?tool=` was acted on, and scrolls the
panel into view: switching a step at the bottom of a long finding without moving
the viewport also reads as nothing happening.

Same shape as `started.current` in `interrogate-view.tsx` (section 8.22). A ref
or a `useState` initial value survives a client-side navigation, and every link
this product renders to its own current route is subject to it.

---

## 8.24 The canonical contract: what the model may not contradict

Verified against the working tree at commit `9c59322`, 26 August 2026.

The figure guard answers one question: did the model write a number the data
did not contain. Three failures pass it untouched, because none of them moves a
number. The action reverses, the direction reverses, or a small count is
asserted that nothing supplied. `lib/analyst/canonical.ts` closes all three.

**Every check fails safe.** An ambiguous reading counts as a violation, the
authored text is discarded, and the deterministic prose renders. A false
rejection costs one render its analyst voice; a false acceptance costs the
reader the truth.

### Action intent, and why it is declared rather than inferred

`ActionIntent` at `lib/analyst/canonical.ts:47` is five values:
`advance`, `restrain`, `examine`, `select`, `press`. The first two are
COMMITTED (`COMMITTED`, `lib/analyst/canonical.ts:54`): they move budget or
scope. The other three are provisional.

The eight `AnalystAction` values map to intent at
`lib/analyst/canonical.ts:66`:

| Action | Intent |
|---|---|
| Accelerate, Expand | `advance` |
| Pause, Reduce exposure | `restrain` |
| Monitor, Investigate | `examine` |
| Shortlist | `select` |
| Renegotiate | `press` |

`intentViolation()` (`lib/analyst/canonical.ts:183`) refuses exactly two
transitions and no others:

- **reversal**: canonical committed one way, rewrite commits the other.
- **strengthening**: canonical is provisional, rewrite commits. Monitor
  becoming Accelerate.

Softening is allowed on purpose. A rewrite turning Accelerate into "Review
before scaling" understates the evidence, which is a worse product and not a
safety failure, and refusing it would discard sound prose.

**The intent is DECLARED by the builder, not read off our own sentence.**
`buildActions()` sets it at `lib/pulse/assemble.ts:193`, `:207` and `:226`.
The third action proves why: "Clear open risks before widening" contains the
word widening and asks for the opposite of widening. `actionIntent()` reads it
as `advance` (`lib/analyst/canonical.ts:137` takes the committed reading when
several match, which is the cautious direction); the builder declares
`restrain`. Classifying our own prose would make the safety of the check depend
on the same fuzziness it exists to guard against.

Enforced at `lib/analyst/author.ts:343`. **The whole set is discarded on one
violation**, not the offending entry: three actions written together are one
argument.

### Direction families

`FAMILIES` at `lib/analyst/canonical.ts:222`. Four axes, two poles each:

| Family | Poles |
|---|---|
| `trend` | up / down |
| `spread` | widening / narrowing |
| `concentration` | concentrating / fragmenting |
| `position` | gaining / slipping |

`BARE_TREND` (`lib/analyst/canonical.ts:257`) matches "up" or "down" only when
followed by a digit, `on`, `from` or `against`, which is how
`pulseJudgement()` writes a direction of travel
(`lib/pulse/judgement.ts:74`). Bare "up" and "down" are far too common in
ordinary prose to be directional on their own.

`claimsFrom()` (`:293`) emits a claim for a family only when the canonical text
lands on **exactly one** of its poles. "Three vendors gaining, two slipping"
names both and therefore claims no direction, which is correct: there is no
single direction there to reverse.

`reversedClaims()` (`:311`) flags the written text only when it lands on the
opposite pole **and says nothing at the claimed one**. Text naming both poles
passes.

Claims are read off the deterministic prose rather than declared by the
thirteen insight builders. The computed sentence IS the canonical statement.
Wired at `lib/analyst/author.ts:137` (insight), `:198` (pulse), `:254`
(since) and `:326` (actions).

### Small-integer counts

`numbersIn()` drops every integer with `|n| <= 10` (`lib/analyst/llm.ts:324`).
That is right for "do these 3 things" and wrong for "3 vendors meet the
threshold", and the difference is entirely the noun.

`COUNTED_NOUNS` (`lib/analyst/canonical.ts:341`) is an explicit list of 46
nouns the datasets hold real counts of. `COUNT_RE` (`:351`) matches a small
integer followed by up to two describing words and then one of them.
Everything absent from the list stays exempt, and "things", "steps", "points",
"inputs", "areas" and "reasons" are deliberately absent: two shipped tests
depend on it (`tests/analyst-llm-guard.test.ts:16` and
`tests/analyst-figure-guard.test.ts:53`).

This lives in a separate function rather than inside `numbersIn()` so that
function keeps its contract, and so the two checks cannot report one figure
twice. Only integers of ten or under are checked here; everything above is
already covered.

Grounding is membership: `unsupportedCounts()` (`:404`) permits a count when
the integer appears anywhere in the facts. Looser than matching noun for noun,
deliberately, so facts saying "3 providers" licence a written "3 vendors".

**`integersIn()` (`:385`) parses whole numeric tokens.** Scanning for bare
digit runs reads "13.7" as a 13 and a 7, and a facts sheet carrying a spread
of 13.7 would then licence "7 vendors clear the threshold" out of nothing.
This was caught by the new tests, not by review.

Dates are stripped from both sides before the count check
(`lib/analyst/llm.ts:373`), reusing `withoutDates()`, so "2026-08-04" in the
facts cannot licence "8 models".

### Entity grounding is packet-scoped

`foreignEntities()` (`lib/analyst/llm.ts:408`) takes an optional `allowed`
list. When a page declares what it covers, that list is the boundary and the
fact prose is not consulted. A computed summary saying "unlike the frontier
labs" used to licence every frontier lab in the roster for the rest of the
answer.

Null or empty keeps the facts-scoped rule, because several pages pass no
entity list and treating an undeclared list as an empty allow-list would
reject every vendor name on them. `authorInsight()` passes its `entities`
argument through at `lib/analyst/author.ts:140`.

### What is NOT covered

- **Off-roster names.** The check is still roster-based, so a wholly invented
  company name is caught by neither this nor the numeric guard. The system
  prompt forbids it and an explicit allow-list makes it less likely. It is not
  mechanically prevented.
- **"5 of the 47 vendors".** More than two words between the number and the
  noun and the association stops being reliable enough to reject prose over,
  so this form is not caught.
- **`authorActions` has no insufficient-evidence state.** `authorInsight()`
  never sends an insufficient page to the model
  (`lib/analyst/author.ts:75`); the actions path has no equivalent concept to
  gate on.

Pinned by 35 tests in `tests/analyst-canonical.test.ts`, including a
`Record<AnalystAction, ActionIntent>` so a ninth action added to the union
fails the typecheck here rather than arriving unclassified and unguarded.

## 8.25 The decision packet

Verified against the working tree at commit `707a789`, 26 August 2026.

Every insight ended in one of eight canonical actions. They are derived from
thresholds we can point at, and they are too broad to act on: "Investigate" is
a direction of travel. `lib/analyst/decision.ts` adds the packet underneath.

`AnalystInsightData.decision` (`lib/analyst/insight.ts:209`) is
`Decision | null`. Required, not optional, so a new builder cannot quietly ship
without one. Null means no recommendation is supportable, which is the
insufficient-evidence case and nothing else: `insufficient()` sets it
explicitly.

All twelve builders carry a packet. Each is filled from figures its own builder
already computed; nothing here introduces a value.

### The shape

`Decision` at `lib/analyst/decision.ts:83`:

| Field | What it is |
|---|---|
| `action` | the canonical action, after the escalation guard |
| `instruction` | the specific thing to do |
| `whyNow` | the change that makes it relevant now |
| `evidenceFor` | supporting claims, each with source, basis and lane |
| `evidenceAgainst` | countervailing claims, same shape |
| `trigger` | the observable change that should reopen it |
| `doNotDo` | the specific over-reach the evidence does not license |
| `strength` | derived, never declared |

`EvidenceBasis` (`:50`) is `measured | modelled | disclosed | absent`. This is
the distinction that stops a modelled share estimate reading like a measured
one.

### Strength is a state, not a score

`EvidenceStrength` (`:77`) is `corroborated | single signal | contested |
insufficient`.

**No confidence percentage anywhere.** Confidence labels were removed from this
platform on request, and a 0 to 100 number over evidence of mixed provenance
would have no methodology behind it. `tests/analyst-decision.test.ts` and
`tests/analyst-insight-panel.test.ts` both assert none appears.

`strengthOf()` (`:123`), derived from the arrays so a builder cannot claim a
strength its evidence does not carry:

- no `evidenceFor` at all, `insufficient`
- any `evidenceAgainst`, `contested`
- two or more DISTINCT `source` values in `evidenceFor`, `corroborated`
- otherwise `single signal`

Independence is counted by distinct source. Three figures out of one dataset
are one signal read three times, and counting them as three would be exactly
the false confidence this exists to stop. `contested` outranks `corroborated`
for the same reason.

### The escalation guard

`resolveAction()` (`:147`). Can only ever WEAKEN the threshold's proposal:

- action intent is not `advance` (per `lib/analyst/canonical.ts`), unchanged
- `advance` on `corroborated`, unchanged
- `advance` on `insufficient`, becomes `Monitor`
- `advance` on `single signal` or `contested`, becomes `Investigate`

**`restrain` is deliberately not downgraded on contested evidence.** Weakening
a Pause because the picture is mixed would push a reader toward action on
exactly the evidence saying be careful, which is the wrong direction to fail
in.

One shipped builder is affected: `workflowInsight` proposes `Accelerate` on its
low-risk branch and survives only because the catalogue and the vendor mapping
are two sources. On one it would be downgraded, which is the intended
behaviour and is pinned by test.

### Triggers state the threshold they turn on

Seven evidence claims now carry the constant the recommendation flips at (the
40 per cent risk share, the 70 per cent concentration line, the 15 point
capability spread, the 5 times price multiple, the 30 point composite spread).

This was found by test, not review. A trigger reading "the high-risk share
rising above 40 per cent" was stating a figure that appeared nowhere in the
evidence, which is the same defect as an invented figure even though the
constant is ours. The threshold now sits in the claim, so the trigger is
grounded in the packet it belongs to.

### What the model may touch

Two fields. `mergeDecision()` (`lib/analyst/author.ts:225`) rebuilds the packet
from the computed one and takes only `instruction` and `whyNow` from the draft.
The action, both evidence arrays, the trigger, the do-not and the strength are
copied across, so there is no path by which a model response reaches them.
That is a STRUCTURAL guarantee: the check for "did the model drop the
contradictory evidence" is that the model was never holding it.

The instruction is refused and falls back three ways
(`usableInstruction()`, `:255`):

1. empty
2. `intentViolation()` fires, the same P0 rule the Pulse actions run under
3. `isSpecific()` (`:287`) fails: fewer than six words, or fewer than five
   once the action label is removed. A rewrite that collapses back into the
   action word has undone the thing the packet exists for.

### The panel

`lib/ui/analyst-insight.tsx`, inside the recommendation box that was already
there. No new panel, no new route.

```
[ACTION]
instruction
Why now:    ...
Against this: ...      only when evidenceAgainst is non-empty
Watch for:  ...        only when a trigger is supportable
Do not:     ...        only when one is supportable
```

`Against this` is INLINE rather than in the derivation drawer, deliberately: a
contradiction behind a disclosure control lets a recommendation read as settled
when it is not. Evidence with source, basis and as-of, plus the strength, sit
in the existing drawer, which is where the brief puts provenance.

### Testing note

`vitest.config.mts` gained `oxc: { jsx: { runtime: "automatic" } }`. The app's
tsconfig sets `jsx: "preserve"` for Next, which leaves vite unable to parse a
`.tsx` component. Setting the transform in the vitest config rather than the
tsconfig keeps the build untouched. It is what lets
`tests/analyst-insight-panel.test.ts` render the real panel and read its markup,
which is repeatable in a way a screenshot is not and does not need the demo
shell's basic auth.

### Remaining limits

- **`doNotDo` and `trigger` are authored per branch, not derived.** They are
  written from the branch's own figures and are grounded by test, but they are
  sentences a person wrote rather than values computed from data.
- **`evidenceAgainst` is builder-declared.** Nothing detects a contradiction
  the builder did not think to record.
- **Two builders carry a single source**, so their strongest available action
  is capped. That is the guard working, and it means those pages cannot reach
  `Accelerate` or `Expand` until a second source is wired in.

37 tests across `tests/analyst-decision.test.ts` and
`tests/analyst-insight-panel.test.ts`.

## 8.26 Cross-signal intelligence

Verified against the working tree at commit `334afb7`, 26 August 2026.

Each page reached its own conclusion from its own datasets, and the conclusions
that matter most to a buyer are not on any one page. This is the layer where
they meet.

### The signal map, from the audit that preceded this

| Source | Metric | Direction available | Provenance | Freshness (vs 26 Aug) |
|---|---|---|---|---|
| `categoryComposites` | composite 0-5, rank, grade | no prior held | measured | 17 Aug, 9d |
| `vendors[].momentum` | momentum | published delta | modelled | 17 Aug |
| `kpis[].delta` | tracked average + change | **real prior** | derived | 17 Aug |
| `shares[].changePct` | category share | **real prior**, gated | modelled estimate | 16 Aug, 10d |
| `cost-capability` | intelligence vs input $/M | none | measured + disclosed | benchmark 24 Jul, **33d** |
| `capabilities` | 10 caps x 470 vendors | none | measured | 17 Aug |
| `reputation` | 3 pillars, 29 vendors | only at 2+ captures | curated seed | 16 Aug |
| `uptake` | adoption share | none | **modelled, not audited** | May 2026 model |
| SEC disclosure | disclosing / total | none | measured | varies |
| alliances graph | edges, verified, breadth | none | measured | seed |
| `risks` | open findings, severity | none | measured | 17 Aug |
| `gaining` / `slipping` | movement classification | **direction, no magnitude** | modelled | 17 Aug |
| `news` | 500 items, impact, sentiment | dated | feed | 24 Jul to 27 Aug |

**Three of thirteen sources carry a prior. None carries three.** So most
readings are states, and acceleration is not derivable from anything this
product currently holds.

### The signal contract

`lib/analyst/signals.ts`. `Signal` at `:69`, ten dimensions at `:37`.

`state` is the dataset's own word ("narrow", "tight", "sole-sourced") and
`magnitude` is optional and native. **There is no numeric normalisation.**
Forcing a 0-5 composite, a percentage and a price multiple onto one scale would
compare things that do not compare, which is the same error as ranking across
market categories.

**`signal()` (`:138`) strips a direction from a single observation at
construction.** Not filtered downstream, removed at the door, so there is no
path by which a caller talks it back in.

`temporalClass()` (`:103`):

| Observations | Class | May say |
|---|---|---|
| 1 | `state` | "Vendor A leads" |
| 2, differing | `change` | "Vendor A's lead has narrowed" |
| 3, change growing | `acceleration` | "the narrowing is faster" |

`stateWording()` is how prose asks for a verb and gets "is narrow" back when
the observations are not there.

`worstLane()` (`:188`) means a synthesis can never outrank its weakest input.
`coincident()` (`:179`) returns false for any undated reading.

### The comparison universe

`SignalPopulation` (`lib/analyst/signals.ts:87`), five members, declared on the
reading rather than inferred from its dimension:

| Value | What it covers |
|---|---|
| `frontier-model-providers` | the `frontier_model_api` taxonomy category |
| `tracked-vendor-set` | every non-investor vendor the assessment tracks |
| `tracked-public-vendors` | tracked vendors with public filings |
| `tracked-delivery-channel` | delivery firms carrying tracked relationships |
| `unspecified` | not declared, and refused by every like-for-like rule |

`samePopulation()` (`:116`) returns false where either side is `unspecified`,
including when both are. Two readings nobody has scoped are not thereby about
the same thing, which is the same rule `unknown` freshness follows.

**Why it exists.** The capability half of `capability-price-divergence` was
taken across every non-investor vendor and the price half across frontier
language models. Measured on the live feed on 27 August 2026: 43 vendors
spanning 10 categories, of which 12 are frontier model APIs and the rest are
silicon, cloud platforms, CRM, ITSM, RAG, sovereign and regulated-industry
suppliers, most of which sell nothing a token price can be quoted for. The two
readings answered different questions and the combined sentence described a
market nobody had measured.

Measured spread, top to median, on `maturity`:

| Population | n | Spread | State |
|---|---|---|---|
| every non-investor vendor | 43 | 17.1 | `wide` |
| `frontier_model_api` cohort | 14 | 10.6 | `narrow` |

The 10.6 is the figure Competitive Intelligence already reports for the same
14 providers, so the page's reading was right and the cross-signal reading was
the one measuring the wrong set.

`frontierCohort()` (`lib/analyst/cross.ts:43`) takes membership from
`m.categoryComposites["frontier_model_api"]`, the ranking engine's own
taxonomy, **not** the vendor row's `category` string. Google's row reads
`Cloud AI platform` and it competes in frontier models; the taxonomy carries it
and the row does not. `loadFrontierFaceOff()` scopes the Price / Performance
face-off from the same category, so both surfaces rest on one definition.

Capability and reputation are each emitted twice, over both populations:
`capability-spread` (`cross.ts:89`) and `capability-spread-frontier` (`:118`),
`reputation-spread` and `reputation-spread-frontier` (`:322`). A cohort with
fewer than three scored members produces no frontier signal.

### The eight relationships

`lib/analyst/synthesis.ts`, `RULES` at `:154`. Each names the exact dimensions
and states it needs and returns null otherwise. No scoring, no weighting, no
inference over rules.

| id | Relation | Bearing | Needs | Same pop. | Same vendor |
|---|---|---|---|---|---|
| `capability-price-divergence` | reinforces | supports | capability narrow + price wide | yes | no |
| `strength-risk-divergence` | contradicts | against | position leads + risk open/high | no | yes |
| `adoption-delivery-divergence` | contradicts | against | adoption high + delivery sole-sourced | no | no |
| `concentration-alternatives` | reinforces | against | concentration tight + clear lead | no | no |
| `commercial-tradeoff` | contradicts | against | price wide + reputation weak | yes | no |
| `reinforcing-movement` | reinforces | supports | two trends, same direction, different sources | no | no |
| `contradictory-movement` | contradicts | against | two trends, opposite directions | no | no |
| `simultaneous-change` | coincides with | supports | two trends inside one window | no | no |

**`requiresSamePopulation`** (`synthesis.ts:196`) marks a rule that weighs one
measurement against another and so needs both over the same universe. Enforced
twice: `findComparable()` (`:144`) selects the comparable reading in the rule's
own `match`, and the loop in `synthesise()` (`:514`) refuses to emit any such
finding whose matched signals disagree, whatever the match returned.

**`requiresSameSubject`** (`:206`) marks a rule whose conclusion is about one
named company. The check at `:524` is an INTERSECTION of each signal's
`members`, not a union: a union is satisfied by two readings about two
different companies, which is the pairing it exists to refuse. Measured before
the fix, on the live feed: `position-lead` carried SAP, the widest lead in
workflow automation, and `risk-open` carried Cerebras, first by sort order on
the register. The finding named both and its implication said "this vendor",
and the two were unrelated companies in unrelated markets. `risk-open` now
carries every high-severity vendor in `members` and states the register at
register level.

Specific rules run before generic ones and a signal consumed by one is not
reused by another, so the same two readings cannot produce two findings saying
the same thing twice.

`jointTemporal()` takes the WEAKEST input's class. A change combined with a
snapshot is a statement about a snapshot.

### What a page may name

`authorInsight(computed, context, entities, ...)`. The third argument is the
boundary for factual naming: `foreignEntities()` treats a name outside it as
the model reaching past the page's data. Five pages declared that boundary as
an arbitrary prefix of what they hold.

| Page | Declared | Actually covers |
|---|---|---|
| `vendor-view` | `vendors.slice(0, 12)` | 43 vendors |
| `competitive-intel` | `vendors.slice(0, 12)` | 43 vendors |
| `market-watch` | `vendors.slice(0, 12)` | 43 vendors |
| `reputation-tracker` | `vendors.slice(0, 12)` | 43 vendors |
| `price-performance` | `models.slice(0, 14)` | 330 models, 18 providers |
| `alliances` | `.slice(0, 14)` | the whole delivery map |
| `financial-snapshot` | `[]` | 9 public and the private rungs |

**Measured, 29 August 2026.** Vendor View's own computed reading names SAP,
Google, Groq and Lambda, all four outside its first twelve. The model quoting
the page back to itself was rejected with "a vendor this page's data does not
cover", retried, failed again and the page rendered its computed text on every
load. The guard was correct; the declaration was wrong.

The truncation bought nothing: 43 vendor names is 410 characters. The one place
a full list would have been costly is `price-performance`, where 330 model
names is 8,430 characters, so that page declares its 18 providers (150
characters) plus the frontier face-off and frontier models it actually
discusses. `peer-insights` keeps an empty list, correctly: it reads the
workflow catalogue and carries no vendor roster.

`tests/analyst-page-entities.test.ts` fails on a `.slice(0, N)` over a covered
set, and on an empty declaration from a page that holds a roster.

### The authoring contract

`lib/analyst/author.ts`, `authoringContract()` at `:89`. The deterministic
layer enforced two rules on itself and on nothing else, then handed the model
the finished prose as one undifferentiated block in which neither rule was
visible or checkable. Both shipped as defects on 27 August 2026:

| Shipped | Evidence behind it |
|---|---|
| "adoption demand ... keeps climbing" | one observation, no prior held |
| a why now built on the capability/price finding | benchmark 34 days old, `aging` |

Neither moved a figure, named an off-page vendor or reversed a direction, so
every guard passed them. Two checks were added, both deterministic, both run
inside the existing retry loop in `generate()`. **No additional model call.**

**Temporal.** `TemporalLicence` (`canonical.ts:437`) is the same three words
`temporalClass()` returns. `temporalViolations()` (`:499`) matches two lists:
`CONTINUATION` (`:459`, 14 patterns) needs `change` or better, `ACCELERATION`
(`:483`, 7 patterns) needs `acceleration`. Bare progressive verbs are bound to
a copula ("adoption IS rising") so an ordinary noun phrase ("the rising tide of
enterprise AI") is left alone.

The licence comes from `Synthesis.temporal` of the findings that actually reach
the prompt, not from every signal the page holds. Price / Performance carries a
movement reading with two observations that fires no rule and never enters the
fact sheet; licensing trend words off it would grant vocabulary for a claim the
model cannot cite. Where no finding reaches the prompt, `temporalFromText()`
(`:530`) reads the licence off the canonical prose, the same move `claimsFrom()`
makes for direction.

**Freshness.** A finding is barred from grounding a why now when
`canCreateUrgency(freshness)` is false or its bearing is `against`, which are
`enrichWithSynthesis()`'s own two rules. `restrictedVocabulary()` (`:624`)
subtracts the permitted material's words from the barred findings' words; what
remains could only have come from evidence the deterministic layer refused to
build a why now on, which makes its appearance mechanically detectable without
any judgement about meaning.

Matched on a **four-character stem** (`:624`). Exact matching restricted
"price" while the permitted evidence said "priced", which would have thrown
away any legitimate rewrite mentioning the price gap. `GENERIC` (`:593`)
drops connectives for the same reason: "across", "while", "between" appear in
every third analyst sentence and protect nothing.

`IMMEDIACY` (`:648`) is the second half: where nothing in the packet is current,
the why now may not assert that the reader must move now, however it is worded.

Scoped to the `whyNow` field alone (`llm.ts:358`). An aging finding is
legitimate background, legitimate evidence for or against, and legitimate
grounds for what to investigate. It is not a reason to hurry.

**Measured on the live product, 28 August 2026.** `/alliances` holds an undated
adoption reading, so the finding built on it is barred. The model reached for
it twice and the guard refused twice:

```
retrying insight:alliance channel: "implement" in whyNow, which draws on
  evidence barred from establishing that this is happening now
discarded insight:alliance channel: "adoption"; "concentrated"; "openai";
  "signal" in whyNow ...
```

The page rendered the computed sentence. On the next generation the model
worked inside the labelled contract and produced an authored why now that
passed.

### Causality

`Relation` (`:50`) has four members and none is causal.

`CAUSAL_WORDS` (`:64`) is 17 entries, and `claimsCausality()` is asserted
against every finding and implication the module produces. A rule author who
writes "drove" gets a failing suite rather than a plausible sentence in front of
a buyer.

It is also wired into the generation loop: `CanonicalGuards.forbidCausal`
(`lib/analyst/llm.ts`) adds causal words to the discard-and-retry list, set only
where cross-signal findings are actually in the prompt. Turning it on
everywhere would reject ordinary prose ("due to" appears in sound sentences)
for no protection.

### How it reaches a recommendation, and the ceiling on it

`enrichWithSynthesis()` (`lib/analyst/cross.ts:364`) adds each finding to the
packet as evidence on the side its `bearing` names, then calls `decide()` again.

Everything after that is the machinery from 8.25: `strengthOf()` sees the
contradiction and returns `contested`; `resolveAction()` refuses to let a
committing action stand on contested evidence.

`mergeDecision()` (`author.ts:373`) is the second line: a why now that breaches
the contract is replaced by the computed one rather than rendered, so a guard
missed upstream still cannot reach a reader.

**So a synthesis can weaken a recommendation and cannot strengthen one, and it
does so THROUGH the deterministic rules rather than around them.** Nothing in
this layer names an action. Measured: an `Accelerate` page given a
strength/risk divergence returns `Investigate`, with the trigger set to
"either half of this disagreement moving".

An insufficient-evidence page has no packet, so synthesis cannot conjure a
recommendation onto one.

### What may answer "why now"

Two independent tests, both in `enrichWithSynthesis()` (`cross.ts:517`):

```
const urgent = found.filter(
  (s) => s.bearing === "supports" && canCreateUrgency(s.freshness)
);
```

**Bearing.** Why now is the case FOR acting, so only a supporting finding may
appear there. This filtered on currency alone, and the result was that a
contradiction current enough to matter was copied verbatim into both `whyNow`
and `evidenceAgainst`: the reader was shown one sentence as the reason to move
and as the reason not to. Measured on the live feed on 27 August 2026, before
the fix, on three of the four wired pages:

```
Why now:      ... Across datasets: On the assessment SAP is clear, and leads
              its market, and on the risk register Cerebras is carrying 6 open
              high-severity findings. ...
Against this: [the same sentence]
```

**Freshness, on the stricter of two tests.** `speaksToNow()`
(`freshness.ts:178`) admits `current` and `aging`; `canCreateUrgency()`
(`:205`) admits `current` only.

| State | May inform the decision | May be why we act now |
|---|---|---|
| `current` | yes | yes |
| `aging` | yes | no |
| `stale` | no | no |
| `unknown` | no | no |

The two questions are different and were answered by one test. A reading past
its source's own refresh window has had a full cadence to move since anybody
looked; it is still evidence about the decision and it is not news. This is the
gap the freshness module's own header describes and did not close: it records
"a benchmark capture 33 days old feeding a why now", the shelf life correctly
called that reading `aging`, `speaksToNow` let `aging` through, and the capture
went on feeding a why now. **The shelf life was never the defect. What urgency
required was.**

### Date provenance: what a timestamp is allowed to mean

`freshnessOf()` ages a reading against its source's shelf life. That is only a
meaningful question when the date it is handed is the date the reading was
TAKEN. Eight of the nine signals feeding decision intelligence were handed the
timestamp their upstream stamped on the response, so they classified `current`
by construction and could never reach `aging` or `stale`. The shelf-life table,
`speaksToNow()` and `canCreateUrgency()` were all inert for those sources.

**Measured, 28 August 2026.** A call whose legs returned at 18:38:16 came back
with:

| Field | Value | What it is |
|---|---|---|
| `generatedAt` | `18:38:16.140Z` | the clock when that leg returned |
| `reputationAsOf` | `18:38:16.242Z` | the clock when that leg returned |
| `shareAsOf` | `18:38:16.261Z` | the clock when that leg returned |
| `compositesCapturedAt` | `2026-08-17T10:45:37Z` | a real capture, 11 days old |

`lib/analyst/llm.ts` records the same behaviour from the other side: three calls
two seconds apart returned three different stamps over identical data.

`DateProvenance` (`lib/analyst/freshness.ts`) names the five things a timestamp
can be, and `evidenceDate()` returns null for the two that are not evidence
dates:

| Provenance | Usable as an evidence date |
|---|---|
| `capture` | yes |
| `publication` | yes |
| `filing` | yes |
| `response` | **no** |
| `unknown` | **no** |

`DATE_PROVENANCE` (`lib/market-metrics.ts`) declares which is which, in the one
file that knows what upstream field each value came from. `signalsFromMetrics()`
resolves every `observedAt` through it. `evidence.asOf` is deliberately left on
the response stamp: it is what the panel's "last updated" means, and it is a
true statement about when we read the data.

**No substitution.** The vendor rows carry `lastUpdated` of `2026-05-07`,
identical across all 43 and sitting beside a `compositesCapturedAt` eleven days
old, which reads as a roster stamp rather than an assessment date. Using it
would assert upstream semantics this repository cannot establish, and asserting
evidence is older than it is would be the same class of error as asserting it
is fresher. Null, and therefore `unknown`, is the honest answer.

**Freshness provenance of every active signal after the fix:**

| Signal | Date used | Provenance | Freshness | May create urgency |
|---|---|---|---|---|
| `capability-spread` | none | response, refused | `unknown` | no |
| `capability-spread-frontier` | none | response, refused | `unknown` | no |
| `position-lead` | `compositesCapturedAt`, 11.4d | capture | `current` | yes |
| `concentration` | none | response, refused | `unknown` | no |
| `risk-open` | none | response, refused | `unknown` | no |
| `movement` | none | response, refused | `unknown` | no |
| `reputation-spread` | none | response, refused | `unknown` | no |
| `reputation-spread-frontier` | none | response, refused | `unknown` | no |
| `price-separation` | `capturedAt`, 35.8d | capture | `aging` | no |

**Consequence, stated plainly.** `capability-price-divergence` requires
currency and its capability half can no longer be dated, so it no longer fires.
That is the rule's own `requiresCurrency` doing what it was written to do, not
a suppression bolted on to make a gate pass: the finding claims something about
the market NOW, and half of it cannot be dated. Structural rules
(`requiresCurrency: false`) still consume the undated readings, which is the
existing policy permitting contextual use, so the evidence is withheld from
urgency rather than discarded.

### The 34-day benchmark, and why the shelf life is unchanged

`cost-capability` was captured 2026-07-24 and read 2026-08-27: **34 days**.

`SHELF_LIFE["Artificial Analysis benchmark"]` stays at `current: 21,
stale: 60` (`freshness.ts:50`). Model releases land monthly and each can move
the frontier score, so 21 days is the refresh window and a reading past it has
had a release cycle to be superseded; 60 days is where the leaderboard has
plausibly reordered outright. Both remain defensible for USABILITY.

At 34 days the reading is `aging`. Under the new rule it contributes to
`capability-price-divergence` as evidence and **cannot answer why now**, which
is the honest answer to the product question: a five-week-old price observation
is good enough to inform what you should do and is not the reason to do it this
week. No threshold was moved to reach this.

### Signals from data already fetched

`signalsFromMetrics()` (`lib/analyst/cross.ts:68`) reads six of the ten
dimensions off the `MarketMetrics` a page has already loaded, and emits eight
signals over them: capability and reputation are each emitted once per
population. **No new fetch,
no new data source.** `priceSignal`, `disclosureSignal`, `deliverySignal` and
`adoptionSignal` (`:236` onward) are optional and return null where the page
does not hold the data.

**Movement is gated on `shareMovementPublished`.** When the upstream
republishes identical priors there is no movement, and classifying it as
movement would be a trend made out of a repeated snapshot.

Wired on six pages: `vendor-view`, `market-watch`, `price-performance`
(the only one passing `priceSignal`), `competitive-intel`, `reputation-tracker`
and `alliances` (`deliverySignal` + `adoptionSignal`). Each was a two-line
change and none added a fetch.

### News recency

`NEWS_MAX_AGE_DAYS = 14` (`lib/analyst/insight.ts:117`).

`pickNews` previously filtered on `minImpact` and then took the single highest
upstream impact score, with no reference to the date. **Measured on the shipped
feed on 26 August 2026: the winner was published 31 July, twenty-six days old,
and was rendering as the dated item beside a why-now.**

Now: a hard gate on age, undated items excluded (assuming freshness is the same
class of error as inventing a figure), future-dated items beyond one day
excluded as a feed defect, and selection on a composite at `:189`:

```
materiality 0.4 + recency 0.4 + relevance 0.2
```

Recency decays linearly across the window. Relevance is a bonus for naming a
vendor the page covers, never a gate, so pages declaring no vendor set rank as
before. `minImpact` still applies, so recency alone cannot promote noise.

### Analyst priors

`lib/analyst/priors.ts`. `THESES` at `:72`, five entries.

The system prompt carried five market claims as permanent truths. Three are
structural. Two were claims about the market right now that this product
measures on its own pages:

- "Capability has commoditised faster than price" (Competitive Intel + Price /
  Performance measure both halves)
- "Disclosure is thin" (Financial Snapshot counts exactly this)

Both are **removed from the SYSTEM constant** and now carry a validator.
`resolveTheses()` (`:141`) returns `durable`, `validated`, `unvalidated` or
`contradicted`; `priorsBlock()` (`:171`) states the durable ones always, the
validated ones only where this page's data has just confirmed them, and names
the contradicted ones under "Do NOT state these" rather than dropping them.

`unvalidated` never reaches the prompt. A page with no signals gets the durable
three and nothing else, which is strictly better than asserting all five
everywhere.

**A bug the tests caught here:** the disclosure validator matched `/mostly/`,
which is present in both "mostly undisclosed" and "mostly disclosed", so it
validated the thesis against data contradicting it. The alternation is now
`/undisclosed|thin|minority/`.

### Not a CMS

No editor, no storage, no admin surface, no workflow. A typed list with
validators, read at render.

### Remaining limits

- **Acceleration is unreachable.** No dataset carries three observations. The
  classifier implements it and today returns it for nothing.
- **`evidenceAgainst` is still builder-declared**, and synthesis only adds to
  it. Nothing detects a contradiction no rule names.
- **`cost-capability` is 34 days old** as of 27 August 2026, so the price
  signal is the oldest input to any synthesis that uses it. It is `aging`, and
  therefore usable as evidence and barred from creating urgency.
- **`commercial-tradeoff` is dormant against current data.** It needs a
  reputation reading in a `weak`, `low`, `trailing` or `spread` state, and both
  the landscape spread (13.7 across 28 vendors) and the frontier spread (11.0
  across 14) read `tightly banded`, which is below the 25-point line at
  `cross.ts`. The population guard is in place for when that changes.
- **`strength-risk-divergence` is dormant against current data**, and correctly
  so. The widest lead in the assessment is SAP at 0.8 in workflow automation
  and SAP carries no open high-severity finding. NVIDIA and Groq both lead a
  category and carry one, but `position-lead` reports only the single widest
  lead, so the rule has no leader to match. That is conservative rather than
  wrong: it is silent where there is no contradiction about the vendor it holds.

146 tests across `tests/analyst-cross-signal.test.ts` (49),
`tests/analyst-freshness.test.ts` (40), `tests/analyst-population.test.ts` (24)
and `tests/analyst-authored-contract.test.ts` (33). The last carries three
generations captured from the running product, so the contract is tested
against prose a model actually wrote and not only against prose chosen to fail
it.

**The live authoring path cannot be exercised under vitest.** `authoredResult()`
wraps the call in `unstable_cache`, which throws `Invariant: incrementalCache
missing` outside a Next render, so a test that calls it returns
`failure: "unreachable"` in 3ms and every case falls back for an
infrastructural reason rather than a model one. A suite that reported those
fallbacks as passes would be asserting nothing. Live behaviour is therefore
captured from the dev server and asserted as fixtures.

## 8.27 Company signals and the three-way opportunity classification

Verified against the working tree at commit `8380b25` plus this change,
30 August 2026.

### The classes

`lib/position/opportunities.ts:617` sets the priority base and
`app/(ai-ent)/company-view/components/opportunity-row.tsx` renders the badge.
Every area is exactly one of three, decided in code and never by a model:

| Class | Rule |
|---|---|
| `evidenced` | a retrieved statement names this workflow AND `classifyStatement()` returns `deployed` or `pilot` |
| `derived` | not evidenced, at least one signal at HIGH or MEDIUM argues for the workflow's category, AND `companyEvidence.length > 0` |
| `sector` | everything else |

The last condition on `derived` is the company-specificity gate. It holds
because `lib/position/company-signals.ts` takes no sector, industry or peer
set: its only input type is `CompanyEvidence`, which carries sources,
statements and reconciled financials and nothing else. Pinned by
`tests/company-signals.test.ts`, "cannot build a signal from anything but this
company's own evidence".

### Statement classification

`lib/position/company-signals.ts`, `classifyStatement()`. Five states, checked
in this order, and only the first two are current practice:

| State | Test |
|---|---|
| `sector_example` | `SECTOR_SUBJECT`, a plural industry noun with a verb, an explicit sector reference, or a quantifier |
| `negated` | `NEGATED` |
| `planned` | `PROSPECTIVE` or `EXPOSURE` |
| `pilot` | `PILOT` |
| `deployed` | anything else |

`EXPOSURE` is scoped to the automation sense only: work described as "exposed
to automation" is work available to automate, not work automated. "Exposed to"
in any other sense stays present tense.

Negation is judged on the CLAUSE the match landed in, not the whole sentence.
`CLAUSE_SPLIT` divides on `;` and on contrast or consequence markers, and
`relevantClause()` selects the clause the vocabulary matched. Without it, live
Barclays research classified "More than 250 AI tools and models are already in
use across the group, so the buying question here is consolidation and
governance of an existing estate, not first adoption" as NEGATED.

### Signal states

Ordinal, never scored:

| State | Rule |
|---|---|
| HIGH | two or more current-practice statements, or one reconciled fact |
| MEDIUM | exactly one current-practice statement |
| LOW | only negating statements |
| UNKNOWN | candidates existed and every one was refused |

A dimension nothing touched produces no signal at all. `evidenceState` is
`company_reported`, `company_stated` or `unresolved`.

### The one fact-driven signal

`lib/position/company-signals.ts:384`: `LARGE_WORKFORCE = 25_000`. A settled
employee count at or above it raises LABOUR INTENSITY. `EMPLOYEE_METRIC`
(`company-signals.ts:386`) is the metric-name test, and a fact whose `currency`
is non-null is refused as a money figure rather than a headcount. Only the
large end is used: a small headcount is not evidence of low labour intensity.

A reconciled metric with `usable === false`, which is every CONFLICTING and
INSUFFICIENT verdict, raises nothing and records `unresolved`. Pinned by
`tests/company-signals.test.ts`, "an unsettled figure raises nothing".

### Priority

`lib/position/opportunities.ts:617` to `:655`. Three steps, clamped 1 to 3:

| Step | Effect |
|---|---|
| base | evidenced 3, derived 2, sector 1 |
| converging | +1 where derived and the leading signal is HIGH |
| unproven | -1 where AI adoption maturity is LOW and the workflow needs `reliabilityRequirement >= 4` or `autonomyDefault !== "advisory_only"` |
| legacy | -1 where legacy dependency is HIGH and the category is Engineering, IT or Data |

3 is HIGH, 2 MEDIUM, 1 LOW. Horizontality is deliberately NOT a step: it
cancelled the signal just derived, because the workflows company evidence
argues for are frequently the horizontal ones. It breaks ties in the sort
instead.

### Reliability

`lib/position/reliability.ts:97`. This is NOT `reliabilityRequirement`, which
is the catalogue's assurance bar for the workflow and is identical for every
company. Both are rendered, each labelled for what it is.

| Step | Effect |
|---|---|
| base | evidenced 4, derived 3, sector 2 |
| own record | +1 where a `regulatory_filing`, `annual_report` or `company_announcement` sits under it |
| converging | +1 where two or more distinct signals argue, or the evidence spans two or more sources |
| conflict | -1 where any reconciled metric is CONFLICTING, or INSUFFICIENT across more than one candidate |
| cap | sector never exceeds 2 |

Clamped 1 to 5. `RELIABILITY_MEANING` states what each point asserts. Pinned by
`tests/opportunity-classification.test.ts`, "reliability reflects evidence, not
the catalogue".

### Evidence matching

`evidenceFor()` in `lib/position/opportunities.ts`. Three conditions, all
required:

1. at least `min(2, words)` of the label's content words (over four characters)
   present, and all of them where the label has one or two;
2. matched on a WORD boundary with an optional plural, never as a substring.
   Live Siemens matched "report" inside "vendor-reported" and "audit" inside
   "independently audited"; live Salesforce matched "agent" inside
   "Agentforce";
3. at least one match is a head noun, being the last content word of a label
   segment split on `/` and `&`. Live Boots matched "third" and "party" out of
   one hyphenated compound against Third-Party Vendor Risk Assessment.

## 8.28 Company research: retry stack and generation budget

Measured on 30 August 2026 against live Woolworths South Africa research.

| Constant | Value | File |
|---|---|---|
| `TIMEOUT_MS` | `75_000` | `lib/analyst/llm.ts:92` |
| `SDK_RETRIES` | `0` | `lib/analyst/llm.ts:135` |
| `RETRY_BUDGET_MS` | `90_000` | `lib/research/company.ts:114` |
| attempt 1 output budget | `3200` tokens | `lib/research/company.ts:295` |
| attempt 2 output budget | `2200` tokens | `lib/research/company.ts:296` |

**Why each of them.** Three retry layers were stacked: the SDK's own default of
2 (three HTTP attempts), `generate()`'s two semantic attempts, and
`researchCompany()`'s two source-scope attempts. Up to twelve HTTP requests for
one research call, and a measured 604 seconds end to end. Vercel kills a
function at 300, so the reader got a broken stream.

The SDK layer is the one removed, because it can only resend an identical
request, where the two outer layers retry with a corrected prompt or narrower
sources. Two chances at the network remain.

**The timeout was set at the measured duration.** A direct timing of the
Woolworths call, 4,420 input tokens and a full answer, returned `ms=30491`
against a 30,000ms ceiling. The call landed either side of its own timeout
depending on the day.

**The output budget was too small.** The same timing returned
`stop_reason: max_tokens` having used all 2,400, so the JSON was cut off
mid-object and arrived as "response was not valid JSON".

Worst-case wall clock: one call 75s, one attempt 150s (two calls), the narrowed
retry starts only if 90s have not already gone, so 90 + 150 plus searches, well
inside 300s.

**Grounding, not the guard.** Two of the three figures the guard rejected on
that run, 5.8 and 9.4, were present in the retrieved evidence as `-5.8%` and
`-9.4%`: GlobalData publishes Woolworths' net income and net profit margin as
`XYZ` and gives only the year-on-year changes. The model restated them without
their signs, which is a different claim. The third, 34,967, was absent
altogether; the source says 37,499. The guard was right in all three cases and
is unchanged. Two rules were added to the shared prompt in
`lib/analyst/llm.ts`: a minus sign is part of the figure, and a placeholder is
not a figure. Pinned by `tests/analyst-figure-guard.test.ts`, "a dropped minus
sign is a different figure".

## 8.29 Semantic workflow matching and the EVIDENCED contract

Verified against the working tree at commit `794058e` plus this change,
30 August 2026.

### What replaced the lexical matcher

`evidenceFor()` required two of a workflow label's own words, a head noun and a
clause-scoped negation check. It could not recognise the same activity written
differently and could not tell a description from a coincidence. It is gone.
`lib/position/workflow-match.ts` now decides alignment against the catalogue's
own metadata, all 75 entries of which carry `label`, `description`,
`subcategory` and `commonInputs`.

| Constant | Value | Line |
|---|---|---|
| `DISTINCTIVE_MAX_DF` | `6` | `workflow-match.ts:35` |
| `MIN_STEM` | `4` | `workflow-match.ts:38` |
| `WEIGHT` | label 3, description 2, subcategory 1, inputs 1 | `workflow-match.ts:110` |
| `MIN_SCORE` | `8` | `workflow-match.ts:204` |
| `MIN_SCORE_MECHANISM` | `10` | `workflow-match.ts:216` |
| `MIN_DISTINCTIVE` | `2` | `workflow-match.ts:218` |
| label segment minimum | `2` stems | `workflow-match.ts:159` |

**Distinctiveness is computed, not declared.** `DOC_FREQUENCY` counts how many
of the 75 workflows each stem appears in, at module load. Nobody maintains a
list of generic words and none can drift from the library, because it is
derived from the library. Measured: `fraud` appears in 1, `detection` in 6,
`data` in 15.

**Alignment requires all three of:**

1. the text names the activity, either by the label's head noun or by two or
   more rare terms out of the catalogue's description of how the work is done;
2. two rare terms, or one where the text names a whole label segment;
3. weighted overlap at or above the floor.

**The two floors are measured, not chosen.** At 6, "a vendor-reported proof
point rather than an independently audited customer outcome" reached Expense
Report Audit; every genuine match in the control set scores 8 or more. The
mechanism-only floor is higher because mechanism words include the workflow's
objects as well as its verbs: "the bank says card payment fraud is a material
risk" collects card, payment, fraud and risk for exactly 8 while describing no
system, and every genuine mechanism-only match scores 13 or more.

**A label segment must be two stems.** Segments split on `/` and `&` are
alternative names for one workflow, so naming either completely identifies it.
A one-word segment is a word rather than a name: live Boots matched
`Sales / Account Research` on "sales" in a sentence about annual sales, and
live Tesco matched `Financial Analysis & Reporting` on "reports" in a sentence
about what Wikipedia reports.

### Structured evidence from the research stage

`lib/research/company.ts` extends each `aiFinding` with three fields the model
reports and the position layer never trusts:

| Field | Values | Line |
|---|---|---|
| `subject` | company, competitor, vendor, sector, unknown | `company.ts:55` |
| `status` | DEPLOYED, PILOT, PLANNED, EXPLORING, NEGATED, UNKNOWN | `company.ts:67` |
| `capability` | free text, never a catalogue id | |

`citedAi()` maps anything it cannot place to `unknown` / `UNKNOWN` rather than
to a default, on the same rule the metric ingest follows.

### The EVIDENCED contract

`evidencedWorkflows()` in `lib/position/opportunities.ts`. Six conditions, all
required, and the model is the final authority on none:

| # | Condition | Line |
|---|---|---|
| 0 | the statement is an AI finding, not a business finding | `:332` |
| 0b | where the run classified anything, this statement carries a claim | `:334` |
| 1 | `claim.subject === "company"` | |
| 2 | not negated, judged on the clause the match landed in | |
| 3 | `alignment()` aligns the passage to the workflow | |
| 4 | `MODEL_CURRENT` holds the status, and `classifyStatement()` agrees | `:385` |
| 5 | `sourceIndex >= 0`, so the claim can be traced | |

**The stricter of the two status readings wins.** A model answering DEPLOYED
over a sentence reading "plans to" is overruled; a model answering PLANNED over
a deployment is taken at its word.

**Nothing persists a verdict.** The classification is recomputed from the
statement on every render, so if the supporting passage goes, EVIDENCED goes
with it.

**Evidence outranks the sector prior.** `opportunities.ts:500` unions any
evidenced workflow into the company's list wherever the catalogue files it.
Found on live Ocado research: its own sources say machine learning already
schedules predictive maintenance in the fulfilment centres, and the product
showed nothing, because Predictive Maintenance is catalogued for manufacturing,
energy and transport rather than retail. The sector list still governs derived
and sector areas.

### Role assignment

`lib/position/role-fit.ts:133`. The three columns were ranked independently, so
live Tesco and live Salesforce both got the Chief Data Officer as business
owner AND delivery owner. `assign()` now takes each column's best candidate not
already taken (`role-fit.ts:140`), in the order business, delivery, governance:
business first because its candidates come from the workflow's own category and
are the narrowest list, governance last because its candidate set is the
richest and it loses least by going last.

Duplication is permitted only where a column has run out of candidates. The
three fallbacks are themselves distinct (COO, CIO, Compliance Officer), so in
practice it does not arise. Alternatives are never pruned: a role taken by
another column stays in this column's dropdown, because deduplication governs
the recommendation and never the reader's choice.

### Controls

`tests/evidence-controls.test.ts` holds four positive controls (deployed fraud
detection, pilot customer service, deployed demand forecasting, deployed
developer AI), each paired with near-neighbour negatives: plan, exploration,
subject-without-work, competitor, vendor product, denial, sector, company-wide
AI, vendor partnership, job advert. `tests/company-signals-live.test.ts` holds
four live research captures.

## 8.30 AIE upstream: timeouts, fallback TTL and the fixture sync

Verified against the working tree at commit `1f2b786` plus this change,
30 August 2026.

### Where the live data comes from

`https://ranking-engine-red.vercel.app/api`, reached two ways: the browser goes
through `app/api/aie/[...path]/route.ts`, and server components go through
`lib/aie-server.ts`. Both are GET-only against a whitelist, both fall back to
`fixtures/aie-live/*.json`, and both report which happened. `AieLane` is
`aie-live` where the upstream answered and `aie` where the recording was used;
the badge never claims live for a fixture read.

### The constants

| Constant | Value | File |
|---|---|---|
| `TIMEOUT_MS` | `[8_000, 12_000]` | `lib/aie-server.ts:31` |
| `CACHE_TTL_MS` | `300_000` | `lib/aie-server.ts:34` |
| `FALLBACK_TTL_MS` | `20_000` | `lib/aie-server.ts:46` |
| `TIMEOUT_MS` (browser proxy) | `12_000`, two attempts | `app/api/aie/[...path]/route.ts` |
| `CACHE_TTL_MS` (browser proxy) | `300_000` | same |

**Two attempts, the second longer, measured on 30 August 2026.** The upstream is
itself a serverless deployment and sleeps. A request to a cold container was
timed at 20 seconds. `aieServerFetch` made ONE attempt, gave up at 8, and served
a recording from a fortnight earlier. The first attempt is what wakes the
upstream, so aborting it early is not a wasted call: the container is booting by
the time the second goes out.

**A fallback is cached for twenty seconds, not five minutes.** This was the
worse half of the same defect. The recording was cached under the live TTL, so
one cold start did not cost one render, it cost every render on that instance
for five minutes.

### What the sync covers, and what it does not

`scripts/sync-aie-fixtures.mjs`, `npm run sync:aie`.

Pulled from an endpoint: `capabilities`, `market-share`, `metadata`, `news`,
`pricing`, `reputation`, `uptake`, `vendors`. The ranking numbers are in these:
vendor overall, winning and trust scores in `vendors.json`, the per-domain 0-100
capability scores in `capabilities.json`, and the share estimates in
`market-share.json`.

No endpoint, captured by hand: `cost-capability.json`, `market-dashboard.json`,
`model-inventory.json`. The sync lists them so the gap is visible.

**`fixtures/aie-live/category-rankings.json` has its own script**,
`scripts/sync-category-rankings.mjs`, because the upstream computes the 0-to-5
per-category composites server-side and renders them into its category pages
rather than publishing them as JSON.

**The two must be refreshed together, and `npm run sync:aie` runs both in
order.** The category script cross-checks ranked-plus-held against the vendor
count `market-share` reports for the same category, so market-share has to be
current first. Measured on 30 August 2026: syncing the API fixtures alone left
market-share current and category-rankings on its 17 August capture, the
cross-check failed for the right reason, and xAI was still missing
`dev_sentiment`, a fourteenth scoring domain the upstream had added. With both
synced, xAI's frontier composite moved 2.29 to 2.72 and its rank 5 to 4.

**A new domain does not need a code change.** The per-domain scores are read
from the fixture as data. `DomainId` in `lib/aie/types.ts:26` is a closed union
used by the ported composite engine, not by the category rankings, so the two
can differ and already do: the fixture carries `model_quality` where the union
carries `market_position`.

### The two domain counts are different quantities

A category in this fixture carries a `domains` NUMBER and each of its vendors
carries a `domains` ARRAY, and they do not agree. Both are right:

| | |
|---|---|
| `category.domains` | how many domains are WEIGHTED in that category's composite, read from the page's own "Category-specific weighting (N domains)" line |
| `vendor.domains[]` | every domain the vendor was ASSESSED on, whether or not it carries weight here |

Measured on 30 August 2026: `ai_silicon` weights 7 (Market Position 42%,
Capital Resilience next) while every vendor in it carries 13 assessed scores.
Reading the array length as the category's domain count makes eleven categories
look under-synced when they are current.

The weighted set is also what the held rule counts: the page holds a vendor
with "Only 4/7 domains evidenced (need at least 4)".

### Which categories weight the new domain

`dev_sentiment` is weighted in two of the thirteen: `frontier_model_api` and
`developer_coding_agent`, both of which went from 13 weighted domains to 14.
The other eleven do not weight it, which is upstream's choice about what
matters in each category and not a gap on this side.

It matters where it applies. In `frontier_model_api` it is weighted **20 per
cent**, the heaviest single weight in the category, ahead of Model Quality at
10 and Governance at 10. Its arrival moved xAI's composite from 2.29 to 2.72
and its rank from 5 to 4, past DeepSeek. The top three did not move.

**It refuses to overwrite a newer capture with an older one.** The pricing
endpoint answers on request and serves `capturedAt: 2026-06-02` whatever day it
is asked, so a re-pull is not a refresh.

### Derived artefacts the sync regenerates

The fixtures feed four committed artefacts, and a sync that moved the fixtures
without regenerating them left the suite red:

| Artefact | Regenerated by |
|---|---|
| `lib/aie/vendor-directory.ts` | `scripts/generate-vendor-directory.mjs` |
| `fixtures/signal-snapshot.json` | `scripts/snapshot-signals.mjs` |
| `fixtures/signal-changes.json` | same |
| `reports/scorecard-ledger.json` | `WRITE_LEDGER=1 vitest run tests/scorecard-ledger.test.ts` |

### The alias hook

`scripts/alias-hook.mjs`. `snapshot-signals.mjs` reaches into `lib/`, `lib/` is
written against the `@/` tsconfig path, and node knows nothing about tsconfig,
so it died on `Cannot find package '@/lib'` and had never run. Because the sync
calls it as a post-step, EVERY sync ended in a failure line even when every
fetch had succeeded, which is the likeliest reason the fixtures sat two weeks
out of date. The hook registers a resolver rather than rewriting `lib/` to
relative imports, which would put a second import convention into application
code to suit a script.

### The refresh, run by hand

`.github/workflows/sync-aie-fixtures.yml`, `workflow_dispatch` only. It ran on
a daily schedule at 04:30 UTC from 31 August to 5 September 2026 (the
"Refresh the recorded AIE payloads" commits) and was made manual on
6 September by decision: ingesting and discovering upstream changes is a
person's call. Two ways to run it, both gated the same way: "Run workflow" on
the Actions tab, or `npm run sync:aie` locally and commit what it reports.
The fixtures are the fallback lane only; live pages read the upstream at
render, so a refresh that is not run ages the fallback and nothing else.

**A GitHub Action and not a Vercel cron**, because the sync writes files and a
Vercel cron runs in a deployed function with a read-only filesystem. It can warm
a cache; it can never refresh a fixture.

**It gates on typecheck, lint and the full suite before committing.** On 30
August 2026 a manual sync pulled a vendor the upstream had just added under a
category this app had no mapping for, and `lib/aie/vendors.ts` throws on an
unmapped category by design; nineteen test files stopped importing. A job that
committed that automatically would have shipped a broken build overnight. A red
run is therefore information: the upstream has changed in a way this app cannot
absorb without a decision.

## 8.31 Analyst Insight: one question, one argument

Verified against the working tree at commit `0c867c2` plus this change,
30 August 2026.

### What was wrong, measured

Live captures of all nine Analyst Insight surfaces on 30 August 2026. Six read
like a senior analyst already. Three did not, and they failed in two distinct
ways rather than one:

| Surface | Failure |
|---|---|
| Vendor View | six findings across four populations in one paragraph, and an action about AMD and Groq under a headline about SAP |
| Pulse | headline was a movement count, "5 vendors gaining, 3 slipping" |
| Market Watch | called a market whose top three hold 68.6 per cent "spread widely enough that buyers still have alternatives" |

The third is not a prose failure. `tight` was a single threshold at `>= 70`, so
a three-firm concentration of 68.6 took the "spread" branch. A three-firm share
near seventy is a concentrated market on any competition measure, and a reader
told the field is open will not keep a second option warm.

### One page, one question

`lib/analyst/question.ts` holds a `PageQuestion` per surface: the question, the
`ArgumentUnit` the argument is about, the population every comparison is drawn
from, what the answer must address, and what belongs to a neighbouring page.
Three layers read it. The builder shapes its argument to it, the prompt states
it before any data, and the comparability guard uses `unit` to decide whether a
comparison was one this page may make.

### Grounded market context

`lib/analyst/market-context.ts`. Two kinds, kept apart:

- **structure**, computed from the MarketMetrics the page already loaded:
  categories judged, separated, contested, three-firm share, risk
  contradictions, movement coverage;
- **theses**, six analytical patterns written down, each carrying a predicate
  over that structure.

**A thesis is offered only when the computed structure satisfies its
predicate.** That is the whole safety property: "capability is converging into
commodity" cannot decorate a page whose scores are widely spread, because the
precondition is false and the sentence is not available. No thesis states a
dated event; `tests/analyst-argument.test.ts` asserts none contains a year or a
launch verb, because this product holds no evidence for one.

| Constant | Value | Line |
|---|---|---|
| `SEPARATION_MARGIN` | `0.5` | `lib/analyst/insight.ts:988` |
| `CONTESTED_MARGIN` | `0.15` | `lib/analyst/insight.ts:991` |
| concentration bands | high 70+, moderate 50+, contestable below | `lib/analyst/insight.ts:511` |

`SEPARATION_MARGIN` is chosen against the instrument: each domain of the 0 to 5
composite is capped by its evidence grade, so two vendors a tenth apart differ
by less than one grade step on one domain, and half a point is the smallest gap
that cannot be explained by disclosure alone.

### The comparability guard

`lib/analyst/comparability.ts`, wired into the `generate()` retry loop so a
breach is corrected rather than merely discouraged.

Nothing reads English. The page declares its facts as `ComparableFact` records
carrying subject, category, population, metric and period, the guard finds
which subjects the authored text names, and it counts the distinct categories
and populations the paragraph reached into.

| Breach | Fires when |
|---|---|
| `cross-category` | two categories named, and NOT (unit is market AND a market-level finding was supplied) |
| `cross-population` | two populations in one comparison |
| `cross-metric` | two metrics AND two categories |

**Crossing categories is allowed on a market page that established a
market-level finding first.** That is the approved route: the finding is the
argument and the categories are evidence for it. Without one, several
categories in a paragraph are several arguments.

### Consultancy filler

`lib/analyst/canonical.ts:719`, `consultancyFiller()`. Eleven phrases that would
be true on any page in any market in any year. Not a truth failure, which is
why nothing else catches it: "the data suggests" is accurate and says nothing.
The phrase is returned rather than counted so the retry can quote it back.

### The computed floor

Rewritten for Vendor View (`vendorViewInsight`), Pulse (`pulseJudgement`) and
Market Watch. The authored layer inherits its shape from the computed one: a
model handed six mini-findings as its floor writes six mini-findings back in
better prose. Each now produces finding, market context, tension, implication,
in that order, with a named vendor appearing only as an example after the
finding.

`pulseJudgement` takes an optional `structure`, so the headline can be about the
market rather than about how many vendors moved. Absent, it behaves exactly as
before.

## 8.32 Authoring latency: the token budget and the retry bound

Verified against the working tree at commit `2d7395d` plus this change,
30 August 2026.

### Root cause

Two authoring calls were observed at 568 and 951 seconds against a 75-second
model timeout. Instrumenting each phase separately showed it was neither a slow
model nor an SDK ignoring its timeout.

`max_tokens` is the budget for EVERYTHING the model emits, thinking included,
and every caller here passed it as though it were a length limit on the prose:
`authorInsight` asks for 1,400 meaning a 90 to 140 word summary and three
implications. Opus 5 thinks adaptively by default and that thinking comes out
of the same budget.

Measured against a real insight prompt: 601 of 1,054 output tokens went to
thinking. Under the load of a production build generating 85 pages the model
thought harder, spent the entire 1,400 before writing a word, and returned:

```
call returned no text after 18095ms: stop=max_tokens, blocks=[thinking], out=1400
```

`callModel` found no text block and returned null, which is indistinguishable
upstream from a call that never happened. Four of nine insight calls ended that
way in one build, each after 18 to 21 seconds and a full budget of tokens, and
each silently became "no response" and fell back to computed prose.

### The constants

| Constant | Value | Line |
|---|---|---|
| `TIMEOUT_MS` | `75_000` | `lib/analyst/llm.ts:92` |
| `SDK_RETRIES` | `0` | `lib/analyst/llm.ts:135` |
| `BUDGET_MS` | `160_000` | `lib/analyst/llm.ts:149` |
| `THINKING_HEADROOM` | `2_000` at the time; `12_000` since 8.33 | `lib/analyst/llm.ts:196` |

**`THINKING_HEADROOM` is added to every caller's `max_tokens`.** The ceiling
costs nothing when it is not reached, because the model stops at `end_turn`:
the same prompt returned in 12.1 seconds at 4,000 against 14.8 at 1,400. What
it buys is that thinking can no longer starve the answer.

**Thinking is deliberately not disabled**, although that was measured and is
faster at 9.3 seconds. Turning it off changes how the model reasons about the
analysis, and this was a latency gate rather than a licence to change what the
readings say.

### Three bounds, and only one of them cannot be starved

| Bound | Mechanism | Scope |
|---|---|---|
| `timeout: TIMEOUT_MS` | SDK promise deadline, timer | one attempt |
| `AbortSignal.timeout()` | aborts the underlying fetch, timer | one attempt |
| `retryWithinBudget()` | comparison of two clock readings | the whole call |

The first two are enforced by timers, and a timer only fires when the event
loop is free to run it. Under a dev compile, a production build or a full test
run on the same machine the loop is not free, which is the mechanism behind a
75-second deadline arriving minutes late.

`retryWithinBudget()` (`lib/analyst/llm.ts:210`) needs no timer. It is checked
BEFORE an attempt is started, so it caps the NUMBER of attempts rather than the
duration of one, and a series of individually legal retries cannot add up to an
unbounded request. `AbortSignal.timeout()` was added alongside so an overrunning
request stops consuming a socket rather than being abandoned in flight.

### Retry structure

| Layer | Attempts | Retries with |
|---|---|---|
| SDK | 1 | n/a, disabled |
| `generate()` | 2, second gated on the budget | a corrected prompt |
| page render | 1 | n/a |

### Measured latency, after the fix

Model-call durations, taken from the per-call phase log, with no build or test
run competing except in scenario D:

| Scenario | n | p50 | p95 | max |
|---|---|---|---|---|
| single request, idle | 1 | 22.1s | 22.1s | 22.1s |
| nine surfaces sequential | 11 | 18.2s | 29.2s | 29.2s |
| nine surfaces concurrent | 11 | 21.9s | 37.3s | 37.3s |
| under a production build of 85 pages | 7 | 25.0s | 56.0s | 56.0s |
| **all** | **29** | **21.9s** | **37.3s** | **56.0s** |

Maximum observed is 35 per cent of the budget. Zero no-response and zero
no-text outcomes across all 29 calls.

Under the identical production-build load, before and after:

| | no-text | no-response | authored |
|---|---|---|---|
| before | 3 | 3 | 4 |
| after | 0 | 0 | 7 |

### Cache

A successful answer is written to the L1 cache and to `unstable_cache`. A
failure throws before either write, so nothing caches a failed or timed-out
authoring. Demonstrated live rather than argued: Alliances fell back to computed
in the sequential run after the urgency guard discarded two drafts, and authored
successfully in 8,875ms in the concurrent run that followed, so a computed
fallback does not prevent a later request from authoring.

### Phase logging

`phaseLog()` emits one line per authoring call carrying the outcome and the
duration of each attempt. Always on, because a debug flag nobody remembers to
set is a flag that is off when it matters. It never carries the prompt, the
answer or the key.

## 8.33 Authoring model: Fable 5.1, and the room it needs

Verified against the working tree at commit `57ae88c` plus this change,
4 September 2026.

### The change

`MODEL` (`lib/analyst/llm.ts:38`) is now `claude-fable-5-1`. It was
`claude-opus-5` from the first authored reading until this commit. Every
reading that passes through `callModel` moves with it: the eleven insight
surfaces, Today's Pulse, Since you last looked, Do these three things and
company research. The interactive Ask-your-analyst path
(`app/api/analyst/live.ts`) is unchanged: its Haiku, Sonnet and Opus tiers are
a visible product behaviour under spec Section 8, not the analyst voice.

### What a bare constant switch did

A toy prompt measured zero thinking tokens on Fable 5.1, which was misleading.
On the real prompt it thinks roughly five times harder than Opus 5, and at the
2,000-token `THINKING_HEADROOM` that 8.32 sized for Opus it starved the same
way, only higher up:

```
call returned no text after 40507ms: stop=max_tokens, blocks=[thinking], out=3400
```

The first cold pass through the real pipeline, 4 September 2026, twelve
authoring kinds, sequential, idle machine, ceiling 2,000:

| Outcome | Kinds |
|---|---|
| authored, first attempt | 7 |
| authored on retry after "response was not valid JSON" | 2 (news, peer) |
| fell back to computed | 3 (market and price and capability: thinking-only block at the full 3,400; reputation: invalid JSON, then the trend guard) |

The three "not valid JSON" responses were the same starvation in a different
message: a reading that thought for most of the ceiling and was cut off part
way through writing the object. At a 12,000 ceiling none recurred.

### Measured on the real pipeline, 4 September 2026

Sequential, idle machine, cache cleared, twelve kinds. Model-call durations
and thinking tokens from the phase log, first attempts.

| Kind | uncapped: thinking / call | effort medium: thinking / call |
|---|---|---|
| pulse-since | 525 / 18.6s | 439 / 16.0s |
| pulse-actions | 667 / 19.1s | 578 / 15.9s |
| pulse-hero | 1,445 / 29.2s | 1,118 / 25.0s |
| news | 3,538 / 50.0s | 1,479 / 31.1s |
| vendor ranking | 2,723 / 41.8s | 1,495 / 29.8s |
| financial | 3,785 / 51.6s | 1,295 / 30.8s, rejected, then 903 / 24.1s |
| market | 1,634 / 34.7s | 2,305 / 38.4s |
| competitive | 2,829 / 44.9s | 3,746 / 50.6s |
| reputation | 3,182 / 46.0s | 951 / 23.2s |
| alliance channel | 2,810 / 42.7s | 999 / 26.0s, rejected, then 723 / 22.6s |
| price and capability | 4,044 / 56.6s | 1,356 / 29.1s |
| peer | 2,438 / 41.3s | 579 / 20.6s |

| | thinking p50 / max | call p50 / p95 / max | first drafts rejected by a truth guard |
|---|---|---|---|
| Opus 5 (8.32, 29 calls) | 601 on the measured prompt | 21.9s / 37.3s / 56.0s | 0 in the concurrent run |
| Fable 5.1, uncapped, ceiling 12,000 | 2,766 / 4,044 (5,637 on an earlier run of price and capability) | 42.3s / 56.6s / 56.6s (68.4s earlier) | 0 of 12 |
| Fable 5.1, effort medium, ceiling 12,000 | 1,207 / 3,746 | 27.6s / 50.6s / 50.6s | 2 of 12 |

The two medium rejections were the guards working, and what they caught is the
point: financial's first draft named Meta, a vendor outside the page's roster
(the entity guard), and alliance's `whyNow` drew on evidence the temporal
licence bars. Both recovered on the retry. The uncapped model produced neither.

### The decision

Uncapped. `THINKING_HEADROOM` (`lib/analyst/llm.ts:196`) is `12_000`:
about twice the 5,637 maximum observed, because the same reading varied by
roughly 40 per cent between runs (5,637 then 4,044), and an unreached ceiling
costs nothing, as 8.32 established. Reasoning effort is not capped, because the
one arm measured produced fabrication-class first drafts that the uncapped
model did not, and the zero-fabrication rule outranks a 35 per cent latency
saving. To run the medium arm, add `output_config: { effort: "medium" }` to the
`messages.create` call in `callModel`; its numbers are the table above.

### The timeout

Two ceilings now, because one could not be raised.

| Constant | Value | Line |
|---|---|---|
| `TIMEOUT_MS` (research) | `75_000` | `lib/analyst/llm.ts:92` |
| `INSIGHT_TIMEOUT_MS` | `120_000` | `lib/analyst/llm.ts:112` |
| `timeoutFor(kind)` | `company:` prefix takes the research ceiling, everything else the insight one | `lib/analyst/llm.ts:114` |
| `staticPageGenerationTimeout` | `240` | `next.config.ts:15` |
| warm-up per-page abort | `150_000` | `WARM_PAGE_TIMEOUT_MS`, `lib/analyst/warm.ts:57` (the post-deploy script it first lived in was removed on 6 September 2026, 8.35) |

Under the first Fable build, at the 75-second ceiling, the slowest call took
69,826ms, and `generate()` does not retry a call that returned nothing, so at
build time a timeout is a page that ships computed until the next scheduled
warm. The shared ceiling could not simply go up: `RETRY_BUDGET_MS` in
`lib/research/company.ts` derives the research worst case from it as
90 + (min(ceiling, `BUDGET_MS`) + ceiling) + searches, which at 120 seconds
is roughly 345 against Vercel's 300-second function limit. So research keeps
75 and its arithmetic untouched, and the insight path, bounded by a page
render, gets 120: about 1.7 times the slowest call under load. A rejected first
draft followed by a retry is then at most 240 seconds, which is what the static
page timeout is set to; the default 60 fired twice on price-performance in the
first build and the page survived only because the retry landed in the same
worker and found the reading in the L1 cache.

**The warm cron is now under-provisioned, and is not changed here.**
`app/api/warm/route.ts` fetches the eleven warm pages one at a time inside a
300-second `maxDuration`, with no per-page abort and no elapsed budget. Most
runs are cache hits and fit. A run after the evidence has moved re-authors
most pages, and at Fable's 42-second median that is about 420 seconds: the
function is killed part way down the list, silently, and the pages after the
cut wait for the next run or the next reader. Which pages those are depends
on list order. A per-run budget with a reported skip list, a more frequent
schedule, or bounded parallelism are the options; the choice is a design one
and is reported rather than made.

### Under a production build

Two builds on the same machine, 85 pages each, all seven statically generated
kinds authoring concurrently, from the phase log:

| | model calls | authored | first drafts rejected by a guard | no text | timeouts | page-timeout retries | call p50 | call max |
|---|---|---|---|---|---|---|---|---|
| Opus 5, 31 August (8.32) | 7 | 7 | 0 | 0 | 0 | 0 | 25.0s | 56.0s |
| Fable 5.1, ceiling 75s, page timeout 60 | 8 | 7 | 1 (alliance, temporal guard, recovered) | 0 | 0 | 2 | 42.1s | 69.8s |
| **Fable 5.1, ceiling 120s, page timeout 240** | **7** | **7** | **0** | **0** | **0** | **0** | **47.4s** | **63.7s** |

The final build's slowest call sits at 53 per cent of its ceiling. Thinking
tokens in that build ran from 1,453 to 5,107 per reading.

### Rollout: the cache key carries neither model nor effort

`cachedGenerate` (`lib/analyst/llm.ts:851`) keys on kind, facts,
instruction, `maxTokens`, roster, `cacheKey` and `guardKey`. A reading Opus 5
wrote is served until its facts change or the 24-hour revalidation runs, and
8.32's production check showed the Data Cache surviving a deploy. Fable readings
therefore appear page by page as facts move, which the upstream does on its
own cadence and a manual `npm run sync:aie` does for the fallback lane, rather
than at the moment of deploy. Not a defect;
recorded so that a day-old Opus reading is not mistaken for a Fable one.

### Two things found on the way, neither changed here

1. `/trust-rank` is on both warm lists (`lib/analyst/warm-list.ts:16`,
   the mirror in the since-removed post-deploy script) and never calls `authorInsight`. Warming it
   renders a page for nothing.
2. A probe that tests `html.includes("analyst written")` is always true on an
   insight page, because the derivation drawer prose contains the phrase. The
   badge span, `text-muted">analyst written</span>`, is the only honest anchor.
   8.32's counts came from the phase log, not the badge, and stand.

### Telemetry

`callModel` now logs `call ok in Nms: stop=..., out=..., thinking=...` on
success (`lib/analyst/llm.ts:589`), alongside the existing no-text
line. Counts only, never content. It is how every number in this section was
read.

---

## 8.34 Fable 5.1 production readiness: cache identity, warming and the key gate

Verified against the working tree at commit `80eacbb` plus this change,
5 September 2026.

**Superseded in part by 8.35 on 6 September 2026.** The `/api/warm` route, the
Vercel cron, `isScheduler()`, the middleware exemption and the `CRON_SECRET`
prerequisite described below were removed the next day at the owner's
instruction that analyst warming must never run on a schedule. The pool in
`lib/analyst/warm.ts` survives as the manual `npm run warm`. The removed
pieces are described here as they were verified on 5 September, because the
reasoning behind them is still the reasoning behind the manual warm.

### Configuration verified before anything changed

| | Value | Where |
|---|---|---|
| `MODEL` | `claude-fable-5-1` | `lib/analyst/llm.ts:38` |
| `INSIGHT_TIMEOUT_MS` | `120_000` | `lib/analyst/llm.ts:112` |
| `TIMEOUT_MS` (research) | `75_000` | `lib/analyst/llm.ts:92` |
| `THINKING_HEADROOM` | `12_000` | `lib/analyst/llm.ts:196` |
| `staticPageGenerationTimeout` | `240` | `next.config.ts:15` |
| warm-up per-page abort | `150_000` | `WARM_PAGE_TIMEOUT_MS`, `lib/analyst/warm.ts:57` |
| reasoning | adaptive default; no `output_config`, no `thinking` block | `lib/analyst/llm.ts:47` |

None of these changed in this tranche.

### Cache identity, before and after

Two layers cache an authored reading and both are in `lib/analyst/llm.ts`:
an in-process Map (L1) and `unstable_cache` (L2, Vercel's Data Cache, which
8.32 showed surviving a deploy).

| | Before | After |
|---|---|---|
| L1 key payload | `{ facts, instruction, guardKey }` | `{ contract, facts, instruction, guardKey }` (`authoringCacheKey()`, line 290) |
| L2 key parts | `["analyst-insight"]` | `["analyst-insight", CONTRACT_KEY]` (line 889) |
| L2 arguments | kind, facts, instruction, maxTokens, roster, cacheKey, guardKey | unchanged |

**The authoring contract** (`AUTHORING_CONTRACT`, line 71) is
everything besides the evidence that can change what the model writes:

| Field | Value now | Source |
|---|---|---|
| `intelligence` | `"2026-09-05"` | `INTELLIGENCE_VERSION`, line 55. Bump when the prompt, guards or instruction wording change without the facts changing |
| `model` | `"claude-fable-5-1"` | `MODEL`, line 38 |
| `reasoning` | `"adaptive"` | `REASONING.effort ?? "adaptive"`, line 47164280. The request spreads the same object (line 552), so the identity and the request cannot drift |

The evidence is already in the key as `facts` (day-precision normalised) and
the per-reading canonical contract, `authoringContract()` in `author.ts`
(temporal licence, urgency, barred findings), is already in it as `guardKey`.
The two are different things and are named differently here on purpose.

**Deliberately excluded:** token ceilings and timeouts. They change whether a
call succeeds, not what a successful call says.

**How `unstable_cache` builds its key**, read from the installed
implementation (`node_modules/next/dist/server/web/spec-extension/unstable-cache.js`,
lines 55 and 82): `fixedKey = cb.toString() + "-" + keyParts.join(",")`, then
`invocationKey = fixedKey + "-" + JSON.stringify(args)`, hashed. So the
contract in the key parts makes every entry written under another contract
unreachable, and a change to the wrapper's own source text does the same as a
side effect. Nothing is purged; the old entries expire on the 24-hour TTL.

### Proof that the old model's cache cannot satisfy the new model's request

**Unit, on the real key function** (`tests/fable-production-readiness.test.ts`):
same contract and evidence produce the same key, including an evidence capture
later the same day; a different model, reasoning, intelligence version or
evidence produces a different one.

**Integration, through the real lookup** (`tests/cache-identity-integration.test.ts`).
An entry is planted in the real L1 store under a chosen contract with
`primeAuthoringCache()` (line 243, the one seam added for
this), and then `authoredResult()` itself is asked:

| Planted under | Requested under | Result |
|---|---|---|
| Fable, current version, evidence X | the same | the planted reading is returned |
| `claude-opus-5`, current version, evidence X | Fable, current version, evidence X | passed by: `{ value: null, failure: "unreachable" }` |
| Fable, intelligence `2026-09-04` | Fable, current | passed by |
| Fable, reasoning `medium` | Fable, adaptive | passed by |
| Fable, evidence X | Fable, evidence Y | passed by; evidence X later the same day is found |

"Passed by" is the lookup missing L1 and falling into L2, which outside a Next
render throws its incrementalCache invariant; that throw is the evidence the
request went past the planted entry. A live demonstration on the L2 layer needs
a successful authoring inside Next and is recorded below as blocked.

### The Opus seed that did not seed, and why

The release simulation first tried to seed a genuine Opus 5 entry by pinning
`MODEL` and rendering `/peer-insights` on the dev server. The page returned
computed after 10.0 seconds. From the server log:

| | |
|---|---|
| model called | `claude-opus-5` (the temporary pin) |
| status | HTTP 400, `invalid_request_error`: "Your credit balance is too low to access the Anthropic API" |
| duration | 321ms for the call; the 10 seconds were the dev compile of the route |
| stop_reason, output tokens, thinking tokens, text block | none: no message was returned |
| draft rejected by a guard | no draft existed |
| authoring returned null | yes: `callModel` caught the error, `generate()` logged `insight:peer no response in 323ms` and threw |
| fallback relative to the cache | after the L1 miss and the L2 invocation; nothing was written to either layer |

**Class A, a model/auth failure, specifically billing.** Not the contract and
not the simulation: the next two requests, on Fable, returned the same 400 in
298ms and 211ms and each made a fresh attempt, which is also the live proof
that a failed authoring is never cached. The pin was reverted and the source
carries no trace of it. The working key that authored roughly sixty Fable
readings and three builds on 4 September had exhausted the account's credit;
Fable's four-to-six-fold output tokens (8.33) are the reason it went that fast.

### Warm target audit

| Target | Rendering | Authors | Classification | Action |
|---|---|---|---|---|
| `/pulse` | dynamic | three readings via `authorPulse`, `authorSince`, `authorActions` | AUTHORS ANALYST INSIGHT | kept |
| `/trust-rank` | dynamic | nothing under its route calls an author entry point | DYNAMIC BUT DOES NOT AUTHOR | **removed** |
| `/news-feed` | dynamic | `insight:news` | AUTHORS | kept |
| `/vendor-view`, `/financial-snapshot`, `/market-watch`, `/competitive-intel`, `/reputation-tracker`, `/alliances`, `/price-performance`, `/peer-insights` | dynamic | one reading each | AUTHORS | kept |

Every warm page is `ƒ` dynamic in the final build's route table; none is
prerendered, so a warm fetch renders and a missing cache entry authors
synchronously. The build still authors seven kinds while classifying routes,
and those build-time entries seed the Data Cache; `/pulse`, `/news-feed` and
`/competitive-intel` bail out of the build render first and are the post-deploy
cold set. `tests/warm-list.test.ts` now checks each entry's route directory for
an author call and pins `/trust-rank` off the list.

### Cold-warm cost per surface, final Fable configuration

Model-call durations and tokens from the phase log, sequential, idle machine,
4 September 2026 (8.33). The configuration is identical for authoring: the
changes since are the cache key and the timeouts, neither of which alters a
call. Re-measurement on 5 September was blocked by the credit balance.

| Surface | call | thinking | output | attempts | guard rejection | fallback |
|---|---|---|---|---|---|---|
| pulse-since | 18.6s | 525 | 875 | 1 | no | no |
| pulse-actions | 19.1s | 667 | 1,050 | 1 | no | no |
| pulse-hero | 29.2s | 1,445 | 1,917 | 1 | no | no |
| news | 50.0s | 3,538 | 4,103 | 1 | no | no |
| vendor ranking | 41.8s | 2,723 | 3,255 | 1 | no | no |
| financial | 51.6s | 3,785 | 4,313 | 1 | no | no |
| market | 34.7s | 1,634 | 2,210 | 1 | no | no |
| competitive | 44.9s | 2,829 | 3,382 | 1 | no | no |
| reputation | 46.0s | 3,182 | 3,753 | 1 | no | no |
| alliance channel | 42.7s | 2,810 | 3,384 | 1 | no | no |
| price and capability | 56.6s | 4,044 | 4,577 | 1 | no | no |
| peer | 41.3s | 2,438 | 3,046 | 1 | no | no |

Sequential total over the ten pages, Pulse counted once at its slowest reading
plus a second of render each: about 456 seconds. Worst observed single call,
any run: 69.8 seconds (first Fable build). Under the 85-page build calls ran
about 25 per cent slower than idle.

### Warm concurrency

The measured durations above were run through the real pool
(`tests/warm-schedule.test.ts`, at 1/1000 scale, which does not change the
schedule):

| concurrency | full cold warm |
|---|---|
| 1 | 456s |
| 2 | 238s |
| 3 | 171s |
| **4** | **132s** |
| 5 | 108s |

Selection rule, pinned by the test: fits the 240-second budget after calls run
25 per cent slower (observed under build load) AND the slowest page retries
once (observed). At 3 that is 171 x 1.25 + 57 = 271, over. At 4 it is 222,
inside. Four is therefore the lowest that fits comfortably. The final Fable
build authored seven readings concurrently with no rate limit. A live run at
concurrency 4 against a production-mode server is the one measurement in this
section not yet taken; it was blocked by the credit balance and the harness
(`new-ai-ent-prod` in `.claude/launch.json`, the route, the bearer) is ready.

### Warm execution

| Constant | Value | Line |
|---|---|---|
| `WARM_CONCURRENCY` | `4` | `lib/analyst/warm.ts:49` |
| `WARM_PAGE_TIMEOUT_MS` | `150_000` | `lib/analyst/warm.ts:57` |
| `WARM_BUDGET_MS` | `240_000` | `lib/analyst/warm.ts:64` |
| `AUTHORED_THRESHOLD_MS` | `5_000` | `lib/analyst/warm.ts:73` |
| `maxDuration` | `300` | `app/api/warm/route.ts`, removed on 6 September 2026 (8.35) |

`runWarm()` (line 145) fetches through a pool of `WARM_CONCURRENCY`
workers; each checks the elapsed budget BEFORE starting a page, so a run can
never be extended by a page begun in its last second, and anything not started
is reported as remaining. `classify()` (line 115) reads the badge
span: computed is a fallback, written is cached below the threshold and
authored at or above it (cached pages served in 0.2 to 1.3 seconds on
production; no Fable call has finished under 15.9), and no badge is a failure,
because a page without a reading is not a warm target.

The report carries requested, authored, cached, fallback, failed, timedOut,
remaining and remainingPaths. `success` is true only when every target was
fetched and none failed or timed out. Fallbacks are counted and logged as a
warning, not treated as warm failures: they are the truth architecture
declining a draft. An incomplete run answers **503**, so the scheduler's own
log shows it. Its predecessor was killed by the platform mid-list and logged
nothing.

End-to-end on 5 September 2026, dev server, bearer supplied: HTTP 200,
`success: true`, requested 10, fallback 10 (the account could not author),
failed 0, timedOut 0, remaining 0, concurrency 4, 16.5 seconds. Before the
demo-gate credentials were forwarded on page fetches the same run answered
503 with ten 401s, each named, which is the report doing its job.

### The endpoint was open, and is now closed

A probe on 5 September 2026 with `x-vercel-cron: 1` and nothing else answered
**HTTP 200** on production and ran a warm. The repository is public and
`CRON_SECRET` is not set in production, so anyone could spend the budget.
`isScheduler()` (removed with the route on 6 September 2026, 8.35) admitted only
`Authorization: Bearer $CRON_SECRET`, the mechanism Vercel documents, and
returns false when the secret is unset: nobody in, the scheduler included, with
the 401 body saying `CRON_SECRET_UNSET` so the operator knows which closed
state it is. The middleware exemption for the route was
removed with it on 6 September 2026. Verified locally: no header, a wrong
bearer and the spoofed header each answer 401.

### Schedule

`vercel.json` kept `0 5,17 * * *` until 6 September 2026, when the cron was
removed (8.35). While it ran, the 05:00 UTC run landed after the
day-precision key flips at midnight UTC, so Today's Pulse is prepared before
the working day; the 17:00 run halves the worst wait after an evidence move.
Neither is tied to the fixture sync, which has run only by hand since
6 September 2026: the warm prepares readings from whatever the pages read,
and ingests nothing. A run against a valid current cache is
cheap by construction: the page is served from L1 or L2 in under a second and
no model is called, which the integration test's control case pins and the
31 August production check showed live. Warming therefore cannot regenerate an
identical current-version reading; only a new contract or new evidence can.

### The production key gate

`scripts/preflight-production.mjs` runs first in `npm run deploy`. It pulls the
production environment to a private temporary file (`vercel env pull`,
removed in `finally`), sends one one-token request to the model the code pins
(read from `lib/analyst/llm.ts`, so it cannot drift), and decides
(`decide()`, line 67): missing key, HTTP 401 or 403, HTTP 404 on the
model, HTTP 400 (an exhausted credit balance returns this on a valid key) and
a missing `CRON_SECRET` each blocked with the reason (the `CRON_SECRET` stage
was removed on 6 September 2026, 8.35). It prints presence and
status, never a value. Against production on 5 September 2026 all three
prerequisites failed: the key returned 401 (since 3 September), `CRON_SECRET` was
unset, and the account's credit balance was exhausted. **By 6 September 2026 the
key had been rotated, the credit restored and the `CRON_SECRET` stage removed;
the preflight passed against production that day (8.35).**

### Fallback

Under the live 400 on 5 September, `/peer-insights` rendered its computed
reading three times with HTTP 200, no blank panel, the canonical decision
intact, and three fresh model attempts in the log: nothing cached the failure.

### Telemetry

The `call ok` line (`lib/analyst/llm.ts:589`) now carries
`model=`, so a log proves which model authored a reading rather than leaving it
to be inferred from thinking counts.

### The build gate under the exhausted account

`npm run build` on 5 September 2026, cache cleared: exit 0, 85/85 static
pages, compiled clean, 0 page-timeout retries. Every one of the
7 build-time authoring calls was refused by Anthropic with the 400 credit
error in 345 to 750ms (7 `call failed` lines, 0 `call ok`, 0 no-text).
Each reading fell back to its computed floor and the build shipped whole, which
is the fallback contract holding under build conditions: no blank panel, no
failed page, nothing cached. It is also what a deploy today would ship, which
is why the preflight refuses one.

### Tests added

| # | Property | Test |
|---|---|---|
| 1 | Opus cache cannot satisfy a Fable request | readiness 1; integration, Opus row |
| 2 | same Fable configuration reuses | readiness 2; integration, control |
| 3 | effort change invalidates | readiness 3; integration, effort row |
| 4 | evidence change invalidates | readiness 4; integration, evidence row |
| 5 | intelligence version change invalidates | readiness 5; integration, version row |
| 6 | warm against a valid cache calls no model | readiness 6 (classification, and `warm.ts` imports no model path); integration control |
| 7 | non-authoring routes not warmed | warm-list: author-call check, `/trust-rank` pinned off |
| 8 | bounded concurrency completes | readiness 8 (max in flight equals the bound); schedule test on measured durations |
| 9 | partial warm reports failure | readiness 9 |
| 10 | timed-out target visible | readiness 10 |
| 11 | cannot report success with targets remaining | readiness 11 |
| 12 | `/api/warm` protected | readiness 12, three cases and the header ban |
| 13 | preflight fails closed on 401 | readiness 13, plus 400, 404, missing key, missing secret, deploy wiring |
| 14 | fallback usable | readiness 14 |
| 15 | no new reader-time model call | readiness 15: `callModel` invoked from exactly one place |

Thirty-eight tests across four files; the suite is 1,188 tests in 67 files.

### Remaining risks

1. The live L2 demonstration and the live concurrency-4 run both need the
   account to author; both harnesses are ready and neither changes a
   conclusion the measured schedule does not already support.
2. Fable's token cost emptied a prepaid balance in a day of measurement. The
   twice-daily warm over ten pages at roughly 3,500 output tokens each is the
   steady-state floor; a budget alert on the Anthropic account is the cheap
   control.
3. The demo gate, if switched on in production, is now forwarded by the warm
   route; the post-deploy script does not forward it and would report every
   page failed, visibly.
4. `AUTHORED_THRESHOLD_MS` is a classification, not a guard; a page that
   authored in under five seconds would be labelled cached. No Fable call has
   come close.

---

## 8.35 Manual warming only, build spend and the key gate

Verified against the working tree at commit `944374c` plus this change,
6 September 2026.

### What could author a reading without a person asking, and what happened to it

| Mechanism | Class | Found | Action |
|---|---|---|---|
| `vercel.json` cron `0 5,17 * * *` on `/api/warm` | SCHEDULED WARM | yes | removed; `vercel.json` now carries no `crons` |
| `/api/warm` route, `isScheduler()`, `CRON_SECRET`, middleware exemption | the scheduled warm's surface | yes | removed outright; no secret remains to configure |
| `npm run deploy` ending in `node scripts/warm-insights.mjs` | DEPLOY WARM | yes | removed; deploy is preflight then `vercel --prod --yes` and nothing after |
| `next build` rendering dynamic routes to classify them | BUILD | yes: 7 Fable calls per build, on every push | suppressed: `buildPhase()` (`lib/analyst/llm.ts:766`) makes `authoredResult()` return `failure: "build"` before any cache lookup (line 789) |
| `scripts/warm-insights.mjs` (sequential, post-deploy) | MANUAL WARM | yes | replaced by `scripts/warm.mjs`, which plans by default and fetches only on `--yes` |
| `.github/workflows/sync-aie-fixtures.yml` | DATA SYNC | manual since 8.30; touches no model, holds no model key | unchanged |
| Vercel Git integration | DEPLOY | **every push to `main` builds and deploys production** (build log: `Cloning github.com/... Commit: 944374c`) | not changed; recorded, because it means a push bypasses `npm run deploy` and its preflight |

**Scheduled Analyst Insight warm invocations after this change: 0.** No cron,
no scheduled workflow, no replacement mechanism. `tests/spend-controls.test.ts`
pins all three.

### The call-path matrix

| Path | Class | Can author? | Bound |
|---|---|---|---|
| a reader opens a page whose reading is not current | USER REQUEST | yes | one `generate()` per kind on the page, at most two attempts inside `BUDGET_MS` |
| a reader's request finds an expired entry | USER REQUEST (background revalidation) | yes, once per key per TTL | the same |
| Company View research (`/api/research`) | USER REQUEST | yes | two source scopes inside `RETRY_BUDGET_MS`, each at most two attempts |
| Ask your analyst, interrogate (`app/api/analyst/live.ts`, `app/api/interrogate/live.ts`) | USER REQUEST | yes, Haiku/Sonnet/Opus tiers | one request each; unchanged here |
| `npm run warm -- --yes` | MANUAL WARM | yes, for pages not current | pool of 4, 150s per page, one pass, exit 1 on any failure; never loops |
| `next build` | BUILD | **no** | measured: 0 calls (below) |
| `vercel --prod`, or a push to `main` | DEPLOY | no: the build authors nothing and deploy warms nothing | |
| any schedule | SCHEDULED | **none exists** | |
| the fixture sync | BACKGROUND DATA SYNC | no: no model import, no model key | |
| a rejected draft | RETRY | one more attempt, inside the budget | `SDK_RETRIES = 0` underneath |
| `scripts/preflight-production.mjs` | OTHER (deploy gate) | one one-token request | |
| `scripts/research-role-verticals.mjs` | OTHER (manual research script) | yes, Haiku and Sonnet | run by hand only; unchanged |

### Build spend, before and after

| Build | Calls | Outcome |
|---|---|---|
| `944374c`, auto-deployed at 11:06 UTC on 6 September | 8 (7 kinds, reputation on attempt 2) | authored with the rotated key: real spend to produce a build artefact |
| this change, 16:30, cache cleared | **0** (no `[analyst-llm]` line of any kind) | exit 0, 84/84 pages, every reading on its computed floor |

The suppression is one check on `NEXT_PHASE`, which Next sets for the build
and its static-generation workers inherit; the second build proves the workers
see it. A page a reader opens at runtime authors exactly as before: the test
stubs `NEXT_PHASE` to the server value and shows the same request proceeding
past the suppression and the empty L1 into L2.

### The manual warm

`npm run warm` prints the ten targets, the concurrency (4), the per-page
ceiling (150s) and the cost, and fetches nothing. `npm run warm -- --yes`
runs `runWarm()` (`lib/analyst/warm.ts:145`) over the list with a
30-minute budget instead of the hosting window's, prints one line per page
(authored, cached, fallback, failed, timed-out) and a COMPLETE or PARTIAL
summary with every count, and exits 1 on anything but COMPLETE. It forwards the
demo gate's credentials only when they are in its own environment. The script
loads TypeScript through `scripts/alias-hook.mjs`, as `snapshot-signals.mjs`
already did, so the list and the pool have one source each. Run against a
current site it costs nothing: a cached page returns in under a second and
calls no model (8.34, control case).

**After a release that changes the model or `INTELLIGENCE_VERSION`, every page
is cold until a person runs it or a reader opens the page.** That is the trade
the owner chose, and it is recorded rather than softened.

### The preflight, before and after

| | before | after |
|---|---|---|
| key present | yes | yes |
| one-token request | status only | status, error type and message |
| 401 / 403 | blocked | stage `auth: failed` |
| 404 | blocked | stage `model: inaccessible` |
| 400 with a credit message | blocked as "HTTP 400" | stage `credit: blocked`, distinguished from auth |
| `CRON_SECRET` | required | **not a prerequisite**; the cron is gone |

`decide()` (`scripts/preflight-production.mjs:67`) returns the stage
that failed. Against production on 6 September 2026: key present, authentication
ok, model access ok for `claude-fable-5-1`, credit ok, HTTP 200. **PREFLIGHT
PASSED.**

### Anthropic authentication: the root cause, and the status now

The 401 reported on 4 and 5 September was the production key itself: rotated or
revoked at Anthropic's end between 2 and 3 September, while Vercel still held it
(32 days old). It was replaced in Vercel Production on or about 4 September
(the variable showed "2d ago" on the 6th). Diagnosed against the running
system, values never printed: the app reads project `new_ai_ent_30_07_2026`,
environment Production; exactly one `ANTHROPIC_API_KEY` exists and only there;
the pulled value is 108 characters, `sk-ant-` prefixed, without trailing
whitespace or carriage returns; the `944374c` build received it and authored
seven readings with it; a one-token `claude-fable-5-1` request returns HTTP 200
with `stop_reason: max_tokens` at `max_tokens: 1`. **Authenticated, model
accessible, credit available. No credential was changed here.** The local key
returned 400 on credit on 5 September and 200 on the 6th.

### Telemetry

Every model call line now names `surface=` (the kind), `model=`,
`trigger=` (`build` or `request`) and, on success, `stop=`, `out=` and
`thinking=` (`lib/analyst/llm.ts:589`). Attempt counts are on the
phase line. Telling a reader's request from a manual warm at the call site would
mean threading request headers into the authoring layer; the warm script's own
report is the ledger for that, and the log's timestamps line up with it. No
prompt, answer or key is ever logged; the test pins the pattern.

### Tests

`tests/spend-controls.test.ts` (new): build refuses before the cache and
writes nothing while a runtime request proceeds; no cron, no scheduled workflow;
the sync holds no model key and no run step warms; deploy is preflight then
deploy; retries bounded (`SDK_RETRIES = 0`, two attempts gated on the budget,
research budget, one call site); telemetry fields present and nothing sensitive
logged. `tests/warm-list.test.ts` and `tests/fable-production-readiness.test.ts`
rewritten for the manual warm and the stage-wise preflight. Suite: 1,202 tests
in 68 files.

### Remaining risks

1. A push to `main` deploys without the preflight. The build no longer spends,
   so a bad key now shows as computed badges at runtime rather than as build
   cost; run `npm run preflight` before pushing a release.
2. After a contract-changing release the first reader of each page pays the
   cold render unless a person runs `npm run warm -- --yes` first.

---

## 9. Run costs

`lib/admin/cost-model.ts`. List prices, measured rather than estimated:

| Run | Cost |
|---|---|
| SEC disclosure snapshot (8 vendors, one window) | $0.000019 |
| SEC disclosure, two 12-month windows | $0.000051 |
| Model catalogue snapshot (330 models) | $0.000022 |
| AIE category share refresh (72 estimates) | $0.000007 |
| Private-company reported figures | $0.000006 |
| News feed cache refill | $0.000026 |

Every series refreshed daily for a month totals **$0.0039**. Cost is not a
reason to refresh less often; rate limits and source courtesy are.

---

## 10. Two traps already paid for

**PostgREST caps responses at 1,000 rows regardless of the `limit` requested.**
`lib/catalogue/client.ts` pages with `offset` and requests `count=exact`,
comparing what arrived against the server's own total. The first fix raised the
limit from 500 to 5,000 and looked correct in review, because the bug is not in
the code: it is in the server's behaviour. Verify against the running database,
never by reading the diff.

**A query that is valid over an empty table answers successfully.** The `usage`
series returned 200 with a note reading "First observations recorded", which
sounds like a pipeline that has started. Nothing could ever land there: usage
lives in `aie.usage_event`, never in `aie.observation`. It is now out of the
`Series` type, so re-adding it is a compile error.

---

## 11. Keeping this faithful

This document is only worth what its accuracy is worth. Three habits keep it
true:

1. **Quote, do not summarise.** Constants are copied from the code with their
   line numbers. A paraphrased threshold is a threshold that will drift.
2. **Change the code and this document in the same commit.** A register updated
   later is a register that was wrong in between.
3. **Where a test pins a constant, name the test.** A number with a test behind
   it is a different kind of fact from one without.
