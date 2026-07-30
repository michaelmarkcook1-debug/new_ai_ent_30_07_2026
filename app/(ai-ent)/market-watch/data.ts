// Market Watch data adapter. PORT lane: every figure on this page comes from
// the AIE dataset in lib/aie (market signals seed, category share estimates,
// intelligence vendor roster, exposure map). Derived values are simple counts
// over those rows and each derivation is documented in a DerivationDrawer.

import {
  EXPOSURE_EDGES,
  EXPOSURE_NODES,
  INTELLIGENCE_VENDORS,
  MARKET_CATEGORIES,
  MARKET_SHARE_ESTIMATES,
  SEED_MARKET_REGIME,
  SEED_SIGNALS,
  TRACKED_VENDORS,
  WATCHLISTS,
} from "@/lib/aie";
import type { RelationshipType } from "@/lib/aie";

// ---------- Market today (signals + regime) ----------

export interface RegimeView {
  periodStart: string;
  periodEnd: string;
  confidenceScore: number;
  uncertaintyNote: string;
  sourceCount: number;
  contributingSignalCount: number;
  facets: { label: string; value: string }[];
}

export interface SignalRow {
  id: string;
  title: string;
  summary: string;
  category: string;
  direction: string;
  timeHorizon: string;
  evidenceGrade: string;
  confidenceScore: number;
  dataStatus: string;
  sourceName: string;
  sourceUrl?: string;
  sourceDate: string;
  uncertaintyNote: string;
}

function facetValue(value: string): string {
  return value.replace(/_/g, " ");
}

export function getMarketToday(): { regime: RegimeView; signals: SignalRow[] } {
  const r = SEED_MARKET_REGIME;
  const regime: RegimeView = {
    periodStart: r.periodStart,
    periodEnd: r.periodEnd,
    confidenceScore: r.confidenceScore,
    uncertaintyNote: r.uncertaintyNote,
    sourceCount: r.sourceIds.length,
    contributingSignalCount: r.contributingSignalIds.length,
    facets: [
      { label: "Risk appetite", value: facetValue(r.riskAppetite) },
      { label: "Rates", value: facetValue(r.rateRegime) },
      { label: "Inflation", value: facetValue(r.inflationRegime) },
      { label: "Growth", value: facetValue(r.growthRegime) },
      { label: "Volatility", value: facetValue(r.volatilityRegime) },
      { label: "Tech multiples", value: facetValue(r.techMultipleRegime) },
      { label: "IPO window", value: facetValue(r.ipoWindowQuality) },
      { label: "AI sentiment", value: facetValue(r.aiSentimentRegime) },
      { label: "Infrastructure", value: facetValue(r.infrastructureConstraintRegime) },
    ],
  };

  const signals: SignalRow[] = [...SEED_SIGNALS]
    .sort((a, b) => (a.sourceDate < b.sourceDate ? 1 : -1))
    .map((s) => ({
      id: s.id,
      title: s.title,
      summary: s.summary,
      category: facetValue(s.signalCategory),
      direction: s.direction,
      timeHorizon: facetValue(s.timeHorizon),
      evidenceGrade: s.evidenceGrade,
      confidenceScore: s.confidenceScore,
      dataStatus: s.dataStatus,
      sourceName: s.sourceName,
      sourceUrl: s.sourceUrl,
      sourceDate: s.sourceDate,
      uncertaintyNote: s.uncertaintyNote,
    }));

  return { regime, signals };
}

// ---------- The market by category ----------

export interface ShareRow {
  vendorId: string;
  vendorName: string;
  share: number;
  previousEstimate?: number;
  changePct: number;
  confidence: number;
  tracked: boolean;
}

export interface CategoryShareView {
  id: string;
  name: string;
  description: string;
  rows: ShareRow[];
  namedShareTotal: number;
  source: string;
  sourceDate: string;
  methodology: string;
}

const VENDOR_NAME = new Map(INTELLIGENCE_VENDORS.map((v) => [v.id, v.name]));
const TRACKED_IDS = new Set(TRACKED_VENDORS.map((v) => v.id));

export function getCategoryShares(): CategoryShareView[] {
  return MARKET_CATEGORIES.map((cat) => {
    const rows = MARKET_SHARE_ESTIMATES.filter((e) => e.categoryId === cat.id)
      .map((e) => ({
        vendorId: e.vendorId,
        vendorName: VENDOR_NAME.get(e.vendorId) ?? e.vendorId,
        share: e.estimatedShare,
        previousEstimate: e.previousEstimate,
        changePct: e.changePct,
        confidence: e.confidence,
        tracked: TRACKED_IDS.has(e.vendorId),
      }))
      .sort((a, b) => b.share - a.share);
    const first = MARKET_SHARE_ESTIMATES.find((e) => e.categoryId === cat.id);
    return {
      id: cat.id,
      name: cat.name,
      description: cat.description,
      rows,
      namedShareTotal: rows.reduce((sum, r) => sum + r.share, 0),
      source: first?.source ?? "AI Enterprise seed data (mock market model)",
      sourceDate: first?.sourceDate ?? "",
      methodology: first?.methodology ?? "",
    };
  });
}

// ---------- Most depended-upon by layer (exposure map in-degree) ----------

export const RELATIONSHIP_TYPES: RelationshipType[] = [
  "investment",
  "cloud",
  "model_hosting",
  "commercial_partnership",
  "supply_chain",
  "subsidiary",
];

export const RELATIONSHIP_LABEL: Record<RelationshipType, string> = {
  investment: "Investment",
  cloud: "Cloud capacity",
  model_hosting: "Model hosting",
  commercial_partnership: "Partnership",
  supply_chain: "Supply chain",
  subsidiary: "Subsidiary",
};

// Exposure-map node id to tracked-vendor id, exact matches only. Nodes with
// no roster match group under "Wider ecosystem" rather than being guessed.
const NODE_TO_TRACKED: Record<string, string> = {
  MSFT: "microsoft",
  AMZN: "aws",
  GOOGL: "google",
  NVDA: "nvidia",
  ORCL: "oracle",
  CRM: "salesforce",
  SNOW: "snowflake",
  AMD: "amd",
  TSM: "tsmc",
  CRWV: "coreweave",
  cerebras: "cerebras",
  groq: "groq",
  togetherai: "together",
  fireworks: "fireworks",
  nscale: "nscale",
  g42: "g42",
  openai: "openai",
  anthropic: "anthropic",
  mistral: "mistral",
  cohere: "cohere",
  xai: "xai",
  perplexity: "perplexity",
  meta: "meta",
  deepseek: "deepseek",
  alibaba: "alibaba",
  moonshot: "moonshot",
  zai: "zai",
  minimax: "minimax",
  ai21: "ai21",
};

// Link-only overrides for nodes whose parent or successor is in the roster.
const NODE_LINK_OVERRIDES: Record<string, string> = {
  deepmind: "google",
  aleph: "cohere",
};

export function vendorLinkIdForNode(nodeId: string): string | null {
  return NODE_TO_TRACKED[nodeId] ?? NODE_LINK_OVERRIDES[nodeId] ?? null;
}

const LAYER_LABEL: Record<string, string> = {
  frontier: "Frontier labs",
  hyperscaler: "Hyperscalers",
  enterprise: "Enterprise platforms",
  application: "Application vendors",
  infrastructure: "Infrastructure players",
};

const LAYER_ORDER = [
  "Frontier labs",
  "Hyperscalers",
  "Enterprise platforms",
  "Application vendors",
  "Infrastructure players",
  "Wider ecosystem",
];

export interface DependencyNodeRow {
  nodeId: string;
  label: string;
  category: string;
  vendorLinkId: string | null;
  total: number;
  byType: Record<RelationshipType, number>;
}

export interface DependencyLayerGroup {
  layer: string;
  nodes: DependencyNodeRow[];
}

export interface DependencyView {
  groups: DependencyLayerGroup[];
  edgeCount: number;
  nodeCount: number;
  maxTotal: number;
}

export function getDependencyByLayer(): DependencyView {
  const trackedLayer = new Map(TRACKED_VENDORS.map((v) => [v.id, v.layer]));
  const inbound = new Map<string, Record<RelationshipType, number>>();
  for (const edge of EXPOSURE_EDGES) {
    const rec =
      inbound.get(edge.targetId) ??
      ({
        investment: 0,
        cloud: 0,
        model_hosting: 0,
        commercial_partnership: 0,
        supply_chain: 0,
        subsidiary: 0,
      } as Record<RelationshipType, number>);
    rec[edge.relationshipType] += 1;
    inbound.set(edge.targetId, rec);
  }

  const byLayer = new Map<string, DependencyNodeRow[]>();
  let maxTotal = 0;
  for (const node of EXPOSURE_NODES) {
    const byType = inbound.get(node.id);
    if (!byType) continue;
    const total = RELATIONSHIP_TYPES.reduce((sum, t) => sum + byType[t], 0);
    maxTotal = Math.max(maxTotal, total);
    const trackedId = NODE_TO_TRACKED[node.id];
    const layerKey = trackedId ? trackedLayer.get(trackedId) : undefined;
    const layer = layerKey ? LAYER_LABEL[layerKey] : "Wider ecosystem";
    const row: DependencyNodeRow = {
      nodeId: node.id,
      label: node.label,
      category: node.category,
      vendorLinkId: vendorLinkIdForNode(node.id),
      total,
      byType,
    };
    const list = byLayer.get(layer) ?? [];
    list.push(row);
    byLayer.set(layer, list);
  }

  const groups: DependencyLayerGroup[] = LAYER_ORDER.filter((l) => byLayer.has(l)).map(
    (layer) => ({
      layer,
      nodes: (byLayer.get(layer) ?? []).sort((a, b) => b.total - a.total),
    }),
  );

  return {
    groups,
    edgeCount: EXPOSURE_EDGES.length,
    nodeCount: [...byLayer.values()].reduce((sum, list) => sum + list.length, 0),
    maxTotal,
  };
}

// ---------- Leaders by category ----------

export interface LeaderView {
  categoryId: string;
  categoryName: string;
  leader: {
    vendorId: string;
    name: string;
    share: number;
    shareConfidence: number;
    overallScore: number;
    confidenceScore: number;
    marketPosition: string;
    tracked: boolean;
  };
  runnersUp: { vendorId: string; name: string; share: number; tracked: boolean }[];
  watchlists: string[];
}

export interface WatchlistView {
  id: string;
  name: string;
  vendors: { id: string; name: string; tracked: boolean }[];
  categories: string[];
}

export function getCategoryLeaders(): LeaderView[] {
  const vendorById = new Map(INTELLIGENCE_VENDORS.map((v) => [v.id, v]));
  return getCategoryShares()
    .filter((cat) => cat.rows.length > 0)
    .map((cat) => {
      const [top, ...rest] = cat.rows;
      const vendor = vendorById.get(top.vendorId);
      return {
        categoryId: cat.id,
        categoryName: cat.name,
        leader: {
          vendorId: top.vendorId,
          name: top.vendorName,
          share: top.share,
          shareConfidence: top.confidence,
          overallScore: vendor?.overallScore ?? 0,
          confidenceScore: vendor?.confidenceScore ?? 0,
          marketPosition: vendor?.marketPosition ?? "",
          tracked: top.tracked,
        },
        runnersUp: rest.slice(0, 2).map((r) => ({
          vendorId: r.vendorId,
          name: r.vendorName,
          share: r.share,
          tracked: r.tracked,
        })),
        watchlists: WATCHLISTS.filter((w) => w.vendors.includes(top.vendorId)).map(
          (w) => w.name,
        ),
      };
    });
}

export function getWatchlists(): WatchlistView[] {
  return WATCHLISTS.map((w) => ({
    id: w.id,
    name: w.name,
    vendors: w.vendors.map((id) => ({
      id,
      name: VENDOR_NAME.get(id) ?? id,
      tracked: TRACKED_IDS.has(id),
    })),
    categories: w.categories,
  }));
}

// Shared date formatter for dataset date stamps (en-GB, deterministic).
export function formatDate(iso: string): string {
  if (!iso) return "";
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return iso;
  return d.toLocaleDateString("en-GB", { day: "numeric", month: "short", year: "numeric" });
}
