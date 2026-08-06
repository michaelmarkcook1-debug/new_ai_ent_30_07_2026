# AIE Re-use Map: Porting the AI Enterprise Dataset and Logic

Source repo: /Users/michaelcook/Documents/Dev Projects/_archive/ranking-engine-stray-copy-2026-07-08 (the "ranking-engine" codebase behind the AIE app at ranking-engine-red.vercel.app).
Audit date: 30 July 2026.
Scope: read-only inventory of data modules, types, API routes, services, vendor roster, confidence and evidence language, and page structure, with a re-use recommendation per entry. All paths below are relative to the repo root unless stated otherwise.

Stack context: Next.js 16.2.5 (App Router), React 19, Prisma 7 with Postgres (optional, everything falls back to typed seed modules when DATABASE_URL is unset), Tailwind 4, Vitest, Anthropic SDK. The repo runs fully without a database, which makes the seed modules directly portable into a demo app.

A note on duplicates: the repo contains Finder-style duplicate files ("seed 2.ts", "types 2.ts", "page 2.tsx", "README 2.md", "investing/* 2/" directories). These are stale copies of the canonical files. SKIP all of them; every recommendation below refers to the file without the " 2" suffix.

## 1. Data modules and fixtures

### 1.1 Vendor spine (the canonical dataset)

- lib/intelligence/seed.ts (505 lines). The single most important data file. Exports INTELLIGENCE_VENDORS (47 vendor records, the canonical roster, see section 5), MARKET_CATEGORIES (13 categories including frontier_model_api, enterprise_assistant, developer_coding_agent, agent_platform, rag_enterprise_search, workflow_automation_ai, crm_customer_ai, itsm_hr_service_ai, cloud_ai_platform, regulated_industry_ai, ai_silicon, ai_cloud_compute, neocloud_inference), MARKET_SHARE_ESTIMATES (derived from a rebalanced shareRows table), VENDOR_MOMENTUM, NEWS_ITEMS, CAPABILITIES, VENDOR_CAPABILITIES, VENDOR_PILLAR_SCORES, EVIDENCE_SOURCES, WATCHLISTS. Each vendor record carries category, description, HQ, ownership, use cases, ecosystems, deployment options, autonomy tier, overallScore, confidenceScore, strategy, product capabilities, enterprise controls, agentic capability, industry strength, risk profile, analyst interpretation, roleTags, and infraBand. Recommendation: PORT as-is. This is the dataset.

- lib/intelligence/entities.ts (312 lines). The Query-tab entity model: 44 entities with per-role scoring (RoleScore: leadership, innovation, readiness, reach, confidence, evidenceGrade, rationale), momentum, usageShare, movement deltas, modelsOwned, hostedThirdParty, infrastructureExposure, investorRelationships, hardwareDependencies, cioInterpretation, evidenceGrade (E1 to E5), dataCaveats, infra sub-bands (silicon, cloud_compute, neocloud, inference, data_platform). Also derives WINNING_BY_LAYER from the roster so layer winners can never drift from tracked entities. This file holds the vendor dependency and investor relationship data in structured string arrays. Recommendation: PORT as-is. It is the richest per-vendor analyst dataset in the repo and the source of the dependencies, alliances, and role-lens views.

- lib/intelligence/seed-vendors-intel.ts (490 lines). The older 20-vendor MVP intelligence profiles (ids prefixed vendor_, e.g. vendor_openai) plus PILLAR_SCORES for four vendors. Superseded by seed.ts and entities.ts but still imported by some legacy surfaces. Recommendation: PORT with trim; keep only if you want the longer-form per-vendor prose (strategy, analyst interpretation per pillar), otherwise SKIP in favor of seed.ts.

- lib/intelligence/seed-market.ts (129 lines). The 10 original market categories, 42 market share estimate rows (with confidence, source label, methodology sentence, previous estimate, change), and vendor momentum seeds. Partially superseded by seed.ts (which has 13 categories). Recommendation: PORT with trim; reconcile against seed.ts and keep one category list.

- lib/intelligence/seed-capabilities.ts (264 lines). 10 capability families (models, enterprise_assistant, rag, agents, governance, security, integrations, cost_controls, deployment, portability) and about 200 vendor-capability cells with status (inferred, documented, tested, verified), maturity score, evidence grade, and notes. Recommendation: PORT as-is for the capability matrix module.

- lib/intelligence/seed-news.ts (292 lines). 30 structured news items dated around May 2026. Every item is explicitly a MOCK: sourceName is prefixed "[MOCK]" and sourceUrl is stripped by design. Rich structure: vendors, categories, affected pillars, impact score, confidence score, sentiment, whyItMatters, suggestedScoreImpact. Recommendation: PORT with trim. The structure and classification taxonomy are excellent; the items themselves are illustrative and stale, so either regenerate content or keep the honest [MOCK] labeling.

- lib/intelligence/vendor-uptake-seed.ts (702 lines). Auto-generated from May 2026 spreadsheets: 585 segment share rows (5 regions x 9 industries x 13 vendors, fractional shares with confidence labels Low to High) plus company-size splits per vendor. Powers the /api/uptake endpoint and the Demonstrate uptake explorer. Recommendation: PORT as-is; it is the only region-by-industry adoption dataset in the repo.

### 1.2 Assessment engine data

- lib/use-cases.ts (918 lines, 75 workflow records: this said 85 until 5 August 2026, from a regex that counted `id:` occurrences outside the array; the ported file holds 75 in 15 categories). The enterprise AI workflow taxonomy: workflows tiered quick, guided, advanced, with industries, commonInputs, regulatoryFlags, and complexity. Recommendation: PORT as-is if the demo includes any assessment flow; the taxonomy is reusable on its own.

- lib/industries.ts (116 lines). 8 industry archetypes with pillar weight profiles and fatal-blocker domains (e.g. regulated_financial weights enterprise_control at 35 percent). Recommendation: PORT as-is.

- lib/seed-vendors.ts (288 lines). Engine-side seed vendor profiles with evidence items and risk flags, but the vendors are anonymized fictional companies (vendor_atlas, vendor_borealis, vendor_caelum, vendor_delta, vendor_evergreen, vendor_falcon). Recommendation: SKIP unless you need engine test fixtures; the fictional roster is not the AIE dataset.

- lib/decision-intelligence/seed.ts (137 lines). Curated board-pack templates: business case, risks, KPIs, board assumptions, competitor profiles, all labeled estimated E2. Recommendation: PORT with trim if the demo shows a board or business-case surface; it is intentionally template content.

### 1.3 Model inventory, pricing, reputation

- lib/model-inventory/seed.ts (1,692 lines). Commercial LLM model inventory: about 98 model records and 30 source registry entries, each citing real official-source URLs, with dataStatus rules (seed until verified), confidence in 50 to 80 for seed rows, and honest ownerVendorId mapping for hosted third-party models (Claude on Bedrock stays Anthropic's). Recommendation: PORT as-is, then refresh model names and versions; the provenance discipline is the value.

- lib/model-inventory/token-pricing.ts (89 lines, 34 pricing rows). USD per 1M input and output tokens plus cached-input price, null where unverified, captured 2026-06-02 from public pricing pages, with an explicit honesty contract in the header. Recommendation: PORT with trim; refresh prices before demoing, keep the null-means-unverified convention.

- lib/reputation/seed.ts (831 lines, 29 vendors). Three-pillar reputation dataset: developer (GitHub, Reddit, forums), employee (Glassdoor-style variables), customer (downtime, value, service). All seed until live ingestion; GitHub cells carry repo provenance where fetched live. Recommendation: PORT as-is for a reputation module, otherwise SKIP.

### 1.4 Investor and market-signal data

- lib/investing/seed.ts (554 lines). Investor Tools seed: INVESTMENT_PROVIDERS, INDIRECT_EXPOSURES, IPO_PROFILES, IPO_EVIDENCE_QUALITY, IPO_FORECASTS (deliberately labeled estimated or seed or unknown, with the IPO_FORECAST_WARNING disclaimer string), POST_IPO_FLUCTUATION_BANDS (percentage-only), MISSING_IPO_DATA_CHECKLISTS, FINANCIAL_METRICS, VALUATION_METRICS. Recommendation: PORT with trim only if the demo includes investor surfaces; the truth-rule scaffolding (disabled providers, missing-data checklists) is the notable part.

- lib/investing/exposure-map-data.ts (546 lines). Hand-curated exposure map: 44 named nodes (with ticker, ownership, category, logo domain, monogram, brand color) and 66 edges typed investment, cloud, model_hosting, commercial_partnership, supply_chain, subsidiary, each with strengthScore, confidence tier (high, medium, seed), estimatedValue, dateUpdated, one-sentence summary, and supporting sourceUrls. Verification rules are documented in the header. Recommendation: PORT as-is. This is the vendor dependency and alliance graph, and the best sourced dataset in the repo.

- lib/market-signals/seed.ts (350 lines). 12 source-cited market signals (macro, legal, talk) and 2 regulatory events (EU AI Act obligations effective 2025-08-02, US chip export controls effective 2025-01-13) with per-event impact vectors (marginRisk, marketAccessRisk, valuationRisk, ipoWindowRisk, supplyChainRisk and so on) and uncertainty notes. Anything without a real public URL is marked dataStatus seed and E1 so it cannot move a score center, only widen bands. Recommendation: PORT as-is for the legislation and regulation module; it is small but well structured.

- lib/investor-tools/product-scope.ts (353 lines, 28 vendors). Product Scope Registry: per-vendor named products with categories, module visibility flags, simulator and assessment eligibility, and uncertainty notes. Recommendation: PORT as-is; it is the linkage layer between vendors and their actual products.

### 1.5 Database snapshot (bonus fixture)

- backups/2026-06-08T04-19-30-337Z/ (JSON dumps of every Prisma table as of 8 June 2026): intelligence_vendors (20), vendor_profiles (28), vendor_products (186), vendor_evidence_items (1,019), evidence_proposals (821), intelligence_news_items (122, includes real ingested items beyond the 30 mocks), vendor_ranking_snapshots (2,048), vendor_scores (328), vendor_pillar_scores (120), vendor_capabilities (200), market_share_estimates (42), vendor_momentum (40), risk_flags (40), vendor_industry_adoption (50), watchlists (2), plus manifest and job tables. Recommendation: PORT with trim. If the demo wants historical ranking snapshots or a larger news corpus than the seeds, this snapshot is the richest single source; strip job, audit, and user-state tables.

- data/triage-audit.jsonl (3,866 lines) and data/linkage-apply-audit.jsonl (149 lines): pipeline audit logs. Recommendation: SKIP; operational exhaust, not product data.

## 2. TypeScript type definitions

- lib/types.ts (277 lines): PillarId (6 pillars), DomainId (12 domains), DOMAIN_TO_PILLAR, EvidenceGrade E0 to E5 with EVIDENCE_MODIFIER (0.0, 0.4, 0.6, 0.75, 0.9, 1.0), RiskSeverity and RISK_PENALTY, RecommendationBand, IndustryArchetype, Vendor, EvidenceItem, AssessmentInput, AssessmentResult. PORT as-is.
- lib/intelligence/types.ts (234 lines): portal-facing Vendor, VendorPillarScore, MarketCategory and MarketCategoryId, MarketShareEstimate, VendorMomentum, NewsItem and NewsCategory, Capability, VendorCapability (with Phase 5 audit extensions: dataStatus, freshnessStatus, sourceIds, uncertaintyNote, truthRecordIds, calculationTrace), Watchlist, EvidenceSource, MarketDashboard, RankInput. PORT as-is.
- lib/intelligence/entities.ts: Role, CategoryKey, InfraBand, RoleScore, Entity (types co-located with data). PORT as-is.
- lib/investing/types.ts (501 lines): ExposureClass, InvestmentProviderProfile, ProductScope and ProductCategory, simulation types, IPO forecast types, DataStatus and SourceStatus and FreshnessStatus unions. PORT only with the investor modules.
- lib/market-signals/types.ts (247 lines): MarketSignal, MarketTalkSignal, RegulatoryEvent, MarketRegime. PORT with the signals module.
- lib/model-inventory/types.ts (160 lines): CommercialModel, CommercialModelSource. PORT with the model inventory.
- lib/truthfulness/types.ts and lib/evidence/types.ts: TruthRecord support types, evidence record shapes. PORT with the truth engine (section 6).
- lib/workflow-types.ts (331 lines) and lib/enterprise/types.ts: assessment workflow shapes. PORT with the assessment engine.
- generated/prisma/*: generated Prisma client types. SKIP; regenerate from prisma/schema.prisma instead.
- prisma/schema.prisma: 23 models covering both layers (VendorProfile through EvidenceSource). PORT as-is if the demo wants persistence; otherwise SKIP and stay seed-only.

## 3. API routes (app/api/*)

All routes are App Router route handlers, Node runtime, mostly force-dynamic. Grouped by family, with external pulls and env key names (names only, from code and .env.example).

Core intelligence (no external pulls, read seed or Prisma):
- app/api/vendors/route.ts and app/api/vendors/[id]/route.ts: vendor list and profile. PORT as-is.
- app/api/vendors/[id]/snapshots/route.ts: ranking history snapshots. PORT if history is kept.
- app/api/news/route.ts: filtered news feed. PORT as-is.
- app/api/market-dashboard/route.ts: composed dashboard payload from the repository. PORT as-is.
- app/api/market-share/route.ts, app/api/capabilities/route.ts, app/api/rank/route.ts (zod-validated lightweight ranking), app/api/metadata/route.ts, app/api/briefings/weekly/route.ts, app/api/watchlists/route.ts, app/api/watchlist/*: PORT as-is.
- app/api/uptake/route.ts: region and industry adoption aggregation over the 585-row model, with a provenance string in the payload. PORT as-is.
- app/api/pricing/route.ts: token pricing with disclaimer and capturedAt. PORT as-is.
- app/api/reputation/route.ts: three-pillar reputation rows. PORT with the reputation module.
- app/api/model-inventory/*: model inventory list, per-vendor, sources, refresh. PORT with the model inventory.

Assessment:
- app/api/assessment/score/route.ts: runs the deterministic engine. app/api/assessment/[id]/route.ts and export/route.ts: run retrieval and board-pack export (pptxgenjs). PORT with the assessment engine.

Truth engine and evidence:
- app/api/truth/claims/route.ts, claims/[id], validate, stale, flag-unsupported, refresh-required: TruthRecord CRUD and validation gates. PORT with the truth engine.
- app/api/evidence/claims, sources, validate-claim: evidence surfaces. PORT with the evidence layer.

Investor tools (two generations, investor-tools is current, investing is the older namespace):
- app/api/investor-tools/*: nav, intelligence, scores, providers, public, product-scope, ipo-watch (with per-provider detail), exposure-map, briefings, simulator/* (filter-universe, apply-shock, validate-cross-feed, scatter-domain, tooltips, save). Live enrichment paths call Yahoo Finance (free, no key) via lib/investing/live-data.ts. PORT with trim (only the surfaces the demo needs). app/api/investing/*: SKIP, superseded duplicate namespace.

Data-source connectors (external pulls, key names in parentheses):
- app/api/data-sources/status, refresh, [connectorId], sec/[cik] (SEC_USER_AGENT), eia/retail-sales (EIA_API_KEY), vendor-docs (no key, fetches curated vendor trust-center and pricing URLs). The connector registry behind these (lib/connectors/registry.ts) covers: sec (SEC_USER_AGENT), fred (FRED_API_KEY), bls (BLS_API_KEY), bea (BEA_API_KEY), eia (EIA_API_KEY), fiscalData (no key), alphaVantage (ALPHA_VANTAGE_API_KEY), gdelt (no key), github (GITHUB_TOKEN optional), congress (CONGRESS_API_KEY), federalRegister (no key), vendorDocs (no key), yahooFinance (no key), stooq (no key, in lib/connectors/stooq.ts). Recommendation: PORT with trim; take the registry pattern plus only the connectors the demo needs (yahooFinance, github, federalRegister, gdelt are keyless and demo-friendly).

Admin and pipeline (LLM-powered):
- app/api/admin/ingestion/run and jobs, admin/proposals/*, admin/evidence/* (triage, dedup, linkage, batch-action), admin/sourcing/*, admin/intelligence/recompute, admin/production-status, admin/seed-missing-vendors, admin/backfill-snapshots, admin/exposure-edits. Env: ANTHROPIC_API_KEY, ANTHROPIC_MODEL, ANTHROPIC_EXTRACT_MODEL, ANTHROPIC_INTEL_MODEL, ADMIN_API_TOKEN, ADMIN_API_OPEN. Recommendation: SKIP for a demo unless you want the analyst review loop; it is the heaviest subsystem.

Cron:
- app/api/cron/daily-refresh, competitive-intel, ranking-snapshot, safe-actions, sourcing-rolling. Guarded by CRON_SECRET. competitive-intel drives Claude web-search news pulls per vendor. Recommendation: PORT with trim (ranking-snapshot and competitive-intel are the two with demo value).

Other env keys seen in code or .env.example: DATABASE_URL, DATABASE_URL_UNPOOLED, POSTGRES_URL_NON_POOLING, RESEND_API_KEY (watchlist email alerts via Resend), NEXT_PUBLIC_APP_URL, DEMO_SOURCE_FIRST, ALLOW_LIVE_LLM_TESTS, TRIAGE_LIVE_FORBIDDEN, SOURCING_LOG_DIR. .env.example lists only: DATABASE_URL, ANTHROPIC_API_KEY, ANTHROPIC_MODEL, ADMIN_API_OPEN, ADMIN_API_TOKEN. Several other .env* files exist (.env.local, .env.production, .env.preview, .env.development.local, .env.local.bak); contents not inspected.

## 4. Service and lib logic worth porting

- lib/engine.ts (471 lines): the deterministic assessment engine. Final score = sum(pillar x dynamic context weight x evidence confidence) + strategic fit bonus + sector adoption fit bonus, minus risk, missing-evidence, and adoption-friction penalties; fatal blockers per industry. Tested in lib/engine.test.ts. PORT as-is.
- lib/intelligence/repository.ts (702 lines): the data spine. Every read goes through here; Prisma when DATABASE_URL is set, typed seeds otherwise. This dual-mode pattern is what makes the demo trivially deployable. PORT as-is.
- lib/intelligence/metrics.ts: momentum aggregation, risk-penalty curve, news classification helpers (tested). PORT as-is.
- lib/intelligence/strategic-scores.ts and lib/decision-intelligence/board-defence-score.ts: computed scores for Understand and board surfaces (tested). PORT with those pages.
- lib/intelligence/ranking-snapshots.ts and ranking-history.ts: snapshot capture and movement computation (tested). PORT if the demo shows movement over time.
- lib/intelligence/briefings.ts: weekly brief composer. PORT as-is (45 lines).
- lib/intelligence/competitive-monitor.ts (308 lines) and competitive-targets.ts: Claude web-search news monitor, one capped call per vendor, idempotent upserts into the news table. Needs ANTHROPIC_API_KEY. PORT with trim if live news is wanted.
- lib/intelligence/load-universe.ts: idempotent, non-destructive universe loader that merges seed.ts and entities.ts into the DB. PORT if using Postgres.
- lib/agents/evidence-extractor.ts, evidence-classifier.ts, llm-client.ts, url-finder.ts: LLM evidence extraction pipeline with a stub fallback path (tested without keys). PORT with trim only if the demo shows ingestion.
- lib/evidence/confidence.ts: the confidence formula (grade base E0 0, E1 35, E2 60, E3 78, E4 88, E5 96; minus 15 stale, minus 10 unknown freshness; plus 2 per corroborating source capped at 8; minus 5 per contradicting source capped at 15). PORT as-is.
- lib/evidence/freshness.ts, normalise.ts, scoring.ts, methodology.ts, source-registry.ts: freshness horizons, normalization, and the public methodology text. PORT as-is.
- lib/truthfulness/truth-engine.ts (205 lines) plus render-claim.ts and registry.ts: the canonical truth gates (see section 6). PORT as-is.
- lib/intelligence/capabilities-truthfulness.ts: per-cell render gate for the capability matrix (verified, documented, seed, stale, disputed, validation_required, unknown, infrastructure_only). PORT as-is.
- lib/intelligence/provenance.ts: the seed-versus-live badge logic (live only when analyst_verified evidence exists in Postgres). PORT as-is.
- lib/system/daily-refresh.ts and derive-scores.ts: orchestrated refresh and score derivation. PORT with the cron routes.
- lib/investing/simulator.ts, simulator-live.ts, live-data.ts, valuation-live.ts, financials-live.ts, news-tilt.ts, ipo-estimator.ts: simulation and live-quote enrichment (Yahoo Finance keyless). PORT with trim per investor surface used.
- lib/growth-models/* (models, macro-models, unified-hybrid): growth model math used by the simulator with demo scripts in scripts/demo-*.ts. PORT with the simulator.
- lib/export/board-pack.ts and components/demonstrate/board-pack-pptx.ts: PPTX board-pack export with XSS-escape tests. PORT if export is demoed.
- lib/sourcing/manifest.ts (351 lines): the curated URL manifest telling the pipeline where every vendor evidence point comes from, with per-source confidence horizons. PORT as-is even if the pipeline is skipped; it doubles as a citation directory.
- lib/tier-overlay.ts, lib/workflow-risk.ts, lib/assessment/tiers.ts: assessment tiering and risk overlays. PORT with the assessment.

## 5. Canonical vendor roster

The canonical roster is INTELLIGENCE_VENDORS in lib/intelligence/seed.ts (47 slugs; slug equals id). load-universe.ts treats this as the spine and folds entities.ts metadata onto it:

openai, microsoft, google, anthropic, aws, salesforce, servicenow, oracle, sap, ibm, cohere, mistral, glean, moveworks, writer, hebbia, rogo, harvey, databricks, snowflake, meta, deepseek, alibaba, moonshot, zai, minimax, ai21, xai, perplexity, nvidia, amd, broadcom, tsmc, cerebras, coreweave, lambda, together, fireworks, groq, nscale, g42, humain, sakana, softbank, a16z, sequoia, mgx.

The entities.ts roster (44 ids) matches except: it lacks glean, hebbia, minimax, ai21; it uses hyphenated ids alibaba-qwen, moonshot-kimi, zhipu-glm, together-ai, fireworks-ai (each maps to the spine slug via the entity() helper). The older 20-vendor MVP roster in seed-vendors-intel.ts uses vendor_-prefixed ids; lib/services/vendor-id-bridge.ts translates between the two conventions. The investor layer additionally excludes pure investors from ranked surfaces (INVESTOR_EXCLUDED_VENDOR_IDS in lib/investing/seed.ts).

## 6. Confidence labels and evidence language

The repo's differentiator is its truthfulness system. It lives in:

- lib/truthfulness/truth-engine.ts: the locked rules. E0 never renders verified; dataStatus seed, stale, disputed, unsupported, unknown each downgrade; confidence under 60 shows a low-confidence badge; zero sourceIds means validation required; verified requires E3 or better AND at least one source AND status in verified, documented, tested. Exposes canRenderAsVerified, truthDisplayStatus, truthBadgeProps, requiresValidation.
- lib/evidence/confidence.ts: the numeric confidence formula (section 4).
- lib/intelligence/capabilities-truthfulness.ts: per-cell render modes and freshness horizons by data status (verified 365 days, documented 180, estimated 90, inferred 60, seed 30).
- lib/intelligence/provenance.ts: the app-level seed-versus-live badge.
- Vocabulary used across data files and UI: evidence grades E0 to E5 with meanings (E1 vendor claim only, E2 public documentation, E3 public test or API verification, E4 production customer evidence, E5 independent audit or verified benchmark); dataStatus values verified, documented, tested, estimated, inferred, seed, stale, disputed, unknown, unsupported; confidence labels Low through High in the uptake model; "[MOCK]" prefixes on illustrative news; "Unverified" price rows; "modelled estimate" provenance strings on API payloads; IPO_FORECAST_WARNING disclaimer text; dataCaveats notes on every entity.

Recommendation: PORT the whole truthfulness cluster as-is. It is small, tested, dependency-light, and it is the credibility story of the product.

## 7. Page structure (App Router)

Primary navigation (components/TopNav.tsx) exposes two groups.

Workflow tabs: /query-v2 (Query: entity market map, role lenses, winning by layer), /understand (capability matrix and vendor filters), /assess (assessment form; /assessment is the newer flow with TierBar; /results/[runId] shows run output), /demonstrate (board pack exporter, token pricing table, vendor uptake explorer), /monitor (watch surface).

Intelligence portal: / (home shell), /dashboard (executive market dashboard), /atlas (AI Ecosystem Atlas), /market (market watch: category share and momentum), /news (classified news brief), /reputation, /capabilities, /vendors and /vendors/[slug], /watchlists, /briefings, /evolution (ranking history), /exposure-map (dependency and alliance map), /quadrant (quadrant chart), /methodology, /settings.

Investor: /investor-tools (cockpit) with briefing, briefings, exposure-map, intelligence, ipo-watch and ipo-watch/[providerSlug], provider/[slug], public, signals (market signals and legislation surface), simulator, watchlist. The parallel /investing/* tree is the older generation: SKIP.

Admin: /admin (console), /admin/evidence and /admin/evidence/batch, /admin/ingestion, /admin/data-sources, /admin/pipeline-health, /admin/production-status, /admin/exposure-edits. SKIP for a demo unless the review loop is part of the story.

Notable components worth carrying with their pages: components/atlas/AIAtlasClient.tsx, components/quadrant/QuadrantChart.tsx, components/query/EcosystemMap.tsx and RelationshipMap.tsx and CategoryCards.tsx, components/dashboard/ExposureMapHero.tsx, components/understand/CapabilityMatrix.tsx, components/demonstrate/VendorUptakeExplorer.tsx and TokenPricingTable.tsx and BoardPackExporter.tsx, components/intelligence-ui.tsx, components/investor-tools-ui.tsx.

## 8. Gaps the demo will need to fill

- News: the 30 seed items are labeled mocks with no URLs; the 122-item DB backup includes real ingested items but everything predates 8 June 2026. Fresh news needs the competitive monitor (ANTHROPIC_API_KEY) or a new feed.
- Pricing: 34 token price rows captured 2026-06-02, several null (unverified); needs a refresh pass before quoting.
- Benchmarks: there is no benchmark dataset (no MMLU, SWE-bench, or similar scores anywhere). Model inventory records models and sources, not benchmark results. If the demo wants benchmarks, that is net-new data.
- Legislation: only 2 seeded regulatory events plus 2 regulatory signals; the congress and federalRegister connectors exist but no accumulated legislation corpus. A legislation module needs either live connector pulls or new curated seeds.
- Financial fundamentals: live quotes come keyless from Yahoo Finance and stooq, but fundamentals in the investing seeds are estimates dated May 2026.
- Freshness generally: all scores, shares, and narratives are dated May and June 2026 analyst estimates (evidence-labeled by design). The truthfulness system will correctly label them seed or stale; plan a refresh pass for anything shown as current.
