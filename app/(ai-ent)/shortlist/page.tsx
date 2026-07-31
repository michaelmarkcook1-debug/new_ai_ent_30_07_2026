import { PageHeader } from "@/lib/ui/page";
import { loadMarketMetrics } from "@/lib/market-metrics";
import { ShortlistView } from "./shortlist-view";

export const metadata = { title: "Shortlist | AI Enterprise" };

export default async function ShortlistPage() {
  const metrics = await loadMarketMetrics();
  return (
    <>
      <PageHeader
        title="Your shortlist"
        subtitle="The vendors you are considering, compared on the fields the datasets actually publish. Kept in this browser only, never sent anywhere."
        lanes={[metrics.lane]}
      />
      <ShortlistView vendors={metrics.vendors} />
    </>
  );
}
