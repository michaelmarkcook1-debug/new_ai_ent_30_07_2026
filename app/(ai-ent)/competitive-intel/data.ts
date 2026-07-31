import { INTELLIGENCE_VENDORS } from "@/lib/aie";
import type { AieRankingRow } from "./types";

// Module data adapter. The heatmap is fetched live from the BoardRadar
// competitive-intelligence endpoint by the client component; this adapter
// only supplies the AIE vendor rankings from the ported seed dataset.

// AIE dataset ranking rows: the seed roster's overall scores with their
// native confidence labels, investors excluded, top of the set first.
const INVESTOR_CATEGORY = "AI investor";
const RANKING_SIZE = 12;

export function aieVendorRankings(): AieRankingRow[] {
  return INTELLIGENCE_VENDORS.filter((v) => v.category !== INVESTOR_CATEGORY)
    .map((v) => ({
      id: v.id,
      name: v.name,
      category: v.category,
      overallScore: v.overallScore,
      confidenceScore: v.confidenceScore,
      marketPosition: v.marketPosition,
    }))
    .sort((a, b) => b.overallScore - a.overallScore)
    .slice(0, RANKING_SIZE);
}
