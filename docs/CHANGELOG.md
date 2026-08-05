# AI Enterprise: capability changelog

What the app could do, and when that changed. Built from the commit history,
not from recollection: every entry below maps to commits on `main`.

This is deliberately **not** a commit log. 170 commits produced roughly 40
capability changes; the rest were fixes, copy, tests and refactors. The rule
for what earns a line here is in [CLAUDE.md](../CLAUDE.md), along with the rule
for what earns a Drive export.

Dates are the dates work landed, in 2026.

---

## 5 August: the research layer, and the guards around it

The largest single day, 48 commits.

- **Your AI Position stopped being a worked example.** The Shell fixture, the
  biggest block of sample data in the product, was replaced by live research:
  name any company, its public sources are retrieved at that moment, read, and
  every statement carries the link it came from. Where sources say nothing,
  the page says nothing.
- **Research streams.** The first build held jobs in memory and polled them,
  which fails totally on Vercel because every poll lands on a different
  instance. Rebuilt on server-sent events, with a progress wheel reporting real
  stages, and the answer held for the session so leaving the tab is safe.
- **The analyst guards were extended from figures to names.** A fabricated
  number was already caught. A fabricated *vendor* assembled from real words
  was not, so entity checking was added against the known roster.
- **A truncated answer now retries** instead of failing silently.
- **Decision Desk moved above ModelEngine,** matching the actual pipeline: the
  Desk assesses vendors for an enterprise, ModelEngine selects models from a
  vendor for a role. ModelEngine gained a toggle overlaying the shortlist the
  Desk produced, and prices the policy delta.
- **The Accuracy axis (CAP-11) got a tab.** It was live in the catalogue and
  scored on 145 models, better coverage than two axes that already had tabs,
  and had simply never been shown.
- **Trust Rank became the daily brief,** with the Security Desk folded in.
- **Peer Insights split into its own tab.** Three panels left Market Watch.
- **An operator page at `/admin`:** runs, costs, counts, connectors, usage.
- **Readers can supply figures no source holds,** marked as assumptions rather
  than estimated silently.
- **API.md written;** the docs brought back in line with the app.

## 4 August: the analyst voice, and a real database

39 commits.

- **Opus 5 writes the analyst prose,** over a whitelist of figures it cannot
  invent, with one chance to correct itself when it strays. Every insight panel
  shows which of the two wrote it.
- **The catalogue got a Postgres database,** and the query stopped silently
  truncating: PostgREST's row ceiling is now paged past rather than trusted.
- **Peer adoption wired live,** with first-party endpoints, an ingestion
  function, and a stated definition of what "live" means.
- **Private company revenue is estimated as a range** with its assumption
  exposed, never as a single invented figure.
- **The financial snapshot went from two disclosure rungs to five.**
- **Price / Performance can switch capability axes,** and states what each axis
  does not cover.
- **Workforce Model Fit** shows how much of a workforce actually needs a
  top-tier model.
- **The Pulse cut from 11 sections to 8,** with sample data removed entirely.
- **The sidebar cut from 18 items to 13.** Model 4 Role became FitEngine, then
  ModelEngine. Market View was renamed. Explore replaced Start Here.
- **The data source register compiled,** which found a dead upstream.

## 3 August: the role library, and the recommender

12 commits.

- **The Workforce Model Fit recommender** landed on Model 4 Role: pick an
  industry, function and role, get the cheapest model meeting that role's
  requirements, with the eliminated models and the number that eliminated them.
- **The role library filled out:** 99 roles that were present but hidden, and
  seven industries that were empty.
- **Seven industries researched properly,** with evidence recorded per
  requirement.
- **The industry menu grouped into nine macro sectors.**
- **An engine and interface audit fixed six defects.**
- **AG's judgement got its own colour,** so an interpretation is never mistaken
  for a measurement.

## 2 August: insights everywhere, confidence nowhere

14 commits.

- **The Analyst Insight added to seven tabs,** then to Alliances and
  Price / Performance.
- **Confidence scoring removed across the platform.** A number nobody could
  derive was worse than no number.
- **Market share categories grouped into five expandable layers.**
- **Token pricing re-read from the vendor pages,** and freshness now beats
  liveness where the two disagree.
- **The derived gap broken into a portfolio,** so mismatches inside it surface.

## 1 August: the Pulse as a decision brief

7 commits.

- **The Pulse rebuilt as an executive decision brief,** with tests behind the
  derivation logic.
- **Financial absence derived from the value** rather than asserted.
- **Model allocation researched, and reported as unmeasurable.** The finding
  was that the split cannot be measured from available data, which was recorded
  rather than filled in.

## 31 July: real data, in place of placeholders

The second largest day, 37 commits. Most of it was replacing fixtures.

- **The Pulse put on real AI Enterprise data.** The competitive heatmap put on
  live BoardRadar, and dead routes stopped being badged live.
- **Reported segment revenue extracted from SEC XBRL filings,** so AI revenue
  on the Financial Snapshot stands on two separated footings.
- **Security and governance postures put on evidence-graded assessments.**
- **Placeholder third-party signals replaced with real cited sources.**
- **Ranking within market category, never across,** so a chip maker is never
  ranked against a CRM assistant.
- **Numeric confidence scores stripped;** market gauges renamed in plain
  English.
- **New views:** peer adoption chart, frontier face-off, alliance topology map,
  depth donut, interactive dependency graph, cost against capability.
- **A persistent shortlist,** and workflow selection that produces one.
- **Mobile layout fixed.** The app was unusable below the md breakpoint.
- **Middleware moved to the Node.js runtime** to stop invocation failures.

## 30 July: the port and the shell

13 commits, from an empty repository.

- **`.gitignore` before anything else,** so `.env.local` could never enter
  history.
- **The AIE dataset ported** from the ranking-engine repo into `lib/aie`, with
  origin headers on every file.
- **Core shell:** AG layout, BoardRadar proxy with the key server-side,
  coverage probe artefacts, The Pulse.
- **Company View for the exemplar buyer,** all six tabs.
- **All Vendor Assessment and Market Intelligence modules.**
- **Rebranded to AI Enterprise** with the AnalystGenius house mark.
- **Em-dashes sanitised** from ported files per the spec rule, and the
  transformation logged.
