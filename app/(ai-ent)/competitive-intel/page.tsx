import { PageHeader } from "@/lib/ui/page";
import { aieVendorRankings, loadCompetitiveIntelFixture } from "./data";
import { CompetitiveHeatmap } from "./components/heatmap";
import { AieRankings } from "./components/aie-rankings";

export const metadata = { title: "Competitive Intel | AI Enterprise" };

export default async function CompetitiveIntelPage() {
  const fixture = await loadCompetitiveIntelFixture();
  const rankings = aieVendorRankings();
  return (
    <>
      <PageHeader
        title="Competitive Intel"
        subtitle="Competitive dynamics across the tracked AI vendors: the BoardRadar heatmap pattern applied to AI-vendor sample content, beside the AIE dataset's vendor rankings. Intensity grids and confidence-labelled scores, never quadrants."
        lanes={["sample", "aie"]}
      />
      <div className="grid grid-cols-1 gap-4 xl:grid-cols-3">
        <div className="xl:col-span-2">
          <CompetitiveHeatmap fixture={fixture} />
        </div>
        <div className="xl:col-span-1">
          <AieRankings rows={rankings} />
        </div>
      </div>
    </>
  );
}
