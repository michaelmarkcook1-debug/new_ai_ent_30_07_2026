import { VENDOR_DIRECTORY } from "@/lib/aie/vendor-directory";
import type { AieRankingRow } from "./types";

// Module data adapter. The heatmap is fetched live from the BoardRadar
// competitive-intelligence endpoint by the client component; this adapter
// only supplies the AIE vendor rankings from the ported seed dataset.

// AIE dataset ranking rows: the seed roster's overall scores with their
// native confidence labels, investors excluded, top of the set first.
const INVESTOR_CATEGORY = "AI investor";
const RANKING_SIZE = 12;

// Ranked on the scores the source publishes. This used to rank on the 8 July
// port, which scored every vendor higher and by different amounts, so both the
// numbers and the order of this table were wrong.
export function aieVendorRankings(): AieRankingRow[] {
  return VENDOR_DIRECTORY.filter(
    (v) => v.category !== INVESTOR_CATEGORY && v.overallScore !== null
  )
    .map((v) => ({
      id: v.id,
      name: v.name,
      category: v.category ?? "not stated",
      overallScore: v.overallScore as number,
      confidenceScore: v.confidenceScore ?? 0,
      marketPosition: v.marketPosition ?? "not stated",
    }))
    .sort((a, b) => b.overallScore - a.overallScore)
    .slice(0, RANKING_SIZE);
}
