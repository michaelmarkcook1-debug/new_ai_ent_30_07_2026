import { NextRequest, NextResponse } from "next/server";
import {
  catalogueConfigured,
  observationsWithCap,
  runs,
  toMovements,
  type Series,
} from "@/lib/catalogue/client";

// GET /api/catalogue/{model|vendor|market|usage}
//
// What has moved in one series, and by how much.
//
// The movement is computed here rather than in the browser for the same reason
// the FitEngine arithmetic lives in the engine: a figure that exists in two
// places drifts, and the one on screen must be the one the API stands behind.
//
// A subject with a single observation returns `change: null`, not zero. A
// first reading is not a movement of nothing, and rendering it as a flat line
// would invent a trend from one data point.

const CACHE_TTL_MS = 300_000;

// The three series that are observations. `usage` is deliberately absent.
//
// It was listed here and answered 200 with an empty movement set and the note
// "First observations recorded" — which read as a pipeline that had started
// and would fill up, when in fact nothing can ever land there. Usage is
// recorded as events in `aie.usage_event`, aggregated by the `usage_summary`
// function, and served by /api/admin/overview. It is not an observation and
// never passes through `aie.observation`, so asking this endpoint for it was
// always going to return nothing. A 400 naming the real home is a truer answer
// than an empty 200.
const ALLOWED = new Set<Series>(["model", "vendor", "market"]);

type CacheEntry = { body: string; at: number };
const cache = new Map<string, CacheEntry>();

export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ series: string }> }
) {
  const { series } = await params;
  if (!ALLOWED.has(series as Series)) {
    return NextResponse.json(
      {
        success: false,
        error:
          series === "usage"
            ? "Usage is recorded as events, not observations, so it has no movement series. The aggregate is on /api/admin/overview."
            : `Unknown series: ${series}`,
        code: "SERIES_NOT_ALLOWED",
        supported: [...ALLOWED],
      },
      { status: 400, headers: { "x-eai-source": "error" } }
    );
  }

  if (!catalogueConfigured()) {
    return NextResponse.json(
      {
        success: false,
        error: "No catalogue is configured.",
        code: "NO_CATALOGUE",
      },
      { status: 503, headers: { "x-eai-source": "error" } }
    );
  }

  const hit = cache.get(series);
  if (hit && Date.now() - hit.at < CACHE_TTL_MS) {
    return new NextResponse(hit.body, {
      headers: {
        "content-type": "application/json",
        "x-eai-source": "live",
        "x-eai-cache": "hit",
      },
    });
  }

  try {
    const [{ rows, total, truncated }, recentRuns] = await Promise.all([
      observationsWithCap(series as Series),
      runs(5),
    ]);
    const movements = toMovements(rows);
    // Biggest movers first, and subjects with no comparison yet at the end —
    // they are not "no change", they are "not yet comparable", and sorting
    // them among the flat ones would blur that.
    movements.sort((a, b) => {
      if (a.change === null && b.change === null) return b.latest - a.latest;
      if (a.change === null) return 1;
      if (b.change === null) return -1;
      return Math.abs(b.change) - Math.abs(a.change);
    });

    const withComparison = movements.filter((m) => m.change !== null).length;
    const body = JSON.stringify({
      series,
      observations: rows.length,
      // The server's own count, so a short answer is visibly short.
      observationsInSeries: total,
      // One entry per subject-and-metric pair, not per subject: a model with a
      // price and a throughput reading is two tracked figures, and calling
      // that "one subject" would understate what is being followed.
      tracked: movements.length,
      comparable: withComparison,
      // Never let a capped query read as a complete one.
      truncated,
      // Said plainly rather than left for the reader to infer from nulls.
      note: [
        // An empty series and a young one are different findings and must not
        // share a sentence. "First observations recorded" over zero rows says
        // the pipeline has started when it has not, which is the more
        // misleading of the two by far: it turns a silent failure into a
        // progress report.
        total === 0
          ? "No observations in this series yet. Nothing has been recorded, so there is nothing to compare — this is an empty series rather than a young one."
          : withComparison === 0
            ? "First observations recorded. Movement appears once a second reading exists, and nothing here is shown as a change until then."
            : `${withComparison} of ${movements.length} tracked figures have two or more observations and can be compared.`,
        truncated
          ? `Showing ${rows.length} of ${total} observations: this is a partial view of the series.`
          : null,
      ]
        .filter(Boolean)
        .join(" "),
      movements,
      lastRuns: recentRuns.map((r) => ({
        startedAt: r.started_at,
        ok: r.ok,
        rowsWritten: r.rows_written,
        failures: r.failures,
      })),
    });
    cache.set(series, { body, at: Date.now() });
    return new NextResponse(body, {
      headers: { "content-type": "application/json", "x-eai-source": "live" },
    });
  } catch (e) {
    return NextResponse.json(
      {
        success: false,
        error: e instanceof Error ? e.message : "catalogue unreachable",
        code: "CATALOGUE_ERROR",
      },
      { status: 502, headers: { "x-eai-source": "error" } }
    );
  }
}
