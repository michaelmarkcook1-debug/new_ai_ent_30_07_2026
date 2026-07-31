import { PageHeader } from "@/lib/ui/page";
import { aieVendorRankings } from "./data";
import { loadProviderMatrix } from "./provider-matrix-data";
import { ProviderCapabilityMatrix } from "./components/provider-matrix";
import { CompetitiveHeatmap } from "./components/heatmap";
import { AieRankings } from "./components/aie-rankings";

export const metadata = { title: "Competitive Intel | AI Enterprise" };

export default async function CompetitiveIntelPage({
  searchParams,
}: {
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}) {
  const params = await searchParams;
  const raw = params.category;
  const categoryId = Array.isArray(raw) ? raw[0] : raw;
  const [matrix, rankings] = await Promise.all([
    loadProviderMatrix(categoryId),
    Promise.resolve(aieVendorRankings()),
  ]);

  return (
    <>
      <PageHeader
        title="Competitive Intel"
        subtitle="How the model providers compare: evidence-graded capability maturity across one market category at a time, beside the AIE vendor rankings. Intensity grids and confidence-labelled scores, never quadrants."
        lanes={[matrix.lane, "live"]}
      />
      <div className="grid grid-cols-1 gap-4 xl:grid-cols-3">
        <div className="xl:col-span-2">
          <ProviderCapabilityMatrix matrix={matrix} />
        </div>
        <div className="xl:col-span-1">
          <AieRankings rows={rankings} />
        </div>
      </div>

      {/* Secondary: the public-company view. Kept because it is real measured
          data, but demoted and labelled, because its universe is public
          companies (cloud units and integrators) and cannot reach the private
          model providers this page is about. */}
      <section className="mt-6 border-t-2 border-dashed border-[var(--ag-channel)] pt-4">
        <div className="flex flex-wrap items-center gap-2">
          <h2 className="text-[15px] font-bold">Public-company view</h2>
          <span className="rounded-full bg-channel-bg px-2 py-0.5 font-mono text-[9px] font-bold uppercase tracking-wider text-channel">
            Delivery channel
          </span>
        </div>
        <p className="mt-1 max-w-3xl text-[12px] text-muted">
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
