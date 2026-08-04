# AI Enterprise — architecture

Written for a team taking this over. Current as of **4 August 2026**, verified
against the running build rather than from memory.

Companion documents: [DATA-SOURCES.md](DATA-SOURCES.md) for every dataset and
its vintage, [MVP-SCOPE.md](MVP-SCOPE.md) for what production would take.

---

## 1. The shape of it

A single Next.js 15.5 application, App Router, TypeScript, Tailwind v4, React
19. Five runtime dependencies: `next`, `react`, `react-dom`, `recharts`, and
`@anthropic-ai/sdk`. That is deliberate and worth preserving — most of the
data layer talks HTTP directly rather than pulling in a client library.

Deployed on Vercel at `https://newaient30072026.vercel.app`.

```
Browser
  │
  ├── Server Components ──► fixtures / bundled JSON      (no network)
  │                     └─► lib/* pure computation       (testable)
  │
  └── Client Components ──► /api/br/*    ──► BoardRadar  (key injected here)
                        ├─► /api/aie/*   ──► Ranking Engine
                        ├─► /api/catalogue/* ──► Supabase Postgres
                        └─► /api/interrogate, /api/analyst ──► Anthropic
```

The rule that shapes most of the code: **secrets never reach the browser**.
Every upstream that needs a key is reached through a server route that injects
it. There is no client-side call to a keyed API anywhere in the app.

---

## 2. Routes

### Pages — `app/(ai-ent)/`

A single route group. 28 page routes, grouped in the sidebar as 13 resting
items (`lib/ui/shell.tsx` → `NAV_GROUPS`); paired pages share a row and expand
when that part of the site is open.

| Group | Routes |
|---|---|
| Market Intelligence | `/start`, `/pulse`, `/market-view` (+`/price-performance`), `/market-watch` (+`/ai-adoption`), `/financial-snapshot`, `/competitive-intel`, `/vendor-view` (+`/reputation-tracker`), `/alliances` (+`/ecosystem-navigator`) |
| AI and Your Company | `/company-view` (+ 5 sub-routes), `/decision-desk` |
| Vendor Assessment | `/workflow-shortlist`, `/trust-rank` (+`/security-desk`), `/news-feed` |
| Other | `/vendor-view/[id]` (SSG, 43 vendors), `/shortlist`, `/model-for-role` (redirect), `/interrogate` (redirect), `/assess-decide` |

Rendering modes matter for cost and freshness:

- **`○` static** — most pages. No per-request work.
- **`●` SSG** — `/vendor-view/[id]`, 43 pages from `generateStaticParams`,
  which reads `TRACKED_VENDORS` and so excludes the 4 AI investors.
- **`ƒ` dynamic** — anything reading cookies (`/pulse`, `/shortlist`) or
  fetching per request.
- **ISR** — pages whose Analyst Insight must re-pick a daily news item declare
  `export const revalidate = 86400`. Without it the insight is a pure function
  of a build-time constant and can never change, which is exactly the bug that
  froze nine tabs on the deploy-day headline.

### API — `app/api/`

| Route | Purpose | Auth |
|---|---|---|
| `br/[...path]` | BoardRadar proxy | Injects `X-API-Key` server-side |
| `aie/[...path]` | Ranking Engine proxy | None needed upstream |
| `catalogue/[series]` | Movement catalogue | Publishable key + RLS |
| `adoption/disclosure`, `adoption/status` | SEC-derived adoption | None |
| `analyst`, `analyst/upload` | Document analyst | `ANTHROPIC_API_KEY` |
| `interrogate` | Question answering | `ANTHROPIC_API_KEY` |
| `favicon`, `logo/[domain]` | Icon proxy | None |

---

## 3. The BoardRadar dependency

The single hardest external dependency, and the one most likely to bite.

**Contract.** `app/api/br/[...path]/route.ts` is the only door. GET only,
whitelisted path prefixes (23 of them), key injected from
`ANALYSTGENIUS_API_KEY`, 300 s in-memory cache, 60 requests/minute per IP,
8 s timeout, one retry on a fast failure but **not** on a timeout, then a
recorded fixture, then a 503.

**Behaviour to know about.** Measured 4 August 2026 across all 14 probed
tickers: a ticker BoardRadar answers returns in 1.3–1.5 s. It stalls
intermittently and per-ticker, and a stall used to cost 24 s of dead air
(12 s × 2 attempts) before the fixture appeared. A timeout now stops at 8 s.

**Two traps.**

1. The proxy returns `success: true` for tickers that do not exist
   (`ZZZZNOTREAL` comes back with `companyName: "ZZZZNOTREAL"`). Do not treat
   a 200 as proof a company is real.
2. A non-JSON 200 is a routing failure, not data — the upstream serves an HTML
   error page for paths it does not recognise. The proxy falls through to the
   fixture rather than badging a dead route LIVE.

**Provenance header.** Every response carries `x-eai-source`: `live`, `mock`
or `error`. The UI badge is driven by that header and by nothing else. A lane
badge is never rendered before the call lands, because a LIVE badge over a
spinner claims a pull that has not happened.

---

## 4. Supabase

Project `ag-vendor-intake`, region `eu-west-2`, ref `lmptnwqthldbficddtfn`.

Reached over PostgREST with plain `fetch` (`lib/catalogue/client.ts`) rather
than `@supabase/supabase-js`: the whole surface used is two GETs and one RPC.

| Object | Kind | Use |
|---|---|---|
| `catalogue_observation` | table | The movement catalogue: one row per observed metric, with `observed_at`, `source_id`, `provenance`, `vintage` |
| `catalogue_source` | table | Source register, ordered by evidence class |
| `catalogue_run` | table | Ingestion run history |
| `record_usage` | RPC | Usage counter |

**Key model.** `NEXT_PUBLIC_SUPABASE_ANON_KEY` is a *publishable* key and is
designed to ship to browsers. What protects the data is row-level security,
not the secrecy of that string: anonymous callers may read the catalogue, may
not write, and cannot read the usage table at all. Writes need
`SUPABASE_SERVICE_ROLE_KEY` and happen only in `scripts/ingest-catalogue.mjs`.

**PostgREST ceiling.** The API caps a response at 1,000 rows regardless of the
`limit` asked for. The client pages with `offset` and requests `count=exact`,
because trusting our own `limit` silently truncated the catalogue once already.

---

## 5. Data flow and the lane system

Every figure in the product carries a lane, and the lane is the contract with
the reader.

| Lane | Means |
|---|---|
| `live` | Fetched from an upstream at request time |
| `aie-live` | Reached the Ranking Engine this render |
| `aie` | Real AIE dataset, from a dated file |
| `derived` | Computed here from named inputs |
| `sample` | Illustrative. Not real. |
| `mock` | A recorded fixture standing in for a failed live call |
| `stub` | Placeholder |

`LaneBadge` (`lib/ui/badges.tsx`) is the only thing that paints one. Two rules
hold everywhere and are worth defending in review:

- **A lane is never asserted before the data arrives.** No badge renders during
  loading.
- **The worst lane wins.** A page assembling live and bundled data badges
  itself with the weaker of the two.

### Server/client boundary

The one that catches people: **a module importing `node:fs` cannot be imported
into a client component.** Webpack fails with `UnhandledSchemeError`. Three
patterns exist for this, all in use:

1. **Generated artefact** — `lib/aie/vendor-directory.ts` is emitted by
   `scripts/generate-vendor-directory.mjs` from a 90 KB fixture, carrying only
   what a browser needs. Regenerated by the sync so it cannot drift.
2. **Server-computed payload** — `lib/model-fit/workforce-payload.ts` flattens
   a 697 KB role file to five figures per industry, because the chart smooths
   from those alone.
3. **`import type` only** — types cross the boundary freely; values do not.

---

## 6. Environment variables

| Variable | Required | Purpose |
|---|---|---|
| `ANALYSTGENIUS_API_BASE` | Yes | BoardRadar upstream base URL |
| `ANALYSTGENIUS_API_KEY` | Yes | `X-API-Key`, injected server-side only |
| `NEXT_PUBLIC_SUPABASE_URL` | Defaulted | Catalogue host |
| `NEXT_PUBLIC_SUPABASE_ANON_KEY` | Defaulted | Publishable key — **not a secret** |
| `SUPABASE_SERVICE_ROLE_KEY` | Ingestion only | Catalogue writes. Never in the app runtime. |
| `ANTHROPIC_API_KEY` | Optional | Unset ⇒ scripted mode, £0 LLM spend |
| `SEC_USER_AGENT` | Courtesy | SEC fair-access header; has a working default |
| `AIE_BASE` | Optional | Overrides the Ranking Engine base |
| `MOCK_MODE` | Optional | `true` forces fixtures everywhere |
| `DEMO_USER` / `DEMO_PASS` | Optional | Basic auth gate. Unset ⇒ open. |

The gate in `middleware.ts` opens when either is unset, which keeps local
development friction-free and is why production is public by design.

---

## 7. Middleware

`middleware.ts` deliberately **imports nothing**, and that constraint is load
bearing. Importing `NextResponse` pulls 97 modules including an ncc-compiled
`@opentelemetry/api` that executes `__dirname` at module scope; on Edge that
throws `ReferenceError` and every request 500s with
`MIDDLEWARE_INVOCATION_FAILED`. A local production build strips that path and
looks clean, which is what made it hard to see. Moving to the Node runtime hits
a different wall: Next 15.5 emits Node middleware as ESM while nothing in the
bundle declares `"type": "module"`.

Web-standard `Request`/`Response` are enough to check a header. Leave it alone.

---

## 8. Testing

`npm test` runs Vitest. 271 tests across 16 files, all passing as of 4 August
2026. `tests/**/*.test.ts` only — **Vitest cannot parse JSX here**, so pure
logic must live in `.ts` for it to be testable. That constraint is why the
chart maths sits in `lib/` and the components only draw.

The tests worth understanding before changing anything:

| File | Guards |
|---|---|
| `workforce-curve.test.ts` | 14.8% at tier 70+, 0.7% at tier 90, and that bandwidth 9 yields one mode where 5 yields several |
| `price-performance.test.ts` | Axis denominators (330/56/44/262) and that the recomputed intelligence frontier reproduces the catalogue's own 10 |
| `disclosure-ladder.test.ts` | Every STATED phrase appears verbatim in the filing text held in the fixture |
| `composite.test.ts`, `composite-data.test.ts` | That no composite is ever returned without its input count, and that durability cannot return "No" |
| `live-vendor-parity.test.ts`, `model-fit-parity.test.ts` | Parity against the upstream and the Python reference |
| `scorecard-ledger.test.ts` | The committed internal report matches what the code produces |

Several assert **specific published figures**. That is intentional: if a
fixture sync moves a number the product quotes in prose, the build fails rather
than the page quietly changing what it claims.

---

## 9. Scripts

```bash
node scripts/sync-aie-fixtures.mjs        # re-pull AIE fixtures, report what moved
node scripts/generate-vendor-directory.mjs # regenerate the client-safe roster
node scripts/snapshot-signals.mjs          # snapshot for change detection
npm run ingest:adoption                    # SEC → data/adoption/*.json
npm run ingest:catalogue                   # all series → Postgres
WRITE_LEDGER=1 npx vitest run tests/scorecard-ledger.test.ts  # regenerate the ledger
```

`sync-aie-fixtures` refuses to overwrite a newer capture with an older one —
the pricing endpoint answers on request but serves a 2 June 2026 capture
whatever day you ask — and regenerates the two derived artefacts afterwards,
because forgetting to do that is how the July port drifted into showing 88 for
a vendor the source scored 68.3.
