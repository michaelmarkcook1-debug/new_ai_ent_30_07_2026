import { PageHeader } from "@/lib/ui/page";
import { loadFeed, UNIVERSE_TICKERS } from "./data";
import { AieFeed } from "./components/aie-feed";
import { CompanyNewsSection } from "./components/company-news";

export const metadata = { title: "News | New AI.Ent" };

export default function NewsFeedPage() {
  const { items, meta } = loadFeed();
  return (
    <>
      <PageHeader
        title="News"
        subtitle="The full AI-market news feed in the AIE Brief style, filterable by topic and timeframe, with live per-company news for the BoardRadar universe below."
        lanes={["aie", "live"]}
      />
      <div className="space-y-5">
        <AieFeed items={items} meta={meta} />
        <CompanyNewsSection universe={UNIVERSE_TICKERS} />
      </div>
    </>
  );
}
