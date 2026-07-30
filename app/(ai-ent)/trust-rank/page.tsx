import { PageHeader } from "@/lib/ui/page";
import {
  loadGrid,
  loadLensVendors,
  loadRegEvents,
  loadTrustRankFixture,
} from "./data";
import { TrustRankView } from "./components/trust-rank-view";

export const metadata = { title: "Trust Rank | New AI.Ent" };

export default async function TrustRankPage() {
  const fixture = await loadTrustRankFixture();
  return (
    <>
      <PageHeader
        title="Trust Rank"
        subtitle="The vendor-oriented view over AI legislation: a jurisdiction grid with a vendor lens, vendor-specific rulings, confidence-labelled regulatory events, and the governance-posture pattern for the selected vendor."
        lanes={["aie", "sample"]}
      />
      <TrustRankView
        vendors={loadLensVendors()}
        grid={loadGrid()}
        events={loadRegEvents()}
        postures={fixture.postures}
      />
    </>
  );
}
