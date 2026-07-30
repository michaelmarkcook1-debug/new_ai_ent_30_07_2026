import { PageHeader } from "@/lib/ui/page";
import { PROBED_TICKERS, privateVendorCards } from "./data";
import { LiveTickers } from "./components/live-tickers";
import { PrivateCompanyCards } from "./components/private-cards";

export const metadata = { title: "Financial Snapshot | New AI.Ent" };

export default function FinancialSnapshotPage() {
  const cards = privateVendorCards();
  return (
    <>
      <PageHeader
        title="Financial Snapshot"
        subtitle="AI vendor financials on two honest lanes: live BoardRadar figures for the probed public tickers, and disclosed-figures-only cards for the private AI companies. When markets cross the chasm, buyers follow the herd: this page shows who is growing and where, without inventing a single number."
        lanes={["live", "aie"]}
      />
      <div className="space-y-6">
        <LiveTickers tickers={PROBED_TICKERS} />
        <PrivateCompanyCards cards={cards} />
      </div>
    </>
  );
}
