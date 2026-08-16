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

`lib/analyst/llm.ts`. Model `claude-opus-5` (line 25), 30 s timeout (line 26),
24 h cache TTL (line 29).

Two independent guards run over every generated passage. Both must pass or the
output is discarded and regenerated.

### 2.1 The numeric guard

`guard()` at line 78, `invented()` at line 87, `numbersIn()` at line 57.

Every number in the generated text must appear in the whitelist of figures
handed to the model. A number that does not is an invention, and its presence
fails the whole passage rather than the sentence.

Dates are excluded by `DATE_RE` (line 107), because a year is not a claim about
the data.

### 2.2 The entity guard

`foreignEntities()` at line 137.

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
holds 294 roles, of which 99 carry `industry: "*"` and ONE shared profile each,
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

## 8.12 Saved positions: Your AI Position into the Decision Desk

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

## 8.13 The Decision Desk shortlist

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

## 8.14 What carries across "AI and Your Company"

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

## 8.15 The jurisdiction filter, and the interrogation's memory

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

## 8.16 Investors are not vendors

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

## 8.17 Touch targets and loading states

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
