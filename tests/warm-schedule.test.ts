import { describe, it, expect } from "vitest";
import { runWarm, WARM_CONCURRENCY, WARM_BUDGET_MS } from "@/lib/analyst/warm";
import { WARM_PAGES } from "@/lib/analyst/warm-list";

// Does the pool bring a full cold warm inside the hosting window? Answered
// with MEASURED durations, not estimates: the cold model-call time for each
// surface on Fable 5.1 at the final headroom, sequential, idle machine,
// 4 September 2026 (RULES-AND-CALCULATIONS 8.33), plus one second of render
// overhead. Today's Pulse authors three readings in parallel inside one
// render, so its figure is the slowest of the three. Run through the real
// pool at 1/1000 scale, because the schedule the pool produces does not
// depend on the unit.

const COLD_MS: Record<string, number> = {
  "/pulse": 29_241 + 1_000,
  "/news-feed": 49_965 + 1_000,
  "/vendor-view": 41_817 + 1_000,
  "/financial-snapshot": 51_551 + 1_000,
  "/market-watch": 34_706 + 1_000,
  "/competitive-intel": 44_918 + 1_000,
  "/reputation-tracker": 46_022 + 1_000,
  "/alliances": 42_735 + 1_000,
  "/price-performance": 56_614 + 1_000,
  "/peer-insights": 41_342 + 1_000,
};
const SCALE = 1_000;
const written = 'text-muted">analyst written</span>';

function measuredFetch() {
  return (async (input: string | URL | Request, init?: RequestInit) => {
    const p = new URL(String(input)).pathname;
    await new Promise<void>((resolve, reject) => {
      const t = setTimeout(resolve, COLD_MS[p] / SCALE);
      init?.signal?.addEventListener("abort", () => { clearTimeout(t); reject(init.signal?.reason); });
    });
    return new Response(written, { status: 200 });
  }) as typeof fetch;
}

async function totalAt(concurrency: number): Promise<number> {
  const r = await runWarm({
    origin: "http://x",
    paths: WARM_PAGES,
    concurrency,
    fetchImpl: measuredFetch(),
    pageTimeoutMs: 150_000 / SCALE,
    budgetMs: 10_000_000 / SCALE, // unbounded here: we want the true total
  });
  expect(r.results.length).toBe(WARM_PAGES.length);
  return r.totalMs * SCALE;
}

describe("a full cold warm on measured Fable 5.1 durations", () => {
  it("covers every warm target with a measurement", () => {
    for (const p of WARM_PAGES) expect(COLD_MS[p], `no measurement for ${p}`).toBeGreaterThan(0);
  });

  it("does not fit sequentially, which is why the pool exists", async () => {
    const seq = Object.values(COLD_MS).reduce((a, b) => a + b, 0);
    expect(seq).toBeGreaterThan(300_000);
    const t1 = await totalAt(1);
    expect(t1).toBeGreaterThan(300_000);
  });

  // Comfortable means: still inside the budget when calls run 25 per cent
  // slower, as they did under build load (8.33: p50 42.3s idle, 47.4s under
  // an 85-page build, max 56.6s against 63.7s), AND one page needs a retry of
  // its slowest reading. Both happened; neither is hypothetical.
  const slowest = Math.max(...Object.values(COLD_MS));
  const comfortable = (t: number) => t * 1.25 + slowest <= WARM_BUDGET_MS;

  it("fits comfortably at the selected concurrency", async () => {
    const t = await totalAt(WARM_CONCURRENCY);
    expect(t, `total ${t}ms at concurrency ${WARM_CONCURRENCY}`).toBeLessThan(WARM_BUDGET_MS);
    expect(comfortable(t), `${t} x 1.25 + ${slowest} exceeds the budget`).toBe(true);
  });

  it("the selected concurrency is the lowest that fits comfortably", async () => {
    if (WARM_CONCURRENCY > 1) {
      const below = await totalAt(WARM_CONCURRENCY - 1);
      expect(comfortable(below), `concurrency ${WARM_CONCURRENCY - 1} would also have been comfortable at ${below}ms`).toBe(false);
    }
  });

  it("reports the measured totals for the record", async () => {
    const rows: string[] = [];
    for (const c of [1, 2, 3, 4, 5]) rows.push(`c=${c}: ${Math.round((await totalAt(c)) / 1000)}s`);
    console.log("[warm-schedule] " + rows.join("  "));
    expect(rows.length).toBe(5);
  });
});
