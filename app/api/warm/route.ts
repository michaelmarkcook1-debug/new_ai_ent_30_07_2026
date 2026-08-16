import { NextRequest, NextResponse } from "next/server";
import { WARM_PAGES } from "@/lib/analyst/warm-list";

// Keep the authored readings warm, so no reader ever pays to generate one.
//
// THE PROBLEM THIS CLOSES. The analyst reading is authored inside the render
// path and cached for 24 hours. That is fine until the hour the cache expires,
// when whichever reader arrives next waits for a full Opus call before the
// first byte. Measured on production: /vendor-view returned 0.4s warm and 2.5s
// on the visit that paid, and before the cache-key fix on 8 August it was 38s.
// The 38 seconds were a bug and are gone; this is the residue, and it is
// structural rather than a bug: somebody has to pay, and it should not be a
// reader.
//
// WHY A CRON RATHER THAN BACKGROUND REVALIDATION. The reading is not a cheap
// fetch that can be refreshed behind a stale response. It is a chain of live
// pulls and then an Opus call with two guard passes and a retry, so the honest
// options are to pay it on a schedule or to pay it in front of somebody. This
// pays it on a schedule.
//
// TWELVE HOURS AGAINST A TWENTY-FOUR HOUR TTL. Deliberately half, so a missed
// run is a late refresh rather than a cold page. The cost is two full warms a
// day: 11 pages against a refresh budget the register puts at $0.0039 a month
// for everything else, so the analyst calls dominate it and are still small.
//
// This does not cover the minutes after a deploy, because the cache key carries
// the build id and a deploy empties it wholesale. scripts/warm-insights.mjs
// remains the post-deploy step in the runbook, and shares WARM_PAGES with this
// so the two lists cannot drift.

export const maxDuration = 300;

/**
 * Whether this request is genuinely the scheduler.
 *
 * The endpoint spends real money per call, so an open one is a way for anybody
 * to run up the bill. Vercel stamps `x-vercel-cron` on its own invocations and
 * sends `Authorization: Bearer $CRON_SECRET` when that variable is set. Either
 * is accepted; neither present is a 401.
 */
function authorised(request: NextRequest): boolean {
  if (request.headers.get("x-vercel-cron")) return true;
  const secret = process.env.CRON_SECRET;
  if (!secret) return false;
  return request.headers.get("authorization") === `Bearer ${secret}`;
}

export async function GET(request: NextRequest) {
  if (!authorised(request)) {
    return NextResponse.json(
      {
        success: false,
        error: "This endpoint is for the scheduler. It spends API budget per call.",
        code: "NOT_SCHEDULER",
      },
      { status: 401 }
    );
  }

  // Its own origin, so this works on a preview deployment as well as
  // production without a hardcoded host.
  const origin = new URL(request.url).origin;
  const started = Date.now();
  const results: { path: string; status: number | null; ms: number }[] = [];

  // One at a time. Eleven concurrent Opus calls would race the same cold
  // instances and could trip an upstream rate limit, which is a worse outcome
  // than taking a minute over it. Same reasoning as the post-deploy script.
  for (const path of WARM_PAGES) {
    const t = Date.now();
    try {
      const res = await fetch(`${origin}${path}`, {
        headers: { "user-agent": "ai-enterprise-warm/1.0" },
        cache: "no-store",
      });
      results.push({ path, status: res.status, ms: Date.now() - t });
    } catch {
      // A page that fails to warm is a page that will be slow for one reader,
      // not a reason to abandon the other ten.
      results.push({ path, status: null, ms: Date.now() - t });
    }
  }

  const failed = results.filter((r) => r.status !== 200);
  // Nobody watches a cron. If a page stops warming, the only symptom a reader
  // sees is that one tab is occasionally slow, which is invisible in aggregate
  // and easy to blame on the network. This is the one line that would name it.
  if (failed.length > 0) {
    console.error(
      `[warm] ${failed.length} of ${results.length} pages failed:`,
      failed.map((f) => `${f.path} -> ${f.status ?? "no response"}`).join(", ")
    );
  }
  return NextResponse.json({
    success: failed.length === 0,
    warmed: results.length - failed.length,
    attempted: results.length,
    totalMs: Date.now() - started,
    slowest: [...results].sort((a, b) => b.ms - a.ms)[0] ?? null,
    failures: failed,
  });
}
