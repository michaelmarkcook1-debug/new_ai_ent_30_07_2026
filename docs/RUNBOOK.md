# AI Enterprise: runbook

How to run, refresh, ship and check this thing. Written for whoever is holding
it at 6pm on a Friday, so it leads with the commands and puts the reasoning
underneath.

Current as of **5 August 2026**. Companion documents:
[API.md](API.md) for endpoint and schema contracts,
[ARCHITECTURE.md](ARCHITECTURE.md) for how it is built,
[DATA-SOURCES.md](DATA-SOURCES.md) for what is behind each page,
[MVP-SCOPE.md](MVP-SCOPE.md) for what production would still take.

---

## 1. Before you ship anything

Four gates. All four, in this order, every time.

```bash
npx tsc --noEmit     # types: strict; fastest signal, run it first
npm test             # 593 tests across 41 files
npm run lint         # ESLint: expect 0 errors, ~39 warnings
npm run build        # 84 pages
```

**Never run `npm run build` while `npm run dev` is running in the same
folder.** They share `.next` and will corrupt each other's output. If you need
to verify a build while a dev server is up, including someone else's, use a
throwaway worktree:

```bash
git worktree add --detach /tmp/buildcheck HEAD
ln -s "$PWD/node_modules" /tmp/buildcheck/node_modules
cd /tmp/buildcheck && npx next build
git worktree remove --force /tmp/buildcheck
```

The lint gate reports warnings and returns 0. That is deliberate: the 39
standing warnings are unused exports and one `<img>`, none of which should
block a deploy, and a gate that blocks on noise gets disabled within a week.
Errors are a different matter and there should never be any.

---

## 2. Deploying

```bash
npm run deploy
```

Two steps, and it stops at the first that fails:

1. **Preflight.** `scripts/preflight-production.mjs` pulls the production
   environment to a private temporary file, sends one one-token request to the
   model the code pins, and reports four stages: key present, authentication,
   model access, credit. It prints stages, never a value. `DEPLOYMENT BLOCKED`
   names the stage; fix it in Vercel or at Anthropic and run again.
2. **Deploy.** `vercel --prod --yes`.

**Deploy warms nothing, and nothing warms on a schedule.** Analyst readings are
prepared only when a reader opens a page or a person runs the warm by hand:

```bash
npm run warm
```

prints the ten pages, the concurrency and the cost and fetches nothing;

```bash
npm run warm -- --yes
```

renders them four at a time and reports each as authored, cached, fallback,
failed or timed out, ending COMPLETE or PARTIAL. Run it after a release that
changes the model or `INTELLIGENCE_VERSION`, when every page is cold; run
against a current site it costs nothing. The cron that did this twice a day was
removed on 6 September 2026 at the owner's instruction.

**A push to `main` deploys production on its own.** The Vercel Git integration
builds every push, and that path skips the preflight. The build no longer calls
the model (8.35), so a broken key shows up as computed badges at runtime rather
than as build cost. Run `npm run preflight` before pushing a release.

**What the cache actually does.** The authored reading is cached in Vercel's
Data Cache under a key that carries the evidence, the model, the reasoning
setting and the intelligence version (8.34). A deploy that changes none of
those keeps serving the existing readings. A deploy that changes the model or
bumps `INTELLIGENCE_VERSION` makes every old reading unreachable at once; they
are not deleted and expire within a day, and the pages are cold until warmed
by a person or a reader.

## 3. Refreshing the data

```bash
npm run ingest:adoption     # SEC EDGAR → data/adoption/*.json (commit the result)
npm run ingest:catalogue    # all series → Supabase Postgres
node scripts/sync-aie-fixtures.mjs   # re-pull AIE fixtures, report what moved
```

`ingest:adoption` writes a file into the repo, so its output must be committed
to take effect. `ingest:catalogue` writes to Postgres and takes effect
immediately; it needs `SUPABASE_SERVICE_ROLE_KEY`, which is the only place that
key is used and must never reach the app runtime.

`sync-aie-fixtures` refuses to overwrite a newer capture with an older one and
regenerates the two derived artefacts afterwards. Forgetting that regeneration
is how the July port drifted into showing 88 for a vendor the source scored
68.3, so let the script do it rather than pulling files by hand.

### What a run costs

List prices, from `lib/admin/cost-model.ts`, measured rather than estimated:

| Run | Cost |
|---|---|
| SEC disclosure snapshot (8 vendors, one window) | $0.000019 |
| SEC disclosure, two 12-month windows | $0.000051 |
| Model catalogue snapshot (330 models) | $0.000022 |
| AIE category share refresh (72 estimates) | $0.000007 |
| Private-company reported figures | $0.000006 |
| News feed cache refill | $0.000026 |

Every series, refreshed every day, for a month: **$0.0039**. Cost is not a
reason to refresh less often. Rate limits and source courtesy are: the SEC
fair-access header (`SEC_USER_AGENT`) is a real obligation, and the adoption
ingest holds all eight vendors to a single shared 20-second budget so a stalled
upstream cannot turn one run into 98 seconds of hanging.

`/admin` shows all of this live: what the catalogue holds, the last runs with
their failures, and the priced cost of each. It is not in the sidebar: type
the URL.

---

### Data operations, by hand

`/admin/data` (linked from `/admin`) discovers what the AI Enterprise source
holds now against the canonical payloads, lets you decide what each unknown
name is, validates, and ingests only what you approve. Discovery, review and
validation work on production; ingestion works only on your own checkout:

```bash
DATAOPS_WRITE=1 npm run dev        # then open http://localhost:3000/admin/data
```

Add `DATAOPS_ROOT=/path/to/a/copy` to rehearse against a copy of
`fixtures/aie-live` first. After a real ingestion the fixtures, the derived
artefacts and `reports/dataops/<time>.json` have changed: review the diff,
commit, and push, which deploys. `category-rankings.json` is refreshed by
`npm run sync:aie`, not here; run it afterwards when the rankings' population
warning appears. Analyst readings are not rewritten by ingestion; the next
reader, or `npm run warm -- --yes`, authors them.

## 4. When something looks wrong

| Symptom | Likely cause | What to do |
|---|---|---|
| A page shows "no data" where data should be | A fixture did not ship | Check `outputFileTracingIncludes` in `next.config.ts` and the route's `.nft.json` in `.next/server` |
| Every request 500s with `MIDDLEWARE_INVOCATION_FAILED` | Something was imported into `middleware.ts` | Revert it. See ARCHITECTURE §7: that file imports nothing, deliberately |
| A vendor page 200s for a company that does not exist | BoardRadar returns `success: true` for unknown tickers | Never treat a 200 as proof a company is real |
| A LIVE badge over stale-looking numbers | `uptake` is a May 2026 seed; live means freshly fetched, not freshly measured | Correct as-is. Peer Insights says so on-page |
| Catalogue series reports `truncated: true` | PostgREST's 1,000-row ceiling | See §5 |
| `npm run lint` reports thousands of problems | Ignore globs missing a `**/` | Check `eslint.config.mjs`; a stale worktree under `.claude` carries its own `.next` |

### Reading the provenance header

Every proxied response carries `x-eai-source`: `live`, `mock` or `error`. The
UI badge is driven by that header and nothing else. If a badge looks wrong,
check the header before checking the component: the component is almost never
where the bug is.

---

## 5. Two traps that have already cost us

**PostgREST caps responses at 1,000 rows regardless of the `limit` you ask
for.** The catalogue client pages with `offset` and requests `count=exact`,
comparing what came back against the server's own total. This was fixed twice:
the first fix raised the limit from 500 to 5,000 and looked correct in review,
because the bug is invisible in the code: it lives in the server's behaviour.
Only querying live exposed it. If you change `lib/catalogue/client.ts`, verify
against the running database, not by reading the diff.

**A query that is valid over an empty table answers successfully.** The `usage`
series returned 200 with an empty movement set and a note saying "First
observations recorded", which reads like a pipeline that has started and will
fill. Nothing could ever land there: usage lives in `aie.usage_event`, never
in `aie.observation`. It is now out of the `Series` type so re-adding it is a
compile error. When adding a series, confirm rows actually arrive before
trusting a 200.

---

## 6. Environment

| Variable | Needed for | Notes |
|---|---|---|
| `ANALYSTGENIUS_API_BASE`, `ANALYSTGENIUS_API_KEY` | BoardRadar | Injected server-side only |
| `NEXT_PUBLIC_SUPABASE_URL`, `NEXT_PUBLIC_SUPABASE_ANON_KEY` | Catalogue reads | Publishable, ships to browsers by design; RLS is the protection |
| `SUPABASE_SERVICE_ROLE_KEY` | `ingest:catalogue` only | Never in the app runtime |
| `ANTHROPIC_API_KEY` | Analyst, Interrogate | Unset ⇒ scripted mode, £0 LLM spend |
| `SEC_USER_AGENT` | SEC courtesy | Has a working default |
| `MOCK_MODE` | Demos without network | `true` serves fixtures everywhere |
| `DEMO_USER`, `DEMO_PASS` | Local basic auth | Unset ⇒ open. Unset in Vercel on purpose |

`.env.local` is gitignored and never leaves the machine. If you need to
recreate it, copy `.env.example` and fill it in.
