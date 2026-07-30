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

// Data lane of a whole module or card (spec Section 4).
export type DataLane = "live" | "aie" | "sample" | "mock" | "stub";

export const LANE_LABEL: Record<DataLane, string> = {
  live: "LIVE",
  aie: "AIE dataset",
  sample: "SAMPLE",
  mock: "Cached sample",
  stub: "In development",
};

export function scoreBand(score: number): "good" | "warn" | "bad" {
  if (score >= 70) return "good";
  if (score >= 40) return "warn";
  return "bad";
}
