import { PageHeader } from "@/lib/ui/page";
import { loadFeed, UNIVERSE_TICKERS } from "./data";
import { AieFeed } from "./components/aie-feed";
import { CompanyNewsSection } from "./components/company-news";
import { LiveFeed } from "./components/live-feed";

export const metadata = { title: "News | New AI.Ent" };

export default function NewsFeedPage() {
  const { items, meta } = loadFeed();
  return (
    <>
      <PageHeader
        title="News"
        subtitle="The live AI-market feed from the deployed AIE pipeline, the historical seed brief, and live per-company news for the BoardRadar universe."
        lanes={["aie-live", "aie", "live"]}
      />
      <div className="space-y-5">
        <LiveFeed />
        <AieFeed items={items} meta={meta} />
        <CompanyNewsSection universe={UNIVERSE_TICKERS} />
      </div>
    </>
  );
}
