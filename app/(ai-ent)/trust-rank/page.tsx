import { PageHeader } from "@/lib/ui/page";
import {
  loadGrid,
  loadLensVendors,
  loadRegEvents,
  loadGovernancePostures,
} from "./data";
import { TrustRankView } from "./components/trust-rank-view";

export const metadata = { title: "Trust Rank | AI Enterprise" };

export default async function TrustRankPage() {
  const postures = await loadGovernancePostures();
  return (
    <>
      <PageHeader
        title="Trust Rank"
        subtitle="The vendor-oriented view over AI legislation: a jurisdiction grid with a vendor lens, vendor-specific rulings, dated regulatory events, and the evidence-graded governance assessment for the selected vendor."
        lanes={["aie", postures.lane]}
      />
      <TrustRankView
        vendors={loadLensVendors()}
        grid={loadGrid()}
        events={loadRegEvents()}
        postures={postures}
      />
    </>
  );
}
