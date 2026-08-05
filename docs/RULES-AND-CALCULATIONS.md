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

---

## 1. Provenance: the lane rules

`lib/provenance.ts:33` defines seven lanes and no eighth:

| Lane | Badge (`LANE_LABEL`, `lib/provenance.ts:42`) |
|---|---|
| `live` | LIVE |
| `aie` | AIE dataset |
| `aie-live` | AIE live |
| `derived` | DERIVED |
| `sample` | SAMPLE |
| `mock` | Cached sample |
| `stub` | In development |

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
