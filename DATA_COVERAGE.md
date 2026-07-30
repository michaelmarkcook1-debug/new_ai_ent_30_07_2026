# DATA_COVERAGE.md

Live BoardRadar coverage probe, run 30 July 2026 against
`https://ag-api-prod-calm-seastar-79.fly.dev/api/v1` with the demo API key.
Every cell below is an observed HTTP response, not a guess. One recorded
response per successful endpoint is stored in `fixtures/br/` for mock mode.

## Headline findings

1. The BoardRadar universe (161 companies in `/companies`) is IT services
   first, but it contains these AI-relevant platform players with real data:
   Microsoft (MSFT), Google Cloud (GOOGL), Amazon Web Services (AMZN), IBM,
   Oracle (ORCL), Salesforce (CRM), ServiceNow (NOW), SAP, Adobe (ADBE),
   Cisco (CSCO), Dell (DELL), Alibaba Cloud (BABA).
2. Meta (META) and NVIDIA (NVDA) are NOT in the company universe:
   `reputation-tracker/unified` returns 404 `COMPANY_NOT_FOUND`. However the
   financial snapshot endpoints resolve any public ticker, so META and NVDA
   are LIVE for financials only.
3. The delivery layer is fully live: `/providers` (66 providers with
   assessment and AI readiness scores), `/ai-readiness/ranking` (105
   entries), `/ai-readiness/profile`, `/providers/snapshot`,
   `/assessment/framework` (per provider, 4 weighted dimensions with
   rationales), `/ai-platform/integration` (per ticker).
4. Several endpooints compute on first call and can exceed 12 seconds cold
   (observed on `financial-snapshot/overview`, `ai-exposure`,
   `ai-platform/integration`). They answer within the window once warm. The
   proxy's fixture fallback covers the cold-start case.
5. Identifier rules observed: most endpoints accept `?ticker=`; `/news`
   requires `?companyId=` (uuid from `/companies`); `/pulse/comparison-tables`
   requires `?primary=`; `/fx/rate` requires `?currency=`;
   `/financial-snapshot/competitor-financials` 400s without extra params.

## Per-ticker matrix (company-scoped endpoints)

HTTP status per ticker. 200 means success envelope with data; "null" means
200 with an honest empty analysis (rendered as an empty state, never a
number); 404 means not in universe; timeout means exceeded 15s cold (all
succeeded on a 45s retry where noted).

| Ticker | fin overview | fin quick-metrics | cyber-risk | ai-exposure | reputation unified | news (companyId) |
|---|---|---|---|---|---|---|
| MSFT | 200 (retry) | 200 | 200 | 200 (retry) | 200 | 200 |
| GOOGL | 200 (retry) | 200 | 200 | 200 (retry) | 200 | 200 |
| AMZN | 200 (retry) | 200 | 200 | 200 (retry) | 200 | untested |
| IBM | 200 (retry) | 200 | 200 | 200 | 200 | untested |
| ORCL | 200 (retry) | 200 | 200 | timeout | 200 | untested |
| CRM | 200 (retry) | 200 | 200 | 200 (retry) | 200 | untested |
| NOW | 200 | 200 | 200 | 200 (retry) | 200 | untested |
| SAP | 200 (retry) | 200 | 200 | 200 (retry) | 200 | untested |
| ADBE | 200 | 200 | 200 | timeout | 200 | untested |
| CSCO | 200 | 200 | 200 | timeout | 200 | untested |
| DELL | 200 | 200 | 200 | 200 | 200 | untested |
| BABA | 200 (retry) | 200 | 200 | timeout | 200 | untested |
| META | 200 | 200 | 200 (null) | timeout | 404 | n/a |
| NVDA | 200 | 200 | 200 (null) | timeout | 404 | n/a |

Also confirmed live for MSFT: `/financial` (full financial payload, 216 KB),
`/financial-snapshot/revenue-metrics`, `/financial-snapshot/stock-price`,
`/governance-risk`, `/talent/intelligence`, `/ai-talent/exposure`,
`/edgar/filings`, `/ai-platform/integration`.

## Market-wide and delivery-layer endpoints

| Endpoint | Status | Note |
|---|---|---|
| /companies | 200 | 161 companies, id + ticker resolution source |
| /providers | 200 | 66 providers, assessment + AI readiness scores |
| /ai-readiness/ranking | 200 | 105 entries with scores and dates |
| /ai-readiness/profile?ticker=ACN | 200 | per-provider readiness detail |
| /providers/snapshot?ticker=ACN | 200 | provider summary |
| /assessment/framework?ticker=ACN | 200 | 4 weighted dimensions, rationales |
| /assessment/framework?ticker=MSFT | 200 but empty | framework is provider-scoped |
| /ai-platform/integration?ticker=ACN | 200 | integrator by AI platform map |
| /ai-platform/integration?ticker=MSFT | 200 (retry) | vendor-side view, 11 KB |
| /pulse/market-indices | 200 | market KPI indices |
| /pulse/ACN | 200 | provider pulse |
| /narrative-reality-gap?ticker=ACN | 200 | narrative vs reality pattern source |
| /competitive-intelligence/heatmap?ticker=ACN | 200 | heatmap schema source, 12.7 KB |
| /governance/landscape | 200 | market-wide governance |
| /governance-risk?ticker=MSFT | 200 | per-company governance risk |
| /peer-financials | 200 | 59 KB, full provenance envelopes per metric |
| /market-signals?ticker=ACN | 200 | signal feed |
| /economic-market-data?ticker=ACN | 200 | macro context |
| /news?companyId=uuid | 200 | requires companyId, not ticker |
| /edgar/filings?ticker=MSFT | 200 | SEC filings list |
| /pulse/comparison-tables | 400 MISSING_PRIMARY | needs ?primary= |
| /fx/rate | 400 MISSING_CURRENCY | needs ?currency= |
| /news/sector | 400 MISSING_COMPANY_ID | company-scoped despite the name |
| /financial-snapshot/competitor-financials?ticker=MSFT | 400 | needs additional params |
| /financial-snapshot/activist-risk | untested | |

## What is wired LIVE in the demo (as a result)

- Delivery layer everywhere it appears: provider catalogue, AI readiness
  ranking, integrator matrix (`/ai-platform/integration`), assessment
  framework (Assess and Decide mirrors its schema; provider-scoped live data
  shown in the delivery context).
- Financial Snapshot: LIVE for MSFT, GOOGL, AMZN, IBM, ORCL, CRM, NOW, SAP,
  ADBE, CSCO, DELL, BABA, plus financials-only for META and NVDA.
  Anthropic, OpenAI, xAI and peers: disclosed-figures-only cards with
  "Awaiting public disclosure" states (they are not in BoardRadar).
- The Security Desk: LIVE cyber-risk for the twelve universe tickers above;
  honest null states for META and NVDA; SAMPLE for private AI labs.
- Reputation Tracker: LIVE unified reputation for the twelve universe
  tickers; SAMPLE for private AI labs.
- News: LIVE per-company news via companyId resolution for universe
  companies; AIE dataset news brief for the AI-market feed.
- Everything else follows its lane per the spec (SCHEMA with SAMPLE badge,
  PORT with AIE dataset badge, STUB).

## Identifier resolution

`/companies` is fetched and cached by the server; ticker to companyId
mapping happens server-side. Fixture `fixtures/br/companies.json` records
the full list.
