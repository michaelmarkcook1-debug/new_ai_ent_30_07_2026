# AI Enterprise: what production would take

For a pod picking this up. Written **4 August 2026** against the running
build. Companions: [ARCHITECTURE.md](ARCHITECTURE.md),
[DATA-SOURCES.md](DATA-SOURCES.md).

The footer says *"Demo build. Sample data is badged."* A team reads that as
"not ready", and for four pages that is correct. For the rest it is not, and
the point of this document is to say precisely which is which so nobody
rebuilds something that already works or demos something that does not.

---

## 1. What is actually done

Not aspirational. Each of these is verified by a test, by a probe against the
live endpoint, or by reading the rendered HTML.

| Area | State |
|---|---|
| Nav and information architecture | 13 resting items, paired pages, `/start` as the front door |
| Provenance system | Every figure carries a lane; no badge renders before data lands; worst lane wins |
| BoardRadar integration | 14 tickers probed live, key server-side only, 8 s timeout, fixture fallback, honest badging |
| Model for Role | 294 roles × 330 priced models, engine at parity with the Python reference |
| Workforce distribution | Two-panel figure, 14.8% / 0.7% pinned by test |
| Price / performance | Four axes with data, unscored models kept in a gutter, denominators printed |
| Composite metric | Three Questions + Verdict dial, never a score without its input count |
| Disclosure ladder | Five rungs, 7 of 9 filers with a stated figure or hard bound, zero invented numbers |
| Movement catalogue | Postgres over PostgREST, paging past the 1,000-row ceiling |
| Test suite | 322 tests, 21 files, green |
| Typecheck | Clean |
| Lint | ESLint + Next preset, 0 errors (gate added 5 Aug 2026; it had never run before) |
| Peer Insights | Industry→workflow reverse lookup on the 75-workflow library |
| Admin view | `/admin`: catalogue contents, run history, priced cost per run |

**The honest summary:** the product's data discipline is its strongest asset
and is genuinely built. What is thin is coverage, freshness automation, and
knowing whether anyone comes back.

---

## 2. The four pages that are not demonstrable as live

Counted from rendered HTML, not from props.

| Page | SAMPLE badges | What it would take |
|---|---:|---|
| `/company-view` (+5 sub-routes) | 13 | The whole "your company" story is the Shell fixture. Needs either a real customer tenant or reframing as an explicit worked example |
| `/trust-rank` | 9 | Governance postures are hand-curated. Needs a regulatory source (EU AI Act register, ONS, Eurostat) |
| `/decision-desk` | 5 | Scripted analyst output. Real behaviour needs `ANTHROPIC_API_KEY` set |
| `/reputation-tracker` | 1 | One sample panel beside real reputation data |

Every other page paints **zero** SAMPLE badges. That is the sentence to put in
front of a pod, because "demo build" currently implies all 28 pages are
illustrative and 24 of them are not.

---

## 3. Backlog

Ordered by what unblocks the most. Severity is about the product's promise,
not code health.

### Data coverage: the real constraint

| # | Gap | Severity | Notes |
|---|---|---|---|
| 1 | **Coding axis has no data.** CAP-04 is `status: identified`, `model_field: null`, 0 of 330 models scored | **High** | The most asked-for capability. Sources known: Artificial Analysis Coding Index, SciCode, Terminal-Bench. Tab ships disabled with that text. Already spun out as a task |
| 2 | **Output pricing and context windows are 0 of 330** | **High** | The price chart is input-only, which understates real workload cost. The derivation drawer says so |
| 3 | **Salesforce and ServiceNow have no segment breakdown** | **High** | Both file segment data. This is an ingestion gap, not a disclosure gap, and it blocks two filers from BOUNDED |
| 4 | **SAP, Adobe, Cisco, Dell, Alibaba have no filings ingested** | Medium | In the ticker selector with live market figures but no filing-derived card |
| 5 | **Reputation covers 28 of 43 vendors; financial disclosure 18 of 43** | Medium | Drives the composite. `reports/scorecard-ledger.json` is the backlog, thinnest coverage first |
| 6 | **`uptake` is a static May 2026 seed** | Medium | Disclosed on-page and superseded by the movement catalogue, but still rendered |
| 7 | **Model series has one observation** | Low | Reports `comparable: 0` honestly. Needs a second snapshot to become a series |
| 8 | **No growth figures for private companies** | Low | Genuinely unpublished. Correctly absent |

### Platform and operations

| # | Gap | Severity | Notes |
|---|---|---|---|
| 9 | **No instrumentation on the daily loop** | **High** | "Since you last looked" and the change log exist; nothing measures whether anyone returns. You cannot tune a retention product you cannot see |
| 10 | **Fixture refresh is manual** | **High** | `sync-aie-fixtures` exists and is careful, but nothing runs it. Needs a schedule plus an alert when a source stops moving |
| 11 | **BoardRadar stalls intermittently per ticker** | Medium | Upstream. Handled honestly (8 s, then recorded data badged as such) but not fixed, and not ours to fix |
| 12 | **`/api/news` returns 3.28 MB and ignores `?limit`** | Medium | Mitigated with a 24 h module TTL and a trim to 300 items |
| 13 | **`logo.clearbit.com` is dead** | Low | Fails in 19 ms, cached 24 h, renders a blank SVG |
| 14 | **No auth, no tenancy, no per-user persistence** | **High for productisation** | Shortlist and overrides live in cookies and `localStorage`. Multi-user needs real accounts |

### Open questions

| # | Question |
|---|---|
| 15 | **The "regulated industry AI" error does not reproduce.** Both interaction paths were driven with error traps armed and produced nothing; all 75 workflows carry complete data and every vendor link resolves. Needs the console text or a screenshot to pin down |
| 16 | **Four investor entries 404 on `/vendor-view`** (a16z, MGX, Sequoia, SoftBank). By design: they are filtered from `TRACKED_VENDORS`, but a 404 is a poor way to express "not a vendor" |
| 17 | **Two Amazon/IBM/NVIDIA "AI revenue" figures are not AI revenue.** IBM's is a book of business, NVIDIA's is a segment line. Rendered with the company's own words. A real AI-revenue series would need a different source |

---

## 4. What a pod would need

**Team.** Two engineers and a data person for a quarter is a realistic first
cut. The data person is not optional: items 1–8 are the difference between a
convincing demo and a product, and none of them is an engineering problem.

**Sequence.** Coverage before features. The composite, the price chart and the
disclosure ladder are all built and all under-fed; ingesting the coding axis
and the missing filings makes three existing surfaces materially better
without writing a new page. Then instrumentation (item 9), because after that
you are guessing about what to build next.

**The thing not to break.** Every number carries where it came from, and an
absence is rendered rather than filled. Several tests exist purely to enforce
that: a composite cannot be returned without its input count, a STATED figure
must appear verbatim in the filing text, the workforce percentages are pinned.
Those tests will look pedantic to a new team. They are the product.

**A specific warning.** The temptation with items 1–8 is to fill gaps with
estimates so the pages look complete. Two places in this codebase already
refuse to do that on purpose: OpenAI's $110B compute commitment is recorded
in `NOT_VALUATIONS` precisely so it is never mistaken for a valuation, and the
durability input cannot return "No" because no vendor discloses distress.
Filling those in would make the product look finished and be worth less than
it is now.
