import { NextResponse } from "next/server";
import { INTELLIGENCE_VENDORS, MARKET_CATEGORIES } from "@/lib/aie";
import { TRACKED_VENDORS } from "@/lib/aie/vendors";

// Temporary introspection route used while reworking the ranking taxonomy.
// Delete once the within-category ranking rule is in place.
export async function GET() {
  const byCategory: Record<string, string[]> = {};
  for (const v of INTELLIGENCE_VENDORS) {
    (byCategory[v.category] ??= []).push(v.id);
  }
  const tracked = new Set(TRACKED_VENDORS.map((v) => v.id));
  return NextResponse.json({
    categories: MARKET_CATEGORIES.map((c) => ({ id: c.id, name: c.name })),
    counts: Object.fromEntries(
      Object.entries(byCategory).map(([k, v]) => [k, v.length])
    ),
    trackedPerCategory: Object.fromEntries(
      Object.entries(byCategory).map(([k, v]) => [
        k,
        v.filter((id) => tracked.has(id)).length,
      ])
    ),
    sample: Object.fromEntries(
      Object.entries(byCategory).map(([k, v]) => [k, v.slice(0, 6)])
    ),
  });
}
