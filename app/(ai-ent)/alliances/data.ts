// Alliances data adapter. PORT lane: the page renders the partnership and
// investment edges of the AIE exposure map with their native confidence
// tiers, values, dates and public source URLs. The only derived figures are
// plain counts over the filtered edge list, documented in the drawer.

import { EXPOSURE_EDGES, EXPOSURE_NODES, TRACKED_VENDORS } from "@/lib/aie";
import type { ConfidenceTier } from "@/lib/aie";

export type AllianceType = "commercial_partnership" | "investment";

export const ALLIANCE_TYPE_LABEL: Record<AllianceType, string> = {
  commercial_partnership: "Partnership",
  investment: "Investment",
};

// Exposure-map node id to tracked-vendor id, exact roster matches plus two
// link-only overrides (DeepMind under Google, Aleph Alpha under Cohere).
const NODE_TO_VENDOR: Record<string, string> = {
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
  deepmind: "google",
  aleph: "cohere",
};

const TRACKED_IDS = new Set(TRACKED_VENDORS.map((v) => v.id));

export function vendorLinkId(nodeId: string): string | null {
  const id = NODE_TO_VENDOR[nodeId];
  return id && TRACKED_IDS.has(id) ? id : null;
}

export interface AllianceEdgeView {
  id: string;
  fromId: string;
  fromLabel: string;
  fromVendorId: string | null;
  toId: string;
  toLabel: string;
  toVendorId: string | null;
  type: AllianceType;
  confidence: ConfidenceTier;
  estimatedValue?: string;
  dateUpdated: string;
  summary: string;
  sourceUrls: string[];
  strengthScore: number;
}

export interface AllianceVendorOption {
  nodeId: string;
  label: string;
  edgeCount: number;
}

export interface AllianceSummary {
  total: number;
  partnerships: number;
  investments: number;
  vendorsCovered: number;
  byConfidence: { high: number; medium: number; seed: number };
}

export interface AlliancesData {
  edges: AllianceEdgeView[];
  options: AllianceVendorOption[];
  summary: AllianceSummary;
  datasetUpdatedLatest: string;
}

const NODE_LABEL = new Map(EXPOSURE_NODES.map((n) => [n.id, n.label]));

export function getAlliancesData(): AlliancesData {
  const edges: AllianceEdgeView[] = EXPOSURE_EDGES.filter(
    (e): e is (typeof EXPOSURE_EDGES)[number] & { relationshipType: AllianceType } =>
      e.relationshipType === "commercial_partnership" ||
      e.relationshipType === "investment",
  )
    .map((e) => ({
      id: e.id,
      fromId: e.sourceId,
      fromLabel: NODE_LABEL.get(e.sourceId) ?? e.sourceId,
      fromVendorId: vendorLinkId(e.sourceId),
      toId: e.targetId,
      toLabel: NODE_LABEL.get(e.targetId) ?? e.targetId,
      toVendorId: vendorLinkId(e.targetId),
      type: e.relationshipType,
      confidence: e.confidence,
      estimatedValue: e.estimatedValue,
      dateUpdated: e.dateUpdated,
      summary: e.summary,
      sourceUrls: e.sourceUrls,
      strengthScore: e.strengthScore,
    }))
    .sort((a, b) => b.strengthScore - a.strengthScore);

  const counts = new Map<string, number>();
  for (const edge of edges) {
    counts.set(edge.fromId, (counts.get(edge.fromId) ?? 0) + 1);
    counts.set(edge.toId, (counts.get(edge.toId) ?? 0) + 1);
  }
  const options: AllianceVendorOption[] = [...counts.entries()]
    .map(([nodeId, edgeCount]) => ({
      nodeId,
      label: NODE_LABEL.get(nodeId) ?? nodeId,
      edgeCount,
    }))
    .sort((a, b) => b.edgeCount - a.edgeCount || a.label.localeCompare(b.label));

  const summary: AllianceSummary = {
    total: edges.length,
    partnerships: edges.filter((e) => e.type === "commercial_partnership").length,
    investments: edges.filter((e) => e.type === "investment").length,
    vendorsCovered: options.length,
    byConfidence: {
      high: edges.filter((e) => e.confidence === "high").length,
      medium: edges.filter((e) => e.confidence === "medium").length,
      seed: edges.filter((e) => e.confidence === "seed").length,
    },
  };

  const datasetUpdatedLatest = edges.reduce(
    (latest, e) => (e.dateUpdated > latest ? e.dateUpdated : latest),
    "",
  );

  return { edges, options, summary, datasetUpdatedLatest };
}
