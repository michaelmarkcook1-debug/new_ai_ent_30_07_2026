import { PageHeader } from "@/lib/ui/page";
import { loadLabPostures } from "./data";
import { CyberRiskPanel } from "./components/cyber-risk-panel";
import { LabsSection } from "./components/labs-section";
import { AnalystInsight } from "@/lib/ui/analyst-insight";
import { governanceInsight, pickNews } from "@/lib/analyst/insight";
import { loadMarketMetrics } from "@/lib/market-metrics";
import { analystNews } from "@/lib/analyst/news-source";

// The Analyst Insight is a pure function of this page's data, so it only says
// something new when an input changes. News is the input that moves daily, and
// it is now fetched at render rather than baked in, so the page is regenerated
// once a day to pick it up.
export const revalidate = 86400;

export const metadata = { title: "The Security Desk | AI Enterprise" };

export default async function SecurityDeskPage() {
  const news = await analystNews();
  const labs = await loadLabPostures();
  const m = await loadMarketMetrics();
  const insight = governanceInsight(
    m,
    pickNews(news.items, { categories: ["Risk event", "Enterprise control"] }),
    0,
    0,
    "security"
  );

  return (
    <>
      <PageHeader
        title="The Security Desk"
        subtitle="Cyber risk posture across the AI platform vendors: live BoardRadar incident analysis where coverage exists, honest empty states where it does not, and the AI Enterprise security capability assessment for the private labs BoardRadar does not reach."
        lanes={["live", labs.lane]}
      />
      <AnalystInsight insight={insight} context="security" />
      <div className="space-y-6">
        <CyberRiskPanel />
        <LabsSection view={labs} />
      </div>
    </>
  );
}
