import { describe, it, expect } from "vitest";
import { readFileSync, readdirSync } from "node:fs";
import path from "node:path";
import { MemoryStore } from "@/lib/dataops/store";
import { discover, type Discovery } from "@/lib/dataops/discover";
import { validate, type Resolution } from "@/lib/dataops/validate";
import { plan, apply } from "@/lib/dataops/ingest";
import { evidenceVersion } from "@/lib/dataops/evidence";
import { matchExisting, aliasesOf } from "@/lib/dataops/entities";
import { suggestCategory, SEED_CATEGORIES } from "@/lib/dataops/taxonomy";
import { meaningfulHash, AIE_UPSTREAM } from "@/lib/dataops/sources";

// Manual discovery, categorisation and ingestion, 6 September 2026.
//
// Everything runs against an in-memory canonical store and a fake upstream,
// so each property below is a fact about the code and not about the network.
// The shapes are the real fixtures' shapes, cut down to a handful of rows.

const T0 = Date.parse("2026-09-06T12:00:00.000Z");
const CANON_DATE = "2026-09-01T00:00:00.000Z";
const NEW_DATE = "2026-09-06T04:30:00.000Z";

const canonical = () => ({
  "vendors.json": JSON.stringify({ asOf: CANON_DATE, vendors: [
    { id: "anthropic", name: "Anthropic", slug: "anthropic", category: "Frontier model/API", ownershipType: "private", overallScore: 68.3 },
    { id: "cohere", name: "Cohere (incl. Aleph Alpha)", slug: "cohere", category: "Frontier model/API", ownershipType: "private", overallScore: 55 },
    { id: "aws", name: "AWS", slug: "aws", category: "Cloud AI platform", ownershipType: "public", overallScore: 70 },
  ] }),
  "market-share.json": JSON.stringify({ label: "share", provenance: "AIE", asOf: CANON_DATE, count: 2, estimates: [
    { vendorId: "anthropic", categoryId: "frontier_model_api", estimatedShare: 20.9, confidence: 95, source: "evidence-derived", sourceDate: CANON_DATE },
    { vendorId: "cohere", categoryId: "frontier_model_api", estimatedShare: 4.1, confidence: 70, source: "evidence-derived", sourceDate: CANON_DATE },
  ] }),
  "reputation.json": JSON.stringify({ provenance: "AIE", asOf: CANON_DATE, count: 1, rows: [{ vendorId: "anthropic", customer: { overall: 82 }, developer: { overall: 71.1 }, employee: { overall: 74.4 } }] }),
  "pricing.json": JSON.stringify({ provenance: "AIE", capturedAt: CANON_DATE, asOf: CANON_DATE, count: 1, rows: [{ id: "tp_anthropic_x", vendorId: "anthropic", vendorName: "Anthropic", modelName: "X", inputPerM: 3, outputPerM: 15, sourceUrl: "https://example" }] }),
  "capabilities.json": JSON.stringify({ capabilities: [{ id: "agents" }], vendorCapabilities: [{ vendorId: "anthropic", capabilityId: "agents", status: "verified", maturityScore: 80, lastVerified: CANON_DATE }] }),
  "metadata.json": JSON.stringify({ industries: [], vendors: [{ id: "anthropic" }, { id: "cohere" }, { id: "aws" }] }),
  "uptake.json": JSON.stringify({ provenance: "AIE", count: 1, rows: [{ vendor: "Anthropic", share: 0.2 }] }),
  "news.json": JSON.stringify({ news: [{ id: 1, title: "old" }] }),
  // Three ranked, matching the three the upstream shares list; the population check has its own case below.
  "category-rankings.json": JSON.stringify({ capturedAt: CANON_DATE, categories: [{ categoryId: "frontier_model_api", held: 0, ranked: [{ vendorId: "anthropic" }, { vendorId: "cohere" }, { vendorId: "mistral" }] }] }),
});

/** What the fake upstream serves. */
const upstream: Record<string, unknown> = {
  vendors: { asOf: NEW_DATE, vendors: [
    { id: "anthropic", name: "Anthropic", slug: "anthropic", category: "Frontier model/API", ownershipType: "private", overallScore: 68.3 },
    { id: "cohere", name: "Cohere (incl. Aleph Alpha)", slug: "cohere", category: "Frontier model/API", ownershipType: "private", overallScore: 55 },
    { id: "aws", name: "AWS", slug: "aws", category: "Cloud AI platform", ownershipType: "public", overallScore: 70 },
    { id: "mistral", name: "Mistral AI", slug: "mistral", category: "Frontier model/API", ownershipType: "private", overallScore: 61 },
    { id: "arm", name: "Arm", slug: "arm", category: "AI silicon", ownershipType: "public", overallScore: 50 },
    { id: "aleph-alpha", name: "Aleph Alpha", slug: "aleph-alpha", category: "Frontier model/API", ownershipType: "private", overallScore: 40 },
    { id: "amazon-web-services", name: "Amazon Web Services", slug: "amazon-web-services", category: "Cloud AI platform", ownershipType: "public", overallScore: 70 },
  ] },
  "market-share": { label: "share", provenance: "AIE", asOf: NEW_DATE, count: 4, estimates: [
    { vendorId: "anthropic", categoryId: "frontier_model_api", estimatedShare: 22.4, confidence: 95, source: "evidence-derived", sourceDate: NEW_DATE },
    { vendorId: "cohere", categoryId: "frontier_model_api", estimatedShare: 4.1, confidence: 70, source: "evidence-derived", sourceDate: NEW_DATE },
    { vendorId: "mistral", categoryId: "frontier_model_api", estimatedShare: 6.5, confidence: 60, source: "evidence-derived", sourceDate: NEW_DATE },
    { vendorId: "aws", categoryId: "cloud_ai_platform", estimatedShare: 140, confidence: 50, source: "evidence-derived", sourceDate: NEW_DATE },
  ] },
  reputation: { provenance: "AIE", asOf: NEW_DATE, count: 1, rows: [{ vendorId: "anthropic", customer: { overall: 82 }, developer: { overall: 71.1 }, employee: { overall: 74.4 } }] },
  pricing: { provenance: "AIE", capturedAt: NEW_DATE, asOf: NEW_DATE, count: 1, rows: [{ id: "tp_anthropic_x", vendorId: "anthropic", vendorName: "Anthropic", modelName: "X", inputPerM: 2.5, outputPerM: 15, sourceUrl: "https://example" }] },
  capabilities: { capabilities: [{ id: "agents" }], vendorCapabilities: [{ vendorId: "anthropic", capabilityId: "agents", status: "verified", maturityScore: 80, lastVerified: NEW_DATE }] },
  metadata: { industries: [], vendors: [{ id: "anthropic" }, { id: "cohere" }, { id: "aws" }] },
  uptake: { provenance: "AIE", count: 1, rows: [{ vendor: "Anthropic", share: 0.2 }] },
  "news?limit=500": { news: [{ id: 1, title: "old" }, { id: 2, title: "new" }] },
};
const fakeFetch = async (endpoint: string) => upstream[endpoint] ?? null;

async function discovered(store = new MemoryStore(canonical())) {
  const d = await discover(store, fakeFetch, { now: () => T0 });
  const payloads: Record<string, unknown> = {};
  for (const f of d.files) if (f.endpoint) payloads[f.file] = upstream[f.endpoint];
  return { store, d: { ...d, payloads } as Discovery & { payloads: Record<string, unknown> } };
}
const rankings = () => JSON.parse(canonical()["category-rankings.json"]);
const shareChangeId = "market-share.json|anthropic:frontier_model_api|estimatedShare";
const badShareId = "market-share.json|aws:cloud_ai_platform|estimatedShare";
const mistralShareId = "market-share.json|mistral:frontier_model_api|estimatedShare";

describe("1. discovery does not mutate canonical data", () => {
  it("leaves every file byte-identical", async () => {
    const store = new MemoryStore(canonical());
    const before = store.snapshot();
    await discover(store, fakeFetch, { now: () => T0 });
    expect(store.snapshot()).toEqual(before);
  });
});

describe("15. a fetch timestamp is not evidence", () => {
  it("dates every change from the payload, never from the fetch, and calls a timestamp-only refetch unchanged", async () => {
    const { d } = await discovered();
    expect(d.discoveredAt).toBe(new Date(T0).toISOString());
    for (const c of d.changes) expect(c.evidenceDate).not.toBe(d.discoveredAt);
    // cohere's share row moved only its sourceDate.
    const cohere = d.changes.find((c) => c.id === "market-share.json|cohere:frontier_model_api|estimatedShare");
    expect(cohere?.status).toBe("unchanged");
    // reputation and capabilities moved only timestamps: the file is unchanged, with the reason stated.
    const rep = d.files.find((f) => f.file === "reputation.json");
    expect(rep?.status).toBe("unchanged");
    expect(rep?.note).toMatch(/capture date moved/);
    expect(meaningfulHash({ a: 1, asOf: "x" })).toBe(meaningfulHash({ a: 1, asOf: "y" }));
  });
});

describe("3, 4, 7, 8, 9: entities", () => {
  it("3. a new entity is NEW and cannot ingest without review", async () => {
    const { d } = await discovered();
    expect(d.entities.find((e) => e.id === "mistral")?.state).toBe("NEW");
    const v = validate(d, [], { canonicalRankings: rankings() });
    expect(v.records.find((r) => r.id === "entity|mistral")?.level).toBe("BLOCKED");
    expect(v.records.find((r) => r.id === mistralShareId)?.level).toBe("BLOCKED");
  });

  it("4. an unresolved entity cannot ingest", async () => {
    const { d } = await discovered();
    const aleph = d.entities.find((e) => e.id === "aleph-alpha");
    expect(aleph?.state).toBe("UNRESOLVED");
    const v = validate(d, [], { canonicalRankings: rankings() });
    expect(v.records.find((r) => r.id === "entity|aleph-alpha")?.level).toBe("BLOCKED");
    expect(v.summary.unresolved).toBeGreaterThan(0);
  });

  it("7. an existing alias suggests the canonical match, and an abbreviation does", () => {
    const roster = [{ id: "cohere", name: "Cohere (incl. Aleph Alpha)" }, { id: "aws", name: "Amazon Web Services" }, { id: "anthropic", name: "Anthropic" }];
    expect(aliasesOf("Cohere (incl. Aleph Alpha)", "cohere")).toContain("aleph alpha");
    expect(matchExisting({ id: "aleph-alpha", name: "Aleph Alpha" }, roster).suggestion).toBe("cohere");
    expect(matchExisting({ id: "aws-x", name: "AWS" }, roster).suggestion).toBe("aws");
  });

  it("8. an ambiguous alias does not auto-merge", async () => {
    const roster = [{ id: "mistral-ai", name: "Mistral AI" }, { id: "mistral-labs", name: "Mistral Labs" }];
    const m = matchExisting({ id: "mistral", name: "Mistral" }, roster);
    expect(m.ambiguous).toBe(true);
    expect(m.suggestion).toBeNull();
    // and in discovery, a suggestion is never applied: the entity stays UNRESOLVED until a person chooses.
    const { d } = await discovered();
    const aleph = d.entities.find((e) => e.id === "aleph-alpha");
    expect(aleph?.match?.suggestion).toBe("cohere");
    expect(aleph?.state).toBe("UNRESOLVED");
  });

  it("9. an existing category can be suggested, 10. and is not accepted by itself", async () => {
    const s = suggestCategory({ id: "mistral", name: "Mistral AI", category: "Frontier model/API" });
    expect(s.suggested).toBe("Frontier model/API");
    expect(s.state).toBe("evidenced");
    const { d } = await discovered();
    const v = validate(d, [], { canonicalRankings: rankings() });
    expect(v.records.find((r) => r.id === "entity|mistral")?.level).toBe("BLOCKED");
    const v2 = validate(d, [{ entityId: "mistral", action: "new", category: "Frontier model/API" }], { canonicalRankings: rankings() });
    expect(v2.records.find((r) => r.id === "entity|mistral")?.level).toBe("READY");
  });

  it("11. the system cannot create a new top-level category", async () => {
    const s = suggestCategory({ id: "arm", name: "Arm", category: "AI silicon" });
    expect(s.suggested).toBeNull();
    expect(s.requiresNewTopLevel).toBe(true);
    expect(SEED_CATEGORIES).not.toContain("AI silicon");
    const { d } = await discovered();
    const v = validate(d, [{ entityId: "arm", action: "new", category: "AI silicon" }], { canonicalRankings: rankings() });
    const arm = v.records.find((r) => r.id === "entity|arm");
    expect(arm?.level).toBe("BLOCKED");
    expect(arm?.findings.map((f) => f.rule)).toContain("taxonomy-validity");
    // mistral and arm are NEW; aleph-alpha and amazon-web-services are UNRESOLVED, each with a suggested match a person must confirm.
    expect(v.summary.newEntities).toBe(2);
    expect(d.entities.find((e) => e.id === "amazon-web-services")?.state).toBe("UNRESOLVED");
    expect(d.entities.find((e) => e.id === "amazon-web-services")?.match?.suggestion).toBe("aws");
  });

  it("12. duplicate detection", async () => {
    const dup: Record<string, unknown> = { ...upstream, vendors: { asOf: NEW_DATE, vendors: [...(upstream.vendors as { vendors: unknown[] }).vendors, { id: "mistral", name: "Mistral AI", category: "Frontier model/API" }] } };
    const store = new MemoryStore(canonical());
    const d = await discover(store, async (e) => dup[e] ?? null, { now: () => T0 });
    const v = validate(d, [{ entityId: "mistral", action: "new", category: "Frontier model/API" }], { canonicalRankings: rankings() });
    expect(v.records.filter((r) => r.id === "entity|mistral").some((r) => r.findings.some((f) => f.rule === "duplicate"))).toBe(true);
  });
});

describe("2, 5, 6: the mutation boundary", () => {
  it("2. ingestion requires explicit approval: nothing selected, nothing lands", async () => {
    const { store, d } = await discovered();
    const before = store.snapshot();
    const v = validate(d, [], { canonicalRankings: rankings() });
    const p = plan(v, []);
    expect(p.approved).toHaveLength(0);
    const r = await apply(d, p, [], store, { now: () => T0 });
    expect(r.status).toBe("NOTHING");
    expect(store.snapshot()).toEqual(before);
  });

  it("5. a BLOCKED record cannot ingest even when selected", async () => {
    const { store, d } = await discovered();
    const v = validate(d, [], { canonicalRankings: rankings() });
    expect(v.records.find((r) => r.id === badShareId)?.level).toBe("BLOCKED");
    const p = plan(v, [badShareId, mistralShareId, "entity|mistral"]);
    expect(p.approved).toHaveLength(0);
    expect(p.blocked.map((b) => b.id)).toContain(badShareId);
    const r = await apply(d, p, [], store, { now: () => T0 });
    expect(r.status).toBe("NOTHING");
    const share = JSON.parse((await store.read("market-share.json")) as string);
    expect(share.estimates.find((e: { vendorId: string }) => e.vendorId === "aws")).toBeUndefined();
  });

  it("6. a READY approved record ingests, 13. with its provenance, 14. and its observation date", async () => {
    const { store, d } = await discovered();
    const v = validate(d, [], { canonicalRankings: rankings() });
    expect(v.records.find((r) => r.id === shareChangeId)?.level).toBe("READY");
    const p = plan(v, [shareChangeId]);
    expect(p.counts.records).toBe(1);
    const r = await apply(d, p, [], store, { now: () => T0, runDerived: async () => [{ step: "stub", ok: true, output: "" }] });
    expect(r.status).toBe("INGESTED");
    expect(r.ingested).toBe(1);
    const share = JSON.parse((await store.read("market-share.json")) as string);
    const row = share.estimates.find((e: { vendorId: string }) => e.vendorId === "anthropic");
    expect(row.estimatedShare).toBe(22.4);
    expect(row.source).toBe("evidence-derived"); // 13. provenance survives
    expect(share.asOf).toBe(NEW_DATE); // 14. the observation date, not the fetch time
    expect(share.asOf).not.toBe(new Date(T0).toISOString());
    expect(r.audit?.source).toBe(AIE_UPSTREAM);
    expect(r.audit?.approved[0]?.evidenceDate).toBe(NEW_DATE);
    expect(r.audit?.approved[0]?.source).toBe("market-share");
    expect(r.audit?.approved[0]?.from).toBe(20.9);
    expect(r.audit?.approved[0]?.to).toBe(22.4);
  });

  it("a NEW entity lands only under a category a person chose, and its figures follow it", async () => {
    const { store, d } = await discovered();
    const res: Resolution[] = [{ entityId: "mistral", action: "new", category: "Frontier model/API" }];
    const v = validate(d, res, { canonicalRankings: rankings() });
    expect(v.records.find((r) => r.id === mistralShareId)?.level).toBe("READY");
    // The population check: with rankings that hold two, the three-vendor share list is flagged, not blocked.
    const two = { capturedAt: CANON_DATE, categories: [{ categoryId: "frontier_model_api", held: 0, ranked: [{ vendorId: "anthropic" }, { vendorId: "cohere" }] }] };
    const flagged = validate(d, res, { canonicalRankings: two });
    expect(flagged.records.find((r) => r.id === mistralShareId)?.findings.map((f) => f.rule)).toContain("population-consistency");
    expect(flagged.records.find((r) => r.id === mistralShareId)?.level).toBe("WARNING");
    const p = plan(v, ["entity|mistral", mistralShareId]);
    const r = await apply(d, p, res, store, { now: () => T0, runDerived: async () => [{ step: "stub", ok: true, output: "" }] });
    expect(r.status).toBe("INGESTED");
    const vendors = JSON.parse((await store.read("vendors.json")) as string).vendors;
    expect(vendors.find((x: { id: string }) => x.id === "mistral")?.category).toBe("Frontier model/API");
    expect(vendors.find((x: { id: string }) => x.id === "arm")).toBeUndefined();
    const share = JSON.parse((await store.read("market-share.json")) as string);
    expect(share.estimates.find((e: { vendorId: string }) => e.vendorId === "mistral")?.estimatedShare).toBe(6.5);
    expect(r.audit?.categoryMappings).toEqual([{ entityId: "mistral", category: "Frontier model/API" }]);
  });
});

describe("16, 17, 18, 22: after the write", () => {
  it("16. derived artefacts regenerate through the supplied runner", async () => {
    const { store, d } = await discovered();
    const v = validate(d, [], { canonicalRankings: rankings() });
    const calls: string[] = [];
    const r = await apply(d, plan(v, [shareChangeId]), [], store, { now: () => T0, runDerived: async () => { calls.push("ran"); return [{ step: "vendor-directory", ok: true, output: "ok" }]; } });
    expect(calls).toEqual(["ran"]);
    expect(r.derived[0]?.ok).toBe(true);
  });

  it("17. the evidence version changes after a meaningful ingestion and not after a timestamp", async () => {
    const { store, d } = await discovered();
    const before = await evidenceVersion(store);
    const stampOnly = new MemoryStore({ ...canonical(), "reputation.json": canonical()["reputation.json"].replace(CANON_DATE, NEW_DATE) });
    expect(await evidenceVersion(stampOnly)).toBe(before);
    const v = validate(d, [], { canonicalRankings: rankings() });
    const r = await apply(d, plan(v, [shareChangeId]), [], store, { now: () => T0, runDerived: async () => [] });
    expect(r.evidenceVersion?.before).toBe(before);
    expect(r.evidenceVersion?.changed).toBe(true);
    expect(await evidenceVersion(store)).not.toBe(before);
  });

  it("18. Analyst Insight is not generated: nothing in dataops reaches the model", async () => {
    const { store, d } = await discovered();
    const v = validate(d, [], { canonicalRankings: rankings() });
    const r = await apply(d, plan(v, [shareChangeId]), [], store, { now: () => T0, runDerived: async () => [] });
    expect(r.analystInsight).toMatch(/not regenerated/);
    for (const f of readdirSync(path.join(process.cwd(), "lib", "dataops"))) {
      expect(readFileSync(path.join(process.cwd(), "lib", "dataops", f), "utf8")).not.toMatch(/analyst\/llm|analyst\/author|@anthropic-ai|callModel|authoredResult/);
    }
    for (const f of ["discover", "validate", "ingest"]) {
      expect(readFileSync(path.join(process.cwd(), "app", "api", "admin", "dataops", f, "route.ts"), "utf8")).not.toMatch(/analyst\/llm|analyst\/author|@anthropic-ai/);
    }
  });

  it("22. a partial failure cannot report success: a failed derived step reverts the files", async () => {
    const { store, d } = await discovered();
    const before = store.snapshot();
    const v = validate(d, [], { canonicalRankings: rankings() });
    const r = await apply(d, plan(v, [shareChangeId]), [], store, { now: () => T0, runDerived: async () => [{ step: "ledger", ok: false, output: "boom" }] });
    expect(r.status).toBe("FAILED");
    expect(r.ingested).toBe(0);
    expect(r.reverted).toBe(true);
    expect(store.snapshot()).toEqual(before);
    expect(r.audit?.status).toBe("FAILED");
  });

  it("refuses outright on a read-only store, touching nothing", async () => {
    const store = new MemoryStore(canonical(), { writable: false });
    const { d } = await discovered(store);
    const v = validate(d, [], { canonicalRankings: rankings() });
    const r = await apply(d, plan(v, [shareChangeId]), [], store, { now: () => T0 });
    expect(r.status).toBe("REFUSED");
    expect(store.snapshot()).toEqual(canonical());
  });
});

describe("19, 20, 21: nothing is scheduled", () => {
  const src = (p: string) => readFileSync(path.join(process.cwd(), p), "utf8");
  it("no discovery, ingestion or Analyst Insight schedule exists", () => {
    const vercel = JSON.parse(src("vercel.json")) as { crons?: unknown[] };
    expect(vercel.crons ?? []).toEqual([]);
    for (const f of readdirSync(path.join(process.cwd(), ".github", "workflows"))) {
      const w = src(path.join(".github", "workflows", f));
      expect(w).not.toMatch(/^\s*schedule:/m);
      expect(w).not.toMatch(/dataops|api\/admin/);
    }
    const pkg = JSON.parse(src("package.json")) as { scripts: Record<string, string> };
    for (const [k, v] of Object.entries(pkg.scripts)) expect(v, k).not.toMatch(/cron|schedule/i);
  });
});

describe("what travels with a discovery", () => {
  it("leaves news.json behind and lets ingest verify a re-fetch against the reviewed hash", async () => {
    const { payloadsForTransit, matchesReviewed, STAYS_BEHIND } = await import("@/lib/dataops/sources");
    const payloads: Partial<Record<import("@/lib/dataops/sources").CanonicalFile, unknown>> = { "news.json": { news: [1, 2, 3] }, "vendors.json": { vendors: [] } };
    const transit = payloadsForTransit(payloads);
    expect(STAYS_BEHIND.has("news.json")).toBe(true);
    expect(Object.keys(transit)).toEqual(["vendors.json"]);
    const reviewed = meaningfulHash({ news: [{ id: 1 }], capturedAt: "2026-09-06T00:00:00Z" });
    expect(matchesReviewed(reviewed, { news: [{ id: 1 }], capturedAt: "2026-09-07T00:00:00Z" })).toBe(true);
    expect(matchesReviewed(reviewed, { news: [{ id: 1 }, { id: 2 }] })).toBe(false);
    expect(matchesReviewed(undefined, { news: [] })).toBe(false);
  });
});
