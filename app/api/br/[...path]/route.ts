import { NextRequest, NextResponse } from "next/server";
import { promises as fs } from "fs";
import path from "path";

// The only door to the BoardRadar API (spec Section 6).
// GET only, whitelisted prefixes, key injected server-side, 300s cache,
// 12s timeout with one retry, 60 req/min per IP, fixture fallback (mock mode).

const ALLOWED_PREFIXES = [
  "companies",
  "providers",
  "pulse",
  "financial",
  "financial-snapshot",
  "talent",
  "ai-exposure",
  "reputation-tracker",
  "competitive-intelligence",
  "governance",
  "governance-risk",
  "cyber-risk",
  "news",
  "ai-readiness",
  "assessment",
  "ai-platform",
  "ai-talent",
  "context",
  "edgar",
  "peer-financials",
  "fx",
  "narrative-reality-gap",
  "market-signals",
];

const CACHE_TTL_MS = 300_000;
// Was 12s with an unconditional retry, so a stalling upstream cost 24s of dead
// air before the fixture appeared. Measured 4 Aug 2026: a ticker BoardRadar
// answers at all comes back in 1.3-1.5s, so 8s is far beyond a slow success
// and only ever truncates a hang.
const TIMEOUT_MS = 8_000;
const RATE_LIMIT_PER_MIN = 60;

type CacheEntry = { body: string; status: number; at: number; source: string };
const cache = new Map<string, CacheEntry>();
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

function errorJson(status: number, code: string, message: string) {
  return NextResponse.json(
    {
      success: false,
      error: message,
      code,
      timestamp: new Date().toISOString(),
    },
    { status, headers: { "x-eai-source": "error" } }
  );
}

// Fixture file name: path slashes -> underscores, plus optional _TICKER suffix.
// Example: financial-snapshot/overview?ticker=MSFT ->
//   fixtures/br/financial-snapshot_overview_MSFT.json
//   falling back to fixtures/br/financial-snapshot_overview.json
async function readFixture(
  apiPath: string,
  ticker: string | null
): Promise<string | null> {
  const base = apiPath.replace(/\//g, "_");
  const dir = path.join(process.cwd(), "fixtures", "br");
  const candidates = ticker ? [`${base}_${ticker}.json`, `${base}.json`] : [`${base}.json`];
  for (const name of candidates) {
    try {
      return await fs.readFile(path.join(dir, name), "utf8");
    } catch {
      // try next candidate
    }
  }
  return null;
}

/** Thrown when the upstream ran past TIMEOUT_MS rather than failing outright. */
class UpstreamTimeout extends Error {}

async function fetchWithTimeout(url: string): Promise<Response> {
  const controller = new AbortController();
  let timedOut = false;
  const timer = setTimeout(() => {
    timedOut = true;
    controller.abort();
  }, TIMEOUT_MS);
  try {
    return await fetch(url, {
      headers: { "X-API-Key": process.env.ANALYSTGENIUS_API_KEY ?? "" },
      signal: controller.signal,
      cache: "no-store",
    });
  } catch (err) {
    if (timedOut) throw new UpstreamTimeout();
    throw err;
  } finally {
    clearTimeout(timer);
  }
}

export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ path: string[] }> }
) {
  const { path: segments } = await params;
  const apiPath = segments.join("/");

  if (!ALLOWED_PREFIXES.some((p) => apiPath === p || apiPath.startsWith(`${p}/`))) {
    return errorJson(403, "PATH_NOT_ALLOWED", `Path not on the whitelist: ${apiPath}`);
  }

  const ip =
    request.headers.get("x-forwarded-for")?.split(",")[0]?.trim() ?? "local";
  if (rateLimited(ip)) {
    return errorJson(429, "RATE_LIMITED", "Too many requests, slow down");
  }

  // Forward query params except userId (omitting it returns public and
  // estimated values, correct for the demo) and never forward any key.
  const search = new URLSearchParams(request.nextUrl.searchParams);
  search.delete("userId");
  search.delete("apiKey");
  const qs = search.toString();
  const ticker = search.get("ticker");
  const cacheKey = `${apiPath}?${qs}`;

  const mockMode = process.env.MOCK_MODE === "true";

  if (!mockMode) {
    const hit = cache.get(cacheKey);
    if (hit && Date.now() - hit.at < CACHE_TTL_MS) {
      return new NextResponse(hit.body, {
        status: hit.status,
        headers: {
          "content-type": "application/json",
          "x-eai-source": hit.source,
          "x-eai-cache": "hit",
        },
      });
    }

    const url = `${process.env.ANALYSTGENIUS_API_BASE}/${apiPath}${qs ? `?${qs}` : ""}`;
    for (let attempt = 0; attempt < 2; attempt++) {
      try {
        const res = await fetchWithTimeout(url);
        const body = await res.text();
        // A 4xx carrying JSON is a real answer (e.g. MISSING_IDENTIFIER), so
        // it passes through and the UI renders an honest state. A response
        // that is not JSON at all is a routing failure, not data: the API
        // serves an HTML error page for a path it does not recognise. Calling
        // that "live" would badge a dead route as a successful pull, so it
        // falls through to the recorded fixture instead. Retry only on 5xx.
        const looksJson = (res.headers.get("content-type") ?? "").includes(
          "json"
        );
        if (res.status < 500 && looksJson) {
          cache.set(cacheKey, {
            body,
            status: res.status,
            at: Date.now(),
            source: "live",
          });
          return new NextResponse(body, {
            status: res.status,
            headers: {
              "content-type": "application/json",
              "x-eai-source": "live",
            },
          });
        }
      } catch (err) {
        // An upstream that did not answer inside the window is stalling, not
        // flickering, so a second full window buys nothing and doubles the time
        // the user spends watching a spinner. Give up and serve the fixture.
        // A fast network failure still gets its one retry.
        if (err instanceof UpstreamTimeout) break;
      }
    }
  }

  const fixture = await readFixture(apiPath, ticker);
  if (fixture) {
    return new NextResponse(fixture, {
      status: 200,
      headers: {
        "content-type": "application/json",
        "x-eai-source": "mock",
      },
    });
  }

  return errorJson(
    503,
    "UPSTREAM_UNAVAILABLE",
    "Live call failed and no recorded fixture exists for this path"
  );
}
