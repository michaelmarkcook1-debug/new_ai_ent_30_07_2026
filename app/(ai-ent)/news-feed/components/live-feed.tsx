"use client";

import { useEffect, useMemo, useState } from "react";
import { CategoryChip, LaneBadge, SentimentPill } from "@/lib/ui/badges";
import { DerivationDrawer } from "@/lib/ui/score";
import { MicroLabel } from "@/lib/ui/micro";
import { aieFetch, type AieNewsItem, type AieSource } from "@/lib/aie-live";

// Live AI-market feed pulled from the deployed AIE app's public news API
// through our proxy: current items with the pipeline's own impact and
// confidence labels. The seed brief below remains the historical record.

function sentimentBadge(s: string | null | undefined) {
  if (s === "positive") return <SentimentPill sentiment="Positive" />;
  if (s === "negative") return <SentimentPill sentiment="Negative" />;
  if (s === "neutral") return <SentimentPill sentiment="Neutral" />;
  return null;
}

function fmtDate(iso: string): string {
  try {
    return new Date(iso).toLocaleDateString("en-GB", {
      day: "numeric",
      month: "short",
      year: "numeric",
    });
  } catch {
    return iso;
  }
}

export function LiveFeed() {
  const [items, setItems] = useState<AieNewsItem[] | null>(null);
  const [source, setSource] = useState<AieSource>("live");
  const [failed, setFailed] = useState(false);
  const [category, setCategory] = useState<string | null>(null);
  const [vendor, setVendor] = useState<string>("all");

  useEffect(() => {
    let cancelled = false;
    aieFetch<{ news: AieNewsItem[] }>("news", { limit: "60" }).then((res) => {
      if (cancelled) return;
      setSource(res.source);
      if (res.ok && res.data?.news) setItems(res.data.news);
      else setFailed(true);
    });
    return () => {
      cancelled = true;
    };
  }, []);

  const categories = useMemo(() => {
    const counts = new Map<string, number>();
    for (const n of items ?? []) {
      for (const c of n.categories ?? []) {
        counts.set(c, (counts.get(c) ?? 0) + 1);
      }
    }
    return [...counts.entries()].sort((a, b) => b[1] - a[1]).slice(0, 8);
  }, [items]);

  const vendors = useMemo(() => {
    const set = new Set<string>();
    for (const n of items ?? []) for (const v of n.vendors ?? []) set.add(v);
    return [...set].sort();
  }, [items]);

  const filtered = useMemo(
    () =>
      (items ?? []).filter(
        (n) =>
          (category === null || n.categories?.includes(category)) &&
          (vendor === "all" || n.vendors?.includes(vendor))
      ),
    [items, category, vendor]
  );

  const lane = source === "mock" ? "mock" : "aie-live";

  return (
    <section className="rounded-lg border border-base-300 bg-base-100">
      <div className="flex flex-wrap items-center justify-between gap-2 border-b border-base-300 px-3 py-2">
        <div className="flex flex-wrap items-center gap-2">
          <h3 className="text-[13px] font-bold">Live AI-market feed</h3>
          <LaneBadge lane={lane} />
          <DerivationDrawer title="How the live feed is derived">
            <p>
              Items come from the deployed AI Enterprise app&apos;s public news
              API, pulled through our own proxy minutes ago. Its ingestion
              pipeline reads GDELT, vendor press releases, the AI press desks,
              SEC 8-K filings, expert newsletters and benchmark organisations,
              then labels each item with its own impact and confidence figures
              (0 to 100). Those labels pass through untouched: nothing here is
              scored by this product.
            </p>
            <p className="text-muted">
              When the live pull fails, the recorded response serves instead
              under a Cached sample badge; the historical seed brief below
              never changes.
            </p>
          </DerivationDrawer>
        </div>
        <select
          aria-label="Vendor filter"
          value={vendor}
          onChange={(e) => setVendor(e.target.value)}
          className="rounded border border-base-300 bg-base-100 px-1.5 py-0.5 text-[11px] text-muted"
        >
          <option value="all">All vendors</option>
          {vendors.map((v) => (
            <option key={v} value={v}>
              {v}
            </option>
          ))}
        </select>
      </div>

      {items && categories.length > 0 ? (
        <div className="flex flex-wrap items-center gap-1.5 border-b border-base-300 px-3 py-2">
          <MicroLabel
            label="Categories"
            tooltip="Category labels applied by the AIE pipeline. Pick one to filter."
          />
          <button
            type="button"
            onClick={() => setCategory(null)}
            className={`rounded-full border px-2 py-0.5 text-[10px] transition ${
              category === null
                ? "border-primary bg-primary text-white"
                : "border-base-300 text-muted hover:border-primary hover:text-primary"
            }`}
          >
            All
          </button>
          {categories.map(([c, count]) => (
            <button
              key={c}
              type="button"
              onClick={() => setCategory(category === c ? null : c)}
              className={`rounded-full border px-2 py-0.5 text-[10px] transition ${
                category === c
                  ? "border-primary bg-primary text-white"
                  : "border-base-300 text-muted hover:border-primary hover:text-primary"
              }`}
            >
              {c} ({count})
            </button>
          ))}
        </div>
      ) : null}

      <ul className="divide-y divide-base-300">
        {failed ? (
          <li className="px-3 py-4 text-[12px] text-muted">
            The live feed is unavailable and no recorded fixture answered; no
            items are shown rather than a guess.
          </li>
        ) : items === null ? (
          <li className="px-3 py-4 font-mono text-[11px] text-muted">
            Loading the live feed...
          </li>
        ) : filtered.length === 0 ? (
          <li className="px-3 py-4 text-[12px] text-muted">
            No items match this filter.
          </li>
        ) : (
          filtered.slice(0, 25).map((n) => (
            <li key={n.id} className="px-3 py-3">
              <div className="flex items-start justify-between gap-3">
                <a
                  href={n.sourceUrl}
                  target="_blank"
                  rel="noreferrer"
                  className="text-[13px] font-semibold leading-snug hover:text-primary"
                >
                  {n.title}
                </a>
                <span
                  className="shrink-0 font-mono text-[10px] text-muted"
                  title="The pipeline's own impact and confidence labels, 0 to 100."
                >
                  Impact {n.impactScore ?? "n/a"}
                </span>
              </div>
              <p className="mt-0.5 text-[12px] leading-snug text-base-content/85">{n.summary}</p>
              {n.whyItMatters ? (
                <p className="mt-1 text-[11px] leading-snug text-muted">
                  <span className="font-semibold">Why it matters:</span> {n.whyItMatters}
                </p>
              ) : null}
              <div className="mt-1.5 flex flex-wrap items-center gap-1.5">
                <span className="font-mono text-[10px] text-muted">
                  {n.sourceName} · {fmtDate(n.publishedAt)}
                </span>
                {(n.categories ?? []).slice(0, 3).map((c) => (
                  <CategoryChip key={c} label={c} />
                ))}
                {sentimentBadge(n.sentiment)}
              </div>
              {n.vendors && n.vendors.length > 0 ? (
                <p className="mt-1 text-[10px] text-muted">Vendors: {n.vendors.join(", ")}</p>
              ) : null}
            </li>
          ))
        )}
      </ul>
    </section>
  );
}
