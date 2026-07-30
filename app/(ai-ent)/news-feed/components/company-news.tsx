"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { brFetch, type BrSource } from "@/lib/br-client";
import { LaneBadge, SentimentPill } from "@/lib/ui/badges";
import { MicroLabel } from "@/lib/ui/micro";
import type { UNIVERSE_TICKERS } from "../data";

type UniverseCompany = (typeof UNIVERSE_TICKERS)[number];

interface CompaniesResponse {
  success: boolean;
  companies: { id: string; ticker: string | null; displayName: string }[];
}

interface Article {
  title: string;
  description?: string;
  summary?: string;
  source: string;
  date: string;
  sentiment?: { label?: string } | null;
}

interface NewsResponse {
  success: boolean;
  companyName?: string;
  articles: Article[];
}

const DATE_FMT = new Intl.DateTimeFormat("en-GB", {
  day: "numeric",
  month: "short",
  year: "numeric",
});

function domainOf(url: string): string | null {
  try {
    return new URL(url).hostname.replace(/^www\./, "");
  } catch {
    return null;
  }
}

function sentimentPill(label?: string | null) {
  if (label === "positive") return <SentimentPill sentiment="Positive" />;
  if (label === "negative") return <SentimentPill sentiment="Negative" />;
  if (label === "neutral") return <SentimentPill sentiment="Neutral" />;
  return null;
}

// One live per-company news panel. The parent resolves ticker to companyId
// from /companies; this panel fetches /news with that companyId.
function CompanyNewsPanel({
  universe,
  idByTicker,
  defaultTicker,
}: {
  universe: UniverseCompany[];
  idByTicker: Record<string, string>;
  defaultTicker: string;
}) {
  const [ticker, setTicker] = useState(defaultTicker);
  const [articles, setArticles] = useState<Article[] | null>(null);
  const [source, setSource] = useState<BrSource>("live");
  const [errorCode, setErrorCode] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);

  const companyId = idByTicker[ticker];
  const label = universe.find((u) => u.ticker === ticker)?.label ?? ticker;

  useEffect(() => {
    if (!companyId) {
      setLoading(false);
      setArticles(null);
      setErrorCode("NOT_IN_UNIVERSE");
      return;
    }
    let cancelled = false;
    setLoading(true);
    setErrorCode(null);
    setArticles(null);
    brFetch<NewsResponse>("news", { companyId }).then((res) => {
      if (cancelled) return;
      setLoading(false);
      setSource(res.source);
      if (res.ok && res.data?.articles) {
        setArticles(res.data.articles.slice(0, 8));
      } else {
        setErrorCode(res.errorCode ?? "UNKNOWN");
      }
    });
    return () => {
      cancelled = true;
    };
  }, [companyId]);

  return (
    <section className="rounded-lg border border-base-300 bg-base-100">
      <div className="flex items-center justify-between gap-2 border-b border-base-300 px-3 py-2">
        <div className="flex items-center gap-2">
          <h3 className="text-[13px] font-bold">{label} news</h3>
          <LaneBadge lane={source === "mock" ? "mock" : "live"} />
        </div>
        <select
          aria-label="Company"
          value={ticker}
          onChange={(e) => setTicker(e.target.value)}
          className="rounded border border-base-300 bg-base-100 px-1.5 py-0.5 text-[11px] text-muted"
        >
          {universe.map((u) => (
            <option key={u.ticker} value={u.ticker}>
              {u.label} ({u.ticker})
            </option>
          ))}
        </select>
      </div>
      {loading ? (
        <p className="px-3 py-6 text-center font-mono text-[11px] text-muted">
          Loading live news...
        </p>
      ) : errorCode ? (
        <p className="px-3 py-6 text-center font-mono text-[11px] text-muted">
          Live news unavailable ({errorCode}); nothing is shown rather than a
          guess.
        </p>
      ) : articles && articles.length > 0 ? (
        <ul className="divide-y divide-base-300">
          {articles.map((a, i) => {
            const domain = domainOf(a.source);
            const summary = a.summary || a.description || "";
            return (
              <li key={`${a.source}-${i}`} className="px-3 py-2.5">
                <div className="flex items-start gap-2">
                  {domain ? (
                    // eslint-disable-next-line @next/next/no-img-element
                    <img
                      src={`https://www.google.com/s2/favicons?domain=${domain}&sz=32`}
                      alt=""
                      width={14}
                      height={14}
                      className="mt-0.5 rounded-sm"
                    />
                  ) : (
                    <span className="mt-0.5 inline-block h-3.5 w-3.5 rounded-sm bg-base-200" />
                  )}
                  <div className="min-w-0 flex-1">
                    <a
                      href={a.source}
                      target="_blank"
                      rel="noreferrer"
                      className="text-[13px] font-medium leading-snug hover:text-primary"
                    >
                      {a.title}
                    </a>
                    {summary ? (
                      <p className="mt-0.5 truncate text-[11px] text-muted">{summary}</p>
                    ) : null}
                    <div className="mt-1 flex flex-wrap items-center gap-1.5">
                      <span className="font-mono text-[10px] text-muted">
                        {domain ?? "source"} · {DATE_FMT.format(new Date(a.date))}
                      </span>
                      {sentimentPill(a.sentiment?.label)}
                    </div>
                  </div>
                </div>
              </li>
            );
          })}
        </ul>
      ) : (
        <p className="px-3 py-6 text-center text-[12px] text-muted">
          No recent articles returned for this company.
        </p>
      )}
    </section>
  );
}

// LIVE company news for the BoardRadar universe: /companies is fetched once
// to resolve ticker to companyId, then each panel calls /news?companyId=.
export function CompanyNewsSection({ universe }: { universe: UniverseCompany[] }) {
  const [idByTicker, setIdByTicker] = useState<Record<string, string> | null>(null);
  const [source, setSource] = useState<BrSource>("live");
  const [errorCode, setErrorCode] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;
    brFetch<CompaniesResponse>("companies").then((res) => {
      if (cancelled) return;
      setSource(res.source);
      if (res.ok && res.data?.companies) {
        const map: Record<string, string> = {};
        for (const c of res.data.companies) {
          if (c.ticker) map[c.ticker] = c.id;
        }
        setIdByTicker(map);
      } else {
        setErrorCode(res.errorCode ?? "UNKNOWN");
      }
    });
    return () => {
      cancelled = true;
    };
  }, []);

  return (
    <section>
      <div className="mb-2 flex flex-wrap items-center gap-2">
        <MicroLabel
          label="Company news, BoardRadar universe"
          tooltip="Per-company news pulled live from BoardRadar. Ticker to companyId resolution happens against /companies at load time; sentiment labels are the API's own."
        />
        <LaneBadge lane={source === "mock" ? "mock" : "live"} />
      </div>
      <p className="mb-3 max-w-2xl text-[11px] text-muted">
        These panels cover companies in the BoardRadar universe, which is IT
        services first with the major AI platform players included. Private AI
        labs are not in this universe; their coverage lives in the AI market
        brief above.
      </p>
      {errorCode ? (
        <p className="rounded-lg border border-base-300 bg-base-100 px-3 py-6 text-center font-mono text-[11px] text-muted">
          Company resolution unavailable ({errorCode}); live news cannot be
          requested without a companyId.
        </p>
      ) : idByTicker === null ? (
        <p className="rounded-lg border border-base-300 bg-base-100 px-3 py-6 text-center font-mono text-[11px] text-muted">
          Resolving companies...
        </p>
      ) : (
        <div className="grid grid-cols-1 gap-4 lg:grid-cols-2">
          <CompanyNewsPanel
            universe={universe}
            idByTicker={idByTicker}
            defaultTicker="MSFT"
          />
          <CompanyNewsPanel
            universe={universe}
            idByTicker={idByTicker}
            defaultTicker="GOOGL"
          />
        </div>
      )}
      <div className="mt-3 text-right">
        <Link
          href="/vendor-view"
          className="text-[11px] font-semibold text-primary hover:underline"
        >
          Vendor profiles: Vendor View
        </Link>
      </div>
    </section>
  );
}
