import { PageHeader } from "@/lib/ui/page";
import { loadFeed, UNIVERSE_TICKERS } from "./data";
import { AieFeed } from "./components/aie-feed";
import { CompanyNewsSection } from "./components/company-news";
import { LiveFeed } from "./components/live-feed";
import { AnalystInsight } from "@/lib/ui/analyst-insight";
import { newsInsight } from "@/lib/analyst/insight";
import { authorInsight } from "@/lib/analyst/author";
import { analystNews } from "@/lib/analyst/news-source";
import { readWatchState } from "@/lib/changes/watchlist";
// Ported from The Security Desk, 6 August 2026. The three feeds below all run
// on a weekly-ish clock or are keyed to a ticker; none of them answers what
// broke in the last few hours, which is the beat a CIO is asked about first.
import { DeskWire } from "./components/desk-wire";

// News is the fastest-moving input in the product, and the insight now reads
// the reader's watchlist to say which of the cycle touches them.
//
// Reading a cookie opts this route into dynamic rendering, so the daily
// `revalidate` it used to declare no longer applies and has been removed
// rather than left to imply a caching behaviour that is not happening. The
// expensive part is unaffected: analystNews() holds its own 24-hour cache, so
// per-request work is the render, not the 3.28MB pull. The Pulse made the same
// trade for the same reason.
export const metadata = { title: "News | AI Enterprise" };

export default async function NewsFeedPage() {
  const news = await analystNews();
  const { items, meta } = loadFeed();
  const watch = await readWatchState();
  const insight = newsInsight(news.items, null, watch.vendorIds);

  const written = await authorInsight(
    insight,
    "news",
    [...new Set(news.items.flatMap((n) => n.vendors ?? []))].slice(0, 14)
  );


  return (
    <>
      <PageHeader
        title="News"
        subtitle="Security and AI press read on this request, the live AI-market feed from the deployed AIE pipeline, the historical seed brief, and live per-company news for the BoardRadar universe."
        lanes={["live", "aie-live", "aie"]}
      />
      <AnalystInsight
        insight={written.value}
        authorship={written.authorship}
        context="news"
      />
      <div className="space-y-5">
        {/* Fastest clock first. */}
        <DeskWire />
        <LiveFeed />
        <AieFeed items={items} meta={meta} />
        <CompanyNewsSection universe={UNIVERSE_TICKERS} />
      </div>
    </>
  );
}
