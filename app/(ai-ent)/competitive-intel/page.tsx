import { PageHeader } from "@/lib/ui/page";
import { aieVendorRankings } from "./data";
import { CompetitiveHeatmap } from "./components/heatmap";
import { AieRankings } from "./components/aie-rankings";

export const metadata = { title: "Competitive Intel | AI Enterprise" };

export default function CompetitiveIntelPage() {
  const rankings = aieVendorRankings();
  return (
    <>
      <PageHeader
        title="Competitive Intel"
        subtitle="Competitive dynamics across the tracked companies: the live BoardRadar competitive-intelligence heatmap for a chosen peer group, beside the AIE dataset's vendor rankings. Intensity grids and confidence-labelled scores, never quadrants."
        lanes={["live", "aie"]}
      />
      <div className="grid grid-cols-1 gap-4 xl:grid-cols-3">
        <div className="xl:col-span-2">
          <CompetitiveHeatmap />
        </div>
        <div className="xl:col-span-1">
          <AieRankings rows={rankings} />
        </div>
      </div>
    </>
  );
}
