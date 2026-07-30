import { promises as fs } from "fs";
import path from "path";
import { INTELLIGENCE_VENDORS } from "@/lib/aie";
import type { AieRankingRow, CompetitiveIntelFixture } from "./types";

// Module data adapter: Competitive Intel is SCHEMA lane (the heatmap sample
// fixture mirrors the BoardRadar competitive-intelligence heatmap response
// schema) plus PORT lane (the AIE vendor rankings from the seed dataset).

export async function loadCompetitiveIntelFixture(): Promise<CompetitiveIntelFixture> {
  const file = await fs.readFile(
    path.join(process.cwd(), "fixtures", "sample", "competitive-intel.json"),
    "utf8"
  );
  return JSON.parse(file) as CompetitiveIntelFixture;
}

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
