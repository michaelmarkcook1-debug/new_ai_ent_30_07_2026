import { WARM_PAGES } from "@/lib/analyst/warm-list";

// Preparing every authored reading, when a person asks for it.
//
// NEVER ON A SCHEDULE. This ran twice a day from a Vercel cron until
// 6 September 2026, when the cron, the route and its secret were removed at
// the owner's instruction: analyst readings are prepared only when a human
// runs `npm run warm -- --yes`, or when a reader opens a page. The pool below
// is what that script uses. Nothing else calls it.
//
// THE PROBLEM THIS REPLACES. The first cron fetched the warm pages one at a
// time with no per-page abort and no elapsed budget, inside a 300-second
// maxDuration. On Opus 5 a full cold pass was about 240 seconds and fitted.
// On Fable 5.1 a cold reading is a 42-second median and a 70-second worst case
// (RULES-AND-CALCULATIONS 8.33), so the same pass is about 450 seconds: the
// platform killed the function part way down the list, nothing was logged,
// and the pages after the cut waited for the next run or the next reader.
// Which pages those were depended on list order.
//
// THREE THINGS FIX THAT, AND EACH IS SEPARATELY NECESSARY. A bounded pool
// brings the pass inside the ceiling; a per-target abort stops one hung page
// holding a worker; an elapsed budget stops the pass starting work it cannot
// finish, so whatever is left is REPORTED as remaining rather than lost when
// the platform pulls the plug. A report that says "success" while targets
// remain is the failure this file exists to make impossible.
//
// WHAT THIS DOES NOT DO. It never calls the model. It fetches pages, and the
// page's own render decides whether a reading is served from cache, authored,
// or falls back to computed prose. Warming adds no reader-time model call and
// no model call of its own; the only calls it can cause are the ones a reader
// would have caused by opening the page.

/**
 * How many pages render at once.
 *
 * SELECTED ON MEASURED DURATIONS, 5 September 2026. The cold model-call time
 * of every warm target on Fable 5.1 (8.33, sequential, idle) was run through
 * this pool in tests/warm-schedule.test.ts. Sequential is about 450 seconds.
 * At 3 the pass takes 172 seconds, which fits the 240-second budget but not
 * once the two adversities that were actually observed are added: calls ran
 * about 25 per cent slower under build load, and one page needed a retry of
 * its slowest reading. 172 x 1.25 + 57 is 272. At 4 the same arithmetic
 * lands inside the budget, so 4 is the lowest that fits with the margin the
 * test pins. The final Fable build authored seven readings concurrently with
 * no rate limit, so 4 is well inside what the account has already carried.
 * A live run at this concurrency is recorded in 8.34 once the account can
 * author again; it was blocked on 5 September by an exhausted credit balance.
 */
export const WARM_CONCURRENCY = 4;

/**
 * How long one page may take. The same ceiling as scripts/warm-insights.mjs:
 * a Fable reading at the 120-second insight ceiling plus a retry does not fit,
 * deliberately, because a page that needs the retry AND the full ceiling is a
 * page to report, not to wait for.
 */
export const WARM_PAGE_TIMEOUT_MS = 150_000;

/**
 * How long the pass may run before it stops STARTING pages. The default suits
 * a 300-second hosting window; the manual script has no such ceiling and
 * passes its own. A target not started by then is counted as remaining.
 */
export const WARM_BUDGET_MS = 240_000;

/**
 * Below this a written page was served from cache; at or above it the page
 * authored during the request. Production served cached pages in 0.2 to 1.3
 * seconds (31 August 2026) and no Fable authoring call has returned in under
 * 15 seconds (8.33, 8.34), so five seconds has a wide margin on both sides.
 * It is a classification threshold, not a guard: a wrong side costs a label.
 */
export const AUTHORED_THRESHOLD_MS = 5_000;

/**
 * The authorship badge, as the page renders it. Anchored on the span rather
 * than the words because the derivation drawer's prose contains the phrase
 * "analyst written" on every insight page (8.33).
 */
export const WRITTEN_BADGE = 'text-muted">analyst written</span>';
export const COMPUTED_BADGE = 'text-muted">computed</span>';

export type WarmOutcome =
  | "authored"
  | "cached"
  | "fallback"
  | "failed"
  | "timed-out"
  | "remaining";

export interface WarmResult {
  path: string;
  outcome: WarmOutcome;
  status: number | null;
  ms: number;
}

export interface WarmReport {
  /** Every target was fetched and none failed or timed out. Fallbacks are counted, not failures. */
  success: boolean;
  requested: number;
  authored: number;
  cached: number;
  fallback: number;
  failed: number;
  timedOut: number;
  remaining: number;
  remainingPaths: string[];
  concurrency: number;
  totalMs: number;
  results: WarmResult[];
}

/** What one fetched page tells us about its reading. */
export function classify(
  status: number | null,
  ms: number,
  html: string,
  timedOut: boolean
): WarmOutcome {
  if (timedOut) return "timed-out";
  if (status !== 200) return "failed";
  if (html.includes(COMPUTED_BADGE)) return "fallback";
  if (html.includes(WRITTEN_BADGE)) {
    return ms >= AUTHORED_THRESHOLD_MS ? "authored" : "cached";
  }
  // No badge at all: this page has no analyst reading, so warming it does
  // nothing. /trust-rank was on the list for that reason until 5 September 2026.
  return "failed";
}

export interface WarmOptions {
  origin: string;
  /** Sent with every page fetch, e.g. the demo gate's Basic credentials when that gate is on. */
  pageHeaders?: Record<string, string>;
  paths?: readonly string[];
  concurrency?: number;
  pageTimeoutMs?: number;
  budgetMs?: number;
  fetchImpl?: typeof fetch;
  now?: () => number;
}

/** Fetch every target through a bounded pool and account for each one. */
export async function runWarm(opts: WarmOptions): Promise<WarmReport> {
  const paths = opts.paths ?? WARM_PAGES;
  const concurrency = Math.max(1, opts.concurrency ?? WARM_CONCURRENCY);
  const pageTimeoutMs = opts.pageTimeoutMs ?? WARM_PAGE_TIMEOUT_MS;
  const budgetMs = opts.budgetMs ?? WARM_BUDGET_MS;
  const fetchImpl = opts.fetchImpl ?? fetch;
  const now = opts.now ?? Date.now;

  const started = now();
  const queue = [...paths];
  const results: WarmResult[] = [];
  const remainingPaths: string[] = [];

  const one = async (path: string): Promise<void> => {
    const t = now();
    let status: number | null = null;
    let html = "";
    let timedOut = false;
    try {
      const res = await fetchImpl(`${opts.origin}${path}`, {
        headers: { "user-agent": "ai-enterprise-warm/2.0", ...(opts.pageHeaders ?? {}) },
        cache: "no-store",
        signal: AbortSignal.timeout(pageTimeoutMs),
      });
      status = res.status;
      html = await res.text();
    } catch (err) {
      timedOut =
        err instanceof Error &&
        (err.name === "TimeoutError" || err.name === "AbortError");
    }
    const ms = now() - t;
    results.push({ path, outcome: classify(status, ms, html, timedOut), status, ms });
  };

  // Each worker takes the next path only if the budget still allows starting
  // one. When it does not, the worker hands the rest of the queue to the
  // report and stops. The check is BEFORE starting, so a budget can never be
  // exceeded by a target that was begun in the last second.
  const worker = async (): Promise<void> => {
    while (queue.length > 0) {
      if (now() - started >= budgetMs) {
        remainingPaths.push(...queue.splice(0));
        return;
      }
      const path = queue.shift();
      if (path === undefined) return;
      await one(path);
    }
  };
  await Promise.all(
    Array.from({ length: Math.min(concurrency, paths.length) }, worker)
  );

  const count = (o: WarmOutcome) => results.filter((r) => r.outcome === o).length;
  const report: WarmReport = {
    success: false,
    requested: paths.length,
    authored: count("authored"),
    cached: count("cached"),
    fallback: count("fallback"),
    failed: count("failed"),
    timedOut: count("timed-out"),
    remaining: remainingPaths.length,
    remainingPaths,
    concurrency,
    totalMs: now() - started,
    results,
  };
  report.success =
    report.failed === 0 &&
    report.timedOut === 0 &&
    report.remaining === 0 &&
    report.authored + report.cached + report.fallback === report.requested;
  return report;
}
