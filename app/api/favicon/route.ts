import { NextRequest, NextResponse } from "next/server";

// Favicon proxy for news source badges.
//
// Same reason as /api/logo: spec rule 5 says browser traffic goes through our
// own server routes. Embedding a third-party favicon service directly in an
// <img src> leaks every reader's IP, and which articles they are looking at,
// to that service on every page view.
//
// This never fetches the requested domain. It only ever calls one fixed
// upstream with the domain as a query value, so it cannot be used to reach
// arbitrary hosts, and the response is always a valid image.

const UPSTREAM = (domain: string) =>
  `https://www.google.com/s2/favicons?domain=${encodeURIComponent(domain)}&sz=32`;

const TIMEOUT_MS = 4_000;
const CACHE_TTL_MS = 86_400_000;

// A plain hostname: labels separated by dots, no scheme, no path, no port,
// no credentials. Anything else is refused rather than forwarded.
const HOST_RE = /^(?!-)[a-z0-9-]{1,63}(?<!-)(\.(?!-)[a-z0-9-]{1,63}(?<!-))+$/;

const BLANK = '<svg xmlns="http://www.w3.org/2000/svg" width="1" height="1"/>';

type Entry = { body: ArrayBuffer | null; type: string; at: number };
const cache = new Map<string, Entry>();

function blank(reason: string) {
  return new NextResponse(BLANK, {
    status: 200,
    headers: {
      "content-type": "image/svg+xml",
      "cache-control": "public, max-age=3600",
      "x-eai-favicon": reason,
    },
  });
}

export async function GET(req: NextRequest) {
  const domain = (req.nextUrl.searchParams.get("domain") ?? "")
    .trim()
    .toLowerCase();

  if (!domain || domain.length > 253 || !HOST_RE.test(domain)) {
    return blank("bad-domain");
  }

  const hit = cache.get(domain);
  if (hit && Date.now() - hit.at < CACHE_TTL_MS) {
    if (!hit.body) return blank("cached-miss");
    return new NextResponse(hit.body, {
      status: 200,
      headers: {
        "content-type": hit.type,
        "cache-control": "public, max-age=86400",
        "x-eai-favicon": "cached",
      },
    });
  }

  try {
    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), TIMEOUT_MS);
    const res = await fetch(UPSTREAM(domain), {
      signal: controller.signal,
      headers: { accept: "image/*" },
    });
    clearTimeout(timer);

    const type = res.headers.get("content-type") ?? "";
    if (!res.ok || !type.startsWith("image/")) {
      cache.set(domain, { body: null, type: "", at: Date.now() });
      return blank("upstream-" + res.status);
    }
    const body = await res.arrayBuffer();
    cache.set(domain, { body, type, at: Date.now() });
    return new NextResponse(body, {
      status: 200,
      headers: {
        "content-type": type,
        "cache-control": "public, max-age=86400",
        "x-eai-favicon": "live",
      },
    });
  } catch {
    cache.set(domain, { body: null, type: "", at: Date.now() });
    return blank("unreachable");
  }
}
