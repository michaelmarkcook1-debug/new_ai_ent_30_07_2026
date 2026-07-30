"use client";

import { useEffect, useState } from "react";
import { aieFetch, type AieNewsItem } from "@/lib/aie-live";
import { LaneBadge } from "@/lib/ui/badges";
import { NewsList, type NewsItem } from "@/lib/ui/news";
import type { AieSource } from "@/lib/aie-live";

// Live AI-market news for The Pulse, pulled from the deployed AIE app's
// public news API through our proxy. The sample strips remain the fallback
// when the pull fails outright.

function toNewsItem(n: AieNewsItem): NewsItem {
  let host = n.sourceName;
  try {
    host = new URL(n.sourceUrl).hostname.replace(/^www\./, "");
  } catch {
    // keep sourceName when the URL does not parse
  }
  const sentiment =
    n.sentiment === "positive" ? "Positive" : n.sentiment === "negative" ? "Negative" : "Neutral";
  return {
    headline: n.title,
    summary: n.summary,
    sourceDomain: host,
    date: new Date(n.publishedAt).toLocaleDateString("en-GB", { day: "numeric", month: "short", year: "numeric" }),
    url: n.sourceUrl,
    tags: n.categories.slice(0, 2),
    sentiment,
  };
}

export function PulseLiveNews({
  fallbackMarket,
  fallbackVendor,
  selectedVendorId,
  selectedVendorName,
}: {
  fallbackMarket: NewsItem[];
  fallbackVendor: NewsItem[];
  selectedVendorId: string;
  selectedVendorName: string;
}) {
  const [items, setItems] = useState<AieNewsItem[] | null>(null);
  const [source, setSource] = useState<AieSource>("live");

  useEffect(() => {
    let cancelled = false;
    aieFetch<{ news: AieNewsItem[] }>("news", { limit: "60" }).then((res) => {
      if (cancelled) return;
      setSource(res.source);
      if (res.ok && res.data?.news) setItems(res.data.news);
      else setItems(null);
    });
    return () => {
      cancelled = true;
    };
  }, []);

  const lane = source === "mock" ? "mock" : "aie-live";
  const market = items ? items.slice(0, 5).map(toNewsItem) : fallbackMarket;
  const vendor = items
    ? items
        .filter((n) => n.vendors?.includes(selectedVendorId))
        .slice(0, 5)
        .map(toNewsItem)
    : fallbackVendor;

  return (
    <section className="grid grid-cols-1 gap-4 lg:grid-cols-2">
      <NewsList
        title="Market news"
        items={market}
        badge={<LaneBadge lane={items ? lane : "sample"} />}
        timeframes={["Latest", "This Month"]}
      />
      <NewsList
        title={`${selectedVendorName} news`}
        items={vendor}
        badge={<LaneBadge lane={items ? lane : "sample"} />}
        timeframes={["Latest", "This Month"]}
      />
    </section>
  );
}
