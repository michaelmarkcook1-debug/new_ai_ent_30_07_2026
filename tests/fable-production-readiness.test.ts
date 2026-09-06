import { describe, it, expect } from "vitest";
import { readFileSync, readdirSync, existsSync } from "node:fs";
import path from "node:path";
import {
  authoringCacheKey,
  AUTHORING_CONTRACT,
  INTELLIGENCE_VERSION,
  llmAvailable,
} from "@/lib/analyst/llm";
import {
  runWarm,
  classify,
  WARM_CONCURRENCY,
  WARM_BUDGET_MS,
  WARM_PAGE_TIMEOUT_MS,
  AUTHORED_THRESHOLD_MS,
  WRITTEN_BADGE,
  COMPUTED_BADGE,
} from "@/lib/analyst/warm";
import { WARM_PAGES } from "@/lib/analyst/warm-list";
import { decide, modelFromSource } from "../scripts/preflight-production.mjs";
import { authorInsight } from "@/lib/analyst/author";
import { loadMarketMetrics } from "@/lib/market-metrics";
import { vendorViewInsight } from "@/lib/analyst/insight";
import { pageQuestion } from "@/lib/analyst/question";

// Production readiness of the Fable 5.1 switch, 5 September 2026.
//
// Three things had to be true before the release could go out, and each is
// pinned here so it stays true: a reading Opus 5 wrote can never be served as
// a Fable reading; a warm run can never report success while targets remain;
// a deploy is blocked while production cannot author.

const src = (p: string) => readFileSync(path.join(process.cwd(), p), "utf8");

const evidenceX = {
  facts:
    "Across 13 judged categories, 2 carry a lead of 0.5 or more and 7 sit inside 0.15. Captured 2026-09-05T10:14:22.000Z.",
  instruction: "Answer: does capability still separate this market?",
  guardKey: JSON.stringify({ claims: [], entities: ["SAP"], forbidCausal: false }),
};
const fable = AUTHORING_CONTRACT;
const opus = { ...AUTHORING_CONTRACT, model: "claude-opus-5" };

// ------------------------------------------------------------ cache identity

describe("cache identity carries the authoring contract", () => {
  it("pins the contract this release ships under", () => {
    expect(fable.model).toBe("claude-fable-5-1");
    expect(fable.reasoning).toBe("adaptive");
    expect(fable.intelligence).toBe(INTELLIGENCE_VERSION);
  });

  it("1. an Opus 5 reading cannot satisfy a Fable 5.1 request for the same evidence", () => {
    expect(authoringCacheKey("insight:market", evidenceX, opus)).not.toBe(
      authoringCacheKey("insight:market", evidenceX, fable)
    );
  });

  it("2. the same Fable configuration and the same evidence reuse", () => {
    const a = authoringCacheKey("insight:market", evidenceX, fable);
    const b = authoringCacheKey("insight:market", evidenceX, fable);
    expect(a).toBe(b);
    // Day precision: an evidence capture later the same day is the same evidence.
    const laterSameDay = { ...evidenceX, facts: evidenceX.facts.replace("10:14:22", "17:02:09") };
    expect(authoringCacheKey("insight:market", laterSameDay, fable)).toBe(a);
  });

  it("3. a reasoning-effort change is a different analytical contract", () => {
    const medium = { ...fable, reasoning: "medium" as const };
    expect(authoringCacheKey("insight:market", evidenceX, medium)).not.toBe(
      authoringCacheKey("insight:market", evidenceX, fable)
    );
  });

  it("4. a change in the evidence invalidates", () => {
    const evidenceY = { ...evidenceX, facts: evidenceX.facts.replace("7 sit inside", "8 sit inside") };
    expect(authoringCacheKey("insight:market", evidenceY, fable)).not.toBe(
      authoringCacheKey("insight:market", evidenceX, fable)
    );
  });

  it("5. an intelligence-version change invalidates", () => {
    const next = { ...fable, intelligence: "2026-09-06" };
    expect(authoringCacheKey("insight:market", evidenceX, next)).not.toBe(
      authoringCacheKey("insight:market", evidenceX, fable)
    );
  });

  it("the L2 key parts carry the same contract, so old entries are unreachable rather than purged", () => {
    // The pure key above is the L1 identity. unstable_cache builds its own from
    // the key parts plus the call arguments; the contract has to be in the key
    // parts or an Opus entry in the shared Data Cache would still answer.
    expect(src("lib/analyst/llm.ts")).toMatch(/\["analyst-insight", CONTRACT_KEY\]/);
  });
});

// ------------------------------------------------------------ warm execution

const written = `<span class="font-mono ${WRITTEN_BADGE}`;
const computed = `<span class="font-mono ${COMPUTED_BADGE}`;

function fakeFetch(plan: Record<string, { status?: number; delayMs?: number; body?: string }>) {
  let inFlight = 0;
  let maxInFlight = 0;
  const impl = (async (input: string | URL | Request, init?: RequestInit) => {
    const p = new URL(String(input)).pathname;
    const step = plan[p] ?? {};
    inFlight++;
    maxInFlight = Math.max(maxInFlight, inFlight);
    try {
      await new Promise<void>((resolve, reject) => {
        const t = setTimeout(resolve, step.delayMs ?? 5);
        init?.signal?.addEventListener("abort", () => {
          clearTimeout(t);
          reject(init.signal?.reason ?? Object.assign(new Error("aborted"), { name: "TimeoutError" }));
        });
      });
    } finally {
      inFlight--;
    }
    return new Response(step.body ?? written, { status: step.status ?? 200 });
  }) as typeof fetch;
  return { impl, max: () => maxInFlight };
}

describe("the warm run", () => {
  const ten = WARM_PAGES.map((p) => p);

  it("6. a warm against a valid current cache is classified cached and calls no model", () => {
    expect(classify(200, 400, written, false)).toBe("cached");
    expect(classify(200, AUTHORED_THRESHOLD_MS + 1, written, false)).toBe("authored");
    // The warm module never talks to the model: it fetches pages, and only a
    // page render can author. Reader-time behaviour is therefore unchanged.
    const warm = src("lib/analyst/warm.ts");
    expect(warm).not.toMatch(/@anthropic-ai\/sdk|from "\.\/llm"|authoredResult|callModel/);
  });

  it("7. a page with no reading is reported, not counted as warmed", () => {
    expect(classify(200, 300, "<main>Trust Rank</main>", false)).toBe("failed");
    expect(WARM_PAGES).not.toContain("/trust-rank");
  });

  it("8. bounded concurrency completes every target and never exceeds the bound", async () => {
    const f = fakeFetch(Object.fromEntries(ten.map((p) => [p, { delayMs: 15 }])));
    const r = await runWarm({ origin: "http://x", paths: ten, concurrency: 3, fetchImpl: f.impl });
    expect(f.max()).toBe(3);
    expect(r.requested).toBe(10);
    expect(r.cached).toBe(10);
    expect(r.remaining).toBe(0);
    expect(r.success).toBe(true);
  });

  it("9. one failed target makes the run honest, not successful", async () => {
    const f = fakeFetch({ "/alliances": { status: 500 } });
    const r = await runWarm({ origin: "http://x", paths: ten, concurrency: 3, fetchImpl: f.impl });
    expect(r.failed).toBe(1);
    expect(r.success).toBe(false);
    expect(r.results.find((x) => x.path === "/alliances")?.outcome).toBe("failed");
  });

  it("10. a timed-out target is visible as timed out", async () => {
    const f = fakeFetch({ "/pulse": { delayMs: 500 } });
    const r = await runWarm({ origin: "http://x", paths: ten, concurrency: 3, pageTimeoutMs: 40, fetchImpl: f.impl });
    expect(r.timedOut).toBe(1);
    expect(r.results.find((x) => x.path === "/pulse")?.outcome).toBe("timed-out");
    expect(r.success).toBe(false);
  });

  it("11. a run that exhausts its budget names what remains and cannot report success", async () => {
    const f = fakeFetch(Object.fromEntries(ten.map((p) => [p, { delayMs: 40 }])));
    const r = await runWarm({ origin: "http://x", paths: ten, concurrency: 1, budgetMs: 60, fetchImpl: f.impl });
    expect(r.remaining).toBeGreaterThan(0);
    expect(r.remainingPaths.length).toBe(r.remaining);
    expect(r.results.length + r.remaining).toBe(r.requested);
    expect(r.success).toBe(false);
  });

  it("a fallback is counted and visible but is not a warm failure", async () => {
    const f = fakeFetch({ "/reputation-tracker": { body: computed } });
    const r = await runWarm({ origin: "http://x", paths: ten, concurrency: 3, fetchImpl: f.impl });
    expect(r.fallback).toBe(1);
    expect(r.success).toBe(true);
  });

  it("keeps its constants inside the hosting window", () => {
    expect(WARM_CONCURRENCY).toBeGreaterThanOrEqual(1);
    expect(WARM_BUDGET_MS).toBeLessThan(300_000);
    expect(WARM_BUDGET_MS).toBeGreaterThanOrEqual(WARM_PAGE_TIMEOUT_MS);
    // Between the slowest cached page seen (1.3s) and the fastest authoring call (15.9s).
    expect(AUTHORED_THRESHOLD_MS).toBeGreaterThan(1_300);
    expect(AUTHORED_THRESHOLD_MS).toBeLessThan(15_000);
  });
});

// ------------------------------------------------------------ no automation

describe("12. there is no automated warm, and the manual one is explicit", () => {
  it("no route, no cron, no scheduled workflow", () => {
    expect(existsSync(path.join(process.cwd(), "app", "api", "warm"))).toBe(false);
    const vercel = JSON.parse(src("vercel.json")) as { crons?: unknown[] };
    expect(vercel.crons ?? []).toEqual([]);
    for (const f of readdirSync(path.join(process.cwd(), ".github", "workflows"))) {
      expect(src(path.join(".github", "workflows", f))).not.toMatch(/^\s*schedule:/m);
    }
  });

  it("the manual warm plans by default and fetches only on --yes", () => {
    const script = src("scripts/warm.mjs");
    expect(script).toMatch(/args\.includes\("--yes"\)/);
    expect(script).toMatch(/from "@\/lib\/analyst\/warm"/);
  });
});

// ------------------------------------------------------------ the key gate

describe("13. the production preflight fails closed, stage by stage", () => {
  const model = AUTHORING_CONTRACT.model;
  const at = (status: number, type: string | null = null, message: string | null = null) =>
    decide({ hasKey: true, check: { status, type, message }, model });

  it("a revoked key fails authentication", () => {
    const v = at(401, "authentication_error", "invalid x-api-key");
    expect(v.ok).toBe(false);
    expect(v.stages.auth).toBe("failed");
    expect(v.blockers.join(" ")).toMatch(/401/);
  });

  it("an exhausted balance is a credit block on a key that authenticated, not an auth failure", () => {
    // Measured live on 5 September 2026: HTTP 400 on a valid key.
    const v = at(400, "invalid_request_error", "Your credit balance is too low to access the Anthropic API.");
    expect(v.ok).toBe(false);
    expect(v.stages.auth).toBe("ok");
    expect(v.stages.model).toBe("ok");
    expect(v.stages.credit).toBe("blocked");
    expect(v.blockers.join(" ")).toMatch(/credit/i);
  });

  it("a model the key cannot reach is its own stage", () => {
    const v = at(404, "not_found_error", "model: claude-fable-5-1");
    expect(v.ok).toBe(false);
    expect(v.stages.auth).toBe("ok");
    expect(v.stages.model).toBe("inaccessible");
  });

  it("a missing key blocks before any request", () => {
    const v = decide({ hasKey: false, check: null, model });
    expect(v.ok).toBe(false);
    expect(v.stages.key).toBe("missing");
  });

  it("passes only when authenticated, the model is reachable and credit is available", () => {
    const v = at(200);
    expect(v).toEqual({ ok: true, stages: { key: "ok", auth: "ok", model: "ok", credit: "ok" }, blockers: [] });
  });

  it("checks the model the code actually pins, read from the source", () => {
    expect(modelFromSource(src("lib/analyst/llm.ts"))).toBe(AUTHORING_CONTRACT.model);
  });

  it("requires no scheduler secret: that cron is gone", () => {
    expect(src("scripts/preflight-production.mjs")).not.toMatch(/CRON_SECRET/);
  });

  it("runs first in the deploy script, and deploy warms nothing", () => {
    const pkg = JSON.parse(src("package.json")) as { scripts: Record<string, string> };
    expect(pkg.scripts.deploy.startsWith("node scripts/preflight-production.mjs &&")).toBe(true);
    expect(pkg.scripts.deploy).not.toMatch(/warm/);
  });
});

// ------------------------------------------------------------ fallback

describe("14. the computed floor remains the fallback", () => {
  it("serves the analyst-grade computed reading when authoring is unavailable", async () => {
    expect(llmAvailable()).toBe(false);
    const computedReading = vendorViewInsight(await loadMarketMetrics());
    const started = Date.now();
    const written = await authorInsight(computedReading, "vendor ranking", [], null, null, {
      question: pageQuestion("vendor-view"),
      context: null,
    });
    expect(written.authorship).toBe("computed");
    expect(written.value.headline.length).toBeGreaterThan(20);
    expect(written.value.decision).toEqual(computedReading.decision);
    expect(Date.now() - started).toBeLessThan(1_000);
  }, 60_000);
});

// ------------------------------------------------------------ no new calls

describe("15. no additional reader-time model call was introduced", () => {
  it("the model is still invoked from exactly one place", () => {
    const llm = src("lib/analyst/llm.ts");
    expect(llm.match(/await callModel\(/g)?.length).toBe(1);
  });
});
