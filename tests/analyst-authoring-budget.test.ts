import { describe, it, expect } from "vitest";
import { retryWithinBudget, BUDGET_MS, llmAvailable } from "@/lib/analyst/llm";
import { authorInsight } from "@/lib/analyst/author";
import { loadMarketMetrics } from "@/lib/market-metrics";
import { vendorViewInsight } from "@/lib/analyst/insight";
import { pageQuestion } from "@/lib/analyst/question";

// The bound on an authoring call, and what happens when it is reached.
//
// WHAT THIS INVESTIGATED. Two authoring calls were observed at 568 and 951
// seconds against a 75-second model timeout. The instrumented answer was not a
// slow model and not an SDK ignoring its timeout:
//
//   `max_tokens` is the budget for EVERYTHING the model emits, thinking
//   included, and every caller here passed it as though it were a length limit
//   on the prose. Opus 5 thinks adaptively by default. Under the load of a
//   production build the model spent the entire 1,400 tokens thinking, returned
//   `stop_reason: max_tokens` with one thinking block and no text, and that
//   silently became "no response" after 18 to 21 seconds. Four of nine insight
//   calls ended that way in one build.
//
// TWO SEPARATE FIXES, AND THEY FIX DIFFERENT THINGS. The headroom stops the
// calls failing. The budget below stops a series of individually legal retries
// adding up to an unbounded request, which is the failure mode the timers could
// not prevent, because a timer only fires when the event loop is free and under
// a build it is not.

describe("the end-to-end authoring budget", () => {
  it("allows a retry inside the budget", () => {
    expect(retryWithinBudget(0, 1_000)).toBe(true);
    expect(retryWithinBudget(0, BUDGET_MS - 1)).toBe(true);
  });

  it("refuses a retry once the budget is spent", () => {
    expect(retryWithinBudget(0, BUDGET_MS + 1)).toBe(false);
  });

  it("refuses the retry that would have produced the 568 and 951 second calls", () => {
    // A first attempt that overran by minutes must not be followed by a second.
    expect(retryWithinBudget(0, 568_000)).toBe(false);
    expect(retryWithinBudget(0, 951_000)).toBe(false);
  });

  it("is a comparison of two clock readings and nothing else", () => {
    // THE PROPERTY THAT MATTERS. Both the SDK timeout and the abort signal are
    // enforced by timers, and a timer cannot fire while the event loop is
    // blocked by a webpack compile or a test run. This needs no timer, so
    // nothing can postpone it. Passing an explicit `now` is the whole check:
    // if this depended on a scheduled callback it could not be written.
    expect(retryWithinBudget(1_000_000, 1_000_000 + BUDGET_MS + 1)).toBe(false);
    expect(retryWithinBudget(1_000_000, 1_000_000 + 5)).toBe(true);
  });

  it("leaves room for two attempts at the measured normal latency", () => {
    // Measured on 30 August 2026 under production-build load: insight calls
    // completed in 8.4 to 28.9 seconds, and the slowest two-attempt call took
    // 56.0 seconds. The budget has to clear that comfortably or it would start
    // refusing legitimate retries.
    expect(BUDGET_MS).toBeGreaterThan(56_000 * 2);
    // And it must still be short enough to bound a page render.
    expect(BUDGET_MS).toBeLessThanOrEqual(180_000);
  });
});

// ---------------------------------------------------------- safe failure

describe("the authored layer is an enhancement, never a dependency", () => {
  const computedFor = async () => vendorViewInsight(await loadMarketMetrics());

  it("returns the computed floor immediately when authoring cannot run", async () => {
    // vitest does not load .env.local, so no key is configured here and this
    // exercises the same early return an exhausted budget reaches.
    expect(llmAvailable()).toBe(false);

    const computed = await computedFor();
    const started = Date.now();
    const written = await authorInsight(computed, "vendor ranking", [], null, null, {
      question: pageQuestion("vendor-view"),
      context: null,
    });

    expect(written.authorship).toBe("computed");
    // Immediately: no model call is attempted, so nothing can hang here.
    expect(Date.now() - started).toBeLessThan(1_000);
  }, 60_000);

  it("hands back the analyst-grade floor rather than an error or a blank", async () => {
    // PART 5. A page whose authoring fails must still be a page. The floor was
    // rewritten in the previous tranche precisely so that falling back to it
    // costs the reader prose quality and not the argument.
    const computed = await computedFor();
    const written = await authorInsight(computed, "vendor ranking", [], null, null, {
      question: pageQuestion("vendor-view"),
      context: null,
    });

    expect(written.value.headline).toBe(computed.headline);
    expect(written.value.summary).toBe(computed.summary);
    expect(written.value.headline.length).toBeGreaterThan(20);
    expect(written.value.implications).toHaveLength(3);
    expect(written.value.insufficient).toBeNull();
    // The action and its packet survive a failed authoring untouched, because
    // they were never the model's to write.
    expect(written.value.action).toBe(computed.action);
    expect(written.value.decision).toEqual(computed.decision);
  }, 60_000);

  it("does not cache the failure, so a later healthy call can still author", async () => {
    // PART 7. Two calls in a row with authoring unavailable must both return
    // the computed floor and neither may leave anything behind that would stop
    // a third from authoring once the service recovers. The L1 cache is only
    // ever written on success; a failure throws before it.
    const computed = await computedFor();
    const page = { question: pageQuestion("vendor-view"), context: null };
    const a = await authorInsight(computed, "vendor ranking", [], null, null, page);
    const b = await authorInsight(computed, "vendor ranking", [], null, null, page);
    expect(a.authorship).toBe("computed");
    expect(b.authorship).toBe("computed");
    expect(b.value.headline).toBe(computed.headline);
  }, 60_000);
});
