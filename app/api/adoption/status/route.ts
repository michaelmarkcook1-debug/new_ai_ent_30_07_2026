import { NextResponse } from "next/server";
import { promises as fs } from "fs";
import path from "path";
import { edgarHealth } from "@/lib/adoption/edgar";
import { federalRegisterHealth } from "@/lib/adoption/federal-register";
import { ADOPTION_SOURCES, TRACKED_VENDORS } from "@/lib/adoption/sources";

// GET /api/adoption/status
//
// What the adoption layer is made of and whether it can currently run.
// Modelled on the ranking engine's /api/data-sources/status, and kept for the
// same reason: an operator should be able to answer "is this live, and if not
// why not" without reading code.
//
// Every source declares what it measures AND what it cannot support, because
// the second is the half that stops a figure being over-read.

export async function GET() {
  const connectors = [edgarHealth(), federalRegisterHealth()];

  let snapshot: { fetchedAt?: string; vendors?: number } | null = null;
  try {
    const raw = await fs.readFile(
      path.join(process.cwd(), "data", "adoption", "disclosure-10-K.json"),
      "utf8"
    );
    const parsed = JSON.parse(raw);
    snapshot = { fetchedAt: parsed.fetchedAt, vendors: parsed.rows?.length };
  } catch {
    snapshot = null;
  }

  return NextResponse.json(
    {
      firstParty: true,
      note:
        "These endpoints own their data. They do not proxy the ranking engine, whose /api/uptake serves a static May 2026 model.",
      connectors: connectors.map((c) => ({
        id: c.id,
        label: c.label,
        status: c.status,
        configured: c.configured,
        message: c.message,
        evidenceClass: c.source.evidenceClass,
        measures: c.source.measures,
        cannotSupport: c.source.cannotSupport,
        licence: c.source.licence,
        apiDocs: c.source.apiDocs,
      })),
      sources: ADOPTION_SOURCES.length,
      trackedVendors: TRACKED_VENDORS.map((v) => v.vendor),
      committedSnapshot: snapshot,
      mockMode: process.env.MOCK_MODE === "true",
    },
    { headers: { "x-eai-source": "live" } }
  );
}
