import { NextRequest, NextResponse } from "next/server";
import { promises as fs } from "fs";
import path from "path";
import { ingestDisclosure } from "@/lib/adoption/ingest";

// GET /api/adoption/disclosure?form=10-K
//
// Our own endpoint, not a proxy. Every other data route in this app forwards
// to somebody else's API; this one owns its data, which is the point of the
// build: the adoption figures the product previously showed came from an
// upstream route serving a static May 2026 model, and no amount of proxying
// could make that fresher.
//
// Discipline copied from the two proxy routes so the three behave alike: a
// five-minute in-process cache, a source header the client reads to badge the
// lane, and a committed fixture fallback so a page never dies on a cold SEC.
//
//   x-eai-source: live      fetched from SEC EDGAR during this request
//   x-eai-source: mock      served from the committed snapshot
//   x-eai-source: error     neither worked, and the body says so
//
// MOCK_MODE=true forces the snapshot, as everywhere else in this app.

const CACHE_TTL_MS = 300_000;
const SNAPSHOT_DIR = path.join(process.cwd(), "data", "adoption");

type CacheEntry = { body: string; at: number };
const cache = new Map<string, CacheEntry>();

/**
 * Rate limit, tighter than the BoardRadar proxy's 60/min because one cache
 * MISS here fans out to eight outbound SEC requests rather than one.
 *
 * The cache is the real protection and this is the backstop, which is worth
 * being accurate about: with five allowed form types and a five-minute TTL,
 * one instance can cost the SEC at most forty requests per five minutes no
 * matter how much traffic arrives. Measured: twelve rapid requests produced
 * only two misses, the rest served warm. The limiter earns its place only
 * against a single caller cycling form types on a cold instance, and against
 * many instances it does nothing, because both the cache and the bucket are
 * per-instance. Getting throttled by the SEC would cost more than this page.
 */
const RATE_LIMIT_PER_MIN = 10;
const rateBuckets = new Map<string, { count: number; windowStart: number }>();

function rateLimited(ip: string): boolean {
  const now = Date.now();
  const bucket = rateBuckets.get(ip);
  if (!bucket || now - bucket.windowStart > 60_000) {
    rateBuckets.set(ip, { count: 1, windowStart: now });
    return false;
  }
  bucket.count += 1;
  return bucket.count > RATE_LIMIT_PER_MIN;
}

/** Form types worth exposing. Anything else is refused rather than forwarded. */
const ALLOWED_FORMS = new Set(["10-K", "10-Q", "8-K", "DEF 14A", "20-F"]);

async function readSnapshot(form: string): Promise<string | null> {
  try {
    return await fs.readFile(path.join(SNAPSHOT_DIR, `disclosure-${form}.json`), "utf8");
  } catch {
    return null;
  }
}

export async function GET(request: NextRequest) {
  const form = request.nextUrl.searchParams.get("form") ?? "10-K";
  if (!ALLOWED_FORMS.has(form)) {
    return NextResponse.json(
      {
        success: false,
        error: `Form type not supported: ${form}`,
        code: "FORM_NOT_ALLOWED",
        supported: [...ALLOWED_FORMS],
      },
      { status: 400, headers: { "x-eai-source": "error" } }
    );
  }

  const mockMode = process.env.MOCK_MODE === "true";

  const hit = cache.get(form);
  const cacheWarm = hit && Date.now() - hit.at < CACHE_TTL_MS;

  // Only a cache MISS costs the SEC anything, so only a miss is rate limited.
  // Limiting warm reads would punish the page for being popular.
  if (!mockMode && !cacheWarm) {
    const ip =
      request.headers.get("x-forwarded-for")?.split(",")[0]?.trim() ?? "local";
    if (rateLimited(ip)) {
      const snapshot = await readSnapshot(form);
      if (snapshot) {
        const parsed = JSON.parse(snapshot);
        parsed.snapshotOf = parsed.fetchedAt;
        return new NextResponse(JSON.stringify(parsed), {
          headers: { "content-type": "application/json", "x-eai-source": "mock" },
        });
      }
      return NextResponse.json(
        {
          success: false,
          error: "Too many requests, slow down",
          code: "RATE_LIMITED",
        },
        { status: 429, headers: { "x-eai-source": "error" } }
      );
    }
  }

  if (!mockMode) {
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
      // Eight throttled requests under one shared 20-second deadline. The
      // per-request timeout bounds a single call, not the run, so without the
      // shared budget a slow SEC could hold this open for over ninety seconds.
      // Vendors not reached inside the budget come back as recorded failures.
      const report = await ingestDisclosure(form);
      const body = JSON.stringify(report.snapshot);
      cache.set(form, { body, at: Date.now() });
      return new NextResponse(body, {
        headers: { "content-type": "application/json", "x-eai-source": "live" },
      });
    } catch {
      // Fall through to the snapshot. The failure is not swallowed: the
      // response is badged as the snapshot, and the snapshot carries its own
      // fetchedAt so the reader can see how old it is.
    }
  }

  const snapshot = await readSnapshot(form);
  if (snapshot) {
    const parsed = JSON.parse(snapshot);
    parsed.snapshotOf = parsed.fetchedAt;
    return new NextResponse(JSON.stringify(parsed), {
      headers: { "content-type": "application/json", "x-eai-source": "mock" },
    });
  }

  return NextResponse.json(
    {
      success: false,
      error: `No live answer and no committed snapshot for ${form}.`,
      code: "NO_DATA",
    },
    { status: 503, headers: { "x-eai-source": "error" } }
  );
}
