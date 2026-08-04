import { PageHeader } from "@/lib/ui/page";
import { buildRankingRows, datasetDate, SCORE_COLUMNS } from "./data";
import { RankingsTable } from "./components/rankings-table";
import { AnalystInsight } from "@/lib/ui/analyst-insight";
import { vendorViewInsight, pickNews } from "@/lib/analyst/insight";
import { loadMarketMetrics } from "@/lib/market-metrics";
import newsFixture from "@/fixtures/aie-live/news.json";

export const metadata = { title: "Vendor View | AI Enterprise" };

export default async function VendorViewPage() {
  const rows = buildRankingRows();
  const m = await loadMarketMetrics();
  const insight = vendorViewInsight(
    m,
    pickNews(newsFixture.news, { categories: ["Market movement", "Product launch"] })
  );

  return (
    <>
      <PageHeader
        title="Vendor View"
        subtitle="The tracked enterprise AI vendor set as an evidence table, ranked within each market category and never across one. One named score per column, the derivation one click away, rows open the full vendor profile."
        lanes={["aie"]}
      />
      <AnalystInsight insight={insight} context="vendor ranking" />
      <RankingsTable rows={rows} generatedOn={datasetDate()} columns={SCORE_COLUMNS} />
    </>
  );
}
