# AI Enterprise

A working demo of AI Enterprise: proven analyst module structure applied to
the enterprise AI supply side, for buyers deciding which AI models,
platforms and delivery partners to choose. It carries its own green identity
rather than the AnalystGenius indigo, so it reads as a distinct product. It
runs locally, and is also deployed at https://newaient30072026.vercel.app.

## Taking this over

Three documents, written for a team picking this up rather than for the demo:

- **[docs/ARCHITECTURE.md](docs/ARCHITECTURE.md)** — routes, data flow, the
  BoardRadar dependency, Supabase, env vars, and the constraints that look
  arbitrary until you break one.
- **[docs/DATA-SOURCES.md](docs/DATA-SOURCES.md)** — every dataset behind every
  page, its vintage, its refresh cadence, and which lane it is badged as.
  Section 0.1 is the per-page table, including which pages still show SAMPLE.
- **[docs/MVP-SCOPE.md](docs/MVP-SCOPE.md)** — what is genuinely done, the four
  pages that are not demonstrable as live, and the backlog to production.
- **[docs/RUNBOOK.md](docs/RUNBOOK.md)** — how to run, refresh, ship and check
  it: the four gates, the deploy that needs a retry, what an ingestion costs,
  and the two traps that have already cost us a day each.

Short version: four pages paint SAMPLE badges and the rest paint none. The
footer's "Demo build" is accurate for `/company-view` (13 badges),
`/trust-rank` (9), `/decision-desk` (5) and one panel of
`/reputation-tracker` (1), and misleading for everything else. The per-page
count is section 0.1 of DATA-SOURCES.md, taken from rendered HTML rather
than from props.

## What you need first

- Node.js version 20 or newer (check with `node --version`).
- The `.env.local` file in this folder (already present on this machine).
  If you ever need to recreate it, copy `.env.example` to `.env.local` and
  fill in the values; that file never leaves your machine and git ignores
  it.

## Starting the demo

Open a terminal in this folder and run:

```
npm install
npm run dev
```

Then open http://localhost:3000 in your browser. A sign-in box appears:
enter the demo username and password from `.env.local` (`DEMO_USER` and
`DEMO_PASS`; the defaults are `eai` and `change-me`).

The **deployed site is deliberately open** — neither variable is set in
Vercel, and the gate in `middleware.ts` opens when either is missing. That
is a decision, not an oversight: the demo is meant to be shareable by link.
Setting either variable in Vercel would close it.

The app opens on The Pulse. The left sidebar carries three groups: **Start
here** (Explore, Your Pulse), **Market Intelligence** (News, Market Watch,
Competitive Intel, Financial Snapshot, Vendor View, Peer Insights) and **AI
and Your Company** (Your AI Position, ModelEngine, Decision Desk, Trust
Rank, Integrators). Paired pages share a row and expand when that part of
the site is open.

`/admin` is not in the sidebar and is reached by typing the URL. It is the
operator's view — catalogue contents, ingestion-run history and the priced
cost of each run — not part of the buyer journey.

## Reading the badges (this matters)

Every figure on screen declares where it came from:

- **LIVE** (green): fetched from the BoardRadar API just now.
- **AIE dataset** (purple): real AI Enterprise dataset content re-used from
  the ranking-engine repository, with its own confidence labels.
- **SAMPLE** (amber): an illustrative value for demo purposes, never a real
  measurement.
- **Cached sample** (amber): a recorded real response served because the
  live call failed or mock mode is on.

Nothing on screen is an invented figure presented as real. Where data does
not exist, the screen says so ("Awaiting public disclosure").

## Mock mode (for demos without network)

Set `MOCK_MODE=true` in `.env.local` and restart `npm run dev`. Every live
surface then serves recorded responses with "Cached sample" badges, so the
demo cannot die on stage. Set it back to `false` for live data.

## The AI Analyst

The analyst tab inside Company View answers only from grounded sources
(your uploads, three preloaded sample documents, the Shell fixture and the
AIE dataset). Without an Anthropic API key it runs in scripted sample
mode: extractive quotes with citations, clearly badged. To go live, put a
key in `.env.local` under `ANTHROPIC_API_KEY=` and restart. The key is
read only from that file, so a key elsewhere on the machine is never spent.

## Workforce Model Fit (Model for Role)

Pick an industry, a function and a role, and the engine returns the
cheapest model that meets that role's requirements, with the reasoning
and the cost on screen: which requirements decided it, which models were
eliminated and by what number, what it costs per person and for the whole
role, and what the same people would cost on the top model instead.

It sits on the ModelEngine tab (route /market-view). 294 roles across 36
industries against 330 priced models. Those figures are derived from the
data at render time (`LIBRARY_ROLE_COUNT`, `LIBRARY_INDUSTRY_COUNT`), not
typed into the copy — this sentence said "258 across 29" for a fortnight
after the library grew, because it was a literal and growing the data never
touched it.

What it does **not** claim matters as much as what it does. Model prices
and benchmark scores are real and attributed. Role requirement profiles
are authored judgement. Capability thresholds, token burn multipliers and
headcount defaults are stated assumptions, and every one of them is a
control you can move: the recommendation changes as you move them, which
is the honest way to show how much of the answer rests on numbers nobody
has measured yet. Requirements with no ingested benchmark are reported as
unassessed, never quietly passed.

The engine is a port of the integration package's reference
implementation and is checked against it: run
`python3 scripts/model-fit-baseline.py` (it reads the reference from
`~/Downloads/pkg`) and then `npm test`, which replays all 294 roles under
four control settings and fails on any disagreement.

## Peer Insights

What firms in your industry are buying, and what they are buying it for.
Pick a segment and you get two things: the vendors that show up in that
slice of the uptake model, and the workflows your sector runs AI on.

The second half is a reverse lookup nothing else in the product offers. The
workflow library has always been read workflow-to-vendors on Workflow
Shortlist; here it is read industry-to-workflow, split into what is specific
to your sector and what every sector runs.

Read the slice for its **shape**, not its ranking. The uptake data is a
modelled estimate dated May 2026, and two later measurements (Menlo
Ventures, Ramp) put the top two vendors the other way round. Both are named
and linked at the top of the page rather than buried under the chart,
because a caveat a reader meets after the figures has already failed.

## Checking your work

Four gates, all of which must pass before a deploy:

```
npx tsc --noEmit     # types
npm test             # 322 tests across 21 files
npm run lint         # ESLint, Next preset — 0 errors
npm run build        # 84 pages
```

Do not run `npm run build` while `npm run dev` is running in the same
folder — they share `.next` and will fight.

`npm run lint` was wired to a linter that had never been installed until 5
August 2026, so it prompted for an interactive install and hung. If you see
a large warning count, check the ignore globs in `eslint.config.mjs` before
believing it: the first honest run reported 8,065 problems, almost all from
a stale agent worktree that carried its own built `.next`.

## The demo walkthrough

Follow `DEMO_SCRIPT.md` for the eight-step buyer journey, from the Pulse
market read to "and here is who delivers it".

## Documents in this folder

- `DEMO_SCRIPT.md`: the click path for a demo.
- `DATA_COVERAGE.md`: exactly which BoardRadar endpoints are live, from a
  real probe.
- `AIE_REUSE_MAP.md`: every file re-used from the ranking-engine repository
  and where it came from.
- `ASSUMPTIONS.md`: every assumption made during the build.
- `docs/REVENUE_METHODOLOGY.md`: how undisclosed vendor revenue is
  estimated, and the band it is honest to quote.
- `docs/MODULE_GUIDE.md`: what each module does, one paragraph each.
