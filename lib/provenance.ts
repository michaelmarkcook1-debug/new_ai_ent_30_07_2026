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
//
// "cited" was added 5 August 2026 for the Privacy & IP Shield, and for the same
// reason. A Shield mark is a sentence quoted out of a vendor's own published
// terms, carrying the URL it was read from and the date a human read it. That
// is not live, because legal terms have no feed to poll. It is not derived,
// because nothing was computed: the vendor wrote the words. It is not the AIE
// dataset, and calling real quoted terms "sample" would be a lie in the
// direction that matters most. The badge a reader needs here is the one that
// says: this is the vendor's own wording, and here is where to check it.
export type DataLane =
  | "live"
  | "aie"
  | "aie-live"
  | "cited"
  | "derived"
  | "sample"
  | "mock"
  | "stub";

export const LANE_LABEL: Record<DataLane, string> = {
  live: "LIVE",
  aie: "AIE dataset",
  "aie-live": "AIE live",
  cited: "CITED",
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
