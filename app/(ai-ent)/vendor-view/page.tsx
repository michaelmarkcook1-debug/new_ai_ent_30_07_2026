import { PageHeader } from "@/lib/ui/page";
import { buildRankingRows, datasetDate, SCORE_COLUMNS } from "./data";
import { RankingsTable } from "./components/rankings-table";
import { AnalystInsight } from "@/lib/ui/analyst-insight";
import { vendorViewInsight, pickNews } from "@/lib/analyst/insight";
import { authorInsight } from "@/lib/analyst/author";
import { loadMarketMetrics } from "@/lib/market-metrics";
import { analystNews } from "@/lib/analyst/news-source";

// The Analyst Insight is a pure function of this page's data, so it only says
// something new when an input changes. News is the input that moves daily, and
// it is now fetched at render rather than baked in, so the page is regenerated
// once a day to pick it up.
export const revalidate = 86400;

export const metadata = { title: "Vendor View | AI Enterprise" };

export default async function VendorViewPage() {
  const news = await analystNews();
  const rows = buildRankingRows();
  const m = await loadMarketMetrics();
  const insight = vendorViewInsight(
    m,
    pickNews(news.items, { categories: ["Market movement", "Product launch"] })
  );

  const written = await authorInsight(insight, "vendor ranking");


  return (
    <>
      <PageHeader
        title="Vendor View"
        subtitle="The tracked enterprise AI vendor set as an evidence table, ranked within each market category and never across one. One named score per column, the derivation one click away, rows open the full vendor profile."
        lanes={["aie"]}
      />
      <AnalystInsight
        insight={written.value}
        authorship={written.authorship}
        context="vendor ranking"
      />
      <RankingsTable rows={rows} generatedOn={datasetDate()} columns={SCORE_COLUMNS} />
    </>
  );
}
