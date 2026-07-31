// Provenance envelope, passed through untouched from the BoardRadar API
// (spec rule 4). Sample fixtures reuse the same envelope with
// sourceBasis: "sample". AIE dataset content carries its native labels.

export type SourceBasis =
  | "disclosed"
  | "estimated"
  | "inferred"
  | "unavailable"
  | "sample";

export type Confidence = "high" | "medium" | "low" | null;

export interface ProvenanceEnvelope {
  sourceBasis: SourceBasis;
  confidence?: Confidence;
  sourceUrl?: string | null;
  sourceNote?: string | null;
}

export interface ProvenancedValue<T = number> extends ProvenanceEnvelope {
  value: T | null;
}

// Data lane of a whole module or card (spec Section 4, extended 30 July
// 2026 with the aie-live lane: current content pulled from the deployed
// AI Enterprise app's public APIs through our own proxy).
// "derived" is its own lane on purpose. It is not live, because no source
// publishes it, and it is not sample, because nothing about it is invented: it
// is computed by us from named inputs that can be re-fetched and checked. The
// existing lanes would have forced it into a badge that lied in one direction
// or the other.
export type DataLane =
  | "live"
  | "aie"
  | "aie-live"
  | "derived"
  | "sample"
  | "mock"
  | "stub";

export const LANE_LABEL: Record<DataLane, string> = {
  live: "LIVE",
  aie: "AIE dataset",
  "aie-live": "AIE live",
  derived: "DERIVED",
  sample: "SAMPLE",
  mock: "Cached sample",
  stub: "In development",
};

export function scoreBand(score: number): "good" | "warn" | "bad" {
  if (score >= 70) return "good";
  if (score >= 40) return "warn";
  return "bad";
}
