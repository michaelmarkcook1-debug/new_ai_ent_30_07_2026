// Module data adapter: Vendor View is PORT lane (AIE dataset). Every value
// on this surface is real AI Enterprise seed content re-used from the
// ranking-engine repository, joined onto the tracked vendor roster. No
// BoardRadar calls, no sample fixtures, nothing invented.

import { TRACKED_VENDORS, type TrackedVendor } from "@/lib/aie/vendors";
import {
  INTELLIGENCE_VENDORS,
  VENDOR_PILLAR_SCORES,
} from "@/lib/aie/intelligence/seed";
import type {
  Vendor as IntelligenceVendor,
  VendorPillarScore,
  VendorCapability,
} from "@/lib/aie/intelligence/types";
import { PILLARS, type EvidenceGrade, type PillarId } from "@/lib/aie/types";
import {
  CAPABILITIES,
  VENDOR_CAPABILITIES,
} from "@/lib/aie/intelligence/seed-capabilities";
import {
  EXPOSURE_EDGES,
  EXPOSURE_NODES,
  type ExposureMapEdge,
} from "@/lib/aie/investing/exposure-map-data";
import {
  SEED_MODELS,
  INFRASTRUCTURE_ONLY_VENDOR_IDS,
} from "@/lib/aie/model-inventory/seed";
import type { CommercialModel } from "@/lib/aie/model-inventory/types";
import {
  REPUTATION_INDEX,
  type DeveloperReputation,
  type EmployeeReputation,
  type CustomerReputation,
} from "@/lib/aie/reputation/seed";
import {
  manifestForVendor,
  type SourceManifestEntry,
} from "@/lib/aie/sourcing/manifest";

// ---------- Rankings surface ----------

export interface PillarCell {
  score: number;
  grade: EvidenceGrade;
  confidence: number;
}

export type ScoreSortKey = "overallScore" | "confidenceScore" | PillarId;

export interface RankingRow {
  id: string;
  name: string;
  layer: TrackedVendor["layer"];
  category: string;
  marketPosition: string;
  isPublic: boolean;
  ticker: string | null;
  overallScore: number;
  confidenceScore: number;
  pillars: Record<PillarId, PillarCell>;
}

// Column labels are the dataset's real field names on purpose: the rankings
// table shows exactly which named score it is sorting on, nothing renamed.
export const SCORE_COLUMNS: { key: ScoreSortKey; help: string }[] = [
  {
    key: "overallScore",
    help: "AG's own overall score for the vendor, from the AI Enterprise intelligence seed (0 to 100).",
  },
  ...PILLARS.map((p) => ({
    key: p.id as ScoreSortKey,
    help: `${p.label}: the capabilityScore for this pillar from VENDOR_PILLAR_SCORES, with its evidence grade.`,
  })),
];

const INTEL_BY_ID = new Map(INTELLIGENCE_VENDORS.map((v) => [v.id, v]));

const PILLAR_ROWS_BY_VENDOR = new Map<string, VendorPillarScore[]>();
for (const row of VENDOR_PILLAR_SCORES) {
  const list = PILLAR_ROWS_BY_VENDOR.get(row.vendorId) ?? [];
  list.push(row);
  PILLAR_ROWS_BY_VENDOR.set(row.vendorId, list);
}

export function buildRankingRows(): RankingRow[] {
  return TRACKED_VENDORS.flatMap((vendor) => {
    const intel = INTEL_BY_ID.get(vendor.id);
    if (!intel) return [];
    const pillarRows = PILLAR_ROWS_BY_VENDOR.get(vendor.id) ?? [];
    const pillars = Object.fromEntries(
      pillarRows.map((p) => [
        p.pillar,
        {
          score: p.capabilityScore,
          grade: p.evidenceGrade,
          confidence: p.confidence,
        },
      ])
    ) as Record<PillarId, PillarCell>;
    return [
      {
        id: vendor.id,
        name: intel.name,
        layer: vendor.layer,
        category: intel.category,
        marketPosition: intel.marketPosition,
        isPublic: vendor.isPublic,
        ticker: vendor.ticker,
        overallScore: intel.overallScore,
        confidenceScore: intel.confidenceScore,
        pillars,
      },
    ];
  });
}

// Dataset refresh stamp, taken from the seed's own lastUpdated field.
export function datasetDate(): string {
  const iso = INTELLIGENCE_VENDORS[0]?.lastUpdated;
  if (!iso) return "unknown";
  return new Date(iso).toLocaleDateString("en-GB", {
    day: "numeric",
    month: "long",
    year: "numeric",
  });
}

// ---------- Profile assembly ----------

// The AIE sub-datasets key vendors three different ways: the intelligence
// spine uses plain ids ("microsoft"), the exposure map uses tickers for
// public companies ("MSFT") plus a few renamed private ids, and the model
// inventory uses lowercase ticker-ish ids ("msft"). These alias tables map
// the tracked-roster id onto each dataset without renaming anything at the
// source.

const EXPOSURE_ALIASES: Record<string, string[]> = {
  microsoft: ["MSFT"],
  aws: ["AMZN"],
  google: ["GOOGL", "deepmind"],
  nvidia: ["NVDA", "nemotron"],
  oracle: ["ORCL"],
  salesforce: ["CRM"],
  snowflake: ["SNOW"],
  amd: ["AMD"],
  tsmc: ["TSM"],
  coreweave: ["CRWV"],
  together: ["togetherai"],
  cohere: ["cohere", "aleph"],
  g42: ["g42", "falcon"],
};

const MODEL_ALIASES: Record<string, string[]> = {
  microsoft: ["msft"],
  aws: ["amzn"],
  google: ["googl"],
  oracle: ["orcl"],
  servicenow: ["now"],
  salesforce: ["crm"],
  snowflake: ["snow"],
  nvidia: ["nvda"],
  cohere: ["cohere", "aleph"],
};

function exposureIdsFor(vendorId: string): string[] {
  return EXPOSURE_ALIASES[vendorId] ?? [vendorId];
}

function modelOwnerIdsFor(vendorId: string): string[] {
  return MODEL_ALIASES[vendorId] ?? [vendorId];
}

const NODE_BY_ID = new Map(EXPOSURE_NODES.map((n) => [n.id, n]));

// Reverse map: exposure node id -> tracked vendor id, for cross-linking
// counterparties back to their own profile pages.
const VENDOR_BY_NODE_ID = new Map<string, string>();
for (const vendor of TRACKED_VENDORS) {
  for (const nodeId of exposureIdsFor(vendor.id)) {
    if (NODE_BY_ID.has(nodeId)) VENDOR_BY_NODE_ID.set(nodeId, vendor.id);
  }
}

export interface DependencyEdgeItem {
  edge: ExposureMapEdge;
  sourceLabel: string;
  targetLabel: string;
  counterpartVendorId: string | null;
}

export interface CapabilityItem {
  row: VendorCapability;
  name: string;
  description: string;
}

export interface VendorProfile {
  vendor: TrackedVendor;
  intel: IntelligenceVendor;
  pillarScores: VendorPillarScore[];
  capabilities: CapabilityItem[];
  edges: DependencyEdgeItem[];
  models: CommercialModel[];
  infrastructureOnly: boolean;
  reputation: {
    developer: DeveloperReputation | undefined;
    employee: EmployeeReputation | undefined;
    customer: CustomerReputation | undefined;
  };
  sources: SourceManifestEntry[];
}

const CAPABILITY_META = new Map(CAPABILITIES.map((c) => [c.id, c]));

const CONFIDENCE_ORDER: Record<string, number> = { high: 0, medium: 1, seed: 2 };

export function getVendorProfile(id: string): VendorProfile | null {
  const vendor = TRACKED_VENDORS.find((v) => v.id === id);
  const intel = INTEL_BY_ID.get(id);
  if (!vendor || !intel) return null;

  // Capability matrix keys vendors as "vendor_<id>".
  const capabilities: CapabilityItem[] = VENDOR_CAPABILITIES.filter(
    (c) => c.vendorId === `vendor_${id}`
  ).map((row) => {
    const meta = CAPABILITY_META.get(row.capabilityId);
    return {
      row,
      name: meta?.name ?? row.capabilityId,
      description: meta?.description ?? "",
    };
  });

  const exposureIds = new Set(exposureIdsFor(id));
  const edges: DependencyEdgeItem[] = EXPOSURE_EDGES.filter(
    (e) => exposureIds.has(e.sourceId) || exposureIds.has(e.targetId)
  )
    .map((edge) => {
      const counterpartNodeId = exposureIds.has(edge.sourceId)
        ? edge.targetId
        : edge.sourceId;
      const counterpartVendorId =
        VENDOR_BY_NODE_ID.get(counterpartNodeId) ?? null;
      return {
        edge,
        sourceLabel: NODE_BY_ID.get(edge.sourceId)?.label ?? edge.sourceId,
        targetLabel: NODE_BY_ID.get(edge.targetId)?.label ?? edge.targetId,
        counterpartVendorId:
          counterpartVendorId === id ? null : counterpartVendorId,
      };
    })
    .sort(
      (a, b) =>
        (CONFIDENCE_ORDER[a.edge.confidence] ?? 3) -
          (CONFIDENCE_ORDER[b.edge.confidence] ?? 3) ||
        b.edge.strengthScore - a.edge.strengthScore
    );

  const ownerIds = new Set(modelOwnerIdsFor(id));
  const models = SEED_MODELS.filter((m) => ownerIds.has(m.ownerVendorId)).sort(
    (a, b) =>
      (a.ownershipType === "first_party" ? 0 : 1) -
        (b.ownershipType === "first_party" ? 0 : 1) ||
      a.modelName.localeCompare(b.modelName)
  );

  const infrastructureOnly = INFRASTRUCTURE_ONLY_VENDOR_IDS.some((infraId) =>
    ownerIds.has(infraId)
  );

  return {
    vendor,
    intel,
    pillarScores: PILLAR_ROWS_BY_VENDOR.get(id) ?? [],
    capabilities,
    edges,
    models,
    infrastructureOnly,
    reputation: {
      developer: REPUTATION_INDEX.developer.get(id),
      employee: REPUTATION_INDEX.employee.get(id),
      customer: REPUTATION_INDEX.customer.get(id),
    },
    // Sourcing manifest keys vendors as "vendor_<id>".
    sources: manifestForVendor(`vendor_${id}`),
  };
}
