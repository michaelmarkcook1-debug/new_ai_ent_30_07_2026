import { promises as fs } from "fs";
import path from "path";
import { REGULATORY_GRID } from "@/lib/regulatory";
import { SEED_REGULATORY_EVENTS, SEED_SIGNALS, TRACKED_VENDORS } from "@/lib/aie";
import type {
  GridRowView,
  LensVendor,
  RegEventView,
  TrustRankFixture,
  VendorLayer,
} from "./lens";

// Module data adapter (server only): Trust Rank vendor view is PORT lane
// (regulatory grid rows and rulings flagged aieSource, plus the AIE
// market-signals regulatory events with their native confidence labels) and
// SCHEMA lane (the remaining grid rows and the governance-posture pattern
// block, badged SAMPLE). Pure types and lens helpers live in ./lens.ts so
// client components never import this fs-dependent module.

const ALL_LAYERS: VendorLayer[] = [
  "frontier",
  "hyperscaler",
  "enterprise",
  "application",
  "infrastructure",
];

// Jurisdiction-to-layer relevance. Horizontal regimes bear on every layer;
// narrower statutes are mapped to the layers their duties actually touch.
const ROW_LAYERS: Record<string, VendorLayer[]> = {
  "European Union": ALL_LAYERS,
  "United Kingdom": ALL_LAYERS,
  "United States (federal)": ALL_LAYERS,
  California: ["frontier"],
  Colorado: ["application", "enterprise"],
  Texas: ["application", "enterprise"],
  "New York": ["application", "enterprise"],
  Germany: ["hyperscaler", "enterprise", "application"],
  France: ["hyperscaler", "enterprise", "application"],
  India: ALL_LAYERS,
};

export function loadGrid(): GridRowView[] {
  return REGULATORY_GRID.map((row) => ({
    ...row,
    layers: ROW_LAYERS[row.jurisdiction] ?? ALL_LAYERS,
  }));
}

export function loadLensVendors(): LensVendor[] {
  return TRACKED_VENDORS.map((v) => ({
    id: v.id,
    name: v.name,
    layer: v.layer,
    brTicker: v.brTicker,
  })).sort((a, b) => a.name.localeCompare(b.name));
}

// Regulatory events from the AIE market-signals seed, joined to their source
// signal so the native evidence grade, confidence and data status stay
// visible next to the event.
export function loadRegEvents(): RegEventView[] {
  return SEED_REGULATORY_EVENTS.map((e) => {
    const signal = SEED_SIGNALS.find((s) => s.id === e.signalId) ?? null;
    return {
      id: e.id,
      eventType: e.eventType,
      jurisdiction: e.jurisdiction,
      effectiveDate: e.effectiveDate ?? null,
      affectedVendorIds: [...e.affectedVendorIds],
      impacts: { ...e.impacts },
      uncertaintyNote: e.uncertaintyNote,
      signal: signal
        ? {
            title: signal.title,
            sourceName: signal.sourceName,
            sourceUrl: signal.sourceUrl ?? null,
            sourceDate: signal.sourceDate,
            evidenceGrade: signal.evidenceGrade,
            confidenceScore: signal.confidenceScore,
            dataStatus: signal.dataStatus,
          }
        : null,
    };
  });
}

export async function loadTrustRankFixture(): Promise<TrustRankFixture> {
  const file = await fs.readFile(
    path.join(process.cwd(), "fixtures", "sample", "trust-rank.json"),
    "utf8"
  );
  return JSON.parse(file) as TrustRankFixture;
}
