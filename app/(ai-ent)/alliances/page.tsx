import { PageHeader } from "@/lib/ui/page";
import { getAlliancesData } from "./data";
import { AlliancesView } from "./components/alliances-view";
import { AnalystInsight } from "@/lib/ui/analyst-insight";
import { supplyMapInsight, pickNews } from "@/lib/analyst/insight";
import newsFixture from "@/fixtures/aie-live/news.json";

export const metadata = { title: "Alliances | AI Enterprise" };

// Alliances: the AIE alliances map. PORT lane; every edge is a native
// exposure-map record with its confidence tier and public sources.
export default async function AlliancesPage() {
  const data = getAlliancesData();
  const insight = supplyMapInsight(
    {
      edges: data.edges.length,
      verified: data.summary.byConfidence.high,
      seed: data.summary.byConfidence.seed,
      nodes: data.summary.vendorsCovered,
      label: "alliance",
    },
    pickNews(newsFixture.news, { categories: ["Partnership", "Strategy signal"] }),
    null
  );

  return (
    <>
      <PageHeader
        title="Alliances"
        subtitle="Who backs whom and who partners with whom across the AI supply side: the partnership and investment edges of the AIE exposure map, each with its native evidence tier, value note and public sources."
        lanes={["aie"]}
      />
      <AnalystInsight insight={insight} context="alliance" />
      <AlliancesView data={data} />
    </>
  );
}
