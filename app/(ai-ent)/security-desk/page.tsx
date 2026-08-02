import { PageHeader } from "@/lib/ui/page";
import { loadLabPostures } from "./data";
import { CyberRiskPanel } from "./components/cyber-risk-panel";
import { LabsSection } from "./components/labs-section";
import { AnalystInsight } from "@/lib/ui/analyst-insight";
import { governanceInsight, pickNews } from "@/lib/analyst/insight";
import { loadMarketMetrics } from "@/lib/market-metrics";
import newsFixture from "@/fixtures/aie-live/news.json";

export const metadata = { title: "The Security Desk | AI Enterprise" };

export default async function SecurityDeskPage() {
  const labs = await loadLabPostures();
  const m = await loadMarketMetrics();
  const insight = governanceInsight(
    m,
    pickNews(newsFixture.news, { categories: ["Risk event", "Enterprise control"] }),
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
