import { NextRequest, NextResponse } from "next/server";
import { promises as fs } from "fs";
import path from "path";

// Proxy to the deployed AI Enterprise app's PUBLIC JSON APIs
// (ranking-engine-red.vercel.app), the spec-sanctioned secondary source for
// current AIE content. Same discipline as the BoardRadar proxy: GET only,
// whitelist, 300s cache, 12s timeout, one retry, fixture fallback so mock
// mode and stage failures never kill a page. No credentials involved; the
// upstream routes are public.

const AIE_BASE = "https://ranking-engine-red.vercel.app/api";

const ALLOWED = new Set([
  "news",
  "vendors",
  "market-share",
  "model-inventory",
  "reputation",
  "uptake",
  "pricing",
  "capabilities",
  "market-dashboard",
  "metadata",
]);

const CACHE_TTL_MS = 300_000;
const TIMEOUT_MS = 12_000;

type CacheEntry = { body: string; at: number };
const cache = new Map<string, CacheEntry>();

// The news archive upstream is ~2.7 MB; slice it server-side so the browser
// never downloads more than it renders.
function trimNews(body: string, limit: number): string {
  try {
    const parsed = JSON.parse(body);
    if (Array.isArray(parsed.news)) {
      parsed.news = parsed.news.slice(0, limit);
    }
    return JSON.stringify(parsed);
  } catch {
    return body;
  }
}

async function readFixture(apiPath: string): Promise<string | null> {
  try {
    return await fs.readFile(
      path.join(process.cwd(), "fixtures", "aie-live", `${apiPath}.json`),
      "utf8"
    );
  } catch {
    return null;
  }
}

export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ path: string[] }> }
) {
  const { path: segments } = await params;
  const apiPath = segments.join("/");

  if (!ALLOWED.has(apiPath)) {
    return NextResponse.json(
      {
        success: false,
        error: `Path not on the AIE whitelist: ${apiPath}`,
        code: "PATH_NOT_ALLOWED",
        timestamp: new Date().toISOString(),
      },
      { status: 403, headers: { "x-eai-source": "error" } }
    );
  }

  const search = new URLSearchParams(request.nextUrl.searchParams);
  const limit = Math.min(Number(search.get("limit") ?? 60) || 60, 200);
  search.delete("limit");
  const qs = search.toString();
  const cacheKey = `${apiPath}?${qs}&l=${limit}`;
  const mockMode = process.env.MOCK_MODE === "true";

  if (!mockMode) {
    const hit = cache.get(cacheKey);
    if (hit && Date.now() - hit.at < CACHE_TTL_MS) {
      return new NextResponse(hit.body, {
        headers: {
          "content-type": "application/json",
          "x-eai-source": "live",
          "x-eai-cache": "hit",
        },
      });
    }

    const url = `${AIE_BASE}/${apiPath}${qs ? `?${qs}` : ""}`;
    for (let attempt = 0; attempt < 2; attempt++) {
      try {
        const controller = new AbortController();
        const timer = setTimeout(() => controller.abort(), TIMEOUT_MS);
        const res = await fetch(url, {
          signal: controller.signal,
          cache: "no-store",
        });
        clearTimeout(timer);
        if (res.ok) {
          let body = await res.text();
          if (apiPath === "news") body = trimNews(body, limit);
          cache.set(cacheKey, { body, at: Date.now() });
          return new NextResponse(body, {
            headers: {
              "content-type": "application/json",
              "x-eai-source": "live",
            },
          });
        }
        // Upstream 4xx (e.g. the uptake filter error) is a real answer.
        if (res.status < 500) {
          const body = await res.text();
          return new NextResponse(body, {
            status: res.status,
            headers: {
              "content-type": "application/json",
              "x-eai-source": "live",
            },
          });
        }
      } catch {
        // timeout or network failure; retry once, then fixtures
      }
    }
  }

  let fixture = await readFixture(apiPath);
  if (fixture) {
    if (apiPath === "news") fixture = trimNews(fixture, limit);
    return new NextResponse(fixture, {
      headers: {
        "content-type": "application/json",
        "x-eai-source": "mock",
      },
    });
  }

  return NextResponse.json(
    {
      success: false,
      error: "AIE live call failed and no recorded fixture exists",
      code: "UPSTREAM_UNAVAILABLE",
      timestamp: new Date().toISOString(),
    },
    { status: 503, headers: { "x-eai-source": "error" } }
  );
}
