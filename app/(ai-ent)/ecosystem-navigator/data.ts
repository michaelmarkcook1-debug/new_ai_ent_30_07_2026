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

// Exposure-map node ids that differ from the tracked-vendor roster ids.
const NODE_ID_ALIASES: Record<string, string> = {
  togetherai: "together",
};

// Node to vendor-profile link. Returns null when the node has no tracked
// vendor profile, so the graph renders plain text instead of a dead link.
// No layer or category is inferred here: the dependency graph groups by the
// dataset's own left and right sides (exposure owner to provider), which is
// recorded per node, rather than by any taxonomy invented in this app.
export function vendorLinkIdForNode(nodeId: string): string | null {
  const node = EXPOSURE_NODES.find((n) => n.id === nodeId);
  const rosterId = NODE_ID_ALIASES[nodeId] ?? nodeId;
  const byId = TRACKED_VENDORS.find((v) => v.id === rosterId);
  if (byId) return byId.id;
  if (node?.ticker) {
    const byTicker = TRACKED_VENDORS.find((v) => v.ticker === node.ticker);
    if (byTicker) return byTicker.id;
  }
  return null;
}

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
