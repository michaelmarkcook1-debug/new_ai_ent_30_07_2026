# AI Enterprise: architecture

Written for a team taking this over. Current as of **5 August 2026**, verified
against the running build rather than from memory.

Companion documents: [API.md](API.md) for endpoint and schema contracts,
[DATA-SOURCES.md](DATA-SOURCES.md) for every dataset and its vintage,
[RUNBOOK.md](RUNBOOK.md) for operating it, [MVP-SCOPE.md](MVP-SCOPE.md) for
what production would take.

---

## 1. The shape of it

A single Next.js 15.5 application, App Router, TypeScript, Tailwind v4, React
19. Five runtime dependencies: `next`, `react`, `react-dom`, `recharts`, and
`@anthropic-ai/sdk`. That is deliberate and worth preserving: most of the
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

### Pages: `app/(ai-ent)/`

A single route group: 29 fixed page routes plus `/vendor-view/[id]`. The
sidebar shows 13 resting items in three groups (`lib/ui/shell.tsx` →
`NAV_GROUPS`); paired pages share a row and expand when that part of the site
is open, which is how 13 rows reach 19 destinations.

| Group | Routes |
|---|---|
| Start here | `/start`, `/pulse` |
| Market Intelligence | `/news-feed`, `/market-watch` (+`/ai-adoption`), `/competitive-intel`, `/financial-snapshot`, `/vendor-view` (+`/reputation-tracker`), `/peer-insights` |
| AI and Your Company | `/company-view` (+ 5 sub-routes), `/market-view` (+`/workflow-shortlist`, `/price-performance`), `/decision-desk`, `/trust-rank` (+`/security-desk`), `/alliances` (+`/ecosystem-navigator`) |
| Not in the nav | `/admin` (operator view), `/vendor-view/[id]` (SSG, 43 vendors), `/shortlist`, `/assess-decide`, `/model-for-role` and `/interrogate` (redirects) |

`/admin` is deliberately unlinked rather than protected: it reads the
catalogue and the run history and shows the priced cost of each ingestion. It
holds nothing a reader of the public site could not derive, so hiding it from
the nav is a tidiness decision, not a security control. If that stops being
true it needs a real gate.

Rendering modes matter for cost and freshness:

- **`○` static**: most pages. No per-request work.
- **`●` SSG**: `/vendor-view/[id]`, 43 pages from `generateStaticParams`,
  which reads `TRACKED_VENDORS` and so excludes the 4 AI investors.
- **`ƒ` dynamic**: anything reading cookies (`/pulse`, `/shortlist`) or
  fetching per request.
- **ISR**: pages whose Analyst Insight must re-pick a daily news item declare
  `export const revalidate = 86400`. Without it the insight is a pure function
  of a build-time constant and can never change, which is exactly the bug that
  froze nine tabs on the deploy-day headline.

### API: `app/api/`

| Route | Purpose | Auth |
|---|---|---|
| `br/[...path]` | BoardRadar proxy | Injects `X-API-Key` server-side |
| `aie/[...path]` | Ranking Engine proxy | None needed upstream |
| `catalogue/[series]` | Movement catalogue: `model`, `vendor`, `market` only | Publishable key + RLS |
| `admin/overview` | Catalogue totals, run history, usage aggregate | Publishable key + RLS |
| `adoption/disclosure`, `adoption/status` | SEC-derived adoption | None |
| `research` | Company research | None |
| `analyst`, `analyst/upload` | Document analyst | `ANTHROPIC_API_KEY` |
| `interrogate` | Question answering | `ANTHROPIC_API_KEY` |
| `favicon`, `logo/[domain]` | Icon proxy | None |

**`catalogue/[series]` takes three series, not four.** `usage` was a member
until 5 August 2026 and answered 200 with an empty movement set and the note
"First observations recorded", which reads as a pipeline that has started and
will fill. Nothing could ever land there: usage is written as events to
`aie.usage_event` and aggregated by the `usage_summary` function, and never
passes through `aie.observation`. It is now absent from the `Series` type, so
re-adding it is a compile error, and asking for it returns 400 naming
`admin/overview`. The lesson generalises: a query that is valid over an empty
table is the worst kind of wrong, because it answers successfully.

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
2. A non-JSON 200 is a routing failure, not data: the upstream serves an HTML
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
| `catalogue_observation` | view | The movement catalogue: one row per observed metric, with `observed_at`, `source_id`, `provenance`, `vintage` |
| `catalogue_source` | view | Source register, ordered by evidence class |
| `catalogue_run` | view | Ingestion run history |
| `record_usage` | RPC | Usage counter: write-only from outside |
| `usage_summary` | RPC | Aggregated usage, the only way to read it |

The three `catalogue_*` views are `security_invoker` views over an `aie`
schema that is not itself exposed. Both functions are `security definer`.
Usage events carry no IP, session, user agent or free text: there is nothing
in that table to leak, by design rather than by policy.

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

1. **Generated artefact**: `lib/aie/vendor-directory.ts` is emitted by
   `scripts/generate-vendor-directory.mjs` from a 90 KB fixture, carrying only
   what a browser needs. Regenerated by the sync so it cannot drift.
2. **Server-computed payload**: `lib/model-fit/workforce-payload.ts` flattens
   a 697 KB role file to five figures per industry, because the chart smooths
   from those alone.
3. **`import type` only**: types cross the boundary freely; values do not.

---

## 6. Environment variables

| Variable | Required | Purpose |
|---|---|---|
| `ANALYSTGENIUS_API_BASE` | Yes | BoardRadar upstream base URL |
| `ANALYSTGENIUS_API_KEY` | Yes | `X-API-Key`, injected server-side only |
| `NEXT_PUBLIC_SUPABASE_URL` | Defaulted | Catalogue host |
| `NEXT_PUBLIC_SUPABASE_ANON_KEY` | Defaulted | Publishable key: **not a secret** |
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

`npm test` runs Vitest. 322 tests across 21 files, all passing as of 5 August
2026. `tests/**/*.test.ts` only: **Vitest cannot parse JSX here**, so pure
logic must live in `.ts` for it to be testable. That constraint is why the
chart maths sits in `lib/` and the components only draw. It also means a test
cannot render a page: an attempt to assert rendered copy by importing a page
component fails at transform. Assert against built HTML instead, or against
the values the copy reads.

The tests worth understanding before changing anything:

| File | Guards |
|---|---|
| `workforce-curve.test.ts` | 14.8% at tier 70+, 0.7% at tier 90, and that bandwidth 9 yields one mode where 5 yields several |
| `price-performance.test.ts` | Axis denominators (330/56/44/262) and that the recomputed intelligence frontier reproduces the catalogue's own 10 |
| `disclosure-ladder.test.ts` | Every STATED phrase appears verbatim in the filing text held in the fixture |
| `composite.test.ts`, `composite-data.test.ts` | That no composite is ever returned without its input count, and that durability cannot return "No" |
| `live-vendor-parity.test.ts`, `model-fit-parity.test.ts` | Parity against the upstream and the Python reference: all 294 roles under four control settings |
| `scorecard-ledger.test.ts` | The committed internal report matches what the code produces |
| `library-counts.test.ts` | That no file states a library size as a literal |

Several assert **specific published figures**. That is intentional: if a
fixture sync moves a number the product quotes in prose, the build fails rather
than the page quietly changing what it claims.

`library-counts.test.ts` guards the inverse failure and is worth understanding
before adding copy. Two pages stated "258 roles across 29 industries" for a
fortnight after the library reached 294 across 36. Nothing broke and no test
failed, because the counts were literals typed into prose and growing the data
never touched them. The fix was to derive them at the point of render; the test
fails if anyone writes one down again, which is the only way the drift returns.

### The other three gates

```bash
npx tsc --noEmit     # types: strict, and the first thing to run
npm run lint         # ESLint, Next preset: 0 errors expected
npm run build        # 84 pages
```

**Do not build while `npm run dev` is running in the same folder.** They share
`.next`. If you must verify a build while a dev server is up, do it in a git
worktree with `node_modules` symlinked: that is how the 5 August audit
verified file tracing without disturbing a running session.

The lint gate is new as of 5 August 2026 and had never run before then:
`npm run lint` called `next lint` with no ESLint installed, so it prompted for
an interactive install and hung. Types and tests had been doing all the work it
was credited with. Two rule decisions in `eslint.config.mjs` are deliberate and
should not be "fixed" without reading the comments there: the ignore globs are
`**/`-anchored because a stale worktree under `.claude` carries its own built
`.next` and drowned the real findings 200:1, and `no-unescaped-entities` is
scoped to `>` and `}` because the apostrophes it otherwise flags are British
English prose, not defects.

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

### Build configuration worth knowing

`next.config.ts` carries two settings that both exist to stop a **silent**
failure, which is why neither is obvious from the code they protect.

`outputFileTracingIncludes` lists three fixture directories explicitly. Next
traces the files a route needs by reading the code, and every fixture read in
this app builds its path from a variable (`disclosure-${form}`,
`${apiPath}.json`) that static analysis cannot resolve. Without the includes
none of them ship. The failure is invisible by design: each read is wrapped in
a catch returning null, so a missing file degrades to a clean "no data" state
that looks like a data gap rather than a deploy bug.

`outputFileTracingRoot` pins the root to this project. Next infers it by
walking up for a lockfile, and a stray `package-lock.json` in the home
directory made it choose `/Users/michaelcook`: every traced path resolved
against the wrong base, with a warning on every build. The fixtures still
shipped, but by luck rather than design.

`sync-aie-fixtures` refuses to overwrite a newer capture with an older one:
the pricing endpoint answers on request but serves a 2 June 2026 capture
whatever day you ask, and regenerates the two derived artefacts afterwards,
because forgetting to do that is how the July port drifted into showing 88 for
a vendor the source scored 68.3.

---

## 10. The analyst model, and the guards on it

Added 4-5 August 2026. Opus 5 writes the analyst voice on every insight
surface, on Today's Pulse, Since you last looked and Do these three things.

The division of labour is the design and is not negotiable:

| owns | what |
|---|---|
| **Code** | every number. The deterministic builders still compute the facts |
| **The model** | the prose only: wording, emphasis, what a figure means for a buyer |
| **Two validators** | the trust |

`lib/analyst/llm.ts` holds both guards, and they are why model-written prose is
allowed in a product whose promise is that nothing is invented.

- **`invented()`** returns any figure in the output that is not in the input.
  Deliberately strict: a *rounded* version of a real figure fails, because on a
  page promising exact sourced numbers a quiet rounding is where the problem
  starts.
- **`foreignEntities()`** catches what the numeric guard cannot. "OpenAI leads
  here" on a page whose data never mentions OpenAI is a fabricated claim
  assembled entirely from real words, and every figure in it can be
  legitimate. Checked against the vendor roster on word boundaries, so "Meta"
  does not fire inside "metadata".

A rejection is a correction, not an ending: the model is told which figure it
invented and asked again, twice, before the surface falls back to computed
text. Unparseable output retries the same way. Every surface says whether it
was `analyst written` or `computed`.

Two things are kept away from the model on purpose: the recommended action
(letting it choose between Accelerate and Pause moves the one element that
reads as a decision) and the tools each recommendation points at.

---

## 11. Company research

`lib/research/`. Your AI Position takes a company name and researches it
rather than rendering a fixture.

- **`search.ts`**: provider-agnostic web search, Tavily or Brave, whichever
  key is present. Returns passages with their URLs and nothing else: it does
  not summarise or rank.
- **`company.ts`**: two searches per company (the business, then its AI),
  then the analyst model reads the passages under the same guards. Two
  attempts at decreasing scope: a failure narrows the ask rather than ending
  it, because a reading of four sources beats an apology about eight.

The distinction that makes it shippable is **retrieval, not recall**. The model
is never asked what it knows about a company; it is handed passages fetched
seconds earlier and every figure is checked back against them. Findings citing
a passage we did not retrieve are dropped.

Progress streams down the request doing the work (`app/api/research/route.ts`),
so the wheel reports stages as they begin rather than animating. The finished
answer is held in the browser for the session.

**Known limit, in the code as well as here.** Leaving mid-run restarts it,
because the work lives in the request. An earlier version held jobs in a
module-level Map and polled them; on Vercel that fails totally, since every
poll lands on whichever instance is free and the job is never found. Surviving
a mid-run departure means putting jobs in Postgres, which the catalogue
already uses.

---

## 12. Latency, measured

Production, 5 August 2026, cold then warm:

| page | cold | warm |
|---|---|---|
| `/start`, `/price-performance` | 0.5-0.6s | 0.2s |
| `/news-feed` | 7.4s | 0.35s |
| `/pulse` | 15.8s | 0.54s |
| `/vendor-view` | 17.1s | 0.33s |
| `/competitive-intel` | 25.5s | 0.34s |
| `/market-watch` | 26.4s | 33.1s |
| `/trust-rank` | 37.8s | 14.3s |

The slow pages are exactly the ones carrying an Analyst Insight; the two fast
ones have none. The cause is that the Opus call sits in the render path and
its cache is per-instance, so most visits pay the full round trip.

The fix, not yet made: move the insight out of the render path and stream it,
as company research already does, or share the cache across instances via
Postgres or Edge Config. Until then the sidebar marks the clicked tab and
spins its icon, which makes the wait legible without making it shorter.
