import { NextRequest, NextResponse } from "next/server";
import { validate, type Resolution } from "@/lib/dataops/validate";
import type { Discovery } from "@/lib/dataops/discover";
import { FsStore } from "@/lib/dataops/store";

// POST /api/admin/dataops/validate  { discovery, resolutions }
// Deterministic; reads the canonical rankings for the population check; writes nothing.

export async function POST(request: NextRequest) {
  const body = (await request.json().catch(() => null)) as { discovery?: Discovery; resolutions?: Resolution[] } | null;
  if (!body?.discovery) return NextResponse.json({ error: "a discovery is required" }, { status: 400 });
  const store = new FsStore();
  const rankingsText = await store.read("category-rankings.json");
  const validation = validate(body.discovery, body.resolutions ?? [], { canonicalRankings: rankingsText ? JSON.parse(rankingsText) : null });
  return NextResponse.json(validation);
}
