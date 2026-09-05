import { NextRequest, NextResponse } from "next/server";
import { isScheduler, runWarm } from "@/lib/analyst/warm";

// Keep the authored readings warm, so no reader ever pays to generate one.
//
// THE PROBLEM THIS CLOSES. The analyst reading is authored inside the render
// path and cached for 24 hours under a key that carries the evidence and the
// authoring contract (lib/analyst/llm.ts). When either changes there is no
// entry to serve, stale or otherwise, and whichever request arrives first
// waits for a full model call before the first byte: 42 seconds at the Fable
// 5.1 median. This pays that on a schedule instead of in front of a reader.
//
// WHY A CRON RATHER THAN BACKGROUND REVALIDATION. An entry that merely expired
// is served stale while it revalidates, and no reader waits. A key that
// CHANGED has nothing to serve, and background revalidation cannot help with
// what does not exist. Evidence moves daily and the contract moves with each
// release, so the schedule runs half an hour after the daily fixture sync and
// again twelve hours later, and a valid current cache makes a run cheap: the
// page returns in under a second and no model is called (8.34).
//
// THE EXECUTION IS IN lib/analyst/warm.ts, which is pure enough to test: a
// bounded pool, a per-page abort, an elapsed budget, and a report that counts
// every target as authored, cached, fallback, failed, timed out or remaining.
// A run that did not finish every target answers 503 and says which remain.
// Its predecessor fetched sequentially with no budget and was killed silently
// by the platform once Fable 5.1 pushed a cold pass past 300 seconds.

export const maxDuration = 300;

export async function GET(request: NextRequest) {
  const secret = process.env.CRON_SECRET;
  if (!isScheduler(request.headers.get("authorization"), secret)) {
    return NextResponse.json(
      {
        success: false,
        error: "This endpoint is for the scheduler. It spends API budget per call.",
        // Tells the operator which of the two closed states this is. Neither
        // reveals anything a caller could use: the endpoint is shut either way.
        code: secret ? "NOT_SCHEDULER" : "CRON_SECRET_UNSET",
      },
      { status: 401 }
    );
  }

  // The pages sit behind the demo gate when DEMO_USER and DEMO_PASS are set
  // (middleware.ts). The gate exempts this route but not the pages it fetches,
  // so without this every fetch would come back 401 and the run would report
  // ten failures, which is exactly what happened on a local check on
  // 5 September 2026. Same process, same environment: nothing leaves it.
  const user = process.env.DEMO_USER;
  const pass = process.env.DEMO_PASS;
  const pageHeaders =
    user && pass
      ? { authorization: `Basic ${Buffer.from(`${user}:${pass}`).toString("base64")}` }
      : undefined;
  const report = await runWarm({ origin: new URL(request.url).origin, pageHeaders });

  if (!report.success) {
    console.error(
      `[warm] INCOMPLETE after ${report.totalMs}ms: failed ${report.failed}, timed out ${report.timedOut}, remaining ${report.remaining}` +
        (report.remainingPaths.length > 0 ? ` (${report.remainingPaths.join(", ")})` : "") +
        `; ` +
        report.results
          .filter((r) => r.outcome === "failed" || r.outcome === "timed-out")
          .map((r) => `${r.path} -> ${r.outcome}${r.status !== null ? ` ${r.status}` : ""}`)
          .join(", ")
    );
  }
  if (report.fallback > 0) {
    // Not a warm failure: the page rendered and the reading fell back to its
    // computed floor, which is the truth architecture declining to publish a
    // draft. Visible here because a fallback that recurs is worth a look.
    console.warn(
      `[warm] ${report.fallback} page(s) rendered computed: ${report.results
        .filter((r) => r.outcome === "fallback")
        .map((r) => r.path)
        .join(", ")}`
    );
  }
  return NextResponse.json(report, { status: report.success ? 200 : 503 });
}
