import { VENDOR_DIRECTORY } from "@/lib/aie/vendor-directory";
import { aieServerFetch, type AieLane } from "@/lib/aie-server";
import type { AieRankingRow } from "./types";

// Module data adapter. The heatmap is fetched live from the BoardRadar
// competitive-intelligence endpoint by the client component; this adapter
// supplies the AIE rankings, fetched live from the ranking engine with the
// generated directory as the fallback.

// AIE dataset ranking rows: the seed roster's overall scores with their
// native confidence labels, investors excluded, top of the set first.
const INVESTOR_CATEGORY = "AI investor";
const RANKING_SIZE = 12;

interface RawVendor {
  id: string;
  name: string;
  category?: string | null;
  overallScore?: number | null;
  confidenceScore?: number | null;
  marketPosition?: string | null;
}

function toRows(vendors: RawVendor[]): AieRankingRow[] {
  return vendors
    .filter(
      (v) =>
        v.category !== INVESTOR_CATEGORY &&
        typeof v.overallScore === "number"
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

// Ranked on the scores the source publishes. This used to rank on the 8 July
// port, which scored every vendor higher and by different amounts, so both the
// numbers and the order of this table were wrong.
//
// Fetched at render rather than read from the generated directory, so the
// panel can honestly call itself live. The lane it returns is the truth of
// what happened on this render: "aie-live" when the ranking engine answered,
// "aie" when it did not and the dated directory stood in. The badge and the
// pulse both key off that, so neither can claim a freshness that did not
// occur.
export async function aieVendorRankings(): Promise<{
  rows: AieRankingRow[];
  lane: AieLane;
}> {
  const res = await aieServerFetch<{ vendors: RawVendor[] }>("vendors");
  const live = res.data?.vendors;
  if (res.lane === "aie-live" && Array.isArray(live) && live.length > 0) {
    return { rows: toRows(live), lane: "aie-live" };
  }
  return { rows: toRows(VENDOR_DIRECTORY as RawVendor[]), lane: "aie" };
}
