# AI Enterprise

A working demo of AI Enterprise: proven analyst module structure applied to
the enterprise AI supply side, for buyers deciding which AI models,
platforms and delivery partners to choose. It carries its own green identity
rather than the AnalystGenius indigo, so it reads as a distinct product. It
runs entirely on your machine; nothing is deployed anywhere.

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

The app opens on The Pulse. The left sidebar mirrors the three groups:
Market Intelligence, AI and Your Company, Vendor Assessment.

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

It sits on the Model for Role tab (route /market-view). 258 roles
across 29 industries against 330 priced models.

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
`~/Downloads/pkg`) and then `npm test`, which replays all 258 roles under
four control settings and fails on any disagreement.

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
