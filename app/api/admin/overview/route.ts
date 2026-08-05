import { NextResponse } from "next/server";
import {
  catalogueConfigured,
  runs,
  seriesCount,
  usageSummary,
  type Series,
} from "@/lib/catalogue/client";
import { edgarHealth } from "@/lib/adoption/edgar";
import { federalRegisterHealth } from "@/lib/adoption/federal-register";
import { allRunCosts, monthlyUsd, UNIT_PRICES } from "@/lib/admin/cost-model";

// GET /api/admin/overview
//
// Everything the admin page shows, in one request: recent ingestion runs with
// their list-price cost estimates, catalogue counts per series, connector
// health, and aggregate usage. The page is public like the rest of the site —
// an open kitchen suits a product whose whole thesis is provenance — and
// nothing served here could not already be derived from the public endpoints
// and the public database views.
//
// Failures are partial by design: if the catalogue is unreachable the
// connector health still returns, and each section says what it could not
// load rather than the whole page dying.

const CACHE_TTL_MS = 300_000;
let cached: { body: string; at: number } | null = null;

// Usage is not listed here: it lives in its own write-only table rather than
// the observation table, and its numbers arrive through the aggregate
// function below. Counting it as "0 observations" while the usage section
// shows events would read as a contradiction.
const SERIES: Series[] = ["model", "vendor", "market"];

export async function GET() {
  if (cached && Date.now() - cached.at < CACHE_TTL_MS) {
    return new NextResponse(cached.body, {
      headers: {
        "content-type": "application/json",
        "x-eai-source": "live",
        "x-eai-cache": "hit",
      },
    });
  }

  const connectors = [edgarHealth(), federalRegisterHealth()].map((c) => ({
    id: c.id,
    label: c.label,
    status: c.status,
    message: c.message ?? null,
  }));

  // Each section fails independently. A dead database should not take the
  // cost model down with it — the costs are arithmetic, not data.
  const [runsResult, countsResult, usageResult] = await Promise.allSettled([
    catalogueConfigured() ? runs(20) : Promise.resolve([]),
    Promise.all(SERIES.map(async (s) => ({ series: s, count: await seriesCount(s) }))),
    usageSummary(),
  ]);

  const body = JSON.stringify({
    costs: {
      perRun: allRunCosts().map((c) => ({
        series: c.series,
        label: c.label,
        invocationUsd: c.invocationUsd,
        cpuUsd: c.cpuUsd,
        memoryUsd: c.memoryUsd,
        upstreamUsd: c.upstreamUsd,
        totalUsd: c.totalUsd,
        requests: c.profile.requests,
        bytesIn: c.profile.bytesIn,
        wallSeconds: c.profile.wallSeconds,
        rowsWritten: c.profile.rowsWritten,
        measured: c.profile.measured,
      })),
      monthlyIfDailyUsd: monthlyUsd(1),
      unitPrices: UNIT_PRICES,
      note:
        "On the plans this product runs on (Vercel Hobby, Supabase Free) the marginal cost of every run is $0 — both are hard-capped, not metered, and every upstream API is free. The figures here are list-price arithmetic: measured quantities multiplied by the published paid-tier unit prices, showing what a run would cost if the caps were outgrown.",
    },
    runs:
      runsResult.status === "fulfilled"
        ? runsResult.value
        : { error: String(runsResult.reason?.message ?? "catalogue unreachable") },
    seriesCounts:
      countsResult.status === "fulfilled"
        ? countsResult.value
        : { error: String(countsResult.reason?.message ?? "catalogue unreachable") },
    usage:
      usageResult.status === "fulfilled"
        ? usageResult.value
        : { error: String(usageResult.reason?.message ?? "usage summary unreachable") },
    connectors,
    generatedAt: new Date().toISOString(),
  });

  cached = { body, at: Date.now() };
  return new NextResponse(body, {
    headers: { "content-type": "application/json", "x-eai-source": "live" },
  });
}
