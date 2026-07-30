import { INTELLIGENCE_VENDORS, NEWS_ITEMS } from "@/lib/aie";

// Module data adapter: the News feed is PORT lane (the structured AIE seed
// news dataset, 30 items) plus a probed LIVE section (per-company BoardRadar
// news fetched client-side through the proxy). Everything here is computed
// server-side so client components receive plain serializable props.

export interface FeedItem {
  id: string;
  title: string;
  summary: string;
  whyItMatters: string;
  // Native dataset label, kept verbatim (includes the dataset's own [MOCK]
  // marker; the seed labels itself as mock pending live ingestion).
  sourceName: string;
  date: string;
  dateMs: number;
  tags: string[];
  vendors: string[];
  sentiment: "positive" | "negative" | "neutral" | "mixed";
  impactScore: number;
  confidenceScore: number;
}

export interface FeedMeta {
  windowStart: string;
  windowEnd: string;
  itemCount: number;
  topics: { tag: string; count: number }[];
}

const VENDOR_NAME_BY_ID = new Map(INTELLIGENCE_VENDORS.map((v) => [v.id, v.name]));

// Seed news rows reference vendors as "vendor_<id>"; resolve the display
// name from the canonical roster, falling back to a capitalized id.
function vendorDisplay(rawId: string): string {
  const id = rawId.replace(/^vendor_/, "");
  const known = VENDOR_NAME_BY_ID.get(id);
  if (known) return known;
  return id.charAt(0).toUpperCase() + id.slice(1);
}

const DATE_FMT = new Intl.DateTimeFormat("en-GB", {
  day: "numeric",
  month: "short",
  year: "numeric",
});

export function loadFeed(): { items: FeedItem[]; meta: FeedMeta } {
  const items: FeedItem[] = NEWS_ITEMS.map((n) => {
    const d = new Date(n.publishedAt);
    return {
      id: n.id,
      title: n.title,
      summary: n.summary,
      whyItMatters: n.whyItMatters,
      sourceName: n.sourceName,
      date: DATE_FMT.format(d),
      dateMs: d.getTime(),
      tags: [...n.categories],
      vendors: n.vendors.map(vendorDisplay),
      sentiment: n.sentiment,
      impactScore: n.impactScore,
      confidenceScore: n.confidenceScore,
    };
  }).sort((a, b) => b.dateMs - a.dateMs);

  const counts = new Map<string, number>();
  for (const item of items) {
    for (const t of item.tags) counts.set(t, (counts.get(t) ?? 0) + 1);
  }
  const topics = [...counts.entries()]
    .map(([tag, count]) => ({ tag, count }))
    .sort((a, b) => b.count - a.count || a.tag.localeCompare(b.tag));

  return {
    items,
    meta: {
      windowStart:
        items.length > 0 ? DATE_FMT.format(new Date(items[items.length - 1].dateMs)) : "",
      windowEnd: items.length > 0 ? DATE_FMT.format(new Date(items[0].dateMs)) : "",
      itemCount: items.length,
      topics,
    },
  };
}

// BoardRadar universe companies offered in the live company-news selector.
// This is the probed coverage set from DATA_COVERAGE.md; /news requires a
// companyId, which the client resolves from /companies at runtime.
export const UNIVERSE_TICKERS: { ticker: string; label: string }[] = [
  { ticker: "MSFT", label: "Microsoft" },
  { ticker: "GOOGL", label: "Google Cloud" },
  { ticker: "AMZN", label: "Amazon Web Services" },
  { ticker: "IBM", label: "IBM" },
  { ticker: "ORCL", label: "Oracle" },
  { ticker: "CRM", label: "Salesforce" },
  { ticker: "NOW", label: "ServiceNow" },
  { ticker: "SAP", label: "SAP" },
  { ticker: "ADBE", label: "Adobe" },
  { ticker: "CSCO", label: "Cisco" },
  { ticker: "DELL", label: "Dell Technologies" },
  { ticker: "BABA", label: "Alibaba Cloud" },
];
