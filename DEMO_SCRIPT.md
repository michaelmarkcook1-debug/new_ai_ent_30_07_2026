# DEMO_SCRIPT.md

The buyer journey for a Global 2000 executive, nine steps, roughly fifteen
minutes. Sign in first (see README). Every screen states its data lane;
when asked "is that number real", the badge answers. Since 30 July the
demo also pulls current content from the deployed AI Enterprise app's
public APIs, badged "AIE live".

## 1. The Pulse: the market read (2 min)

Open **The Pulse**. The Interrogate hero sits at the top: the product now
leads with "tell me your situation". Read the Analyst Insight banner, the
four market KPI gauges (open "How this is derived"), and switch the
Spotlight between vendors: narrative bars versus reality bars. The
**Delivery channel watch** card is LIVE from BoardRadar; the news strips at
the bottom are AIE live, current to today, with the selected vendor's own
feed beside the market feed.

## 2. Interrogate: the hero piece (2.5 min)

Type a situation into the hero (or click an example on /interrogate):
"We are a European bank exploring agentic AI for onboarding, worried about
the EU AI Act." Interrogate asks a sharp question shaped by what you have
not yet said; answer it, and it writes a tailored finding in which every
claim carries a citation, with the tier routing shown underneath (Haiku
shapes questions, Sonnet writes the finding). Close on the three
follow-on buttons: rankings, Trust Rank, Assess and Decide.

## 3. Company View: Shell, the exemplar buyer (1 min)

Open **Company View: Shell**. The header says it plainly: Shell is not in
the coverage universe, so every figure is SAMPLE shaped exactly like the
live schemas. Skim the four company KPIs.

## 4. AI Exposure (1.5 min)

The function table answers the buyer's first real question: where does AI
help us, where does it threaten us. Open Key Findings and Recommendations.

## 5. Trust Rank: the regulatory grid (2 min)

Governance gauge and posture summary, then the regulatory grid: ten
jurisdictions, status chips, what each regime means here, per-row source
badges. Below, the vendor-specific rulings.

## 6. Assess and Decide: now its own tab (2.5 min)

Open **Assess and Decide** from the sidebar. Pick a depth tier
(Opportunity, Strategy, Procurement): the weight preset changes and the
headline recomputes. Drag a weight slider: the total moves, the dimension
scores never do ("same verified basis, your priorities"). Open **How this
is derived** for the worked calculation under your current weights. The
six-pillar strip below is the deployed AIE engine's own methodology,
pulled live with its default weights.

## 7. AI Analyst: one grounded question (1.5 min)

Inside Company View, open **AI Analyst**. Upload any TXT or MD assessment
if you like, then ask: "What does the EU AI Act require of our high-risk
use cases?" The answer quotes the grounded sources with citations; the
footer shows tier routing and an indicative token count.

## 8. Vendor Rankings into a profile (1.5 min)

Open **Vendor View**. Named scores, AIE dataset badges, evidence grades,
no medals. Sort a column, filter to the frontier layer, then open
**Anthropic** for the full profile: scores with derivation, capabilities,
dependencies with sources, models, source directory.

## 9. Ecosystem Navigator: who delivers it (1 min)

Walk the dependency layers, then land on the LIVE integrator matrix at the
bottom: the services channel, clearly labelled, straight from BoardRadar.
Close with: "and here is who delivers it."

## If the network dies mid-demo

Nothing changes visibly except badges: live cards (BoardRadar and AIE
live alike) fall back to recorded responses marked "Cached sample". To
rehearse that state, set `MOCK_MODE=true` in `.env.local` and restart the
dev server.
