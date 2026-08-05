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
npm test             # 322 tests across 21 files
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
npx vercel --prod --yes
```

There is **no git remote**: deploys go through the Vercel CLI directly from
this folder. `git push` will fail, and that is expected, not a broken setup.

**The deploy fails intermittently on upload.** On 5 August 2026 the first
attempt built 42 of 84 pages and then died with `fetch failed`; the retry went
through unchanged. If you see that, retry once before investigating. A failed
attempt never reaches production, but it does leave a failed deployment in the
Vercel dashboard, so do not read one there as evidence that production is
broken.

### Checking a deploy actually landed

Do not trust the CLI's "ready" alone: check what the site says:

```bash
curl -s https://newaient30072026.vercel.app/start | grep -o '[0-9]* roles across [0-9]* industries'
curl -s -o /dev/null -w '%{http_code}\n' https://newaient30072026.vercel.app/market-view
curl -s https://newaient30072026.vercel.app/api/catalogue/vendor | head -c 200
```

The three catalogue series must all report `truncated: false`. If one reports
`true`, the paging in `lib/catalogue/client.ts` has regressed, see §5.

### The site is public on purpose

`DEMO_USER` and `DEMO_PASS` are deliberately **not** set in Vercel. The gate in
`middleware.ts` opens when either is missing, so the deployed site is open by
link. This is a decision so the demo can be shared. Do not "fix" it. Locally
both are set in `.env.local`, so local development does prompt.

---

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
