import { NextRequest, NextResponse } from "next/server";
import { mkdirSync, writeFileSync } from "node:fs";
import path from "node:path";
import { validate, type Resolution } from "@/lib/dataops/validate";
import { plan, apply } from "@/lib/dataops/ingest";
import { runDerivedArtefacts } from "@/lib/dataops/derived";
import type { Discovery } from "@/lib/dataops/discover";
import { AIE_UPSTREAM, ENDPOINT_OF, STAYS_BEHIND, matchesReviewed, type CanonicalFile } from "@/lib/dataops/sources";
import { FsStore } from "@/lib/dataops/store";

// POST /api/admin/dataops/ingest  { discovery, resolutions, approvedIds }
//
// THE MUTATION BOUNDARY. Re-validates on the server (a client's levels are
// never trusted), keeps only approved READY or WARNING records, and refuses
// outright with 409 when the store is read-only, which it is on Vercel and on
// any checkout without DATAOPS_WRITE=1. Writes every affected file or none,
// regenerates the derived artefacts, reverts if one fails, and records the
// audit under reports/dataops/. Calls no model.

export const maxDuration = 300;

export async function POST(request: NextRequest) {
  const body = (await request.json().catch(() => null)) as { discovery?: Discovery & { payloads?: Partial<Record<CanonicalFile, unknown>>; payloadHashes?: Partial<Record<CanonicalFile, string>> }; resolutions?: Resolution[]; approvedIds?: string[] } | null;
  if (!body?.discovery) return NextResponse.json({ error: "a discovery is required" }, { status: 400 });
  const store = new FsStore();
  if (!store.writable()) {
    return NextResponse.json({ status: "REFUSED", error: `canonical store is read-only: ${store.reason()}`, ingested: 0 }, { status: 409 });
  }
  const rankingsText = await store.read("category-rankings.json");
  const validation = validate(body.discovery, body.resolutions ?? [], { canonicalRankings: rankingsText ? JSON.parse(rankingsText) : null });
  const planned = plan(validation, body.approvedIds ?? []);
  // Payloads that stayed behind are fetched again now, and only accepted if
  // they still say what was reviewed. The upstream moving between review and
  // ingest is a reason to review again, never a reason to ingest the unseen.
  body.discovery.payloads = { ...(body.discovery.payloads ?? {}) };
  for (const r of planned.approved) {
    const file = r.change?.file;
    if (!file || !STAYS_BEHIND.has(file) || body.discovery.payloads[file] !== undefined) continue;
    let fetched: unknown = null;
    try {
      const res = await fetch(`${AIE_UPSTREAM}/${ENDPOINT_OF[file]}`, { headers: { accept: "application/json" }, cache: "no-store", signal: AbortSignal.timeout(20_000) });
      if (res.ok) fetched = await res.json();
    } catch {
      fetched = null;
    }
    if (!matchesReviewed(body.discovery.payloadHashes?.[file], fetched)) {
      return NextResponse.json({ status: "FAILED", ingested: 0, error: `${file}: the upstream no longer says what was reviewed (or did not answer); discover again before ingesting it` }, { status: 409 });
    }
    body.discovery.payloads[file] = fetched;
  }
  const result = await apply(body.discovery, planned, body.resolutions ?? [], store, {
    // On a staging root the derived scripts would read the real fixtures, so
    // the step is reported as skipped rather than pretending it regenerated.
    runDerived: process.env.DATAOPS_ROOT
      ? async () => [{ step: "derived artefacts", ok: true, output: "skipped: DATAOPS_ROOT points at staging data; regenerate after ingesting the real fixtures" }]
      : () => runDerivedArtefacts(process.cwd()),
    auditSink: async (audit) => {
      // Under the staging root when rehearsing, so a rehearsal leaves nothing in the repository.
      const dir = process.env.DATAOPS_ROOT ? path.join(process.env.DATAOPS_ROOT, "dataops-audit") : path.join(process.cwd(), "reports", "dataops");
      mkdirSync(dir, { recursive: true });
      writeFileSync(path.join(dir, `${audit.ingestedAt.replace(/[:.]/g, "-")}.json`), `${JSON.stringify(audit, null, 2)}\n`);
    },
  });
  return NextResponse.json(result, { status: result.status === "FAILED" ? 500 : 200 });
}
