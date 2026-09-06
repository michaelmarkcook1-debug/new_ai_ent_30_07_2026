# AI Enterprise: API and data contracts

The reference a developer needs to call this app's endpoints or change its
store, as opposed to the narrative in [ARCHITECTURE.md](ARCHITECTURE.md) and
the provenance in [DATA-SOURCES.md](DATA-SOURCES.md).

Every shape below was **captured from production on 5 August 2026**, not
written from the types. Where a field is described as always present, that
means it was present in the captured response and is unconditional in the
route, both checked.

Base: `https://newaient30072026.vercel.app`

---

## 1. Conventions

### The provenance header

Every proxied or fetched response carries `x-eai-source`, and it is the only
thing that drives a lane badge in the UI:

| Value | Means |
|---|---|
| `live` | Reached the upstream this request |
| `mock` | Served a recorded fixture: upstream failed, or `MOCK_MODE=true` |
| `error` | Neither worked |

Some routes also send `x-eai-cache: hit` when answering from the in-process
cache. A cache hit is still `live`: the data was fetched live, just not this
second.

**Never infer freshness from the payload.** Infer it from the header.

### Error envelope

Every error response, on every route, is the same shape:

```json
{ "success": false, "error": "human sentence", "code": "MACHINE_CODE" }
```

`code` is the thing to branch on; `error` is for a person. Some errors add a
field to help the caller recover: `supported` on `SERIES_NOT_ALLOWED`, for
instance. Codes in use:

| Code | Route | Meaning |
|---|---|---|
| `SERIES_NOT_ALLOWED` | `catalogue/{series}` | Unknown or retired series |
| `CATALOGUE_ERROR` | `catalogue/{series}` | Supabase unreachable or rejected the query |
| `NO_CATALOGUE` | `catalogue/{series}` | No Supabase configured |
| `FORM_NOT_ALLOWED` | `adoption/disclosure` | SEC form type outside the whitelist |
| `NO_DATA` | `adoption/disclosure` | Nothing to return |
| `RATE_LIMITED` | `adoption/disclosure`, `br/*` | Over the per-IP limit |
| `PATH_NOT_ALLOWED` | `br/*`, `aie/*` | Proxy path outside the whitelist |
| `BAD_REQUEST` | `analyst`, `analyst/upload`, `interrogate` | Malformed body |
| `BAD_QUESTION` | `analyst` | Question failed validation |
| `BAD_SITUATION` | `interrogate` | Situation failed validation |
| `BAD_TYPE` | `analyst/upload` | Unsupported file type |
| `TOO_LARGE` | `analyst/upload` | Upload over the size cap |

### Caching and limits

| Route | Cache | Rate limit |
|---|---|---|
| `/api/catalogue/{series}` | 300 s in-process | none |
| `/api/adoption/disclosure` | 300 s in-process, then committed snapshot | 10/min per IP, **on misses only** |
| `/api/br/*` | 300 s in-process | 60/min per IP |
| `/api/aie/*` | per-module TTL | none |

Rate limiting misses rather than requests is deliberate: a cached answer costs
nothing upstream, so charging a caller for it would punish the good case.

---

## 2. `/api/catalogue/{series}`

`GET`. Series: **`model`**, **`vendor`**, **`market`**. No parameters.

`usage` is not a series and returns 400, see §7.

```json
{
  "series": "vendor",
  "observations": 37,
  "observationsInSeries": 37,
  "tracked": 25,
  "comparable": 11,
  "truncated": false,
  "note": "11 of 25 tracked figures have two or more observations and can be compared.",
  "movements": [ /* see below */ ],
  "lastRuns": [
    { "startedAt": "2026-08-04T23:44:19.395888+00:00", "ok": true, "rowsWritten": 21, "failures": [] }
  ]
}
```

| Field | Type | Notes |
|---|---|---|
| `observations` | int | Rows actually returned |
| `observationsInSeries` | int | The **server's** count, from `Content-Range` |
| `tracked` | int | One per subject **and metric** pair, not per subject |
| `comparable` | int | Tracked figures with two or more observations |
| `truncated` | bool | `observations < observationsInSeries`. Must be `false` |
| `note` | string | The above said in a sentence, including an empty-series case |

A `movements` entry:

```json
{
  "subject_id": "anthropic",
  "subject_label": "Anthropic",
  "metric": "valuation_post_money_usd_m",
  "unit": "USD millions",
  "latest": 965000,
  "latestAt": "2026-06-15T00:00:00+00:00",
  "previous": 380000,
  "previousAt": "2026-02-12T00:00:00+00:00",
  "change": 585000,
  "changePct": 153.94736842105263,
  "provenance": "Anthropic raises $65B in Series H funding at $965B post-money valuation. (Anthropic newsroom, 2026-06-15.) Caveats: …",
  "source_id": "press_reported_figures"
}
```

**`change: null` is not zero.** A subject with one observation has no movement
to report, and rendering it as a flat line would invent a trend from a single
point. `previous`, `previousAt`, `change` and `changePct` are all null in that
case. Sort order puts the biggest absolute movers first and the
not-yet-comparable last, for the same reason.

`provenance` is a sentence intended to be shown to a reader verbatim.
`source_id` joins to the source register (§6).

---

## 3. `/api/adoption/disclosure`

`GET`. How many SEC registrants name each vendor in a filing type.

| Param | Default | Notes |
|---|---|---|
| `vendor` | all tracked | Vendor id |
| `form` | `10-K` | Whitelisted; anything else is `FORM_NOT_ALLOWED` |
| `windowDays` | `365` | Unbounded counts measure "ever mentioned", which is a different claim |

```json
{
  "measures": "…", "formType": "10-K", "window": "…",
  "fetchedAt": "2026-08-05T…Z",
  "rows": [
    { "vendor": "Google Cloud", "filings": 142,
      "bySic": [ { "sic": "7372", "label": "Prepackaged software", "filings": 46 } ] }
  ],
  "failed": [],
  "source": "…"
}
```

`failed` lists vendors whose lookup did not complete: a partial answer is
returned rather than a 500, and the caller is told which parts are missing.

**A filing naming a vendor is not a customer relationship.** It may name it as
a competitor, investor, supplier or partner, and the filing does not say
which. US registrants only. That limit is carried in the source register's
`cannot_support` and should travel with any figure derived from this.

All eight vendors share a **single 20-second budget** per run. Without it, a
stalled upstream turned one run into ~98 seconds of hanging.

---

## 4. `/api/adoption/status`

`GET`, no parameters. Connector health and the licence position of each source.

```json
{ "firstParty": true, "note": "…", "connectors": [], "sources": [],
  "trackedVendors": [], "committedSnapshot": {}, "mockMode": false }
```

A connector carries `id`, `label`, `status` and a `message` that states the
remediation rather than just the fault, for example that `SEC_USER_AGENT` is
unset and running on a default.

---

## 5. `/api/admin/overview`

`GET`, no parameters. Backs `/admin`.

```json
{
  "costs": { "perRun": [ { "series": "adoption", "label": "SEC disclosure snapshot (8 vendors, one window)",
                           "invocationUsd": 6e-7, "cpuUsd": 7.11e-6, "memoryUsd": 1.10e-5,
                           "upstreamUsd": 0, "totalUsd": 1.87e-5, "requests": 8 } ] },
  "seriesCounts": [ { "series": "model", "count": 1252 },
                    { "series": "vendor", "count": 37 },
                    { "series": "market", "count": 72 } ],
  "usage": [ { "surface": "fitengine", "action": "compute", "events": 1,
               "last_at": "2026-08-04T12:06:30.788672+00:00" } ],
  "runs": [], "connectors": [], "generatedAt": "…"
}
```

`usage` here comes from the `usage_summary` function, **not** from
`aie.observation`. This is the only route that reads usage at all.

Costs are list-price arithmetic from `lib/admin/cost-model.ts`, carried at full
float precision: format at the edge with `formatUsd`, which shows enough
decimals to see the first significant figure instead of rounding every run to
`$0.00`.

---

## 6. The store

Supabase project `lmptnwqthldbficddtfn` (`ag-vendor-intake`), region
`eu-west-2`. Read over PostgREST with plain `fetch`; no client library.

### `aie.observation`: the catalogue

| Column | Type | Null | Notes |
|---|---|---|---|
| `id` | bigint | no | identity |
| `series` | text | no | `model` \| `vendor` \| `market` |
| `subject_kind` | text | no | what the subject is |
| `subject_id` | text | no | stable key |
| `subject_label` | text | no | display name |
| `metric` | text | no | what is measured |
| `value_num` | float8 | yes | one of num/text is set |
| `value_text` | text | yes | |
| `unit` | text | yes | |
| `observed_at` | timestamptz | no | **when the figure was true** |
| `ingested_at` | timestamptz | no | `now()`: when we learned it |
| `source_id` | text | no | → `aie.source.id` |
| `provenance` | text | no | shown verbatim to readers |
| `vintage` | text | yes | |

Constraints, read from `pg_constraint`:

| Constraint | Definition |
|---|---|
| `observation_unique` | `UNIQUE (series, subject_id, metric, observed_at)` |
| `observation_has_value` | `CHECK (value_num IS NOT NULL OR value_text IS NOT NULL)` |
| `observation_series_check` | `CHECK (series IN ('model','vendor','market','usage'))` |
| `observation_source_id_fkey` | `FOREIGN KEY (source_id) REFERENCES aie.source(id)` |

`observation_unique` makes ingestion idempotent: re-running a snapshot updates
rather than duplicates. `observation_has_value` means a row must measure
something: there is no way to record an observation that observed nothing.

> **Known drift, 5 August 2026.** `observation_series_check` still permits
> `'usage'`. The application no longer does: it is out of the `Series` type
> and out of the route's allowlist, so nothing writes it, and the table holds
> zero such rows. But the database would still accept one, which means the
> guarantee currently rests on the code alone. Tightening the constraint to
> the three real series is a one-line migration and is **not** applied here,
> because altering a production constraint is a decision to take deliberately
> rather than as a side effect of writing documentation.

**`observed_at` and `ingested_at` are different questions** and conflating them
is the classic error here. A figure published in June about February is
`observed_at` February. Sorting a trajectory by `ingested_at` reorders history
by when we happened to read it.

### `aie.source`: the register

`id`, `name`, `url` (nullable), `licence`, `evidence_class` (char, `CHECK` in
`A`–`E`), `measures`, `cannot_support`, `created_at`.

`measures` and `cannot_support` are both **required**. A source that cannot
state what it fails to support does not go in. Current register:

| id | class | url |
|---|---|---|
| `federal_register` | A | https://www.federalregister.gov/api/v1 |
| `sec_edgar_fts` | A | https://efts.sec.gov/LATEST/search-index |
| `vendor_pricing_page` | A | none (published per vendor) |
| `aie_model_catalogue` | D | none (assembled) |
| `aie_workspace_usage` | D | none (first-party) |
| `press_reported_figures` | D | none (per-figure publisher and URL in `lib/finance/data/private-figures.json`) |
| `aie_market_share` | E | none (modelled) |

A null `url` means the source is assembled or first-party and has no single
upstream address, not that provenance is missing: per-row provenance lives on
the observation.

### `aie.ingestion_run`

`id`, `series`, `started_at`, `finished_at`, `ok`, `attempted`, `rows_written`,
`failures jsonb` (default `[]`), `note`. A run that partly fails is recorded
with its failures rather than discarded.

### `aie.usage_event`

`id`, `occurred_at`, `surface`, `action`, `subject_id` (nullable),
`detail jsonb`. Both label columns are constrained rather than free text:
`surface IN ('fitengine','shortlist','adoption','decision-desk','interrogate')`
and `action IN ('compute','add','remove','view','export')`, so the aggregate
cannot be polluted by a typo'd surface name that silently becomes a new
category. **No IP, session id, user agent or visitor text**: there is
nothing in this table to leak, by construction rather than by policy. It is
also why usage can never be an observation series.

### Views and functions

Three `security_invoker` views in `public` expose the read surface, because the
`aie` schema itself is not exposed: `catalogue_observation`, `catalogue_source`,
`catalogue_run`. Two `security definer` functions: `record_usage(p_surface,
p_action, p_subject_id, p_detail)` writes, `usage_summary()` reads the
aggregate.

### Row-level security

The policies, read from `pg_policies`:

| Table | Policy | Roles | Command | Using / Check |
|---|---|---|---|---|
| `aie.observation` | `observation_public_read` | anon, authenticated | SELECT | `true` |
| `aie.source` | `source_public_read` | anon, authenticated | SELECT | `true` |
| `aie.ingestion_run` | `ingestion_run_public_read` | anon, authenticated | SELECT | `true` |
| `aie.usage_event` | `usage_event_anon_insert` | anon, authenticated | INSERT | check `true` |

There is **no SELECT policy on `usage_event` and no UPDATE or DELETE policy
anywhere**. Anonymous callers read the catalogue, append usage, and can do
nothing else; reading usage back requires the `usage_summary` function, and any
write to the catalogue requires `SUPABASE_SERVICE_ROLE_KEY`, which is used only
by `scripts/ingest-catalogue.mjs` and never in the app runtime.

`NEXT_PUBLIC_SUPABASE_ANON_KEY` is a **publishable** key and is designed to
ship to browsers. The table above is what protects the data, not the secrecy of
that string.

### The 1,000-row ceiling

PostgREST caps a response at 1,000 rows **regardless of the `limit` asked
for**. `lib/catalogue/client.ts` pages with `offset` and sends
`Prefer: count=exact`, comparing what arrived against `Content-Range`.

This bug is invisible in the code: it lives in the server's behaviour, and a
first fix that raised the limit from 500 to 5,000 looked correct in review and
changed nothing. **If you touch the paging, verify against the running
database, not the diff.**

---

## 7. Adding to this

**A new series.** Add it to `Series` in `lib/catalogue/client.ts` and to
`ALLOWED` in `app/api/catalogue/[series]/route.ts`. Then confirm rows actually
arrive before trusting a 200: a query that is valid over an empty table answers
successfully, which is how `usage` shipped as a series that could never hold
anything and reported "First observations recorded" over nothing.

**A new source.** Insert into `aie.source` with `measures` **and**
`cannot_support` filled in, and an honest `evidence_class`. Then add it to
DATA-SOURCES.md: the register and the document are both meant to be complete,
and only one of them is enforced by a NOT NULL.

**A new endpoint.** Emit `x-eai-source`, use the error envelope in §1, and
whitelist rather than blacklist any path or parameter that reaches an upstream.

---

## POST /api/admin/dataops/discover

Fetches every canonical endpoint from the upstream and compares it with the
canonical files. Writes nothing. No body. Returns the staged discovery:
`discoveredAt` (fetch time, not evidence), `source`, `files[]` (file, endpoint,
status `new-capture | unchanged | older | failed | script-captured`, captures,
record counts, note), `entities[]` (id, name, state `KNOWN | NEW | UNRESOLVED |
REJECTED`, source, upstreamCategory, suggestion, match, reason, evidenceDate),
`changes[]` (id, kind, entity, label, file, field, current, discovered, status
`new | changed | unchanged | removed`, canonicalCapture, evidenceDate, source),
`summary`, `payloads` (what was seen, for validate and ingest), `taxonomy`,
`roster`, and `store` (`writable`, `reason`, `root`, `staging`).

## POST /api/admin/dataops/validate

Body `{ discovery, resolutions[] }` where a resolution is `{ entityId, action:
"new" | "match" | "reject", category?, matchId? }`. Deterministic; reads the
canonical rankings for the population check; writes nothing. Returns
`records[]` (id, kind `entity | change`, level `READY | WARNING | BLOCKED`,
findings[] with rule and message, selectedByDefault, applicable) and `summary`.

## POST /api/admin/dataops/ingest

Body `{ discovery, resolutions[], approvedIds[] }`. The mutation boundary.
Re-validates on the server, keeps only approved READY or WARNING records, and
answers `409` with `status: "REFUSED"` and the reason when the store is
read-only (always on Vercel; on a checkout without `DATAOPS_WRITE=1`). Otherwise
writes every affected file or none, regenerates the derived artefacts, reverts
on failure, and returns `status` (`INGESTED | FAILED | NOTHING | REFUSED`),
`ingested`, `skipped`, `blocked`, `failed`, `files[]`, `derived[]`,
`evidenceVersion { before, after, changed }`, `analystInsight` (always "not
regenerated"), `audit`, `reverted`. `500` on FAILED.
