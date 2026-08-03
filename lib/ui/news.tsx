"use client";

import { useState } from "react";
import { CategoryChip, SentimentPill } from "@/lib/ui/badges";

export interface NewsItem {
  headline: string;
  summary?: string;
  sourceDomain: string;
  date: string;
  url?: string | null;
  tags?: string[];
  sentiment?: "Positive" | "Negative" | "Neutral";
}

// News list: source favicon, headline, one-line summary, source domain and
// date, topic tag chips, sentiment pill, per-list timeframe dropdown.
export function NewsList({
  items,
  title,
  badge,
  timeframes = ["This Month", "This Quarter"],
}: {
  items: NewsItem[];
  title: string;
  badge?: React.ReactNode;
  timeframes?: string[];
}) {
  const [timeframe, setTimeframe] = useState(timeframes[0]);
  return (
    <section className="rounded-lg border border-base-300 bg-base-100">
      <div className="flex flex-wrap items-center justify-between gap-2 border-b border-base-300 px-3 py-2.5">
        <div className="flex flex-wrap items-center gap-2">
          <h3 className="text-sm font-bold">{title}</h3>
          {badge}
        </div>
        <select
          aria-label="Timeframe"
          value={timeframe}
          onChange={(e) => setTimeframe(e.target.value)}
          className="max-w-full rounded border border-base-300 bg-base-100 px-1.5 py-0.5 text-xs text-muted"
        >
          {timeframes.map((t) => (
            <option key={t}>{t}</option>
          ))}
        </select>
      </div>
      <ul className="divide-y divide-base-300">
        {items.length === 0 ? (
          <li className="px-3 py-4 text-sm text-muted">
            No items in this timeframe.
          </li>
        ) : (
          items.map((n, i) => (
            <li key={i} className="px-3 py-3">
              <div className="flex items-start gap-2">
                <img
                  src={`/api/favicon?domain=${encodeURIComponent(n.sourceDomain)}`}
                  alt=""
                  width={14}
                  height={14}
                  className="mt-0.5 rounded-sm"
                />
                <div className="min-w-0 flex-1">
                  {n.url ? (
                    <a
                      href={n.url}
                      target="_blank"
                      rel="noreferrer"
                      className="text-sm font-medium leading-snug hover:text-primary"
                    >
                      {n.headline}
                    </a>
                  ) : (
                    <span className="measure text-sm font-medium leading-snug">{n.headline}</span>
                  )}
                  {n.summary ? (
                    <p className="mt-0.5 truncate text-xs text-muted">{n.summary}</p>
                  ) : null}
                  <div className="mt-1 flex flex-wrap items-center gap-1.5">
                    <span className="break-all font-mono text-xs text-muted">
                      {n.sourceDomain} · {n.date}
                    </span>
                    {(n.tags ?? []).map((t) => (
                      <CategoryChip key={t} label={t} />
                    ))}
                    {n.sentiment ? <SentimentPill sentiment={n.sentiment} /> : null}
                  </div>
                </div>
              </div>
            </li>
          ))
        )}
      </ul>
    </section>
  );
}
