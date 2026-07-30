# DEMO_SCRIPT.md

The buyer journey for a Global 2000 executive, eight steps, roughly twelve
minutes. Sign in first (see README). Every screen states its data lane;
when asked "is that number real", the badge answers.

## 1. The Pulse: the market read (2 min)

Open **The Pulse**. Read the Analyst Insight banner aloud: buyers hold more
leverage than the headlines suggest. Point at the four market KPI gauges
(deal momentum, adoption, regulatory pressure, talent flow) and open "How
this is derived" beneath them. Switch the Spotlight to OpenAI, then
Anthropic: the narrative bars versus the reality bars show where the story
runs ahead of the evidence. On the right, the **Delivery channel watch**
card is LIVE from BoardRadar: the integrators who would deliver the
programme, ranked by AI readiness. Scroll the comparison table and the
three insight columns, then the abridged news strips at the bottom.

Say: "Everything amber is a sample and says so. Everything green came from
the API seconds ago."

## 2. Company View: Shell, the exemplar buyer (1 min)

Open **Company View: Shell**. The header says it plainly: Shell is not in
the coverage universe, so every figure is SAMPLE shaped exactly like the
live schemas; wiring a real buyer is a data swap, not a rebuild. Skim the
four company KPIs and the question chips.

## 3. AI Exposure (1.5 min)

Open the **AI Exposure** tab. The function table answers the buyer's first
real question: where does AI help us, where does it threaten us. Trading
and maintenance carry the opportunity; back office carries the disruption.
Open Key Findings and Recommendations.

## 4. Trust Rank: the regulatory grid (2 min)

Open **Trust Rank**. The governance gauge and posture summary first, then
the regulatory grid: ten jurisdictions, regime, status chip, and what it
means for this organisation. Point out the source column: rows seeded from
the AIE legislation material carry the AIE dataset badge; the rest are
SAMPLE. Below, the vendor-specific rulings (EU general-purpose obligations,
US chip export controls).

## 5. Assess and Decide: the derivation drawer (2 min)

Open **Assess and Decide**. Four weighted dimensions, each with rationale
and subcriteria. Click **How this is derived**: method, formula, and the
worked calculation summing to the headline score. This is the anti-black-box
moment: no score in this product exists without this drawer.

## 6. AI Analyst: one grounded question (1.5 min)

Open **AI Analyst**. Note the grounding order on the right (uploads first)
and the three preloaded documents. Upload any TXT or MD assessment if you
like, then ask: "What does the EU AI Act require of our high-risk use
cases?" The answer quotes the grounded sources with citations, and the
footer shows the tier routing (Haiku retrieves, Sonnet synthesises, Opus
only behind the deep-analysis button) with an indicative token count. In
scripted sample mode it says so; it never invents.

## 7. Vendor Rankings into a profile (1.5 min)

Open **Vendor View**. The rankings are an evidence table: named scores,
AIE dataset badges, no medals. Sort a column, filter to the frontier
layer, then click **Anthropic** (or any vendor) to open the profile:
scores with derivation, capabilities, dependencies with source
attributions, models, and the source directory.

## 8. Ecosystem Navigator: who delivers it (1 min)

Open **AI Ecosystem Navigator**. Walk the dependency layers (who depends
on whom), then land on the LIVE integrator matrix at the bottom: the
services channel, clearly labelled, straight from BoardRadar. Close with:
"and here is who delivers it."

## If the network dies mid-demo

Nothing changes visibly except badges: live cards fall back to recorded
responses marked "Cached sample". To rehearse that state, set
`MOCK_MODE=true` in `.env.local` and restart the dev server.
