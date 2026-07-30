import { PageHeader } from "@/lib/ui/page";
import { getAlliancesData } from "./data";
import { AlliancesView } from "./components/alliances-view";

export const metadata = { title: "Alliances | AI Enterprise" };

// Alliances: the AIE alliances map. PORT lane; every edge is a native
// exposure-map record with its confidence tier and public sources.
export default function AlliancesPage() {
  const data = getAlliancesData();
  return (
    <>
      <PageHeader
        title="Alliances"
        subtitle="Who backs whom and who partners with whom across the AI supply side: the partnership and investment edges of the AIE exposure map, each with its native confidence tier, value note and public sources."
        lanes={["aie"]}
      />
      <AlliancesView data={data} />
    </>
  );
}
