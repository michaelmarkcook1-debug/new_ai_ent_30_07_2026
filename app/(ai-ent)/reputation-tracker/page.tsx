import { PageHeader } from "@/lib/ui/page";
import { loadThirdPartySignals } from "./third-party-data";
import { AiePillarsSection } from "./components/aie-pillars";
import { ReputationHistoryChart } from "./components/history-chart";
import { LiveUnifiedSection } from "./components/live-unified";
import { ThirdPartySignals } from "./components/third-party";

export const metadata = { title: "Reputation Tracker | AI Enterprise" };

export default async function ReputationTrackerPage() {
  const thirdParty = await loadThirdPartySignals();
  return (
    <>
      <PageHeader
        title="Reputation Tracker"
        subtitle="How the AI vendor set is perceived by the people who use it, build on it and work in it: three AIE reputation pillars, the live BoardRadar unified read for the platform players, and clearly separated third-party signals."
        lanes={["aie", "live", thirdParty.lane]}
      />
      <div className="space-y-4">
        <ReputationHistoryChart />
        <AiePillarsSection />
        <LiveUnifiedSection />
        <ThirdPartySignals view={thirdParty} />
      </div>
    </>
  );
}
