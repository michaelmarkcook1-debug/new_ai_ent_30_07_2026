import { describe, it, expect } from "vitest";
import { readFileSync } from "node:fs";
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
  isScheduler,
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

// ------------------------------------------------------------ the endpoint

describe("12. /api/warm remains protected", () => {
  it("admits only the bearer secret", () => {
    expect(isScheduler("Bearer s3cret", "s3cret")).toBe(true);
    expect(isScheduler("Bearer wrong", "s3cret")).toBe(false);
    expect(isScheduler(null, "s3cret")).toBe(false);
  });

  it("fails closed when no secret is configured, even to a plausible bearer", () => {
    expect(isScheduler("Bearer anything", undefined)).toBe(false);
    expect(isScheduler("Bearer anything", "")).toBe(false);
  });

  it("no longer trusts a header any client can set", () => {
    // A probe with `x-vercel-cron: 1` and nothing else opened production on
    // 5 September 2026. The route must not reference that header at all.
    expect(src("app/api/warm/route.ts")).not.toMatch(/x-vercel-cron/);
  });
});

// ------------------------------------------------------------ the key gate

describe("13. the production key preflight fails closed", () => {
  const model = AUTHORING_CONTRACT.model;

  it("blocks on 401", () => {
    const v = decide({ hasKey: true, keyStatus: 401, hasCronSecret: true, model });
    expect(v.ok).toBe(false);
    expect(v.blockers.join(" ")).toMatch(/401/);
  });

  it("blocks on an exhausted credit balance, which returns 400 on a valid key", () => {
    // Measured live on 5 September 2026: the local key that authored every
    // reading the day before returned 400 "credit balance is too low".
    const v = decide({ hasKey: true, keyStatus: 400, hasCronSecret: true, model });
    expect(v.ok).toBe(false);
    expect(v.blockers.join(" ")).toMatch(/credit/i);
  });

  it("blocks on a missing key, a missing cron secret, and an unreachable model", () => {
    expect(decide({ hasKey: false, keyStatus: null, hasCronSecret: true, model }).ok).toBe(false);
    expect(decide({ hasKey: true, keyStatus: 200, hasCronSecret: false, model }).ok).toBe(false);
    expect(decide({ hasKey: true, keyStatus: 404, hasCronSecret: true, model }).ok).toBe(false);
  });

  it("passes only when the key authenticates and the secret exists", () => {
    expect(decide({ hasKey: true, keyStatus: 200, hasCronSecret: true, model })).toEqual({ ok: true, blockers: [] });
  });

  it("checks the model the code actually pins, read from the source", () => {
    expect(modelFromSource(src("lib/analyst/llm.ts"))).toBe(AUTHORING_CONTRACT.model);
  });

  it("runs first in the deploy script", () => {
    const pkg = JSON.parse(src("package.json")) as { scripts: Record<string, string> };
    expect(pkg.scripts.deploy.startsWith("node scripts/preflight-production.mjs &&")).toBe(true);
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
