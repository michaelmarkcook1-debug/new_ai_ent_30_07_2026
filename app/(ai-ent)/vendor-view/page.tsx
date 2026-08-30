import { PageHeader } from "@/lib/ui/page";
import { buildRankingRows, datasetDate, SCORE_COLUMNS } from "./data";
import { RankingsTable } from "./components/rankings-table";
import { AnalystInsight } from "@/lib/ui/analyst-insight";
import { vendorViewInsight, pickNews } from "@/lib/analyst/insight";
import { authorInsight } from "@/lib/analyst/author";
import { pageQuestion } from "@/lib/analyst/question";
import { vendorComparableFacts } from "@/lib/analyst/insight";
import { groundedContext } from "@/lib/analyst/market-context";
import { enrichWithSynthesis, signalsFromMetrics } from "@/lib/analyst/cross";
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
    pickNews(news.items, {
      categories: ["Market movement", "Product launch"],
      // The vendors this page covers, so the tie line can say whether the item
      // bears on the figures below or is market context.
      pageVendorIds: m.vendors.map((v) => v.id),
      vendorNames: new Map(m.vendors.map((v) => [v.id, v.name])),
    })
  );

  // Cross-signal. Everything here is read off the MarketMetrics this page has
  // already fetched, so there is no extra call: the assessment says who leads
  // and the risk register says who is carrying an open finding, and those two
  // are never reconciled upstream. Where they disagree the finding becomes
  // evidence against, which contests the strength and can only weaken the
  // recommendation, never strengthen it.
  const { insight: crossed, synthesis, signals } = enrichWithSynthesis(
    insight,
    signalsFromMetrics(m)
  );

  const written = await authorInsight(
    crossed,
    "vendor ranking",
    // The vendors this page covers, all of them. This was sliced to the first 12
    // of 43, which is not a prompt-size saving (the full list is 410 characters)
    // and cost the page its analyst voice: the computed text names SAP, Google,
    // Groq and Lambda, all outside that slice, so the model quoting the page's
    // own reading was rejected for naming vendors "this page's data does not
    // cover" and the reader got the enumerated computed text instead.
    m.vendors.map((v) => v.name),
    null,
    { signals, synthesis }
  ,

    // The question this page answers, and the market context this reading
    // has earned. See lib/analyst/question.ts and market-context.ts: neither
    // adds a fetch, a dataset or a second model call.
    {
      question: pageQuestion("vendor-view"),
      context: groundedContext(m),
      comparable: vendorComparableFacts(m),
    }
  );


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
