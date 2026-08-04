// SEC EDGAR full-text search connector.
//
// The one source in this build that measures adoption rather than modelling
// it. EDGAR's full-text index answers "which registrants name this vendor in
// this form type", and returns, per hit, the company, its CIK, the filing
// date, its SIC industry code and its state — plus a native aggregation over
// SIC, which is the industry breakdown this product wants without us having
// to bucket anything ourselves.
//
// Verified against the live endpoint on 4 August 2026: a 10-K search for
// Anthropic returned 56 filings, top industry 7372 (prepackaged software)
// with 17; OpenAI returned 181; Google Cloud 877. Those differences are real
// and mostly reflect how long each vendor has existed and how deeply it is
// embedded in other people's products — which is why this is published as a
// disclosure count with that caveat attached, and never as market share.

import { SEC_EDGAR, sicLabel } from "./sources";
import type { ConnectorHealth, DisclosureRow, FetchOutcome } from "./types";

const EFTS = "https://efts.sec.gov/LATEST/search-index";
const TIMEOUT_MS = 12_000;

/**
 * SEC fair access asks callers to identify themselves. This is not a secret,
 * so it has a working default; set SEC_USER_AGENT to a real contact address
 * in production, which is what the SEC asks for.
 */
function userAgent(): string {
  return (
    process.env.SEC_USER_AGENT ??
    "AI-Enterprise-Demo (contact: set SEC_USER_AGENT)"
  );
}

interface EftsHit {
  _id: string;
  _source: {
    ciks?: string[];
    display_names?: string[];
    file_date?: string;
    sics?: string[];
    adsh?: string;
  };
}

interface EftsResponse {
  hits?: { total?: { value?: number }; hits?: EftsHit[] };
  aggregations?: {
    sic_filter?: { buckets?: { key: string; doc_count: number }[] };
  };
}

/**
 * The EDGAR document URL for a hit.
 *
 * The `_id` is "<accession>:<file>", and the archive path wants the accession
 * with its dashes stripped. Built here rather than in the view so a row can be
 * spot-checked from the API response alone.
 */
function filingUrl(id: string, cik: string): string | null {
  const [accession, file] = id.split(":");
  if (!accession) return null;
  const bare = accession.replace(/-/g, "");
  const trimmedCik = cik.replace(/^0+/, "");
  return `https://www.sec.gov/Archives/edgar/data/${trimmedCik}/${bare}/${file ?? ""}`;
}

/**
 * The default window, in days.
 *
 * EDGAR's full-text index reaches back to 2001, and an unbounded count is
 * badly misleading: the first Google Cloud example an unbounded search
 * returned was a 2018 filing, which says nothing about who is buying now.
 * Bounding to the last twelve months turns "ever mentioned" into "named in a
 * current annual report", which is the question a buyer is actually asking.
 * Anthropic's 10-K count falls from 56 all-time to 36 in the last year.
 */
const DEFAULT_WINDOW_DAYS = 365;

/**
 * One vendor's disclosure footprint for one form type, within a window.
 *
 * `deadline` is a signal shared across a whole ingestion run. Without it, eight
 * vendors each with their own 12-second timeout can hold a browser-facing
 * request open for over ninety seconds — the per-request timeout bounds one
 * call, not the run. The route passes one deadline for all eight.
 */
export async function fetchDisclosure(
  term: string,
  vendor: string,
  formType = "10-K",
  windowDays = DEFAULT_WINDOW_DAYS,
  deadline?: AbortSignal
): Promise<FetchOutcome<DisclosureRow>> {
  const params = new URLSearchParams();
  // The quotes matter: an unquoted multi-word term matches either word and
  // would turn "Google Cloud" into every filing mentioning Google.
  params.set("q", `"${term}"`);
  params.set("forms", formType);
  const from = new Date(Date.now() - windowDays * 86_400_000)
    .toISOString()
    .slice(0, 10);
  const to = new Date().toISOString().slice(0, 10);
  params.set("startdt", from);
  params.set("enddt", to);
  const url = `${EFTS}?${params.toString()}`;
  const fetchedAt = new Date().toISOString();

  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), TIMEOUT_MS);
  // A run-level deadline aborts this call too, so one slow vendor cannot
  // consume the whole budget and leave the rest queued behind it.
  const onDeadline = () => controller.abort();
  deadline?.addEventListener("abort", onDeadline, { once: true });
  try {
    if (deadline?.aborted) {
      return {
        ok: false,
        status: "error",
        records: [],
        fetchedAt,
        sourceUrl: url,
        error: "run deadline reached before this vendor was queried",
      };
    }
    const res = await fetch(url, {
      signal: controller.signal,
      headers: { "user-agent": userAgent(), accept: "application/json" },
      cache: "no-store",
    });
    if (res.status === 429) {
      return {
        ok: false,
        status: "rate_limited",
        records: [],
        fetchedAt,
        sourceUrl: url,
        error: "SEC rate limit reached",
      };
    }
    if (!res.ok) {
      return {
        ok: false,
        status: "error",
        records: [],
        fetchedAt,
        sourceUrl: url,
        error: `HTTP ${res.status}`,
      };
    }
    // Only a JSON answer counts as data. SEC serves an HTML interstitial with
    // a 200 to traffic it does not like, and res.ok alone would let that
    // through to be parsed as an empty result and rendered as zero adoption.
    // The same rule the BoardRadar proxy already enforces (ASSUMPTIONS #20).
    const contentType = res.headers.get("content-type") ?? "";
    if (!contentType.includes("json")) {
      return {
        ok: false,
        status: "error",
        records: [],
        fetchedAt,
        sourceUrl: url,
        error: `Expected JSON, got ${contentType || "no content-type"} — SEC may be refusing this User-Agent`,
      };
    }
    const body = (await res.json()) as EftsResponse;
    const total = body.hits?.total?.value ?? 0;
    const buckets = body.aggregations?.sic_filter?.buckets ?? [];
    const hits = body.hits?.hits ?? [];

    const row: DisclosureRow = {
      vendor,
      filings: total,
      bySic: buckets.slice(0, 8).map((b) => ({
        sic: b.key,
        label: sicLabel(b.key),
        filings: b.doc_count,
      })),
      examples: hits.slice(0, 5).map((h) => {
        const cik = h._source.ciks?.[0] ?? "";
        return {
          // "AMAZON COM INC  (AMZN)  (CIK 0001018724)" collapses its double
          // spaces here so the name reads properly in a table.
          company: (h._source.display_names?.[0] ?? "Unknown").replace(/\s{2,}/g, " "),
          cik,
          filedOn: h._source.file_date ?? "",
          sic: h._source.sics?.[0] ?? "",
          url: filingUrl(h._id, cik) ?? "",
        };
      }),
      query: `"${term}" in ${formType}, filed ${from} to ${to}`,
    };
    return { ok: true, status: "ok", records: [row], fetchedAt, sourceUrl: url };
  } catch (e) {
    return {
      ok: false,
      status: "error",
      records: [],
      fetchedAt,
      sourceUrl: url,
      error: e instanceof Error ? e.message : "network error",
    };
  } finally {
    clearTimeout(timer);
    deadline?.removeEventListener("abort", onDeadline);
  }
}

export function edgarHealth(): ConnectorHealth {
  return {
    id: SEC_EDGAR.id,
    label: SEC_EDGAR.name,
    // No key means no unconfigured state: this connector can always try.
    status: "ok",
    configured: true,
    message: process.env.SEC_USER_AGENT
      ? undefined
      : "Running with a default User-Agent; set SEC_USER_AGENT to a contact address for production courtesy.",
    source: SEC_EDGAR,
  };
}
