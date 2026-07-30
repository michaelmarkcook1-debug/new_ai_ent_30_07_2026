import { PageHeader } from "@/lib/ui/page";
import { buildRankingRows, datasetDate } from "./data";
import { RankingsTable } from "./components/rankings-table";

export const metadata = { title: "Vendor View | AI Enterprise" };

export default function VendorViewPage() {
  const rows = buildRankingRows();
  return (
    <>
      <PageHeader
        title="Vendor View"
        subtitle="The tracked enterprise AI vendor set as an evidence table: one named score per column, sortable, with the derivation one click away. Rows open the full vendor profile."
        lanes={["aie"]}
      />
      <RankingsTable rows={rows} generatedOn={datasetDate()} />
    </>
  );
}
