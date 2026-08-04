import { describe, it, expect, afterEach, vi } from "vitest";
import { ingestDisclosure } from "@/lib/adoption/ingest";
import { fetchDisclosure } from "@/lib/adoption/edgar";

// The run-level deadline, and the JSON guard.
//
// Both of these came out of an adversarial review of the shipped code, and
// both were real:
//
//   The per-request timeout bounds one call, not the run. Eight vendors each
//   allowed 12 seconds could hold a browser-facing request open for over
//   ninety seconds while the route's own comment claimed "about two seconds".
//
//   res.ok alone is not enough to trust a body. SEC answers undeclared
//   automated traffic with an HTML interstitial and a 200, which would parse
//   to an empty result and render as zero adoption — a fabricated figure by
//   omission, which is the one thing this product must never do.
//
// Both are tested against a stubbed fetch so the suite stays offline.

const realFetch = globalThis.fetch;

afterEach(() => {
  globalThis.fetch = realFetch;
  vi.restoreAllMocks();
});

/** A fetch that never answers until aborted, to simulate a hanging SEC. */
function hangingFetch() {
  return vi.fn((_url: string, init?: RequestInit) => {
    return new Promise((_resolve, reject) => {
      const signal = init?.signal;
      if (signal?.aborted) return reject(new Error("aborted"));
      signal?.addEventListener("abort", () => reject(new Error("aborted")), {
        once: true,
      });
    });
  });
}

describe("run-level deadline", () => {
  it("returns a partial answer instead of hanging when the source stalls", async () => {
    globalThis.fetch = hangingFetch() as unknown as typeof fetch;

    const started = Date.now();
    // Eight vendors would take 96 seconds on per-request timeouts alone.
    // With a one-second run budget the whole thing must come back promptly.
    await expect(ingestDisclosure("10-K", 365, 1_000)).rejects.toThrow(
      /produced no rows/i
    );
    const elapsed = Date.now() - started;

    // Generous ceiling; the point is that it is nowhere near 8 x 12s.
    expect(elapsed).toBeLessThan(15_000);
  }, 30_000);

  it("records every unreached vendor rather than dropping it", async () => {
    globalThis.fetch = hangingFetch() as unknown as typeof fetch;
    // A run where nothing succeeds throws rather than writing an empty
    // snapshot over a good one, and the message names what failed.
    await expect(ingestDisclosure("10-K", 365, 500)).rejects.toThrow(/OpenAI/);
  }, 30_000);

  it("aborts a single call once the shared deadline fires", async () => {
    globalThis.fetch = hangingFetch() as unknown as typeof fetch;
    const controller = new AbortController();
    setTimeout(() => controller.abort(), 100);
    const out = await fetchDisclosure(
      "OpenAI",
      "OpenAI",
      "10-K",
      365,
      controller.signal
    );
    expect(out.ok).toBe(false);
    expect(out.records).toHaveLength(0);
  }, 20_000);

  it("does not even start a vendor queued behind an expired deadline", async () => {
    globalThis.fetch = hangingFetch() as unknown as typeof fetch;
    const controller = new AbortController();
    controller.abort();
    const out = await fetchDisclosure(
      "OpenAI",
      "OpenAI",
      "10-K",
      365,
      controller.signal
    );
    expect(out.error).toMatch(/deadline/i);
    expect(globalThis.fetch).not.toHaveBeenCalled();
  });
});

describe("only a JSON answer counts as data", () => {
  it("refuses an HTML interstitial served with a 200", async () => {
    // Exactly what SEC returns to traffic it does not like. Without the
    // content-type guard this parses to zero hits and renders as zero
    // adoption, which is a fabricated figure by omission.
    globalThis.fetch = vi.fn(async () =>
      new Response("<html><body>Request blocked</body></html>", {
        status: 200,
        headers: { "content-type": "text/html" },
      })
    ) as unknown as typeof fetch;

    const out = await fetchDisclosure("Anthropic", "Anthropic");
    expect(out.ok).toBe(false);
    expect(out.records).toHaveLength(0);
    expect(out.error).toMatch(/Expected JSON/i);
    // The message points at the likely cause so an operator can act on it.
    expect(out.error).toMatch(/User-Agent/i);
  });

  it("accepts a genuine JSON answer", async () => {
    globalThis.fetch = vi.fn(async () =>
      new Response(
        JSON.stringify({
          hits: {
            total: { value: 3 },
            hits: [
              {
                _id: "0001018724-26-000004:amzn-20251231.htm",
                _source: {
                  ciks: ["0001018724"],
                  display_names: ["AMAZON COM INC  (AMZN)"],
                  file_date: "2026-02-06",
                  sics: ["5961"],
                },
              },
            ],
          },
          aggregations: { sic_filter: { buckets: [{ key: "7372", doc_count: 2 }] } },
        }),
        { status: 200, headers: { "content-type": "application/json" } }
      )
    ) as unknown as typeof fetch;

    const out = await fetchDisclosure("Anthropic", "Anthropic");
    expect(out.ok).toBe(true);
    const row = out.records[0];
    expect(row.filings).toBe(3);
    expect(row.bySic[0].label).toBe("Prepackaged software");
    // The double space in EDGAR's display name is collapsed for reading.
    expect(row.examples[0].company).toBe("AMAZON COM INC (AMZN)");
    expect(row.examples[0].url).toContain("/Archives/edgar/data/1018724/");
  });

  it("treats a 429 as rate limiting, not as an error to retry blindly", async () => {
    globalThis.fetch = vi.fn(async () =>
      new Response("", { status: 429 })
    ) as unknown as typeof fetch;
    const out = await fetchDisclosure("Anthropic", "Anthropic");
    expect(out.status).toBe("rate_limited");
  });
});
