import { NextRequest, NextResponse } from "next/server";
import { EXPOSURE_NODES } from "@/lib/aie";

// Logo proxy for the dependency graph. Two reasons this exists rather than
// pointing an <image href> straight at a third party:
//
//  1. Spec rule 5: browser traffic goes through our own server routes. A
//     direct third-party image embed leaks the viewer's IP and referrer to a
//     service we do not control.
//  2. A dead or blocked upstream renders a broken-image glyph in the SVG.
//     This route always answers with a valid image, so the worst case is a
//     transparent pixel and the monogram drawn underneath shows through.
//
// The graph is fully legible with zero logos: they are decoration over a
// monogram that is always drawn.

const UPSTREAM = (domain: string) => `https://logo.clearbit.com/${domain}`;
const TIMEOUT_MS = 4_000;
const CACHE_TTL_MS = 86_400_000;

// Whitelist from the dataset itself, so this cannot be used as an open image
// proxy for arbitrary hosts.
const ALLOWED: Set<string> = new Set(
  EXPOSURE_NODES.map((n) => n.logoDomain).filter((d): d is string => Boolean(d))
);

// 1x1 transparent SVG: a valid image response that reveals the monogram.
const BLANK = '<svg xmlns="http://www.w3.org/2000/svg" width="1" height="1"/>';

type CacheEntry = { body: ArrayBuffer | null; type: string; at: number };
const cache = new Map<string, CacheEntry>();

function blankResponse(reason: string) {
  return new NextResponse(BLANK, {
    status: 200,
    headers: {
      "content-type": "image/svg+xml",
      "cache-control": "public, max-age=3600",
      "x-eai-logo": reason,
    },
  });
}

export async function GET(
  _req: NextRequest,
  { params }: { params: Promise<{ domain: string }> }
) {
  const { domain } = await params;

  if (!ALLOWED.has(domain)) {
    return blankResponse("not-allowed");
  }

  const hit = cache.get(domain);
  if (hit && Date.now() - hit.at < CACHE_TTL_MS) {
    if (!hit.body) return blankResponse("cached-miss");
    return new NextResponse(hit.body, {
      status: 200,
      headers: {
        "content-type": hit.type,
        "cache-control": "public, max-age=86400",
        "x-eai-logo": "cached",
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

    if (!res.ok) {
      cache.set(domain, { body: null, type: "", at: Date.now() });
      return blankResponse("upstream-" + res.status);
    }

    const type = res.headers.get("content-type") ?? "image/png";
    if (!type.startsWith("image/")) {
      cache.set(domain, { body: null, type: "", at: Date.now() });
      return blankResponse("not-an-image");
    }

    const body = await res.arrayBuffer();
    cache.set(domain, { body, type, at: Date.now() });
    return new NextResponse(body, {
      status: 200,
      headers: {
        "content-type": type,
        "cache-control": "public, max-age=86400",
        "x-eai-logo": "live",
      },
    });
  } catch {
    cache.set(domain, { body: null, type: "", at: Date.now() });
    return blankResponse("unreachable");
  }
}
