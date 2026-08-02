import { PageHeader } from "@/lib/ui/page";
import { loadFeed, UNIVERSE_TICKERS } from "./data";
import { AieFeed } from "./components/aie-feed";
import { CompanyNewsSection } from "./components/company-news";
import { LiveFeed } from "./components/live-feed";
import { AnalystInsight } from "@/lib/ui/analyst-insight";
import { newsInsight } from "@/lib/analyst/insight";
import newsFixture from "@/fixtures/aie-live/news.json";

export const metadata = { title: "News | AI Enterprise" };

export default async function NewsFeedPage() {
  const { items, meta } = loadFeed();
  const insight = newsInsight(newsFixture.news, null);

  return (
    <>
      <PageHeader
        title="News"
        subtitle="The live AI-market feed from the deployed AIE pipeline, the historical seed brief, and live per-company news for the BoardRadar universe."
        lanes={["aie-live", "aie", "live"]}
      />
      <AnalystInsight insight={insight} context="news" />
      <div className="space-y-5">
        <LiveFeed />
        <AieFeed items={items} meta={meta} />
        <CompanyNewsSection universe={UNIVERSE_TICKERS} />
      </div>
    </>
  );
}
