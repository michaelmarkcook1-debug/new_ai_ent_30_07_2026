import { describe, it, expect, beforeAll, afterAll, vi } from "vitest";
import { readFileSync, readdirSync } from "node:fs";
import path from "node:path";
import { authoredResult, buildPhase, llmAvailable } from "@/lib/analyst/llm";

// What can spend a Fable 5.1 call, and what cannot. 6 September 2026.
//
// The owner's instruction: a reading is authored when a reader opens a page
// whose reading is not current, or when a person runs the manual warm. Never
// because the clock reached a time, never because the site was built, never
// because the data sync ran.

const src = (p: string) => readFileSync(path.join(process.cwd(), p), "utf8");

describe("a production build authors nothing", () => {
  beforeAll(() => vi.stubEnv("ANTHROPIC_API_KEY", "test-placeholder-never-sent"));
  afterAll(() => vi.unstubAllEnvs());

  const request = () =>
    authoredResult<{ marker: string }>(
      "insight:build-check",
      "Across 13 judged categories, 2 carry a lead of 0.5 or more. Captured 2026-09-06T08:00:00.000Z.",
      "Answer the page's question.",
      1400,
      [],
      {}
    );

  it("refuses before the cache lookup while next build is running", async () => {
    vi.stubEnv("NEXT_PHASE", "phase-production-build");
    expect(buildPhase()).toBe(true);
    expect(llmAvailable()).toBe(true); // the key is there; the build still does not use it
    const r = await request();
    expect(r.value).toBeNull();
    expect(r.failure).toBe("build");
  });

  it("wrote nothing, and the same request at runtime proceeds toward the model", async () => {
    vi.stubEnv("NEXT_PHASE", "phase-production-server");
    expect(buildPhase()).toBe(false);
    // Past the suppression, past an empty L1, into L2, which outside a Next
    // render throws its invariant: that is "unreachable", and it is as far as
    // a test may go without spending a call. A reader's cache miss authors.
    const r = await request();
    expect(r.value).toBeNull();
    expect(r.failure).toBe("unreachable");
  });
});

describe("nothing scheduled can author", () => {
  const workflowDir = path.join(process.cwd(), ".github", "workflows");
  const workflows = readdirSync(workflowDir).map((f) => src(path.join(".github", "workflows", f)));

  it("vercel.json registers no cron", () => {
    const vercel = JSON.parse(src("vercel.json")) as { crons?: unknown[] };
    expect(vercel.crons ?? []).toEqual([]);
  });

  it("no workflow runs on a schedule", () => {
    for (const w of workflows) expect(w).not.toMatch(/^\s*schedule:/m);
  });

  it("the data sync neither holds a model key nor reaches the model", () => {
    for (const w of workflows) {
      expect(w).not.toMatch(/ANTHROPIC/);
      // No step may run a warm; the word may appear in a comment saying so.
      const steps = w.split("\n").filter((l) => /^\s*(- )?run:/.test(l));
      for (const step of steps) expect(step).not.toMatch(/warm|api\/warm/i);
    }
    for (const s of ["sync-aie-fixtures.mjs", "sync-category-rankings.mjs", "snapshot-signals.mjs", "alias-hook.mjs"]) {
      expect(src(path.join("scripts", s))).not.toMatch(/analyst\/llm|analyst\/author|@anthropic-ai|callModel|authoredResult/);
    }
  });
});

describe("deployment does not warm", () => {
  const pkg = JSON.parse(src("package.json")) as { scripts: Record<string, string> };

  it("deploy is preflight then deploy, and nothing after", () => {
    expect(pkg.scripts.deploy).toBe("node scripts/preflight-production.mjs && vercel --prod --yes");
    expect(pkg.scripts.deploy).not.toMatch(/warm/);
  });

  it("warm is its own command, run through the alias hook", () => {
    expect(pkg.scripts.warm).toBe("node --import ./scripts/alias-hook.mjs scripts/warm.mjs");
  });
});

describe("retries stay bounded", () => {
  const llm = src("lib/analyst/llm.ts");

  it("the SDK retries nothing underneath us", () => {
    expect(llm).toMatch(/^const SDK_RETRIES = 0;/m);
    expect(llm).toMatch(/maxRetries: SDK_RETRIES/);
  });

  it("an authoring makes at most two attempts, the second gated on the budget", () => {
    expect(llm).toMatch(/for \(let attempt = 0; attempt < 2; attempt\+\+\)/);
    expect(llm).toMatch(/if \(attempt > 0 && !retryWithinBudget\(startedAt, Date\.now\(\)\)\)/);
  });

  it("company research keeps its own wall-clock budget", () => {
    expect(src("lib/research/company.ts")).toMatch(/^const RETRY_BUDGET_MS = 90_000;/m);
  });

  it("the model is invoked from exactly one place", () => {
    expect(llm.match(/await callModel\(/g)?.length).toBe(1);
  });
});

describe("every call is countable in the log", () => {
  const llm = src("lib/analyst/llm.ts");

  it("names the surface, the model and what triggered it, on success and on failure", () => {
    expect(llm).toMatch(/call ok in \$\{Date\.now\(\) - started\}ms: surface=\$\{surface\}, model=\$\{MODEL\}, trigger=\$\{trigger\(\)\}/);
    expect(llm).toMatch(/call failed after \$\{Date\.now\(\) - started\}ms: surface=\$\{surface\}, model=\$\{MODEL\}, trigger=\$\{trigger\(\)\}/);
    expect(llm).toMatch(/call returned no text after \$\{Date\.now\(\) - started\}ms: surface=\$\{surface\}, model=\$\{MODEL\}, trigger=\$\{trigger\(\)\}/);
  });

  it("never logs a prompt, an answer or a key", () => {
    expect(llm).not.toMatch(/console\.(warn|log|error)\([^)]*\b(prompt|apiKey|text\.text)\b/);
  });
});
