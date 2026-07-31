import { VENDOR_RULINGS, type RegulatoryRow, type VendorRuling } from "@/lib/regulatory";
import type { TrackedVendor } from "@/lib/aie";
import type { ProvenanceEnvelope } from "@/lib/provenance";

// Pure types and mapping helpers shared by the server adapter (data.ts) and
// the client components. This file must stay free of Node-only imports so it
// can be bundled client-side.

export type VendorLayer = TrackedVendor["layer"];

export const LAYER_LABEL: Record<VendorLayer, string> = {
  frontier: "Frontier lab",
  hyperscaler: "Hyperscaler",
  enterprise: "Enterprise platform",
  application: "Application layer",
  infrastructure: "Infrastructure",
};

export interface LensVendor {
  id: string;
  name: string;
  layer: VendorLayer;
  brTicker: string | null;
}

export interface GridRowView extends RegulatoryRow {
  // Vendor layers this jurisdiction row bears on. This is a deliberately
  // simple analyst-judged mapping, explained in the derivation drawer.
  layers: VendorLayer[];
}

// Ruling-to-layer mapping, kept simple and honest: frontier labs inherit the
// EU general-purpose AI obligations ruling; infrastructure inherits the chip
// export controls ruling; other layers have no vendor-specific ruling in the
// tracked material (the jurisdiction grid still applies to them).
const FRONTIER_RULING_ITEM = "EU general-purpose AI obligations";
const INFRA_RULING_ITEM = "Advanced compute restrictions";

export function rulingsForLayer(layer: VendorLayer): VendorRuling[] {
  if (layer === "frontier") {
    return VENDOR_RULINGS.filter((r) => r.item === FRONTIER_RULING_ITEM);
  }
  if (layer === "infrastructure") {
    return VENDOR_RULINGS.filter((r) => r.item === INFRA_RULING_ITEM);
  }
  return [];
}

export interface RegEventView {
  id: string;
  eventType: string;
  jurisdiction: string;
  effectiveDate: string | null;
  affectedVendorIds: string[];
  impacts: Record<string, number>;
  uncertaintyNote: string;
  signal: {
    title: string;
    sourceName: string;
    sourceUrl: string | null;
    sourceDate: string;
    evidenceGrade: string;
    confidenceScore: number;
    dataStatus: string;
  } | null;
}

const EVENT_TYPE_LABEL: Record<string, string> = {
  ai_regulation: "AI regulation",
  chip_export_control: "Chip export control",
};

export function eventTypeLabel(eventType: string): string {
  return EVENT_TYPE_LABEL[eventType] ?? eventType;
}

