import { NextResponse } from "next/server";
import { discover } from "@/lib/dataops/discover";
import { AIE_UPSTREAM, CANONICAL_FILES, meaningfulHash, payloadsForTransit, type CanonicalFile } from "@/lib/dataops/sources";
import { FsStore } from "@/lib/dataops/store";
import { SEED_CATEGORIES } from "@/lib/dataops/taxonomy";

// POST /api/admin/dataops/discover
//
// Fetches every canonical endpoint from the upstream and sets it against the
// canonical files. Reads the store; never writes it. Returns the staged
// discovery, including the discovered payloads, so review, validation and
// ingestion can run on exactly what was seen rather than on a second fetch.
// A fallback is not a discovery: this goes to the upstream directly, and an
// endpoint that does not answer is reported as failed.

export const maxDuration = 120;

async function fetchJson(endpoint: string): Promise<unknown | null> {
  for (const timeout of [10_000, 15_000]) {
    try {
      const res = await fetch(`${AIE_UPSTREAM}/${endpoint}`, { headers: { accept: "application/json" }, cache: "no-store", signal: AbortSignal.timeout(timeout) });
      if (res.ok) return (await res.json()) as unknown;
      if (res.status < 500) return null;
    } catch {
      // retried once with the longer ceiling
    }
  }
  return null;
}

export async function POST() {
  const store = new FsStore();
  const payloads: Partial<Record<CanonicalFile, unknown>> = {};
  const payloadHashes: Partial<Record<CanonicalFile, string>> = {};
  const seen = new Map<string, unknown | null>();
  const remembering = async (endpoint: string) => {
    const data = await fetchJson(endpoint);
    seen.set(endpoint, data);
    return data;
  };
  const discovery = await discover(store, remembering);
  for (const file of CANONICAL_FILES) {
    const f = discovery.files.find((x) => x.file === file);
    const data = seen.get(f?.endpoint ?? "");
    if (data && f && (f.status === "new-capture" || f.status === "unchanged")) {
      payloads[file] = data;
      payloadHashes[file] = meaningfulHash(data);
    }
  }
  const rosterText = await store.read("vendors.json");
  const roster = ((rosterText ? (JSON.parse(rosterText) as { vendors?: { id: string; name: string }[] }).vendors : []) ?? []).map((v) => ({ id: v.id, name: v.name }));
  return NextResponse.json({
    ...discovery,
    // news.json stays behind (STAYS_BEHIND); ingest fetches it again and checks the hash.
    payloads: payloadsForTransit(payloads),
    payloadHashes,
    // The client's selects offer exactly these and nothing else.
    taxonomy: SEED_CATEGORIES,
    roster,
    store: { writable: store.writable(), reason: store.reason(), root: store.root, staging: Boolean(process.env.DATAOPS_ROOT) },
  });
}
