// Module data adapter: Vendor View is PORT lane (AIE dataset). Every value
// on this surface is real AI Enterprise seed content re-used from the
// ranking-engine repository, joined onto the tracked vendor roster. No
// BoardRadar calls, no sample fixtures, nothing invented.

import { TRACKED_VENDORS, type TrackedVendor } from "@/lib/aie/vendors";
import { categoryRankings } from "@/lib/aie/category-rankings";
import {
  INTELLIGENCE_VENDORS,
  VENDOR_PILLAR_SCORES,
} from "@/lib/aie/intelligence/seed";
import type {
  Vendor as IntelligenceVendor,
  VendorPillarScore,
  VendorCapability,
} from "@/lib/aie/intelligence/types";
import {
  canonicalVendorId,
  liveCapabilities,
  liveVendorCapabilities,
  liveVendors,
  liveVendorsAsOf,
  type LiveVendor,
} from "@/lib/aie/live-vendors";
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

export interface CapabilityCell {
  score: number | null;
  grade: string | null;
  status: string | null;
  lastVerified: string | null;
}

export type ScoreSortKey = "overallScore" | "confidenceScore" | string;

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
  capabilities: Record<string, CapabilityCell>;
  /**
   * The assessment, per market, which is the product's only vendor rating.
   *
   * Keyed by market because a vendor scores differently in each one it
   * competes in: Anthropic is 3.65 in frontier models and 3.69 as a coding
   * agent. There is no single number to hang on a vendor row, which is why
   * this table sorts inside a market group rather than across the set.
   *
   * `overallScore` stays on the row and is no longer what anything ranks on.
   * It is the engine's other published figure, kept so the derivation can show
   * both, and it is the number this table used to rank by. That was the last
   * surface still doing so after the assessment became the single rating.
   */
  placements: Record<string, { composite: number; rank: number }>;
}

// Column labels are the dataset's real field names on purpose: the rankings
// table shows exactly which named score it is sorting on, nothing renamed.
export const SCORE_COLUMNS: { key: ScoreSortKey; label: string; help: string }[] = [
  {
    key: "assessment",
    label: "Assessment",
    help: "The weighted composite (0 to 5) of evidence-graded assessment domains, weighted for this market. The product's only vendor rating, and what this table ranks on.",
  },
  {
    key: "overallScore",
    label: "Overall score",
    help: "The engine's other published figure: one global 0 to 100 formula over every vendor. Shown for reference and NOT what this table ranks on. This table sorted by it until 17 August 2026, which left it naming different leaders from the rest of the product.",
  },
  ...liveCapabilities().map((c) => ({
    key: c.id as ScoreSortKey,
    label: c.name,
    help: `The maturityScore the source publishes for this capability, with its evidence grade and the date it was last verified.`,
  })),
];

const LIVE_BY_ID = new Map(liveVendors().map((v) => [v.id, v]));

/** Every market this vendor is ranked in, with its assessment in each. */
function placementsFor(vendorId: string): Record<string, { composite: number; rank: number }> {
  const out: Record<string, { composite: number; rank: number }> = {};
  for (const c of categoryRankings()) {
    const r = c.ranked.find((x) => x.vendorId === vendorId);
    if (r) out[c.categoryId] = { composite: r.composite, rank: r.rank };
  }
  return out;
}

// The capability breakdown replaces the pillar scores.
//
// Pillars were a construct of the July port: upstream publishes no such
// scores, so the six numbers under every vendor were computed by the seed and
// then frozen. The live source does publish a capability breakdown, ten
// scores per vendor with an evidence grade and a verification date on each,
// and those are the figures the ranking engine itself shows.
export function buildRankingRows(): RankingRow[] {
  return TRACKED_VENDORS.flatMap((vendor) => {
    const live = LIVE_BY_ID.get(canonicalVendorId(vendor.id));
    // A vendor the live source has dropped is dropped here too, rather than
    // falling back to a July figure that would look current.
    if (!live || live.overallScore === null) return [];
    const caps = Object.fromEntries(
      liveVendorCapabilities(vendor.id).map((c) => [
        c.capabilityId,
        {
          score: c.maturityScore,
          grade: c.evidenceGrade,
          status: c.status,
          lastVerified: c.lastVerified,
        },
      ])
    ) as Record<string, CapabilityCell>;
    return [
      {
        id: vendor.id,
        name: live.name,
        layer: vendor.layer,
        category: live.category ?? "not stated",
        marketPosition: live.marketPosition ?? "not stated",
        isPublic: vendor.isPublic,
        ticker: vendor.ticker,
        overallScore: live.overallScore,
        confidenceScore: live.confidenceScore ?? 0,
        capabilities: caps,
        placements: placementsFor(vendor.id),
      },
    ];
  });
}

// Dataset refresh stamp, taken from the seed's own lastUpdated field.
export function datasetDate(): string {
  const iso = liveVendorsAsOf() ?? liveVendors()[0]?.lastUpdated;
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
  intel: LiveVendor;
  liveCapabilities: ReturnType<typeof liveVendorCapabilities>;
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
  const intel = LIVE_BY_ID.get(canonicalVendorId(id));
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
    liveCapabilities: liveVendorCapabilities(id),
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
