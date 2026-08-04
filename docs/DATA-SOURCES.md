# AI Enterprise — data sources

**Working document.** Expect additions. Last verified against live endpoints:
**4 August 2026**.

Every status in this file was probed, not assumed. Where something is broken it
says so, because a source register that lists a dead upstream as healthy is
worse than no register.

---

## 0. How to read this

Sources fall into four tiers, and the distinction matters more than the list:

| Tier | Meaning | Can it move? |
|---|---|---|
| **First-party live** | We own the endpoint and the data behind it | Yes — we control refresh |
| **Third-party live** | Someone else's API, fetched at request time | Yes — but on their cadence |
| **Proxied** | Someone else's API behind our whitelist + cache | Only as fast as they refresh |
| **Bundled** | A dated file in the repo | No — a snapshot, and labelled as one |

The product's rule is that a figure carries its tier and its vintage wherever
it is shown. A bundled figure presented as live is the failure mode this
document exists to prevent.

---

## 0.1 Every page, and what it is badged

Counted from the rendered HTML on 4 August 2026, not from the props. The
`SAMPLE` column is the number of SAMPLE badges the page actually paints, which
is the only number that matters to someone deciding whether a page is
demonstrable.

| Page | What it answers | Data behind it | Lanes shown | SAMPLE | Refresh |
|---|---|---|---|---:|---|
| `/start` | Which question is yours | Static card copy | AIE LIVE, LIVE | 0 | Editorial |
| `/pulse` | What changed today | `market-share`, `reputation`, `capabilities`; judgement derived in `lib/pulse/judgement.ts`; verdict from `lib/vendor/composite-data.ts` | AIE (worst pull), DERIVED | 0 | Fixture sync + ISR 24 h |
| `/market-watch` | Who leads each category | `market-share.json` (4 Aug 2026) | AIE LIVE, AIE | 0 | `sync-aie-fixtures` |
| `/ai-adoption` | Who is actually paying | Menlo + Ramp curated figures; peer explorer from AIE uptake | LIVE, AIE LIVE, AIE | 0 | Hand-curated; uptake is a May 2026 seed |
| `/financial-snapshot` | Vendor financials | BoardRadar live (14 tickers) + `fixtures/sec/*` (31 Jul 2026) + `lib/finance/private-revenue.ts` | LIVE, AIE | 0 | BR live, 300 s cache; SEC on ingest |
| `/competitive-intel` | Capability comparison | `capabilities.json`, 470 vendor-capability rows | matrix lane, LIVE | 0 | `sync-aie-fixtures` |
| `/vendor-view`, `/vendor-view/[id]` | One vendor, read properly | `vendors.json`, `capabilities.json`, `reputation.json`, composite | AIE | 0 | `sync-aie-fixtures` |
| `/reputation-tracker` | How buyers rate vendors | `reputation.json` (29 rows, 4 Aug 2026) + third-party block | AIE, LIVE, third-party lane | **1** | `sync-aie-fixtures` |
| `/alliances` | Which GSI carries which vendor | `lib/aie/alliances/seed.ts`, 51 channel links | AIE | 0 | Hand-curated |
| `/market-view` (Model for Role) | Which model per role | `roles.json` (294 roles), `models.json` (330 models) | DERIVED, AIE | 0 | Bundled snapshot, 2 Aug 2026 |
| `/price-performance` | What capability costs | `models.json` | AIE LIVE, AIE | 0 | Bundled snapshot |
| `/workflow-shortlist` | Who to buy for a workflow | `lib/aie/use-cases.ts` (75 workflows) + vendor index | AIE LIVE, AIE | 0 | Bundled + proxy |
| `/trust-rank` | What regulation binds you | Governance postures | AIE, postures lane | **9** | Hand-curated |
| `/security-desk` | Security posture | Lab postures | LIVE, labs lane | 0 | Hand-curated |
| `/ecosystem-navigator` | Who depends on whom | Dependency seed | AIE, LIVE | 0 | Hand-curated |
| `/decision-desk` | The call you must defend | AIE data + scripted analyst | AIE LIVE, AIE, SAMPLE | **5** | Anthropic API if keyed |
| `/news-feed` | What moved | `/api/news`, 24 h module TTL | AIE LIVE, AIE, LIVE | 0 | 24 h |
| `/company-view` | Your AI position | **Shell fixture** (`fixtures/sample/shell.json`) | — | **13** | Static sample |
| `/shortlist` | Saved vendors | Cookie (`ag_shortlist`) | metrics lane | 0 | Per-browser |
| `/interrogate` | Ask a question | Anthropic API, or scripted when unkeyed | — | 0 | Live per request |

**The four pages a pod must not demo as live.** `/company-view` is the Shell
sample end to end and is the largest single block of sample data in the
product. `/trust-rank` and `/decision-desk` carry sample content inside
otherwise real pages. `/reputation-tracker` has one sample panel. Everything
else paints no SAMPLE badge at all.

Two things that are real but easy to misread as live. The role and model
libraries behind Model for Role and Price / Performance are **bundled
snapshots dated 2 August 2026**: they are genuine published figures, they do
not refresh, and the pages badge them AIE rather than LIVE for that reason.
And `uptake` remains a static May 2026 seed, disclosed on-page, superseded by
the movement catalogue in §1.1.

---

## 1. First-party — endpoints we own

### 1.1 Movement catalogue (Postgres)

Our own database. The only source here where we control both the schema and
the refresh.

| | |
|---|---|
| **Host** | `https://lmptnwqthldbficddtfn.supabase.co` |
| **Project** | `ag-vendor-intake` (Supabase, eu-west-2) |
| **Schema** | `aie` (private) exposed via `public.catalogue_*` views |
| **Auth** | Publishable key (read). Service key (write) — `SUPABASE_SERVICE_ROLE_KEY` |
| **Status** | ✅ Live. **1,340 observations** as at 4 Aug 2026 |
| **Verified** | `content-range: 0-0/1340` |

**Tables**

| Table | Purpose |
|---|---|
| `aie.source` | Source registry. Every source declares `measures` **and** `cannot_support` |
| `aie.observation` | The catalogue. One row per (series, subject, metric, `observed_at`) |
| `aie.ingestion_run` | Audit. A failed run is a row, not a silence |
| `aie.usage_event` | Anonymous usage. No IP, session, user agent or visitor text |

**Series**

| Series | Observations | Comparable | Notes |
|---|---:|---:|---|
| `model` | 1,252 | 0 | 330 models × price/throughput/intelligence/vendor. One snapshot, so no movement yet |
| `vendor` | 16 | 8 | Two dated 12-month windows — real movement on first run |
| `market` | 72 | 0 | AIE category share, one refresh |
| `usage` | accumulating | — | Written by the app, never ingested |

**Key design points a developer needs to know**

- `observed_at` (when the fact was true) ≠ `ingested_at` (when we recorded it).
- Unique constraint on `(series, subject_id, metric, observed_at)` makes
  re-ingestion idempotent.
- **PostgREST caps responses at 1,000 rows** regardless of `limit`. The client
  pages using `Prefer: count=exact` and `Content-Range`. Do not trust
  `rows.length < limit` as a truncation check — it silently missed 252 rows.

**RLS posture** (verified live)

| Operation | Public key | Expected |
|---|---|---|
| Read `catalogue_observation` | `200` | ✅ public data |
| Read `usage_event` | not exposed | ✅ write-only from outside |
| Insert `observation` | `permission denied` | ✅ writes need service key |

### 1.2 Adoption disclosure — `/api/adoption/disclosure`

| | |
|---|---|
| **Upstream** | SEC EDGAR (see §2.1) |
| **Cache** | 5 min in-process; committed snapshot fallback |
| **Rate limit** | 10/min per IP, on cache misses only |
| **Fallback** | `data/adoption/disclosure-10-K.json` (shipped via `outputFileTracingIncludes`) |
| **Status** | ✅ Live |

### 1.3 Catalogue API — `/api/catalogue/{series}`

Series: `model` · `vendor` · `market` · `usage`. Returns movements with
`change: null` where only one observation exists, plus `truncated` measured
against the server's own count.

### 1.4 Adoption status — `/api/adoption/status`

Connector health and the licence position of each source.

---

## 2. Third-party live — fetched at request time

### 2.1 SEC EDGAR full-text search ⭐

The strongest source in the product: measured, disclosed by the companies
themselves, and citable per row.

| | |
|---|---|
| **Endpoint** | `https://efts.sec.gov/LATEST/search-index` |
| **Params** | `q` (quoted), `forms`, `startdt`, `enddt` |
| **Auth** | None. `User-Agent` required by fair-access policy — `SEC_USER_AGENT` |
| **Rate limit** | <10 req/s |
| **Licence** | US government work, public domain |
| **Evidence class** | **A** (regulatory/statutory) |
| **Status** | ✅ `200`, ~2.3 s, 34 KB |

**Returns per hit:** company, CIK, filing date, **SIC industry code**, state —
plus a native `sic_filter` aggregation, which is the industry breakdown without
us bucketing anything.

**Cannot support:** whether the registrant is a *customer*. A filing may name a
vendor as competitor, investor, supplier or partner. US registrants only.

**Gotchas**
- Quote multi-word terms — unquoted `Google Cloud` matches either word.
- The index reaches back to **2001**. Unbounded counts measure "ever
  mentioned": Anthropic is 56 all-time vs 36 in the last year.
- Returns **HTML with a 200** to traffic it dislikes — check `content-type`,
  not just `res.ok`.

### 2.2 Federal Register

| | |
|---|---|
| **Endpoint** | `https://www.federalregister.gov/api/v1/documents.json` |
| **Auth** | None |
| **Licence** | US government work, public domain |
| **Evidence class** | **A** |
| **Status** | ✅ `200`, 0.37 s. ~1,521 AI documents |

**Cannot support:** anything outside US federal rulemaking — no EU AI Act, no
UK regulators, no state law.

### 2.3 Google favicon service

| | |
|---|---|
| **Endpoint** | `https://www.google.com/s2/favicons?domain=…&sz=32` |
| **Status** | ⚠️ `301` redirect — works, but follows a redirect |
| **Used by** | `/api/favicon` |

### 2.4 Clearbit logo — ❌ **DEAD**

| | |
|---|---|
| **Endpoint** | `https://logo.clearbit.com/{domain}` |
| **Status** | ❌ **DNS does not resolve** (`Could not resolve host`) |
| **Used by** | `/api/logo/[domain]` |
| **Impact** | Low. DNS failure returns in ~19 ms (no timeout wait), the route catches it, caches the negative result for 24 h, and serves a 1×1 blank SVG with `x-eai-logo: unreachable` |
| **Action** | Replace or remove at leisure. Not urgent — it fails fast, fails once per domain per day, and fails silently by design |

> The one genuine breakage found while compiling this document. Clearbit's
> logo API was retired after the HubSpot acquisition.
>
> Worth noting the failure handling is doing exactly its job: an upstream
> disappeared entirely and no page broke. The cost is a missing logo, not an
> error — which is also why nobody noticed until someone probed the host.

---

## 3. Proxied — someone else's API behind our whitelist

### 3.1 Ranking Engine (AIE) — `/api/aie/[...path]`

| | |
|---|---|
| **Upstream** | `https://ranking-engine-red.vercel.app/api` |
| **Auth** | None |
| **Cache** | 5 min in-process, 12 s timeout, 1 retry, fixture fallback |
| **Status** | ✅ All probed paths `200` |

**Whitelist (10 paths)** — anything else is `403`:

| Path | Live size | Fixture | Notes |
|---|---|---|---|
| `vendors` | 75 KB | `vendors.json` (47) | |
| `market-share` | 48 KB | `market-share.json` (72) | Modelled estimate, not measured |
| `uptake` | 1.4 KB | `uptake.json` | **Static May 2026 seed** — see warning |
| `news` | **3.28 MB** | `news.json` (200) | Ignores `?limit`. See §5 |
| `model-inventory` | — | `model-inventory.json` (100) | |
| `reputation` | — | `reputation.json` (29) | |
| `pricing` | — | `pricing.json` | |
| `capabilities` | — | `capabilities.json` | |
| `market-dashboard` | — | `market-dashboard.json` | |
| `metadata` | — | `metadata.json` (49) | |

> ⚠️ **`uptake` is not live data.** The upstream route reads a static May 2026
> seed and its own provenance string calls it a modelled estimate. Its ordering
> (OpenAI ahead of Anthropic) is contradicted by both Menlo Ventures and the
> Ramp AI Index. Proxying it harder cannot make it fresher — there is nothing
> fresher behind it. This is why §1.1 exists.

### 3.2 AnalystGenius (BoardRadar) — `/api/br/[...path]`

| | |
|---|---|
| **Upstream** | `https://ag-api-prod-calm-seastar-79.fly.dev/api/v1` |
| **Auth** | `X-API-Key` — `ANALYSTGENIUS_API_KEY` |
| **Cache** | 5 min, 12 s timeout, 1 retry, 60 req/min per IP |
| **Status** | ✅ `200` with key (135 KB), `401` without — auth working correctly |

**Whitelist (23 prefixes):** `companies`, `providers`, `pulse`, `financial`,
`financial-snapshot`, `talent`, `ai-exposure`, `reputation-tracker`,
`competitive-intelligence`, `governance`, `governance-risk`, `cyber-risk`,
`news`, `ai-readiness`, `assessment`, `ai-platform`, `ai-talent`, `context`,
`edgar`, `peer-financials`, `fx`, `narrative-reality-gap`, `market-signals`.

> `userId` is deliberately stripped before forwarding, so responses carry
> public/estimated values — correct for a public demo.

---

## 4. Bundled — dated files in the repo

No network. Each is a snapshot and is labelled with its vintage.

| File | Size | Rows | Vintage |
|---|---:|---|---|
| `lib/model-fit/data/roles.json` | 684 KB | 294 role profiles | 2 Aug 2026 |
| `lib/model-fit/data/models.json` | 132 KB | 330 models | 2 Aug 2026 |
| `fixtures/aie-live/*.json` | ~1.1 MB | 11 files | Proxy fallbacks |
| `fixtures/br/*.json` | ~500 KB | 6 files | Proxy fallbacks |
| `data/adoption/disclosure-10-K.json` | 20 KB | 8 vendors | Regenerate: `npm run ingest:adoption` |
| `lib/aie/vendor-directory.ts` | — | 43 vendors | `VENDOR_DIRECTORY_AS_OF` = 7 May 2026 |

---

## 5. Anthropic API (LLM features)

| | |
|---|---|
| **Auth** | `ANTHROPIC_API_KEY` |
| **Status** | ⚪ **Not set** (0 chars) — the app runs in scripted mode, £0 LLM spend |
| **Used by** | `/api/interrogate`, `/api/analyst` |

**Model routing** — cheapest model that meets the bar, which is the product's
own thesis applied to itself:

| Model | Role |
|---|---|
| `claude-haiku-4-5` | Query classification, chunk selection |
| `claude-sonnet-5` | Default synthesis |
| `claude-opus-5` | Only on an explicit "comprehensive" request |

> **Prompt caching does not apply here** and should not be added. The system
> prompts are 111 and 146 tokens against a minimum cacheable prefix of 512
> (Opus 5) / 1,024 (Sonnet 5) / 4,096 (Haiku 4.5). A `cache_control` marker
> would charge the write premium and never produce a read. Measured, not
> assumed.

---

## 6. Environment variables

| Variable | Required | Purpose |
|---|---|---|
| `ANALYSTGENIUS_API_BASE` | Yes (BR) | BoardRadar upstream |
| `ANALYSTGENIUS_API_KEY` | Yes (BR) | `X-API-Key` |
| `NEXT_PUBLIC_SUPABASE_URL` | Defaulted | Catalogue host |
| `NEXT_PUBLIC_SUPABASE_ANON_KEY` | Defaulted | Publishable key — **not a secret** |
| `SUPABASE_SERVICE_ROLE_KEY` | Ingestion only | Catalogue writes |
| `SEC_USER_AGENT` | Courtesy | SEC fair access; has a working default |
| `ANTHROPIC_API_KEY` | Optional | Unset ⇒ scripted mode |
| `AIE_BASE` | Optional | Overrides ranking-engine base |
| `MOCK_MODE` | Optional | `true` forces fixtures everywhere |
| `DEMO_USER` / `DEMO_PASS` | Optional | Basic auth. **Deliberately unset in production** — the site is public by design |

---

## 7. Known issues

| # | Issue | Severity | Status |
|---|---|---|---|
| 1 | `logo.clearbit.com` does not resolve | Low — fails in 19 ms, cached 24 h, blank SVG | ❌ Open — replace at leisure |
| 2 | `/api/news` returns 3.28 MB and ignores `?limit` | Medium (bandwidth) | ⚠️ Mitigated — 24 h module TTL |
| 3 | `uptake` is a static May 2026 seed | High (misleading) | ⚠️ Disclosed on-page; superseded by §1.1 |
| 4 | PostgREST 1,000-row ceiling | Medium (silent truncation) | ✅ Fixed — paging + `count=exact` |
| 5 | Model series has one observation | Expected | ✅ Reports `comparable: 0` |

---

## 8. Refresh commands

```bash
npm run ingest:adoption           # SEC → data/adoption/*.json (committed)
npm run ingest:catalogue          # all series → Postgres (needs service key)
npm run ingest:catalogue model    # one series
npm run ingest:catalogue -- --sql # emit SQL instead, no key needed
```

---

## 9. To add

- [ ] Replace or remove the Clearbit logo source
- [ ] A second model snapshot, so the model series becomes comparable
- [ ] UK/EU regulatory source to sit beside Federal Register (ONS, Eurostat,
      EU AI Act) — Eurostat is JSON-stat and keyless; ONS BICS is xlsx-only
- [ ] Decide whether Menlo / Ramp figures stay hand-curated or get a source row
