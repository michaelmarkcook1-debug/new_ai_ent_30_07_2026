// Module data adapter: the Ecosystem Navigator is PORT lane (AIE dataset,
// imported pure from lib/aie) plus one LIVE section (the integrator layer,
// fetched client-side via the /api/br proxy). Everything in this file is
// derivation over the ported dataset; no values are invented here.

import {
  EXPOSURE_NODES,
  EXPOSURE_EDGES,
  TRACKED_VENDORS,
  ECOSYSTEM_ONLY,
  SEED_MODELS,
} from "@/lib/aie";
import type {
  ExposureMapNode,
  ExposureMapEdge,
  RelationshipType,
  ConfidenceTier,
} from "@/lib/aie";
import type { CommercialModel } from "@/lib/aie";

export type { ExposureMapNode, ExposureMapEdge, RelationshipType, ConfidenceTier, CommercialModel };

// ──────────────────────────────────────────────────────────────────────────
// Section (a): dependency map, grouped into layer bands.
// ──────────────────────────────────────────────────────────────────────────

export type BandId =
  | "hyperscaler"
  | "frontier"
  | "enterprise"
  | "application"
  | "infrastructure";

export interface LayerBand {
  id: BandId;
  label: string;
  description: string;
  nodes: ExposureMapNode[];
}

// Exposure-map node ids that differ from the tracked-vendor roster ids.
const NODE_ID_ALIASES: Record<string, string> = {
  togetherai: "together",
};

// Fallback layers for exposure-map nodes outside the tracked roster,
// derived from each node's own AIE category label (silicon, servers and
// clouds keep their supply-side placement; model owners sit with the labs).
const FALLBACK_LAYER: Record<string, BandId> = {
  deepmind: "frontier",
  nemotron: "frontier",
  aleph: "frontier",
  lighton: "frontier",
  falcon: "frontier",
  ernie: "frontier",
  hunyuan: "frontier",
  TCEHY: "hyperscaler",
  BIDU: "hyperscaler",
  OVH: "hyperscaler",
  ASML: "infrastructure",
  HPE: "infrastructure",
  DELL: "infrastructure",
  SMCI: "infrastructure",
  huawei: "infrastructure",
};

const BAND_META: { id: BandId; label: string; description: string }[] = [
  {
    id: "frontier",
    label: "Frontier and model labs",
    description: "Model owners: frontier labs, open-model owners and regional labs.",
  },
  {
    id: "hyperscaler",
    label: "Hyperscalers and cloud platforms",
    description: "Cloud platforms that fund, host and distribute the models.",
  },
  {
    id: "enterprise",
    label: "Enterprise data platforms",
    description: "Data-platform incumbents with first-party model programmes.",
  },
  {
    id: "application",
    label: "Enterprise applications and assistants",
    description: "Application-layer vendors that consume or embed models.",
  },
  {
    id: "infrastructure",
    label: "Silicon, servers and inference clouds",
    description: "The supply chain: chips, foundries, servers and GPU clouds.",
  },
];

export function layerForNode(node: ExposureMapNode): BandId {
  const rosterId = NODE_ID_ALIASES[node.id] ?? node.id;
  const byId = TRACKED_VENDORS.find((v) => v.id === rosterId);
  if (byId) return byId.layer;
  if (node.ticker) {
    const byTicker = TRACKED_VENDORS.find((v) => v.ticker === node.ticker);
    if (byTicker) return byTicker.layer;
  }
  const fallback = FALLBACK_LAYER[node.id];
  if (fallback) return fallback;
  // Last resort keeps the map rendering if the dataset gains a node we have
  // not mapped: model owners sit with the labs, everything else supply-side.
  return node.side === "right" ? "frontier" : "infrastructure";
}

export function layerBands(): LayerBand[] {
  return BAND_META.map((meta) => ({
    ...meta,
    nodes: EXPOSURE_NODES.filter((n) => layerForNode(n) === meta.id).sort((a, b) =>
      a.label.localeCompare(b.label, "en-GB")
    ),
  })).filter((band) => band.nodes.length > 0);
}

// Capital layer from the AIE roster: investors appear on the map legend but
// carry no sourced dependency edges in the exposure dataset.
export const INVESTOR_BAND = {
  label: "Capital layer (investors)",
  description:
    "AIE roster investors. No sourced dependency edges are recorded for the capital layer in the exposure dataset, so none are drawn.",
  investors: ECOSYSTEM_ONLY,
};

export const RELATIONSHIP_LABEL: Record<RelationshipType, string> = {
  investment: "Investment",
  cloud: "Cloud",
  model_hosting: "Model hosting",
  commercial_partnership: "Partnership",
  supply_chain: "Supply chain",
  subsidiary: "Subsidiary",
};

export const CONFIDENCE_LABEL: Record<ConfidenceTier, string> = {
  high: "HIGH",
  medium: "MEDIUM",
  seed: "SEED",
};

export function nodeById(id: string): ExposureMapNode | undefined {
  return EXPOSURE_NODES.find((n) => n.id === id);
}

export function relationshipTypesPresent(): { type: RelationshipType; count: number }[] {
  const counts = new Map<RelationshipType, number>();
  for (const edge of EXPOSURE_EDGES) {
    counts.set(edge.relationshipType, (counts.get(edge.relationshipType) ?? 0) + 1);
  }
  return [...counts.entries()]
    .map(([type, count]) => ({ type, count }))
    .sort((a, b) => b.count - a.count);
}

export function edgesForVendor(vendorNodeId: string | null): ExposureMapEdge[] {
  if (!vendorNodeId) return EXPOSURE_EDGES;
  return EXPOSURE_EDGES.filter(
    (e) => e.sourceId === vendorNodeId || e.targetId === vendorNodeId
  );
}

export function connectedNodeIds(vendorNodeId: string): Set<string> {
  const ids = new Set<string>();
  for (const e of EXPOSURE_EDGES) {
    if (e.sourceId === vendorNodeId) ids.add(e.targetId);
    if (e.targetId === vendorNodeId) ids.add(e.sourceId);
  }
  return ids;
}

export const EXPOSURE_COUNTS = {
  nodes: EXPOSURE_NODES.length,
  edges: EXPOSURE_EDGES.length,
};

// ──────────────────────────────────────────────────────────────────────────
// Section (b): models catalogue.
// ──────────────────────────────────────────────────────────────────────────

export const MODEL_CATEGORY_LABEL: Record<string, string> = {
  llm_text: "Text LLM",
  multimodal: "Multimodal",
  reasoning: "Reasoning",
  coding: "Coding",
  embedding: "Embedding",
  reranking: "Reranking",
  guardrail_safety: "Guardrails and safety",
  speech_audio: "Speech and audio",
  image_generation: "Image generation",
  video_generation: "Video generation",
  ocr_document_ai: "OCR and document AI",
  time_series: "Time series",
  domain_specific: "Domain specific",
  unknown: "Unlabelled",
};

export const AVAILABILITY_LABEL: Record<string, string> = {
  commercially_available: "Commercially available",
  commercially_available_preview: "Commercial preview",
  enterprise_only: "Enterprise only",
  api_available: "API available",
  hosted_on_marketplace: "Marketplace hosted",
  underlying_product_model: "Underlying product model",
  not_commercially_available: "Not commercially available",
  unknown: "Unknown",
};

export const OWNERSHIP_LABEL: Record<string, string> = {
  first_party: "First party",
  hosted_third_party: "Hosted third party",
  marketplace: "Marketplace",
  byollm: "BYO LLM",
  open_weight: "Open weight",
  underlying_product_model: "Product model",
  unknown: "Unknown",
};

export interface ModelCategoryCount {
  id: string;
  label: string;
  count: number;
}

// Category chips are built only from categories that actually exist in the
// seed data, never from the full enum.
export function modelCategoriesPresent(): ModelCategoryCount[] {
  const counts = new Map<string, number>();
  for (const m of SEED_MODELS) {
    counts.set(m.modelCategory, (counts.get(m.modelCategory) ?? 0) + 1);
  }
  return [...counts.entries()]
    .map(([id, count]) => ({
      id,
      label: MODEL_CATEGORY_LABEL[id] ?? id,
      count,
    }))
    .sort((a, b) => b.count - a.count);
}

// The GENERATED stamp comes from the dataset's own capture and source dates,
// never from the clock.
export function modelsGeneratedStamp(): { capturedAt: string; latestSourceDate: string } {
  let capturedAt = "";
  let latestSourceDate = "";
  for (const m of SEED_MODELS) {
    if (m.capturedAt > capturedAt) capturedAt = m.capturedAt;
    if (m.sourceDate > latestSourceDate) latestSourceDate = m.sourceDate;
  }
  return { capturedAt, latestSourceDate };
}

export const MODELS = SEED_MODELS;
export const MODEL_COUNT = SEED_MODELS.length;
