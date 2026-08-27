import { PageHeader } from "@/lib/ui/page";
import { aieVendorRankings } from "./data";
import { loadProviderMatrix } from "./provider-matrix-data";
import { ProviderCapabilityMatrix } from "./components/provider-matrix";
import { CompetitiveHeatmap } from "./components/heatmap";
import { AieRankings } from "./components/aie-rankings";
import { AnalystInsight } from "@/lib/ui/analyst-insight";
import { competitiveInsight, pickNews } from "@/lib/analyst/insight";
import { authorInsight } from "@/lib/analyst/author";
import { enrichWithSynthesis, signalsFromMetrics } from "@/lib/analyst/cross";
import { loadMarketMetrics } from "@/lib/market-metrics";
import { analystNews } from "@/lib/analyst/news-source";

// The Analyst Insight is a pure function of this page's data, so it only says
// something new when an input changes. News is the input that moves daily, and
// it is now fetched at render rather than baked in, so the page is regenerated
// once a day to pick it up.
export const revalidate = 86400;

export const metadata = { title: "Competitive Intel | AI Enterprise" };

export default async function CompetitiveIntelPage({
  searchParams,
}: {
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}) {
  const news = await analystNews();
  const params = await searchParams;
  const raw = params.category;
  const categoryId = Array.isArray(raw) ? raw[0] : raw;
  const [matrix, rankings] = await Promise.all([
    loadProviderMatrix(categoryId),
    Promise.resolve(aieVendorRankings()),
  ]);

  const m = await loadMarketMetrics();
  const insight = competitiveInsight(
    m,
    pickNews(news.items, {
      categories: ["Product launch", "Market movement"],
      // The vendors this page covers, so the tie line can say whether the item
      // bears on the figures below or is market context.
      pageVendorIds: m.vendors.map((v) => v.id),
      vendorNames: new Map(m.vendors.map((v) => [v.id, v.name])),
    }),
    matrix.categoryName,
    matrix.capabilities.length,
    // The rows actually on screen. The insight used to name this category and
    // then quote a top and median computed across every tracked vendor.
    matrix.rows
  );

  // Cross-signal, from the metrics this page already loaded. Capability is
  // this page's own reading; the assessment's clearest lead and the risk
  // register are not, and a vendor that ranks well while carrying an open
  // finding is exactly the shortlist mistake this page can now flag.
  const { insight: crossed, synthesis, signals } = enrichWithSynthesis(
    insight,
    signalsFromMetrics(m)
  );

  const written = await authorInsight(
    crossed,
    "competitive",
    m.vendors.slice(0, 12).map((v) => v.name),
    null,
    { signals, synthesis }
  );


  return (
    <>
      {/* The subtitle said "the model providers" while the dropdown offered
          seven categories and the data covers thirteen, including silicon and
          compute. It now says what it shows. */}
      <PageHeader
        title="Competitive Intel"
        subtitle="Evidence-graded capability maturity, one market category at a time, beside the AIE live rankings. Ranked within a category, never across one."
        lanes={[matrix.lane, "live"]}
      />
      <AnalystInsight
        insight={written.value}
        authorship={written.authorship}
        context="competitive"
      />
      <div className="grid grid-cols-1 gap-4 @4xl:grid-cols-3">
        <div className="@container @4xl:col-span-2">
          <ProviderCapabilityMatrix matrix={matrix} />
        </div>
        <div className="@container @4xl:col-span-1">
          <AieRankings rows={rankings.rows} lane={rankings.lane} />
        </div>
      </div>

      {/* Secondary: the public-company view. Kept because it is real measured
          data, but demoted and labelled, because its universe is public
          companies (cloud units and integrators) and cannot reach the private
          model providers this page is about. */}
      <section className="mt-6 border-t-2 border-dashed border-[var(--ag-channel)] pt-4">
        <div className="flex flex-wrap items-center gap-2">
          <h2 className="text-base font-bold">Public-company view</h2>
          <span className="rounded-full bg-channel-bg px-2 py-0.5 font-mono text-xs font-bold uppercase tracking-wider text-channel">
            Delivery channel
          </span>
        </div>
        <p className="mt-1 measure text-sm text-muted">
          The BoardRadar competitive-intelligence heatmap covers listed
          companies, so its peer groups are cloud platforms and the systems
          integrators that deliver AI. It cannot reach OpenAI, Anthropic,
          Mistral or Cohere, which are private. Useful for the platform and
          channel picture, but it is not the model provider market and is never
          blended with the matrix above.
        </p>
        <div className="mt-3">
          <CompetitiveHeatmap />
        </div>
      </section>
    </>
  );
}
