import { PageHeader } from "@/lib/ui/page";
import { loadFeed, UNIVERSE_TICKERS } from "./data";
import { AieFeed } from "./components/aie-feed";
import { CompanyNewsSection } from "./components/company-news";
import { LiveFeed } from "./components/live-feed";
import { AnalystInsight } from "@/lib/ui/analyst-insight";
import { newsInsight } from "@/lib/analyst/insight";
import { authorInsight } from "@/lib/analyst/author";
import { analystNews } from "@/lib/analyst/news-source";

// News is the fastest-moving input in the product, so this page and its
// insight are regenerated once a day rather than baked at build time.
export const revalidate = 86400;

export const metadata = { title: "News | AI Enterprise" };

export default async function NewsFeedPage() {
  const news = await analystNews();
  const { items, meta } = loadFeed();
  const insight = newsInsight(news.items, null);

  const written = await authorInsight(insight, "news");


  return (
    <>
      <PageHeader
        title="News"
        subtitle="The live AI-market feed from the deployed AIE pipeline, the historical seed brief, and live per-company news for the BoardRadar universe."
        lanes={["aie-live", "aie", "live"]}
      />
      <AnalystInsight
        insight={written.value}
        authorship={written.authorship}
        context="news"
      />
      <div className="space-y-5">
        <LiveFeed />
        <AieFeed items={items} meta={meta} />
        <CompanyNewsSection universe={UNIVERSE_TICKERS} />
      </div>
    </>
  );
}
