// Barrel for the ported AIE data layer (lib/aie/).
// Re-exports the most useful surface of the ranking-engine dataset modules.
// Everything here is pure TypeScript seed data and helpers; no runtime deps.
// Name collisions between modules (NEWS_ITEMS, CAPABILITIES, INDUSTRIES,
// TruthRecord) are resolved by exporting the canonical module's symbol and
// aliasing or omitting the other.

// Core taxonomy: pillars, domains, evidence grades, risk penalties.
export { PILLARS, DOMAIN_TO_PILLAR, EVIDENCE_MODIFIER, RISK_PENALTY } from "./types";
export type {
  PillarId,
  DomainId,
  EvidenceGrade,
  RiskSeverity,
  RecommendationBand,
  IndustryArchetype,
} from "./types";

// Demo vendor roster derived from the canonical 47-vendor seed roster.
export { TRACKED_VENDORS, ECOSYSTEM_ONLY, vendorById } from "./vendors";
export type { TrackedVendor, EcosystemVendor } from "./vendors";

// Canonical intelligence dataset: 47 vendors, 13 market categories, shares,
// momentum, pillar scores, evidence sources, watchlists.
export {
  INTELLIGENCE_VENDORS,
  MARKET_CATEGORIES,
  MARKET_SHARE_ESTIMATES,
  VENDOR_MOMENTUM,
  VENDOR_PILLAR_SCORES,
  EVIDENCE_SOURCES,
  WATCHLISTS,
} from "./intelligence/seed";
export type {
  Vendor as IntelligenceVendor,
  MarketCategory,
  MarketCategoryId,
  MarketShareEstimate,
  VendorMomentum,
  VendorPillarScore,
  NewsItem,
  NewsCategory,
  Capability,
  VendorCapability,
  Watchlist,
  EvidenceSource,
} from "./intelligence/types";

// Query-tab entity model: 44 entities with per-role scores, dependencies,
// investor relationships, and the derived winning-by-layer view.
export { ENTITIES, WINNING_BY_LAYER, LAYER_DEFS, rolesFor, roleLeadership } from "./intelligence/entities";
export type { Entity, Role, RoleScore, RoleScores, InfraBand, CategoryKey } from "./intelligence/entities";

// Capability matrix: 10 capability families and ~200 vendor-capability cells.
export { CAPABILITIES, VENDOR_CAPABILITIES } from "./intelligence/seed-capabilities";

// Structured news seed (30 items, explicitly [MOCK]-labeled).
export { NEWS_ITEMS } from "./intelligence/seed-news";

// Region-by-industry vendor uptake model (585 segment rows plus size splits).
// INDUSTRIES is aliased to UPTAKE_INDUSTRIES to avoid colliding with the
// industry archetype profiles below.
export {
  REGIONS,
  INDUSTRIES as UPTAKE_INDUSTRIES,
  COMPANY_SIZES,
  UPTAKE_VENDORS,
  SEGMENT_SHARES,
  COMPANY_SIZE_SHARES,
  aggregateUptake,
  getCellShare,
} from "./intelligence/vendor-uptake-seed";
export type { Region, Industry, CompanySize, SegmentShareRow, CompanySizeRow } from "./intelligence/vendor-uptake-seed";

// Momentum, risk-penalty, and evidence-grade helper math.
export {
  calculateMarketMomentum,
  marketShareChangePct,
  momentumStatus,
  calculateRiskPenalty,
  evidenceConfidenceFromGrade,
} from "./intelligence/metrics";

// Exposure map: 44 named nodes and 66 typed dependency/alliance edges.
export { EXPOSURE_NODES, EXPOSURE_EDGES, EXTENDED_ECOSYSTEM_NODE_IDS } from "./investing/exposure-map-data";
export type {
  ExposureMapNode,
  ExposureMapEdge,
  RelationshipType,
  ConfidenceTier,
} from "./investing/exposure-map-data";

// Commercial model inventory (~98 models, 30 source registry entries).
export { SEED_MODELS, SEED_MODEL_SOURCES, INFRASTRUCTURE_ONLY_VENDOR_IDS } from "./model-inventory/seed";
export type { CommercialModel, CommercialModelSource } from "./model-inventory/types";

// Token pricing (USD per 1M tokens, null means unverified).
export {
  TOKEN_PRICING,
  TOKEN_PRICING_CAPTURED_AT,
  TOKEN_PRICING_DISCLAIMER,
  PRICING_VENDORS,
  pricingForVendorIds,
} from "./model-inventory/token-pricing";
export type { TokenPrice } from "./model-inventory/token-pricing";

// Market signals and regulatory events (source-cited, seed-labeled).
export { SEED_SIGNALS, SEED_MARKET_TALK, SEED_REGULATORY_EVENTS, SEED_MARKET_REGIME } from "./market-signals/seed";
export type { MarketSignal, MarketTalkSignal, RegulatoryEvent, MarketRegime } from "./market-signals/types";

// Product Scope Registry: per-vendor named products and module visibility.
export { PRODUCT_SCOPES, listProductScopes, productScopesForVendor, productScopeIdsForVendor } from "./investor-tools/product-scope";

// Three-pillar reputation seed (developer, employee, customer).
export {
  DEVELOPER_REPUTATION,
  EMPLOYEE_REPUTATION,
  CUSTOMER_REPUTATION,
  REPUTATION_INDEX,
  REPUTATION_VENDOR_IDS,
} from "./reputation/seed";
export type { DeveloperReputation, EmployeeReputation, CustomerReputation } from "./reputation/seed";

// Enterprise AI workflow taxonomy (75 records, tiered, in 15 areas).
// WORKFLOW_LIBRARY_SIZE derives this; the copy that states it reads that
// rather than a number typed here. The 85 this once claimed was never right.
export {
  USE_CASES,
  workflowTierOf,
  workflowsForTier,
  workflowsByCategory,
  PRIMARY_OBJECTIVES,
  ECOSYSTEMS,
} from "./use-cases";
export type { UseCase, WorkflowTier, WorkflowComplexity, IndustryTag, RegulatoryFlag } from "./use-cases";

// Industry archetype profiles with pillar weights and fatal-blocker domains.
export { INDUSTRIES, getIndustry, industryMaturityScore, adoptionMaturityBand } from "./industries";

// Numeric confidence formula and freshness gate.
export { confidenceFor } from "./evidence/confidence";
export { freshnessOf } from "./evidence/freshness";
export type { FreshnessStatus, ConnectorTier } from "./evidence/freshness";

// Truth engine: locked render gates for verified/seed/stale/disputed claims.
// TruthRecord here is the truth-engine's canonical claim shape (the richer
// record shapes live in ./truthfulness/types).
export {
  canRenderAsVerified,
  truthDisplayStatus,
  truthBadgeProps,
  requiresValidation,
  isHighConfidence,
} from "./truthfulness/truth-engine";
export type { TruthRecord, TruthDataStatus, TruthBadgeProps } from "./truthfulness/truth-engine";

// Curated sourcing manifest: where every vendor evidence point comes from.
export { SOURCE_MANIFEST, manifestForVendor, manifestSummary } from "./sourcing/manifest";
export type { SourceManifestEntry, SourceCategory } from "./sourcing/manifest";
