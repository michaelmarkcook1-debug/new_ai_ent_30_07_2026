import { promises as fs } from "fs";
import path from "path";

// Reads the compiled narrative-versus-reality gap.
//
// Written by scripts/narrative-reality-gap.mjs, which is where the method and
// its limits are documented. Recompiled by re-running that script, not by
// editing this file or the fixture by hand.

export interface GapVendor {
  vendorId: string;
  name: string;
  category: string;
  marketPosition: string | null;

  /** Percentile of narrative attention within the tracked set, or null. */
  narrativeScore: number | null;
  /** Percentile of evidence-weighted capability within the same set. */
  realityScore: number | null;
  /** narrativeScore minus realityScore, null when either side is missing. */
  gap: number | null;
  direction: string;
  /** Which narrative sources cleared the threshold for this vendor. */
  narrativeSources: string[];

  /** Raw evidence-weighted maturity, before percentile ranking. */
  reality: number | null;
  realityRows: number;
  realityWeakestEvidence: string | null;

  domain: string | null;
  hn: { stories: number; points: number; comments: number } | null;
  aieNews: { items: number; positive: number; negative: number };
}

export interface NarrativeGap {
  generatedAt: string;
  windowDays: number;
  vendorCount: number;
  measuredCount: number;
  method: {
    reality: string;
    narrative: string;
    gap: string;
    threshold: string;
    bias: string;
  };
  sources: string[];
  vendors: GapVendor[];
}

let cached: NarrativeGap | null = null;

export async function loadNarrativeGap(): Promise<NarrativeGap | null> {
  if (cached) return cached;
  try {
    const file = path.join(
      process.cwd(),
      "fixtures",
      "narrative-reality-gap.json"
    );
    const raw = await fs.readFile(file, "utf8");
    cached = JSON.parse(raw) as NarrativeGap;
    return cached;
  } catch {
    // Missing or unreadable means the page shows the vendor's own figures
    // instead. It never means showing a gap that was not compiled.
    return null;
  }
}

export function gapFor(
  gap: NarrativeGap | null,
  vendorId: string
): GapVendor | null {
  if (!gap) return null;
  const v = gap.vendors.find((x) => x.vendorId === vendorId);
  return v && v.gap !== null ? v : null;
}
