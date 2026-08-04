import { PageHeader } from "@/lib/ui/page";
import { PROBED_TICKERS, privateVendorCards } from "./data";
import { loadRevenueView } from "./segment-data";
import { LiveTickers } from "./components/live-tickers";
import { PrivateCompanyCards } from "./components/private-cards";
import { AiRevenuePanel } from "./components/ai-revenue";
import { PrivateRevenuePanel } from "./components/private-revenue";
import { DisclosureLadder } from "./components/disclosure-ladder";
import {
  publicLadder,
  privateLadder,
  publicCoverage,
} from "@/lib/finance/disclosure-ladder";

export const metadata = { title: "Financial Snapshot | AI Enterprise" };

export default function FinancialSnapshotPage() {
  const cards = privateVendorCards();
  const revenue = loadRevenueView();
  // One ladder, read by both the summary panel and the private cards. The
  // cards used to show an empty state while a derived range sat above them.
  const publicRows = publicLadder(PROBED_TICKERS);
  const privateRows = privateLadder();
  return (
    <>
      <PageHeader
        title="Financial Snapshot"
        subtitle="AI vendor financials on two honest lanes: live BoardRadar figures for the probed public tickers, and disclosed-figures-only cards for the private AI companies. When markets cross the chasm, buyers follow the herd: this page shows who is growing and where, without inventing a single number."
        lanes={["live", "aie"]}
      />
      <div className="space-y-6">
        <AiRevenuePanel view={revenue} />
        <DisclosureLadder
          publicRows={publicRows}
          privateRows={privateRows}
          coverage={publicCoverage(PROBED_TICKERS)}
        />
        <LiveTickers tickers={PROBED_TICKERS} />
        <PrivateRevenuePanel
          vendors={cards.map((c) => ({ id: c.id, name: c.name }))}
        />
        <PrivateCompanyCards cards={cards} ladder={privateRows} />
      </div>
    </>
  );
}
