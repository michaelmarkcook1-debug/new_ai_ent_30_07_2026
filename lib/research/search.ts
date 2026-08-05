// Web search, so a company outside the SEC's reach can still be researched
// from something other than a model's memory.
//
// The product's rule does not soften because the subject is now an arbitrary
// company. A figure still has to come from a named source a reader can open.
// What changes is where the source comes from: filings and BoardRadar where
// they exist, and cited web results where they do not.
//
// So this returns snippets with their URLs, and nothing else. It does not
// summarise, rank by opinion, or decide what is true. The caller passes the
// snippets to the analyst model as grounding, and the same numeric and entity
// guards that police every other written surface police this one too. A figure
// the search results did not contain cannot reach the page.
//
// Provider-agnostic on purpose. Tavily and Brave are both supported because
// the choice is an operational one and should not be baked into the callers;
// whichever key is present is the one used.

export type SearchProvider = "tavily" | "brave" | "none";

export interface SearchHit {
  title: string;
  url: string;
  /** The passage the provider returned. Never rewritten here. */
  snippet: string;
  /** Publication date when the provider supplies one. */
  publishedAt: string | null;
}

export interface SearchResult {
  hits: SearchHit[];
  provider: SearchProvider;
  /** Set when no search ran, so a caller can say why rather than say nothing. */
  unavailable: string | null;
}

const TIMEOUT_MS = 15_000;
const TTL_MS = 6 * 60 * 60 * 1000;

const cache = new Map<string, { value: SearchResult; at: number }>();

export function searchProvider(): SearchProvider {
  if (process.env.TAVILY_API_KEY?.trim()) return "tavily";
  if (process.env.BRAVE_SEARCH_API_KEY?.trim()) return "brave";
  return "none";
}

export const searchAvailable = (): boolean => searchProvider() !== "none";

const empty = (why: string): SearchResult => ({
  hits: [],
  provider: "none",
  unavailable: why,
});

interface TavilyResponse {
  results?: {
    title?: string;
    url?: string;
    content?: string;
    published_date?: string;
  }[];
}

interface BraveResponse {
  web?: {
    results?: {
      title?: string;
      url?: string;
      description?: string;
      age?: string;
    }[];
  };
}

async function tavily(query: string, max: number): Promise<SearchHit[]> {
  const res = await fetch("https://api.tavily.com/search", {
    method: "POST",
    headers: {
      "content-type": "application/json",
      authorization: `Bearer ${process.env.TAVILY_API_KEY}`,
    },
    body: JSON.stringify({
      query,
      max_results: max,
      // Longer passages, because a snippet too short to carry a figure and its
      // context is worse than useless: it invites the model to fill the gap.
      search_depth: "advanced",
      include_answer: false,
    }),
    signal: AbortSignal.timeout(TIMEOUT_MS),
  });
  if (!res.ok) return [];
  const body = (await res.json()) as TavilyResponse;
  return (body.results ?? [])
    .filter((r) => r.url && r.content)
    .map((r) => ({
      title: r.title ?? r.url ?? "",
      url: r.url as string,
      snippet: r.content as string,
      publishedAt: r.published_date ?? null,
    }));
}

async function brave(query: string, max: number): Promise<SearchHit[]> {
  const url = new URL("https://api.search.brave.com/res/v1/web/search");
  url.searchParams.set("q", query);
  url.searchParams.set("count", String(max));
  const res = await fetch(url, {
    headers: {
      accept: "application/json",
      "x-subscription-token": process.env.BRAVE_SEARCH_API_KEY ?? "",
    },
    signal: AbortSignal.timeout(TIMEOUT_MS),
  });
  if (!res.ok) return [];
  const body = (await res.json()) as BraveResponse;
  return (body.web?.results ?? [])
    .filter((r) => r.url && r.description)
    .map((r) => ({
      title: r.title ?? r.url ?? "",
      url: r.url as string,
      snippet: r.description as string,
      publishedAt: r.age ?? null,
    }));
}

export async function webSearch(
  query: string,
  max = 6
): Promise<SearchResult> {
  const provider = searchProvider();
  if (provider === "none") {
    return empty(
      "No web search provider is configured, so nothing outside the filings and the tracked dataset was searched."
    );
  }

  const key = `${provider}:${max}:${query.toLowerCase()}`;
  const hit = cache.get(key);
  if (hit && Date.now() - hit.at < TTL_MS) return hit.value;

  try {
    const hits =
      provider === "tavily"
        ? await tavily(query, max)
        : await brave(query, max);
    const value: SearchResult =
      hits.length > 0
        ? { hits, provider, unavailable: null }
        : empty("The search returned no usable result for this company.");
    cache.set(key, { value, at: Date.now() });
    return value;
  } catch {
    // A search that fails is an absence, never a reason to guess.
    return empty("The web search did not respond, so nothing was retrieved.");
  }
}

/**
 * The passages, formatted for grounding, each carrying the URL it came from.
 *
 * Numbered so the model can cite by index, and passed verbatim so the guard
 * has the exact text to check any figure against.
 */
export function groundingBlock(hits: SearchHit[]): string {
  return hits
    .map(
      (h, i) =>
        `[${i + 1}] ${h.title}${h.publishedAt ? ` (${h.publishedAt})` : ""}\n${h.url}\n${h.snippet}`
    )
    .join("\n\n");
}
